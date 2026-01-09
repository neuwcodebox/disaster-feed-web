import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ApiEvent,
  type ApiEventMetric,
  createEventSource,
  fetchEventMetrics,
  fetchEvents,
  fetchSourceStatuses,
  parseEventData,
  toDisasterEvent,
  toEventMetric,
} from '../api';
import { EVENT_KIND_VALUES } from '../constants';
import type { DisasterEvent, EventLevels, EventMetric, SourceStatus } from '../types';
import { filterEventsByAge, filterMetricsByAge } from '../utils/eventFilters';
import {
  compareEventsByOccurrence,
  compareMetricsByOccurrence,
  insertSorted,
  limitEventsByCategory,
  toMetricFromEvent,
} from '../utils/eventProcessing';
import { INITIAL_SOURCE_STATUSES } from '../utils/sourceStatuses';

type UseDisasterStreamOptions = {
  maxEventAgeMs: number;
  metricsWindowMs: number;
  metricsFetchLimit: number;
  maxEventsPerCategory: number;
  onAlertLevel: (level: EventLevels) => void;
};

type InitialLoadResult = {
  events: DisasterEvent[];
  metrics: EventMetric[];
  lastEventId: string | null;
  knownEventCache: Map<string, number>;
};

const hasItemId = <T extends { id: string }>(items: T[], targetId: string): boolean => {
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].id === targetId) {
      return true;
    }
  }
  return false;
};

const mergeEvents = (allEvents: ApiEvent[], kindResults: PromiseSettledResult<ApiEvent[]>[]): ApiEvent[] => {
  const combined: ApiEvent[] = [];
  for (let i = 0; i < allEvents.length; i += 1) {
    combined.push(allEvents[i]);
  }
  for (let i = 0; i < kindResults.length; i += 1) {
    const result = kindResults[i];
    if (result.status === 'fulfilled') {
      for (let j = 0; j < result.value.length; j += 1) {
        combined.push(result.value[j]);
      }
    } else {
      console.warn('Failed to fetch events by kind', result.reason);
    }
  }
  return combined;
};

const buildKnownEventCache = (items: DisasterEvent[]): Map<string, number> => {
  const cache = new Map<string, number>();
  for (let i = 0; i < items.length; i += 1) {
    const event = items[i];
    cache.set(event.id, event.timestamp);
  }
  return cache;
};

const pruneKnownEventCache = (cache: Map<string, number>, now: number, maxAgeMs: number) => {
  if (maxAgeMs <= 0) {
    return;
  }
  const threshold = now - maxAgeMs;
  const staleIds: string[] = [];
  for (const [id, timestamp] of cache) {
    if (timestamp < threshold) {
      staleIds.push(id);
    }
  }
  for (let i = 0; i < staleIds.length; i += 1) {
    cache.delete(staleIds[i]);
  }
};

const dedupeAndMapEvents = (items: ApiEvent[]): DisasterEvent[] => {
  const mappedById = new Map<string, DisasterEvent>();
  for (let i = 0; i < items.length; i += 1) {
    const mappedEvent = toDisasterEvent(items[i]);
    const existing = mappedById.get(mappedEvent.id);
    if (!existing || mappedEvent.timestamp > existing.timestamp) {
      mappedById.set(mappedEvent.id, mappedEvent);
    }
  }
  return Array.from(mappedById.values());
};

const buildMetricsSeed = (
  metricsResults: PromiseSettledResult<ApiEventMetric[]>[],
  mappedEvents: DisasterEvent[],
): EventMetric[] => {
  const metricsSeed: EventMetric[] = [];
  let hasMetricsResponse = false;
  const missingMetricKinds: number[] = [];
  for (let i = 0; i < metricsResults.length; i += 1) {
    const result = metricsResults[i];
    const kind = EVENT_KIND_VALUES[i];
    if (result.status === 'fulfilled') {
      hasMetricsResponse = true;
      for (let j = 0; j < result.value.length; j += 1) {
        metricsSeed.push(toEventMetric(result.value[j]));
      }
    } else {
      missingMetricKinds.push(kind);
      console.warn('Failed to fetch event metrics by kind', kind, result.reason);
    }
  }
  if (!hasMetricsResponse) {
    for (let i = 0; i < mappedEvents.length; i += 1) {
      metricsSeed.push(toMetricFromEvent(mappedEvents[i]));
    }
  } else if (missingMetricKinds.length > 0) {
    const missingKindSet = new Set(missingMetricKinds);
    for (let i = 0; i < mappedEvents.length; i += 1) {
      const event = mappedEvents[i];
      if (missingKindSet.has(event.kind)) {
        metricsSeed.push(toMetricFromEvent(event));
      }
    }
  }
  return metricsSeed;
};

const updateSourceStatuses = (prev: SourceStatus[], event: DisasterEvent, now: number): SourceStatus[] => {
  const next = prev.slice();
  for (let i = 0; i < next.length; i += 1) {
    if (next[i].sourceId === event.sourceId) {
      next[i] = { ...next[i], isConnected: true, lastUpdate: now };
      return next;
    }
  }
  return [
    ...next,
    {
      sourceId: event.sourceId,
      name: event.source,
      isConnected: true,
      lastUpdate: now,
    },
  ];
};

