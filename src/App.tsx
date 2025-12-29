import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ApiEvent,
  createEventSource,
  fetchEventsByKind,
  fetchInitialEvents,
  fetchSourceStatuses,
  parseEventData,
  toDisasterEvent,
} from './api';
import CategoryGrid from './components/CategoryGrid';
import FooterMarquee from './components/FooterMarquee';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import {
  EVENT_KIND_VALUES,
  MAX_CATEGORIES_DISPLAY,
  SIDEBAR_MIN_LEVEL,
  SOURCE_DISPLAY_ORDER,
  STATUS_SOURCE_LABELS,
} from './constants';
import { type CategoryGroup, type DisasterEvent, EventLevels, type SourceStatus } from './types';

const createInitialSourceStatuses = (): SourceStatus[] => {
  const initial: SourceStatus[] = [];
  for (let i = 0; i < SOURCE_DISPLAY_ORDER.length; i += 1) {
    const sourceId = SOURCE_DISPLAY_ORDER[i];
    initial.push({
      sourceId,
      name: STATUS_SOURCE_LABELS[sourceId] ?? `#${sourceId}`,
      isConnected: false,
      lastUpdate: 0,
    });
  }
  return initial;
};

const INITIAL_SOURCE_STATUSES = createInitialSourceStatuses();
const MAX_EVENTS_PER_CATEGORY = 20;

const compareEventsByOccurrence = (a: DisasterEvent, b: DisasterEvent): number => {
  if (a.timestamp !== b.timestamp) {
    return b.timestamp - a.timestamp;
  }
  return b.id.localeCompare(a.id);
};

const limitEventsByCategory = (items: DisasterEvent[], maxPerCategory: number): DisasterEvent[] => {
  const counts = new Map<string, number>();
  const limited: DisasterEvent[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const event = items[i];
    const count = counts.get(event.category) ?? 0;
    if (count >= maxPerCategory) {
      continue;
    }
    counts.set(event.category, count + 1);
    limited.push(event);
  }
  return limited;
};

const App: React.FC = () => {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>(INITIAL_SOURCE_STATUSES);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string | null>(null);

  const handleIncomingEvent = useCallback((message: MessageEvent<string>) => {
    const parsed = parseEventData(message.data);
    if (!parsed) {
      return;
    }
    const mappedEvent = toDisasterEvent(parsed);
    const eventId = message.lastEventId || parsed.id;
    if (eventId) {
      lastEventIdRef.current = eventId;
    }
    setEvents((prev) => {
      for (let i = 0; i < prev.length; i += 1) {
        if (prev[i].id === mappedEvent.id) {
          return prev;
        }
      }
      const next = [mappedEvent, ...prev];
      next.sort(compareEventsByOccurrence);
      return limitEventsByCategory(next, MAX_EVENTS_PER_CATEGORY);
    });
    setSourceStatuses((prev) => {
      const next = prev.slice();
      const now = Date.now();
      for (let i = 0; i < next.length; i += 1) {
        if (next[i].sourceId === mappedEvent.sourceId) {
          next[i] = { ...next[i], isConnected: true, lastUpdate: now };
          return next;
        }
      }
      return [
        ...next,
        {
          sourceId: mappedEvent.sourceId,
          name: mappedEvent.source,
          isConnected: true,
          lastUpdate: now,
        },
      ];
    });
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadInitialEvents = async () => {
      try {
        const allEventsPromise = fetchInitialEvents();
        const kindPromises: Promise<ApiEvent[]>[] = [];
        for (let i = 0; i < EVENT_KIND_VALUES.length; i += 1) {
          kindPromises.push(fetchEventsByKind(EVENT_KIND_VALUES[i], 10));
        }
        const [allEvents, kindResults] = await Promise.all([allEventsPromise, Promise.allSettled(kindPromises)]);
        if (!isActive) {
          return;
        }
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
        const mappedById = new Map<string, DisasterEvent>();
        for (let i = 0; i < combined.length; i += 1) {
          const mappedEvent = toDisasterEvent(combined[i]);
          const existing = mappedById.get(mappedEvent.id);
          if (!existing || mappedEvent.timestamp > existing.timestamp) {
            mappedById.set(mappedEvent.id, mappedEvent);
          }
        }
        const mapped = Array.from(mappedById.values());
        mapped.sort(compareEventsByOccurrence);
        setEvents(limitEventsByCategory(mapped, MAX_EVENTS_PER_CATEGORY));
        if (mapped.length > 0) {
          lastEventIdRef.current = mapped[0].id;
        }
      } catch (error) {
        console.error(error);
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
      await loadInitialEvents();
      if (!isActive) {
        return;
      }
      connectStream(lastEventIdRef.current ?? undefined);
    };

    void startStream();

    return () => {
      isActive = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [handleIncomingEvent]);

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

  const sidebarEvents = useMemo(() => {
    return events
      .filter((e) => {
        const priorityMap = {
          [EventLevels.Info]: 0,
          [EventLevels.Minor]: 1,
          [EventLevels.Moderate]: 2,
          [EventLevels.Severe]: 3,
          [EventLevels.Critical]: 4,
        };
        return priorityMap[e.level] >= priorityMap[SIDEBAR_MIN_LEVEL];
      })
      .slice(0, 20);
  }, [events]);

  const categoryGroups = useMemo(() => {
    const groups: Record<string, DisasterEvent[]> = {};
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      if (!groups[event.category]) {
        groups[event.category] = [];
      }
      groups[event.category].push(event);
    }

    const sortedGroups: CategoryGroup[] = Object.keys(groups).map((cat) => ({
      category: cat,
      latestEvent: groups[cat][0],
      events: groups[cat],
    }));

    return sortedGroups
      .sort((a, b) => compareEventsByOccurrence(a.latestEvent, b.latestEvent))
      .slice(0, MAX_CATEGORIES_DISPLAY);
  }, [events]);

  return (
    // On mobile, we use min-h-screen and allow overflow. On desktop, fixed h-screen.
    <div className="min-h-screen lg:h-screen w-full flex flex-col bg-slate-950 text-slate-50 border-0 md:border-2 border-slate-900 select-none overflow-x-hidden">
      <Header sourceStatuses={sourceStatuses} />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar: Above grid on mobile, Left side on desktop */}
        <Sidebar events={sidebarEvents} />

        {/* Main Grid: Scrollable area */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col">
          <CategoryGrid groups={categoryGroups} />
        </div>
      </main>

      <FooterMarquee events={events.slice(0, 10)} />
    </div>
  );
};

export default App;
