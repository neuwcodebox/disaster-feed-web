import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import type React from 'react';
import { LEVEL_CONFIG } from '../constants';
import { type CategoryGroup, EventLevels } from '../types';

interface CategoryGridProps {
  groups: CategoryGroup[];
}

const formatRelativeTime = (timestamp: number) =>
  formatDistanceToNow(timestamp, {
    addSuffix: true,
    locale: ko,
  });

const CategoryGrid: React.FC<CategoryGridProps> = ({ groups }) => {
  const levels = [EventLevels.Info, EventLevels.Minor, EventLevels.Moderate, EventLevels.Severe, EventLevels.Critical];

  return (
    <div className="flex-1 bg-slate-950 p-4 md:p-6 flex flex-col lg:overflow-hidden">
      {/* Grid Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3 shrink-0">
        <div className="flex items-center space-x-2">
          <LayoutGrid className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
          <h2 className="text-lg md:text-xl font-bold text-slate-300">유형별 현황</h2>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Legend Section - Wrap on very small screens */}
          <div className="flex items-center space-x-2 md:space-x-3 bg-slate-900/30 px-2 md:px-3 py-1.5 rounded-lg border border-slate-800/50 overflow-x-auto max-w-full">
            {levels.map((level) => (
              <div key={level} className="flex items-center space-x-1 whitespace-nowrap">
                <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${LEVEL_CONFIG[level].bg}`} />
                <span className="text-[9px] md:text-[10px] font-bold text-slate-400">{LEVEL_CONFIG[level].label}</span>
              </div>
            ))}
          </div>

          <div className="hidden sm:block text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
            최신순
          </div>
        </div>
      </div>

      {/* Responsive Grid Container: 1 col on mobile, 2 on tablet, 3 on desktop */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:overflow-hidden pb-4 md:pb-0">
        <AnimatePresence mode="popLayout">
          {groups.map((group) => {
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
                <div className="h-10 md:h-12 px-3 md:px-4 flex items-center justify-between border-b border-slate-700/50 bg-slate-800/30 shrink-0">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${LEVEL_CONFIG[highestLevel].bg} shadow-sm animate-pulse`}
                    />
                    <h3 className="text-base md:text-lg font-bold text-white tracking-tight">{group.category}</h3>
                  </div>
                </div>

                {/* Event List */}
                <div className="flex-1 relative overflow-hidden group/list">
                  <div className="absolute inset-0 overflow-y-auto scrollbar-hide p-2 space-y-1.5">
                    <AnimatePresence mode="popLayout">
                      {group.events.slice(0, 20).map((event, idx) => (
                        <motion.div
                          key={event.id}
                          layout
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-2 rounded-lg transition-all duration-300 border ${
                            idx === 0
                              ? 'bg-slate-800/80 border-slate-600/50 shadow-md ring-1 ring-slate-700/30'
                              : 'bg-slate-900/40 border-transparent hover:bg-slate-800/40 hover:border-slate-700/30'
                          }`}
                        >
                          <div className="flex items-start space-x-2">
                            {/* Intensity Indicator */}
                            <div className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${LEVEL_CONFIG[event.level].bg}`} />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span
                                  className={`text-[7px] md:text-[8px] font-black px-1 rounded-sm uppercase ${LEVEL_CONFIG[event.level].bg} ${LEVEL_CONFIG[event.level].text}`}
                                >
                                  {LEVEL_CONFIG[event.level].label}
                                </span>
                                <span className="text-[8px] md:text-[9px] font-bold text-slate-500">
                                  {formatRelativeTime(event.timestamp)}
                                </span>
                              </div>
                              <h4
                                className={`text-xs md:text-[13px] font-bold leading-tight whitespace-pre-line break-all ${
                                  idx === 0 ? 'text-slate-100' : 'text-slate-400'
                                }`}
                              >
                                {event.title}
                              </h4>
                              {event.content && (
                                <p
                                  className={
                                    idx === 0
                                      ? 'text-[10px] text-slate-500 mt-0.5 font-medium leading-tight whitespace-pre-line wrap-break-word'
                                      : 'text-[10px] text-slate-500 mt-0.5 font-medium leading-tight truncate'
                                  }
                                >
                                  {event.content}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Intensity Bar - Fixed Height */}
                <div className="h-1 w-full flex shrink-0">
                  {group.events.slice(0, 12).map((e) => (
                    <div key={`intensity-${e.id}`} className={`flex-1 h-full ${LEVEL_CONFIG[e.level].bg} opacity-20`} />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CategoryGrid;