export const useDisasterStream = ({
  maxEventAgeMs,
  metricsWindowMs,
  metricsFetchLimit,
  maxEventsPerCategory,
  onAlertLevel,
}: UseDisasterStreamOptions) => {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [metrics, setMetrics] = useState<EventMetric[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>(INITIAL_SOURCE_STATUSES);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const knownEventCacheRef = useRef<Map<string, number>>(new Map());
  const onAlertLevelRef = useRef(onAlertLevel);
  const maxKnownAgeMs = Math.max(maxEventAgeMs, metricsWindowMs);

  useEffect(() => {
    onAlertLevelRef.current = onAlertLevel;
  }, [onAlertLevel]);

  const handleIncomingEvent = useCallback(
    (message: MessageEvent<string>) => {
      const parsed = parseEventData(message.data);
      if (!parsed) {
        return;
      }

      const mappedEvent = toDisasterEvent(parsed, true);
      const eventId = message.lastEventId || parsed.id;
      if (eventId) {
        lastEventIdRef.current = eventId;
      }

      const now = Date.now();
      const knownEventCache = knownEventCacheRef.current;
      if (knownEventCache.has(mappedEvent.id)) {
        pruneKnownEventCache(knownEventCache, now, maxKnownAgeMs);
        return;
      }

      knownEventCache.set(mappedEvent.id, mappedEvent.timestamp);
      pruneKnownEventCache(knownEventCache, now, maxKnownAgeMs);

      onAlertLevelRef.current(mappedEvent.level);

      setEvents((prev) => {
        if (hasItemId(prev, mappedEvent.id)) {
          return prev;
        }
        const next = insertSorted(prev, mappedEvent, compareEventsByOccurrence);
        const recent = filterEventsByAge(next, now, maxEventAgeMs);
        return limitEventsByCategory(recent, maxEventsPerCategory);
      });

      const metric = toMetricFromEvent(mappedEvent);
      setMetrics((prev) => {
        if (hasItemId(prev, metric.id)) {
          return prev;
        }
        const next = insertSorted(prev, metric, compareMetricsByOccurrence);
        return filterMetricsByAge(next, now, metricsWindowMs);
      });

      setSourceStatuses((prev) => updateSourceStatuses(prev, mappedEvent, now));
    },
    [maxEventAgeMs, maxEventsPerCategory, maxKnownAgeMs, metricsWindowMs],
  );

  useEffect(() => {
    let isActive = true;

    const loadInitialEvents = async (): Promise<InitialLoadResult | null> => {
      try {
        const now = Date.now();
        const eventsSince = new Date(now - maxEventAgeMs);
        const metricsSince = new Date(now - metricsWindowMs);

        const allEventsPromise = fetchEvents({ since: eventsSince });

        const eventKindPromises: Promise<ApiEvent[]>[] = [];
        const metricKindPromises: Promise<ApiEventMetric[]>[] = [];
        for (let i = 0; i < EVENT_KIND_VALUES.length; i += 1) {
          const kind = EVENT_KIND_VALUES[i];
          eventKindPromises.push(fetchEvents({ kind, limit: maxEventsPerCategory, since: eventsSince }));
          metricKindPromises.push(fetchEventMetrics({ kind, limit: metricsFetchLimit, since: metricsSince }));
        }

        const [allEvents, eventsKindResults, metricsKindResults] = await Promise.all([
          allEventsPromise,
          Promise.allSettled(eventKindPromises),
          Promise.allSettled(metricKindPromises),
        ]);

        const combined = mergeEvents(allEvents, eventsKindResults);
        const mapped = dedupeAndMapEvents(combined);
        mapped.sort(compareEventsByOccurrence);
        const recent = filterEventsByAge(mapped, now, maxEventAgeMs);
        const limited = limitEventsByCategory(recent, maxEventsPerCategory);

        const metricsSeed = buildMetricsSeed(metricsKindResults, mapped);
        metricsSeed.sort(compareMetricsByOccurrence);

        const knownEventCache = buildKnownEventCache(recent);
        pruneKnownEventCache(knownEventCache, now, maxKnownAgeMs);

        return {
          events: limited,
          metrics: filterMetricsByAge(metricsSeed, now, metricsWindowMs),
          lastEventId: allEvents.length > 0 ? allEvents[0].id : null,
          knownEventCache,
        };
      } catch (error) {
        console.error(error);
        return null;
      }
    };

    const connectStream = (afterId?: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      const stream = createEventSource(afterId);
      eventSourceRef.current = stream;
      stream.onmessage = handleIncomingEvent;
    };

    const startStream = async () => {
      const initial = await loadInitialEvents();
      if (!isActive || !initial) {
        return;
      }
      setEvents(initial.events);
      setMetrics(initial.metrics);
      lastEventIdRef.current = initial.lastEventId;
      knownEventCacheRef.current = initial.knownEventCache;
      connectStream(lastEventIdRef.current ?? undefined);
    };

    void startStream();

    return () => {
      isActive = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [handleIncomingEvent, maxEventAgeMs, maxEventsPerCategory, metricsFetchLimit, metricsWindowMs, maxKnownAgeMs]);

  useEffect(() => {
    let isActive = true;

    const loadStatuses = async () => {
      try {
        const nextStatuses = await fetchSourceStatuses();
        if (isActive) {
          setSourceStatuses(nextStatuses);
        }
      } catch (error) {
        console.error(error);
        if (isActive) {
          setSourceStatuses((prev) => prev.map((status) => ({ ...status, isConnected: false })));
        }
      }
    };

    void loadStatuses();
    const intervalId = window.setInterval(() => {
      void loadStatuses();
    }, 20000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return { events, metrics, sourceStatuses };
};
