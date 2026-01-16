import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
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
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3 shrink-0">
        <div className="flex items-center space-x-2">
          <LayoutGrid className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
          <h2 className="text-lg md:text-xl font-bold text-slate-300">유형별 현황</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3 justify-between">
          {/* Legend Section - Wrap on very small screens */}
          <div className="flex min-w-0 shrink items-center space-x-2 md:space-x-3 bg-slate-900/30 px-2 md:px-3 py-1.5 rounded-lg border border-slate-800/50 overflow-x-auto">
            {levels.map((level) => (
              <div key={level} className="flex items-center space-x-1 whitespace-nowrap">
                <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${LEVEL_CONFIG[level].bg}`} />
                <span className="text-[9px] md:text-[10px] font-bold text-slate-400">{LEVEL_CONFIG[level].label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
              let highestLevel = group.latestEvent.level;
              for (const event of group.events) {
                if (event.level > highestLevel) {
                  highestLevel = event.level;
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
                      <CategorySparkline metrics={metricsByCategory[group.category] ?? []} hours={24} />
                      <span className="text-sm md:text-base leading-none" aria-hidden="true">
                        {getEventKindIcon(group.latestEvent.kind)}
                      </span>
                    </div>
                  </div>

                  {/* Event List */}
                  <div className="flex-1 relative overflow-hidden group/list">
                    <div className="absolute inset-0 overflow-y-auto scrollbar-hide p-2 space-y-1.5">
                      <AnimatePresence mode="popLayout">
                        {group.events.map((event, idx) => {
                          const isPrimary = idx === 0;

                          return <CategoryEventCard key={event.id} event={event} isPrimary={isPrimary} />;
                        })}
                      </AnimatePresence>
                    </div>
                  </div>

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
