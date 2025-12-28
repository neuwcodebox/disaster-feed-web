import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Activity, Clock } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { SourceStatus } from '../types';

interface HeaderProps {
  sourceStatuses: SourceStatus[];
}

const Header: React.FC<HeaderProps> = ({ sourceStatuses }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-auto md:h-20 bg-slate-900 flex flex-col md:flex-row items-center justify-between px-4 py-3 md:py-0 border-b border-slate-800 shadow-2xl relative z-20 shrink-0 gap-4 md:gap-0">
      <div className="flex items-center space-x-3 md:space-x-4 w-full md:w-auto">
        <div className="bg-red-600 p-1.5 md:p-2 rounded-lg animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.4)]">
          <Activity className="w-5 h-5 md:w-8 md:h-8 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg md:text-3xl font-extrabold tracking-tighter text-white whitespace-nowrap">
            <span className="text-red-500">실시간</span> 재난 통합 상황판
          </h1>
          <p className="hidden md:block text-[10px] text-slate-400 font-medium uppercase tracking-widest">
            Disaster Integrated Live Dashboard
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end w-full md:w-auto space-x-4 md:space-x-12">
        {/* Detailed Source Statuses - more compact on mobile */}
        <div className="flex items-center space-x-2 md:space-x-3 bg-slate-950/50 p-1.5 md:p-2 rounded-xl border border-slate-800 flex-1 md:flex-none justify-center">
          <div className="hidden sm:flex px-2 border-r border-slate-800 flex-col items-center justify-center">
            <span className="text-[8px] font-black text-slate-500 uppercase leading-none mb-0.5 tracking-tighter">
              DATA
            </span>
            <span className="text-[8px] font-black text-slate-500 uppercase leading-none tracking-tighter">STATUS</span>
          </div>
          <div className="flex space-x-2 md:space-x-2">
            {sourceStatuses.map((source) => (
              <div key={source.sourceId} className="flex flex-col items-center">
                <div
                  className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full mb-0.5 transition-all duration-500 ${
                    source.isConnected
                      ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                      : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse'
                  }`}
                />
                <span
                  className={`text-[8px] md:text-[10px] font-bold leading-tight whitespace-pre-line text-center ${source.isConnected ? 'text-slate-400' : 'text-red-400'}`}
                >
                  {source.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-center space-x-1 md:space-x-2 text-base md:text-2xl font-mono font-bold text-white leading-none">
            <Clock className="w-3.5 h-3.5 md:w-5 md:h-5 text-blue-400" />
            <span>{format(now, 'HH:mm:ss')}</span>
          </div>
          <span className="hidden sm:block text-[9px] md:text-xs text-slate-400 font-semibold mt-1">
            {format(now, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
