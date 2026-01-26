import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronUp, LayoutGrid } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_PAGE_SIZE, getEventKindIcon, LEVEL_CONFIG } from '../constants';
import { type CategoryGroup, type CategorySortMode, EventLevels, type EventMetric } from '../types';
import CategoryEventCard from './CategoryEventCard';
import CategorySparkline from './CategorySparkline';

interface CategoryGridProps {
  eventsByCategory: CategoryGroup[];
  metricsByCategory: Record<string, EventMetric[]>;
  sortMode: CategorySortMode;
  onSortModeChange: (mode: CategorySortMode) => void;
}

const PAGE_DRAG_THRESHOLD = 80;
const SCROLL_TOP_VISIBILITY_THRESHOLD = 12;
const EVENT_LIST_INITIAL_COUNT = 10;
const EVENT_LIST_BATCH_SIZE = 10;

const pageVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 60 : -60,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -60 : 60,
  }),
};

interface CategoryEventListProps {
  events: CategoryGroup['events'];
}

const CategoryEventList: React.FC<CategoryEventListProps> = ({ events }) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [visibleCount, setVisibleCount] = useState(() => Math.min(EVENT_LIST_INITIAL_COUNT, events.length));
  const eventCount = events.length;

  const visibleEvents = useMemo(() => events.slice(0, visibleCount), [events, visibleCount]);

  useEffect(() => {
    setVisibleCount(Math.min(EVENT_LIST_INITIAL_COUNT, eventCount));
  }, [eventCount]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) {
      return;
    }

    const updateScrollState = () => {
      setShowScrollTop(node.scrollTop > SCROLL_TOP_VISIBILITY_THRESHOLD);
    };

    updateScrollState();
    node.addEventListener('scroll', updateScrollState, { passive: true });

    return () => {
      node.removeEventListener('scroll', updateScrollState);
    };
  }, []);

  useEffect(() => {
    const node = listRef.current;
    const sentinel = sentinelRef.current;
    if (!node) {
      return;
    }
    if (eventCount === 0) {
      setShowScrollTop(false);
      return;
    }
    setShowScrollTop(node.scrollTop > SCROLL_TOP_VISIBILITY_THRESHOLD);
    if (!sentinel) {
      return;
    }
    if (visibleCount >= eventCount) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) {
          return;
        }
        setVisibleCount((prev) => Math.min(prev + EVENT_LIST_BATCH_SIZE, eventCount));
      },
      {
        root: node,
        rootMargin: '0px 0px 120px 0px',
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [eventCount, visibleCount]);

  const handleScrollTop = () => {
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <div className="flex-1 relative overflow-hidden group/list">
      <div ref={listRef} className="absolute inset-0 overflow-y-auto scrollbar-hide p-2 space-y-1.5">
        <AnimatePresence mode="popLayout">
          {visibleEvents.map((event, idx) => {
            const isPrimary = idx === 0;

            return <CategoryEventCard key={event.id} event={event} isPrimary={isPrimary} />;
          })}
        </AnimatePresence>
        <div ref={sentinelRef} className="h-6" aria-hidden="true" />
      </div>

      <AnimatePresence>
        {showScrollTop ? (
          <motion.button
            type="button"
            onClick={handleScrollTop}
            aria-label="맨 위로"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-2 right-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/40 bg-slate-950/90 text-blue-200 shadow-[0_10px_20px_rgba(2,6,23,0.55),0_0_14px_rgba(59,130,246,0.2)] transition hover:text-white hover:border-blue-300 hover:bg-slate-900"
          >
            <ChevronUp className="w-4 h-4" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const CategoryGrid: React.FC<CategoryGridProps> = ({
  eventsByCategory,
  metricsByCategory,
  sortMode,
  onSortModeChange,
}) => {
  const levels = [EventLevels.Info, EventLevels.Minor, EventLevels.Moderate, EventLevels.Severe, EventLevels.Critical];
  const isLatest = sortMode === 'latest';
  const isScore = sortMode === 'score';
  const [pageIndex, setPageIndex] = useState(0);
  const [pageDirection, setPageDirection] = useState(0);
  const totalPages = Math.ceil(eventsByCategory.length / CATEGORY_PAGE_SIZE);
  const hasMultiplePages = totalPages > 1;
  const pageLabel = `${Math.min(pageIndex + 1, Math.max(totalPages, 1))}/${Math.max(totalPages, 1)}`;

  const pageGroups = useMemo(() => {
    const startIndex = pageIndex * CATEGORY_PAGE_SIZE;
    return eventsByCategory.slice(startIndex, startIndex + CATEGORY_PAGE_SIZE);
  }, [eventsByCategory, pageIndex]);

  useEffect(() => {
    if (sortMode === 'latest' || sortMode === 'score') {
      setPageIndex(0);
      setPageDirection(0);
    }
  }, [sortMode]);

  useEffect(() => {
    const maxIndex = Math.max(totalPages - 1, 0);
    if (pageIndex > maxIndex) {
      setPageIndex(maxIndex);
      setPageDirection(0);
    }
  }, [pageIndex, totalPages]);

  const handlePageChange = (nextIndex: number) => {
    const maxIndex = Math.max(totalPages - 1, 0);
    const clampedIndex = Math.min(Math.max(nextIndex, 0), maxIndex);
    if (clampedIndex === pageIndex) {
      return;
    }
    setPageDirection(clampedIndex > pageIndex ? 1 : -1);
    setPageIndex(clampedIndex);
  };

  const goPrev = () => {
    handlePageChange(pageIndex - 1);
  };

  const goNext = () => {
    handlePageChange(pageIndex + 1);
  };

  return (
    <div className="flex-1 bg-slate-950 p-4 md:p-6 flex flex-col lg:overflow-hidden">
      {/* Grid Header */}
      <div className="flex flex-row flex-wrap items-start gap-3 md:items-center justify-between mb-4 shrink-0">
        <div className="flex flex-row flex-wrap items-center justify-between gap-2 min-w-0 md:gap-3">
          <div className="flex items-center space-x-2 shrink-0">
            <LayoutGrid className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
            <h2 className="text-lg md:text-xl font-bold text-slate-300">유형별 현황</h2>
          </div>

          <div className="inline-flex w-fit min-w-0 flex-wrap items-center gap-2 bg-slate-900/30 px-2 md:px-3 py-1.5 rounded-lg border border-slate-800/50 self-start">
            {levels.map((level) => (
              <div key={level} className="flex items-center space-x-1 whitespace-nowrap">
                <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${LEVEL_CONFIG[level].bg}`} />
                <span className="text-[9px] md:text-[10px] font-bold text-slate-400">{LEVEL_CONFIG[level].label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3 shrink-0">
          <div className="flex items-center text-[9px] md:text-[10px] font-bold uppercase tracking-widest bg-slate-900/50 px-0.5 py-0.5 md:px-1 md:py-1 rounded-full border border-slate-800">
            <button
              type="button"
              onClick={() => onSortModeChange('latest')}
              className={`px-2 py-0.5 rounded-full transition ${
                isLatest ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              최신순
            </button>
            <button
              type="button"
              onClick={() => onSortModeChange('score')}
              className={`px-2 py-0.5 rounded-full transition ${
                isScore ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              우선순
            </button>
          </div>

          {hasMultiplePages ? (
            <div className="flex items-center gap-0.5 bg-slate-900/50 px-0.5 py-0.5 md:px-1 md:py-1 rounded-full border border-slate-800 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <button
                type="button"
                onClick={goPrev}
                disabled={pageIndex === 0}
                aria-label="이전 페이지"
                className="rounded-full p-1 transition text-slate-400 hover:text-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="min-w-5 text-center text-slate-200">{pageLabel}</span>
              <button
                type="button"
                onClick={goNext}
                disabled={pageIndex >= totalPages - 1}
                aria-label="다음 페이지"
                className="rounded-full p-1 transition text-slate-400 hover:text-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Responsive Grid Container: 1 col on mobile, 2 on tablet, 3 on desktop */}
      <div className="flex-1 min-h-0 relative overflow-hidden pb-4 md:pb-0">
        <AnimatePresence mode="wait" initial={false} custom={pageDirection}>
          <motion.div
            key={`category-page-${pageIndex}`}
            custom={pageDirection}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: 'easeOut' }}
            drag={hasMultiplePages ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (!hasMultiplePages) {
                return;
              }
              if (info.offset.x > PAGE_DRAG_THRESHOLD) {
                goPrev();
                return;
              }
              if (info.offset.x < -PAGE_DRAG_THRESHOLD) {
                goNext();
              }
            }}
            className="grid h-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
          >
            {pageGroups.map((group) => {
              const metrics = metricsByCategory[group.category];

              let highestLevel = EventLevels.Info;
              if (metrics && metrics.length > 0) {
                for (const m of metrics) {
                  if (m.level > highestLevel) {
                    highestLevel = m.level;
                  }
                }
              }

              return (
                <motion.div
                  key={group.category}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden flex flex-col shadow-lg h-70 md:h-80 lg:h-full"
                >
                  {/* Category Header - Fixed Height */}
                  <div className="gap-2 h-10 md:h-12 px-3 md:px-4 flex items-center justify-between border-b border-slate-700/50 bg-slate-800/30 shrink-0">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${LEVEL_CONFIG[highestLevel].bg} shadow-sm animate-pulse`}
                      />
                      <h3 className="text-base md:text-lg font-bold text-white tracking-tight whitespace-nowrap">
                        {group.category}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <CategorySparkline metrics={metrics ?? []} hours={24} />
                      <span className="text-sm md:text-base leading-none" aria-hidden="true">
                        {getEventKindIcon(group.latestEvent.kind)}
                      </span>
                    </div>
                  </div>

                  {/* Event List */}
                  <CategoryEventList events={group.events} />

                  {/* Intensity Bar - Fixed Height */}
                  <div className="h-1 w-full flex shrink-0">
                    {group.events.slice(0, 12).map((e) => (
                      <div
                        key={`intensity-${e.id}`}
                        className={`flex-1 h-full ${LEVEL_CONFIG[e.level].bg} opacity-20`}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CategoryGrid;
