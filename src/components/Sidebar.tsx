import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import type React from 'react';
import { LEVEL_CONFIG } from '../constants';
import { type DisasterEvent, EventLevels } from '../types';

interface SidebarProps {
  events: DisasterEvent[];
}

const Sidebar: React.FC<SidebarProps> = ({ events }) => {
  return (
    <aside className="w-96 bg-slate-900/50 border-r border-slate-800 flex flex-col">
      <div className="p-5 bg-slate-800/80 flex items-center space-x-2 border-b border-slate-700">
        <ShieldAlert className="w-6 h-6 text-orange-500" />
        <h2 className="text-xl font-bold tracking-tight">주요 재난 상황</h2>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 p-4 space-y-4">
          <AnimatePresence mode="popLayout">
            {events.map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`p-4 rounded-xl border-l-8 ${LEVEL_CONFIG[event.level].border} bg-slate-800 shadow-lg relative overflow-hidden`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${LEVEL_CONFIG[event.level].bg} ${LEVEL_CONFIG[event.level].text}`}
                  >
                    {LEVEL_CONFIG[event.level].label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">
                    {format(event.timestamp, 'HH:mm:ss')}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-100 line-clamp-2 leading-snug mb-2">{event.title}</h3>
                {event.content && (
                  <p className="text-[11px] text-slate-300 whitespace-pre-line break-words leading-snug">
                    {event.content}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {event.source} | {event.category}
                  </span>
                </div>

                {/* Subtle highlight for critical */}
                {event.level === EventLevels.Critical && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-red-600/10 rounded-full -mr-8 -mt-8 animate-pulse" />
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
