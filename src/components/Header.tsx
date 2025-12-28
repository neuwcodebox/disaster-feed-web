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
    <header className="h-20 bg-slate-900 flex items-center justify-between px-4 border-b border-slate-800 shadow-2xl relative z-10 shrink-0">
      <div className="flex items-center space-x-4">
        <div className="bg-red-600 p-2 rounded-lg animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.4)]">
          <Activity className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter text-white">
            <span className="text-red-500">실시간</span> 재난 통합 상황판
          </h1>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
            Disaster Integrated Live Dashboard
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-12">
        {/* Detailed Source Statuses */}
        <div className="flex items-center space-x-3 bg-slate-950/50 p-2 rounded-xl border border-slate-800">
          <div className="px-2 border-r border-slate-800 flex flex-col items-center justify-center">
            <span className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1 tracking-tighter">
              DATA
            </span>
            <span className="text-[9px] font-black text-slate-500 uppercase leading-none tracking-tighter">STATUS</span>
          </div>
          <div className="flex space-x-2">
            {sourceStatuses.map((source) => (
              <div key={source.sourceId} className="flex flex-col items-center">
                <div
                  className={`w-2.5 h-2.5 rounded-full mb-1 transition-all duration-500 ${
                    source.isConnected
                      ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                      : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse'
                  }`}
                />
                <span
                  className={`text-[10px] font-bold leading-tight whitespace-pre-line text-center ${
                    source.isConnected ? 'text-slate-300' : 'text-red-400'
                  }`}
                >
                  {source.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center space-x-2 text-2xl font-mono font-bold text-white leading-none">
            <Clock className="w-5 h-5 text-blue-400" />
            <span>{format(now, 'HH:mm:ss')}</span>
          </div>
          <span className="text-xs text-slate-400 font-semibold mt-1">
            {format(now, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
