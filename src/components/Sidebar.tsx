import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import type React from 'react';
import { LEVEL_CONFIG } from '../constants';
import { type DisasterEvent, EventLevels } from '../types';

interface SidebarProps {
  events: DisasterEvent[];
}

const formatRelativeTime = (timestamp: number) =>
  formatDistanceToNow(timestamp, {
    addSuffix: true,
    locale: ko,
  });

const Sidebar: React.FC<SidebarProps> = ({ events }) => {
  return (
    <aside className="w-full lg:w-96 bg-slate-900/50 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0">
      <div className="p-3 md:p-5 bg-slate-800/80 flex items-center space-x-2 border-b border-slate-700">
        <ShieldAlert className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
        <h2 className="text-base md:text-xl font-bold tracking-tight">주요 재난 상황</h2>
      </div>

      {/* Scrollable area: Horizontal on mobile, Vertical on Desktop */}
      <div className="flex-1 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden relative scrollbar-hide">
        <div className="p-3 md:p-4 flex lg:flex-col space-x-3 lg:space-x-0 lg:space-y-4">
          <AnimatePresence mode="popLayout">
            {events.map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`shrink-0 w-64 lg:w-full p-3 md:p-4 rounded-xl border-l-4 md:border-l-8 ${LEVEL_CONFIG[event.level].border} bg-slate-800 shadow-lg relative overflow-hidden`}
              >
                <div className="flex justify-between items-start mb-1.5 md:mb-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] md:text-[10px] font-bold ${LEVEL_CONFIG[event.level].bg} ${LEVEL_CONFIG[event.level].text}`}
                  >
                    {LEVEL_CONFIG[event.level].label}
                  </span>
                  <span className="text-[8px] md:text-[10px] text-slate-500 font-bold">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>

                <h3 className="font-bold text-xs md:text-sm text-slate-100 leading-snug mb-1.5 md:mb-2 whitespace-pre-line break-all">
                  {event.title}
                </h3>
                {event.content && (
                  <p className="text-[11px] md:text-[12px] text-slate-300 leading-snug whitespace-pre-line wrap-break-words">
                    {event.content}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2">
                  <span className="text-[8px] md:text-[10px] font-semibold text-slate-400">
                    {event.source} | {event.category}
                  </span>
                </div>

                {event.level === EventLevels.Critical && (
                  <div className="absolute top-0 right-0 w-12 h-12 md:w-16 md:h-16 bg-red-600/10 rounded-full -mr-6 -mt-6 animate-pulse" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-500 font-bold text-center">
        본 프로젝트는 비영리로 운영되며 제공 정보에 대한 어떠한 보증도 하지 않습니다.
        <br />
        반드시 공식적인 경로를 통해 상황을 확인하시기 바랍니다.
      </div>
    </aside>
  );
};

export default Sidebar;
