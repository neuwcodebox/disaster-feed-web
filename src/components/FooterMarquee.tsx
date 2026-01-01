import { format } from 'date-fns';
import type React from 'react';
import type { DisasterEvent } from '../types';

interface FooterMarqueeProps {
  events: DisasterEvent[];
}

const FooterMarquee: React.FC<FooterMarqueeProps> = ({ events }) => {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 flex h-10 items-center overflow-hidden border-t border-slate-800 bg-slate-900 w-full lg:static lg:z-10 lg:h-12">
      <div className="bg-red-600 px-3 sm:px-4 md:px-5 lg:px-6 h-full flex items-center z-10 skew-x-[-20deg] -ml-2 md:-ml-3 lg:-ml-4">
        <span className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-black text-white italic tracking-tighter skew-x-20">
          LIVE UPDATE
        </span>
      </div>

      <div className="flex-1 flex items-center overflow-hidden whitespace-nowrap pl-2 md:pl-3">
        <div className="animate-marquee flex items-center py-1">
          {events.map((event) => (
            <span
              key={event.id}
              className="text-[10px] sm:text-[11px] md:text-[12px] lg:text-sm font-bold text-slate-300"
            >
              <span className="text-blue-400 mr-2 md:mr-3">[{format(event.timestamp, 'HH:mm')}]</span>
              <span className="text-white mr-1.5">{event.source}:</span>
              {event.title}
              <span className="mx-4 md:mx-6 lg:mx-8 text-slate-700">|</span>
            </span>
          ))}
          {/* Repeat for seamless loop if needed, but for broadcast, a standard long list is fine */}
          {events.map((event) => (
            <span
              key={`${event.id}-copy`}
              className="text-[10px] sm:text-[11px] md:text-[12px] lg:text-sm font-bold text-slate-300"
            >
              <span className="text-blue-400 mr-2 md:mr-3">[{format(event.timestamp, 'HH:mm')}]</span>
              <span className="text-white mr-1.5">{event.source}:</span>
              {event.title}
              <span className="mx-4 md:mx-6 lg:mx-8 text-slate-700">|</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
          display: flex;
        }
      `}</style>
    </footer>
  );
};

export default FooterMarquee;
