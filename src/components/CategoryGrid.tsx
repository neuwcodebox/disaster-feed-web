import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, LayoutGrid } from 'lucide-react';
import type React from 'react';
import { LEVEL_CONFIG } from '../constants';
import type { CategoryGroup } from '../types';

interface CategoryGridProps {
  groups: CategoryGroup[];
}

const CategoryGrid: React.FC<CategoryGridProps> = ({ groups }) => {
  return (
    <div className="flex-1 bg-slate-950 p-6 flex flex-col overflow-hidden">
      {/* Grid Header */}
      <div className="flex items-center justify-between mb-4 ml-2 shrink-0">
        <div className="flex items-center space-x-2">
          <LayoutGrid className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold text-slate-300">종류별 상황판</h2>
        </div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800">
          최근 활성 종류 우선 정렬
        </div>
      </div>

      {/* Fixed Grid Container: ensures no scrollbars appear on the main page */}
      <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-4 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {groups.map((group) => (
            <motion.div
              key={group.category}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 120 }}
              className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden flex flex-col shadow-lg h-full"
            >
              {/* Category Header - Fixed Height */}
              <div className="h-12 px-4 flex items-center justify-between border-b border-slate-700/50 bg-slate-800/30 shrink-0">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${LEVEL_CONFIG[group.latestEvent.level].bg} shadow-sm animate-pulse`}
                  />
                  <h3 className="text-lg font-bold text-white tracking-tight">{group.category}</h3>
                </div>
                <div className="flex items-center text-[10px] font-bold text-slate-400">
                  <Clock className="w-3 h-3 mr-1" />
                  {format(group.latestEvent.timestamp, 'HH:mm')}
                </div>
              </div>

              {/* Event List - Fill remaining space within category block */}
              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 p-2 space-y-1 overflow-hidden">
                  <AnimatePresence mode="popLayout">
                    {group.events.slice(0, 20).map((event, idx) => (
                      <motion.div
                        key={event.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-2.5 rounded-lg border border-transparent transition-colors ${
                          idx === 0 ? 'bg-slate-800/60 border-slate-700/50 shadow-inner' : 'bg-transparent'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          {/* Intensity Indicator */}
                          <div className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${LEVEL_CONFIG[event.level].bg}`} />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span
                                className={`text-[8px] font-black px-1 rounded-sm uppercase ${LEVEL_CONFIG[event.level].bg} ${LEVEL_CONFIG[event.level].text}`}
                              >
                                {LEVEL_CONFIG[event.level].label}
                              </span>
                              <span className="text-[9px] font-mono font-bold text-slate-500">
                                {format(event.timestamp, 'HH:mm:ss')}
                              </span>
                            </div>
                            <h4
                              className={`text-[13px] font-bold leading-tight truncate ${
                                idx === 0 ? 'text-slate-100' : 'text-slate-400'
                              }`}
                            >
                              {event.title}
                            </h4>
                            {idx === 0 && event.content && (
                              <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 font-medium leading-none">
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
                  <div key={`intensity-${e.id}`} className={`flex-1 h-full ${LEVEL_CONFIG[e.level].bg} opacity-30`} />
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CategoryGrid;
