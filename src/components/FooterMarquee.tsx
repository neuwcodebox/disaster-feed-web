import { format } from 'date-fns';
import type React from 'react';
import type { DisasterEvent } from '../types';

interface FooterMarqueeProps {
  events: DisasterEvent[];
}

const FooterMarquee: React.FC<FooterMarqueeProps> = ({ events }) => {
  return (
    <footer className="h-12 bg-slate-900 border-t border-slate-800 flex items-center overflow-hidden relative">
      <div className="bg-red-600 px-6 h-full flex items-center z-10 skew-x-[-20deg] -ml-4">
        <span className="text-sm font-black text-white italic tracking-tighter skew-x-20">LIVE UPDATE</span>
      </div>

      <div className="flex-1 flex items-center overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block py-1">
          {events.map((event) => (
            <span key={event.id} className="text-sm font-bold text-slate-300">
              <span className="text-blue-400 mr-2">[{format(event.timestamp, 'HH:mm')}]</span>
              <span className="text-white mr-1">{event.source}:</span>
              {event.title}
              <span className="mx-8 text-slate-700">|</span>
            </span>
          ))}
          {/* Repeat for seamless loop if needed, but for broadcast, a standard long list is fine */}
          {events.map((event) => (
            <span key={`${event.id}-copy`} className="text-sm font-bold text-slate-300">
              <span className="text-blue-400 mr-2">[{format(event.timestamp, 'HH:mm')}]</span>
              <span className="text-white mr-1">{event.source}:</span>
              {event.title}
              <span className="mx-8 text-slate-700">|</span>
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
