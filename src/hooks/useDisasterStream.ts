import { useCallback, useEffect, useRef, useState } from 'react';
import { createEventSource, fetchEvents, fetchSourceStatuses, parseEventData, toDisasterEvent } from '../api';
import { INITIAL_EVENTS_FETCH_LIMIT } from '../config/appRuntime';
import type { DisasterEvent, EventLevels, EventMetric, SourceStatus } from '../types';
import { filterEventsByAge } from '../utils/eventFilters';
import { compareEventsByOccurrence, insertSorted } from '../utils/eventProcessing';
import { INITIAL_SOURCE_STATUSES } from '../utils/sourceStatuses';

type UseDisasterStreamOptions = {
  maxEventAgeMs: number;
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

export const useDisasterStream = ({ maxEventAgeMs, onAlertLevel }: UseDisasterStreamOptions) => {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [metrics, setMetrics] = useState<EventMetric[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>(INITIAL_SOURCE_STATUSES);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const knownEventCacheRef = useRef<Map<string, number>>(new Map());
  const onAlertLevelRef = useRef(onAlertLevel);

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
        pruneKnownEventCache(knownEventCache, now, maxEventAgeMs);
        return;
      }

      knownEventCache.set(mappedEvent.id, mappedEvent.timestamp);
      pruneKnownEventCache(knownEventCache, now, maxEventAgeMs);

      onAlertLevelRef.current(mappedEvent.level);

      setEvents((prev) => {
        if (hasItemId(prev, mappedEvent.id)) {
          return prev;
        }
        const next = insertSorted(prev, mappedEvent, compareEventsByOccurrence);
        const recent = filterEventsByAge(next, now, maxEventAgeMs);
        return recent;
      });

      setSourceStatuses((prev) => updateSourceStatuses(prev, mappedEvent, now));
    },
    [maxEventAgeMs],
  );

  useEffect(() => {
    setMetrics(events);
  }, [events]);

  useEffect(() => {
    let isActive = true;

    const loadInitialEvents = async (): Promise<InitialLoadResult | null> => {
      try {
        const now = Date.now();
        const eventsSince = new Date(now - maxEventAgeMs);

        const fetchedEvents = await fetchEvents({
          since: eventsSince,
          limit: INITIAL_EVENTS_FETCH_LIMIT,
        });

        const mapped: DisasterEvent[] = [];
        for (let i = 0; i < fetchedEvents.length; i += 1) {
          mapped.push(toDisasterEvent(fetchedEvents[i]));
        }
        mapped.sort(compareEventsByOccurrence);

        const knownEventCache = buildKnownEventCache(mapped);
        pruneKnownEventCache(knownEventCache, now, maxEventAgeMs);

        return {
          events: mapped,
          metrics: mapped,
          lastEventId: mapped.length > 0 ? mapped[0].id : null,
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
  }, [handleIncomingEvent, maxEventAgeMs]);

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
