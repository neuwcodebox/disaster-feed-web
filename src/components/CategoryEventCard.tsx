import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion } from 'framer-motion';
import type React from 'react';
import { useState } from 'react';
import { LEVEL_CONFIG } from '../constants';
import type { DisasterEvent } from '../types';
import EventSourceLink from './EventSourceLink';

interface CategoryEventCardProps {
  event: DisasterEvent;
  isPrimary: boolean;
}

const formatRelativeTime = (timestamp: number) =>
  formatDistanceToNow(timestamp, {
    addSuffix: true,
    locale: ko,
  });

const highlightTransition = { duration: 3.5, ease: 'easeOut' } as const;

const CategoryEventCard = ({ event, isPrimary }: CategoryEventCardProps) => {
  const [isExpandedByUser, setIsExpandedByUser] = useState(false);
  const isExpandable = !isPrimary && Boolean(event.content);
  const isExpanded = isPrimary || isExpandedByUser;

  const handleToggle = () => {
    if (isExpandable) {
      setIsExpandedByUser((prev) => !prev);
    }
  };

  const handleKeyDown = (keyEvent: React.KeyboardEvent<HTMLDivElement>) => {
    if (isExpandable && (keyEvent.key === 'Enter' || keyEvent.key === ' ')) {
      keyEvent.preventDefault();
      handleToggle();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden p-2 pl-3 rounded-lg transition-all duration-300 border ${
        isPrimary
          ? 'bg-slate-900/40 border-slate-600/30 shadow-md ring-1 ring-slate-700/30 hover:bg-slate-800/40'
          : `bg-slate-900/40 border-transparent hover:bg-slate-800/40 hover:border-slate-700/20 ${
              isExpandable ? 'cursor-pointer' : 'cursor-default'
            }`
      }`}
      onClick={handleToggle}
      role={isExpandable ? 'button' : undefined}
      aria-expanded={isExpandable ? isExpanded : undefined}
      aria-pressed={isExpandable ? isExpanded : undefined}
      tabIndex={isExpandable ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      {event.isRealtime && (
        <motion.div
          aria-hidden="true"
          className={`absolute inset-0 ${LEVEL_CONFIG[event.level].bg} pointer-events-none`}
          initial={{ opacity: 0.25 }}
          animate={{ opacity: 0 }}
          transition={highlightTransition}
        />
      )}
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-0.5 opacity-60 ${LEVEL_CONFIG[event.level].bg}`}
      />
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={`text-[7px] md:text-[8px] font-semibold px-1 rounded-sm uppercase ${LEVEL_CONFIG[event.level].bg} ${LEVEL_CONFIG[event.level].text}`}
          >
            {LEVEL_CONFIG[event.level].label}
          </span>
          <div className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold">
            <span className="text-slate-500">{formatRelativeTime(event.timestamp)}</span>
            <span className="text-slate-500">·</span>
            <EventSourceLink
              sourceId={event.sourceId}
              label={event.source}
              className="text-slate-500 hover:text-slate-300 transition"
            />
          </div>
        </div>
        <h4 className="text-xs md:text-[13px] font-bold leading-tight whitespace-pre-line break-all text-slate-100">
          {event.title}
        </h4>
        {event.content && (
          <p
            className={
              isExpanded
                ? 'text-[10px] text-slate-500 mt-0.5 font-medium leading-tight whitespace-pre-line wrap-break-word'
                : 'text-[10px] text-slate-500 mt-0.5 font-medium leading-tight truncate'
            }
          >
            {event.content}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default CategoryEventCard;
