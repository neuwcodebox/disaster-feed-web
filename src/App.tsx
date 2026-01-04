import { Map as MapIcon } from 'lucide-react';
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
import DisasterMap from './components/DisasterMap';
import FooterMarquee from './components/FooterMarquee';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import UpdateNotifier from './components/UpdateNotifier';
import {
  EVENT_KIND_VALUES,
  EVENT_LEVEL_SOUNDS,
  MAX_CATEGORIES_DISPLAY,
  SIDEBAR_MIN_LEVEL,
  SOURCE_DISPLAY_ORDER,
  STATUS_SOURCE_LABELS,
} from './constants';
import { type CategoryGroup, type CategorySortMode, type DisasterEvent, EventLevels, type SourceStatus } from './types';
import { filterEventsByAge } from './utils/eventFilters';

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
const MAX_EVENTS_PER_CATEGORY = 50;
const ALERT_SOUND_WINDOW_MS = 1000;
const ALERT_SOUND_MIN_LEVEL = EventLevels.Moderate;
const MAP_LARGE_SCREEN_QUERY = '(min-width: 1536px)';
const ALERT_SOUND_LEVELS: EventLevels[] = [EventLevels.Moderate, EventLevels.Severe, EventLevels.Critical];
const LEVEL_BASE_SCORES: Record<EventLevels, number> = {
  [EventLevels.Info]: 10,
  [EventLevels.Minor]: 20,
  [EventLevels.Moderate]: 40,
  [EventLevels.Severe]: 80,
  [EventLevels.Critical]: 160,
};
const SCORE_DECAY_PER_MINUTE = 1;
const SCORE_RESORT_INTERVAL_MS = 15000;
const MAX_EVENT_AGE_MS = 3 * 24 * 60 * 60 * 1000;

const compareEventsByOccurrence = (a: DisasterEvent, b: DisasterEvent): number => {
  if (a.timestamp !== b.timestamp) {
    return b.timestamp - a.timestamp;
  }
  return b.id.localeCompare(a.id);
};

const getEventScore = (event: DisasterEvent, nowMs: number): number => {
  const baseScore = LEVEL_BASE_SCORES[event.level] ?? 0;
  const elapsedMinutes = Math.max(0, (nowMs - event.timestamp) / 60000);
  return baseScore - elapsedMinutes * SCORE_DECAY_PER_MINUTE;
};

