import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createEventSource,
  fetchInitialEvents,
  fetchSourceStatuses,
  getFetchedAtMs,
  parseEventData,
  toDisasterEvent,
} from './api';
import CategoryGrid from './components/CategoryGrid';
import FooterMarquee from './components/FooterMarquee';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { MAX_CATEGORIES_DISPLAY, SIDEBAR_MIN_LEVEL, SOURCE_DISPLAY_ORDER, STATUS_SOURCE_LABELS } from './constants';
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

const App: React.FC = () => {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>(INITIAL_SOURCE_STATUSES);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const lastFetchedAtRef = useRef<number | null>(null);

  const handleIncomingEvent = useCallback((rawData: string) => {
    const parsed = parseEventData(rawData);
    if (!parsed) {
      return;
    }
    const mappedEvent = toDisasterEvent(parsed);
    const fetchedAtMs = getFetchedAtMs(parsed);
    if (fetchedAtMs && (lastFetchedAtRef.current === null || fetchedAtMs > lastFetchedAtRef.current)) {
      lastFetchedAtRef.current = fetchedAtMs;
    }
    setEvents((prev) => {
      for (let i = 0; i < prev.length; i += 1) {
        if (prev[i].id === mappedEvent.id) {
          return prev;
        }
      }
      const next = [mappedEvent, ...prev];
      next.sort((a, b) => b.timestamp - a.timestamp);
      return next.slice(0, 100);
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
        const payload = await fetchInitialEvents();
        if (!isActive) {
          return;
        }
        const mapped: DisasterEvent[] = [];
        let latestFetchedAt: number | null = lastFetchedAtRef.current;
        for (let i = 0; i < payload.length; i += 1) {
          const mappedEvent = toDisasterEvent(payload[i]);
          mapped.push(mappedEvent);
          const fetchedAtMs = getFetchedAtMs(payload[i]);
          if (fetchedAtMs && (latestFetchedAt === null || fetchedAtMs > latestFetchedAt)) {
            latestFetchedAt = fetchedAtMs;
          }
        }
        mapped.sort((a, b) => b.timestamp - a.timestamp);
        setEvents(mapped.slice(0, 100));
        if (latestFetchedAt) {
          lastFetchedAtRef.current = latestFetchedAt;
        }
      } catch (error) {
        console.error(error);
      }
    };

    const connectStream = (since?: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      const stream = createEventSource(since);
      eventSourceRef.current = stream;
      stream.onmessage = (message) => {
        handleIncomingEvent(message.data);
      };
      stream.onerror = () => {
        stream.close();
        if (reconnectTimeoutRef.current !== null) {
          window.clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          const sinceMs = lastFetchedAtRef.current;
          const sinceValue = sinceMs ? new Date(sinceMs).toISOString() : undefined;
          connectStream(sinceValue);
        }, 3000);
      };
    };

    const startStream = async () => {
      await loadInitialEvents();
      if (!isActive) {
        return;
      }
      const sinceMs = lastFetchedAtRef.current;
      const sinceValue = sinceMs ? new Date(sinceMs).toISOString() : undefined;
      connectStream(sinceValue);
    };

    void startStream();

    return () => {
      isActive = false;
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
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
      .sort((a, b) => b.latestEvent.timestamp - a.latestEvent.timestamp)
      .slice(0, MAX_CATEGORIES_DISPLAY);
  }, [events]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 text-slate-50 border-[2px] border-slate-900 select-none">
      <Header sourceStatuses={sourceStatuses} />

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Recent Critical/Severe Events */}
        <Sidebar events={sidebarEvents} />

        {/* Right Main Grid: Category-wise latest events with fixed layout */}
        <CategoryGrid groups={categoryGroups} />
      </main>

      {/* Ticker footer for additional broadcast feel */}
      <FooterMarquee events={events.slice(0, 10)} />
    </div>
  );
};

export default App;
