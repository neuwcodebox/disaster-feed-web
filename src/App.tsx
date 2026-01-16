import { Map as MapIcon } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CategoryGrid from './components/CategoryGrid';
import DisasterMap from './components/disaster-map/DisasterMap';
import FooterMarquee from './components/FooterMarquee';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import UpdateNotifier from './components/UpdateNotifier';
import {
  MAP_LARGE_SCREEN_QUERY,
  MAX_EVENT_AGE_MS,
  MAX_EVENTS_PER_CATEGORY,
  METRICS_FETCH_LIMIT,
  METRICS_WINDOW_MS,
  SIDEBAR_EVENT_LIMIT,
} from './config/appRuntime';
import { SIDEBAR_MIN_LEVEL } from './constants';
import { useAlertSound } from './hooks/useAlertSound';
import { useDisasterStream } from './hooks/useDisasterStream';
import { useExpiryClock } from './hooks/useExpiryClock';
import type { CategoryGroup, CategorySortMode, DisasterEvent, EventMetric } from './types';
import { filterEventsByAge, filterMetricsByAge } from './utils/eventFilters';
import { compareEventsByOccurrence, compareEventsByScoreStatic } from './utils/eventProcessing';

const takeFirst = <T,>(items: T[], limit: number): T[] => {
  if (items.length <= limit) {
    return items;
  }
  return items.slice(0, limit);
};

const buildMetricsByCategory = (items: EventMetric[]): Record<string, EventMetric[]> => {
  const grouped: Record<string, EventMetric[]> = {};
  for (let i = 0; i < items.length; i += 1) {
    const metric = items[i];
    const existing = grouped[metric.category];
    if (existing) {
      existing.push(metric);
    } else {
      grouped[metric.category] = [metric];
    }
  }
  return grouped;
};

const buildSidebarEvents = (items: DisasterEvent[], minLevel: number, limit: number): DisasterEvent[] => {
  const filtered: DisasterEvent[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const event = items[i];
    if (event.level >= minLevel) {
      filtered.push(event);
    }
  }
  if (filtered.length <= 1) {
    return filtered;
  }
  filtered.sort(compareEventsByScoreStatic);
  if (filtered.length > limit) {
    filtered.length = limit;
  }
  return filtered;
};

const buildCategoryGroups = (items: DisasterEvent[], sortMode: CategorySortMode): CategoryGroup[] => {
  if (items.length === 0) {
    return [];
  }

  const grouped = new Map<string, DisasterEvent[]>();
  for (let i = 0; i < items.length; i += 1) {
    const event = items[i];
    const existing = grouped.get(event.category);
    if (existing) {
      existing.push(event);
    } else {
      grouped.set(event.category, [event]);
    }
  }

  const eventSorter = sortMode === 'score' ? compareEventsByScoreStatic : compareEventsByOccurrence;
  const sortedGroups: CategoryGroup[] = [];
  for (const [category, groupEvents] of grouped) {
    groupEvents.sort(eventSorter);
    sortedGroups.push({
      category,
      latestEvent: groupEvents[0],
      events: groupEvents,
    });
  }

  sortedGroups.sort((a, b) => eventSorter(a.latestEvent, b.latestEvent));
  return sortedGroups;
};

const App: React.FC = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(MAP_LARGE_SCREEN_QUERY).matches;
  });
  const [categorySortMode, setCategorySortMode] = useState<CategorySortMode>('score');

  const { handleAlertLevel } = useAlertSound({ isMuted });
  const { events, metrics, sourceStatuses } = useDisasterStream({
    maxEventAgeMs: MAX_EVENT_AGE_MS,
    metricsWindowMs: METRICS_WINDOW_MS,
    metricsFetchLimit: METRICS_FETCH_LIMIT,
    maxEventsPerCategory: MAX_EVENTS_PER_CATEGORY,
    onAlertLevel: handleAlertLevel,
  });
  const nowMs = useExpiryClock({
    events,
    metrics,
    maxEventAgeMs: MAX_EVENT_AGE_MS,
    metricsWindowMs: METRICS_WINDOW_MS,
  });

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

  const recentEvents = useMemo(() => filterEventsByAge(events, nowMs, MAX_EVENT_AGE_MS), [events, nowMs]);
  const recentMetrics = useMemo(() => filterMetricsByAge(metrics, nowMs, METRICS_WINDOW_MS), [metrics, nowMs]);

  const metricsByCategory = useMemo(() => buildMetricsByCategory(recentMetrics), [recentMetrics]);
  const sidebarEvents = useMemo(
    () => buildSidebarEvents(recentEvents, SIDEBAR_MIN_LEVEL, SIDEBAR_EVENT_LIMIT),
    [recentEvents],
  );
  const categoryGroups = useMemo(
    () => buildCategoryGroups(recentEvents, categorySortMode),
    [categorySortMode, recentEvents],
  );
  const footerEvents = useMemo(() => takeFirst(recentEvents, 10), [recentEvents]);

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
          <CategoryGrid
            eventsByCategory={categoryGroups}
            metricsByCategory={metricsByCategory}
            sortMode={categorySortMode}
            onSortModeChange={setCategorySortMode}
          />
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

      <FooterMarquee events={footerEvents} />
    </div>
  );
};

export default App;