const compareEventsByScore =
  (nowMs: number) =>
  (a: DisasterEvent, b: DisasterEvent): number => {
    const scoreDiff = getEventScore(b, nowMs) - getEventScore(a, nowMs);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return compareEventsByOccurrence(a, b);
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
  const [isMuted, setIsMuted] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(MAP_LARGE_SCREEN_QUERY).matches;
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [categorySortMode, setCategorySortMode] = useState<CategorySortMode>('score');
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const alertSoundsRef = useRef<Partial<Record<EventLevels, HTMLAudioElement>> | null>(null);
  const alertCooldownTimerRef = useRef<number | null>(null);
  const pendingAlertLevelRef = useRef<EventLevels | null>(null);

  const prepareAlertSounds = useCallback(() => {
    if (alertSoundsRef.current) {
      return;
    }
    const sounds: Partial<Record<EventLevels, HTMLAudioElement>> = {};
    for (let i = 0; i < ALERT_SOUND_LEVELS.length; i += 1) {
      const level = ALERT_SOUND_LEVELS[i];
      const source = EVENT_LEVEL_SOUNDS[level];
      if (!source) {
        continue;
      }
      const audio = new Audio(source);
      audio.preload = 'auto';
      sounds[level] = audio;
    }
    alertSoundsRef.current = sounds;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia(MAP_LARGE_SCREEN_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsLargeScreen(event.matches);
    };
    setIsLargeScreen(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const toggleMap = useCallback(() => {
    setIsMapOpen((prev) => !prev);
  }, []);

  const closeMap = useCallback(() => {
    setIsMapOpen(false);
  }, []);

  const playAlertSound = useCallback(
    (level: EventLevels) => {
      if (isMuted) {
        return;
      }
      prepareAlertSounds();
      const audio = alertSoundsRef.current?.[level];
      if (!audio) {
        return;
      }
      audio.currentTime = 0;
      void audio.play().catch((error: unknown) => {
        console.warn('알림음을 재생하지 못했습니다.', error);
      });
    },
    [isMuted, prepareAlertSounds],
  );

  const scheduleAlertWindow = useCallback(() => {
    if (alertCooldownTimerRef.current) {
      return;
    }
    alertCooldownTimerRef.current = window.setTimeout(() => {
      alertCooldownTimerRef.current = null;
      const pendingLevel = pendingAlertLevelRef.current;
      pendingAlertLevelRef.current = null;
      if (pendingLevel != null) {
        playAlertSound(pendingLevel);
      }
    }, ALERT_SOUND_WINDOW_MS);
  }, [playAlertSound]);

  const handleAlertLevel = useCallback(
    (level: EventLevels) => {
      if (level < ALERT_SOUND_MIN_LEVEL) {
        return;
      }
      const pendingLevel = pendingAlertLevelRef.current;
      if (pendingLevel == null || level > pendingLevel) {
        pendingAlertLevelRef.current = level;
      }
      scheduleAlertWindow();
    },
    [scheduleAlertWindow],
  );

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
      handleAlertLevel(mappedEvent.level);
      setEvents((prev) => {
        for (let i = 0; i < prev.length; i += 1) {
          if (prev[i].id === mappedEvent.id) {
            return prev;
          }
        }
        const next = [mappedEvent, ...prev];
        next.sort(compareEventsByOccurrence);
        const recent = filterEventsByAge(next, Date.now(), MAX_EVENT_AGE_MS);
        return limitEventsByCategory(recent, MAX_EVENTS_PER_CATEGORY);
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
    },
    [handleAlertLevel],
  );

  useEffect(() => {
    return () => {
      if (alertCooldownTimerRef.current) {
        window.clearTimeout(alertCooldownTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, SCORE_RESORT_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadInitialEvents = async () => {
      try {
        const allEventsPromise = fetchInitialEvents();
        const kindPromises: Promise<ApiEvent[]>[] = [];
        for (let i = 0; i < EVENT_KIND_VALUES.length; i += 1) {
          kindPromises.push(fetchEventsByKind(EVENT_KIND_VALUES[i], MAX_EVENTS_PER_CATEGORY));
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
        const recent = filterEventsByAge(mapped, Date.now(), MAX_EVENT_AGE_MS);
        setEvents(limitEventsByCategory(recent, MAX_EVENTS_PER_CATEGORY));
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

  const recentEvents = useMemo(() => filterEventsByAge(events, nowMs, MAX_EVENT_AGE_MS), [events, nowMs]);

  const sidebarEvents = useMemo(() => {
    const priorityMap = {
      [EventLevels.Info]: 0,
      [EventLevels.Minor]: 1,
      [EventLevels.Moderate]: 2,
      [EventLevels.Severe]: 3,
      [EventLevels.Critical]: 4,
    };
    const filtered = recentEvents.filter((event) => priorityMap[event.level] >= priorityMap[SIDEBAR_MIN_LEVEL]);
    if (filtered.length <= 1) {
      return filtered;
    }
    const next = filtered.slice();
    next.sort(compareEventsByScore(nowMs));
    return next.slice(0, 30);
  }, [nowMs, recentEvents]);

  const categoryGroups = useMemo(() => {
    const groups: Record<string, DisasterEvent[]> = {};
    for (let i = 0; i < recentEvents.length; i += 1) {
      const event = recentEvents[i];
      if (!groups[event.category]) {
        groups[event.category] = [];
      }
      groups[event.category].push(event);
    }

    const sortedGroups: CategoryGroup[] = [];
    const groupKeys = Object.keys(groups);
    const eventSorter = categorySortMode === 'score' ? compareEventsByScore(nowMs) : compareEventsByOccurrence;
    for (let i = 0; i < groupKeys.length; i += 1) {
      const category = groupKeys[i];
      const groupEvents = groups[category];
      groupEvents.sort(eventSorter);
      sortedGroups.push({
        category,
        latestEvent: groupEvents[0],
        events: groupEvents,
      });
    }

    return sortedGroups.sort((a, b) => eventSorter(a.latestEvent, b.latestEvent)).slice(0, MAX_CATEGORIES_DISPLAY);
  }, [categorySortMode, nowMs, recentEvents]);

  const isMapVisible = isLargeScreen || isMapOpen;

  return (
    // On mobile, we use min-h-screen and allow overflow. On desktop, fixed h-screen.
    <div className="min-h-screen lg:h-screen w-full flex flex-col bg-slate-950 text-slate-50 border-0 md:border-2 border-slate-900 select-none overflow-x-hidden pb-10 md:pb-12 lg:pb-0">
      <Header sourceStatuses={sourceStatuses} isMuted={isMuted} onToggleMute={() => setIsMuted((prev) => !prev)} />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar: Above grid on mobile, Left side on desktop */}
        <Sidebar events={sidebarEvents} />

        {/* Main Grid: Scrollable area */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col">
          <CategoryGrid groups={categoryGroups} sortMode={categorySortMode} onSortModeChange={setCategorySortMode} />
        </div>

        <DisasterMap
          events={recentEvents}
          isOpen={isMapVisible}
          isLargeScreen={isLargeScreen}
          onClose={closeMap}
          maxEventAgeMs={MAX_EVENT_AGE_MS}
        />
      </main>

      {!isLargeScreen && !isMapOpen ? (
        <button
          type="button"
          onClick={toggleMap}
          aria-label="지도 열기"
          className="fixed right-5 bottom-12 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-blue-400/50 bg-slate-950/90 text-blue-200 shadow-[0_12px_26px_rgba(2,6,23,0.55),0_0_18px_rgba(59,130,246,0.25)] transition hover:text-white hover:border-blue-300 hover:bg-slate-900"
        >
          <MapIcon className="w-5 h-5" />
        </button>
      ) : null}

      <UpdateNotifier />

      <FooterMarquee events={recentEvents.slice(0, 10)} />
    </div>
  );
};

export default App;
