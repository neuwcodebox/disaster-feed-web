import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Activity, Clock, Users, Volume2, VolumeOff } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { fetchStreamClientsTotal } from '../api';
import type { SourceStatus } from '../types';

interface HeaderProps {
  sourceStatuses: SourceStatus[];
  isMuted: boolean;
  onToggleMute: () => void;
}

const Header: React.FC<HeaderProps> = ({ sourceStatuses, isMuted, onToggleMute }) => {
  const [now, setNow] = useState(new Date());
  const [streamClientTotal, setStreamClientTotal] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadStreamClients = async () => {
      try {
        const total = await fetchStreamClientsTotal();
        if (isActive) {
          setStreamClientTotal(total);
        }
      } catch (error: unknown) {
        console.warn('Failed to fetch stream clients', error);
        if (isActive) {
          setStreamClientTotal(null);
        }
      }
    };

    void loadStreamClients();
    const timer = setInterval(() => {
      void loadStreamClients();
    }, 10000);

    return () => {
      isActive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <header className="h-auto bg-slate-900 flex flex-col lg:flex-row flex-wrap items-center justify-between px-4 py-3 border-b border-slate-800 shadow-2xl relative z-20 shrink-0 gap-x-8 gap-y-3">
      <div className="flex items-center space-x-3 md:space-x-4 w-full lg:w-auto">
        <div className="bg-red-600 p-1.5 md:p-2 rounded-lg animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.4)]">
          <Activity className="w-5 h-5 md:w-8 md:h-8 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="flex items-baseline gap-2 text-lg md:text-3xl font-extrabold tracking-tighter text-white whitespace-nowrap">
            <span className="text-red-500">실시간</span> 재난 통합 상황판
            <span
              className="inline-flex items-center ms-2 gap-0.5 md:gap-1 text-[10px] md:text-xs font-semibold text-slate-400"
              title="현재 시청자 수"
            >
              <Users className="w-3 h-3 md:w-3.5 md:h-3.5" aria-hidden />
              <span>{streamClientTotal ?? '-'}</span>
            </span>
          </h1>
          <p className="hidden md:block text-[10px] text-slate-400 font-medium uppercase tracking-widest">
            Disaster Integrated Live Dashboard
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between lg:justify-end w-full lg:w-auto gap-x-2 gap-y-3 md:gap-x-3 lg:gap-x-8">
        {/* Detailed Source Statuses - more compact on mobile */}
        <div className="flex items-center gap-1.5 md:gap-2 bg-slate-950/50 p-1 md:p-1.5 rounded-lg border border-slate-800 flex-1 md:flex-none justify-center">
          <div className="hidden sm:flex px-1.5 border-r border-slate-800 flex-col items-center justify-center">
            <span className="text-[7px] font-black text-slate-500 uppercase leading-none tracking-tighter">DATA</span>
            <span className="text-[7px] font-black text-slate-500 uppercase leading-none tracking-tighter">STATUS</span>
          </div>
          <div className="flex flex-wrap items-start justify-center gap-x-1 gap-y-0.5 md:gap-x-1.5 md:gap-y-1 min-w-0">
            {sourceStatuses.map((source) => (
              <div key={source.sourceId} className="flex flex-col items-center min-w-0">
                <div
                  className={`w-1 h-1 md:w-2 md:h-2 rounded-full mb-0.5 transition-all duration-500 ${
                    source.isConnected
                      ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.55)]'
                      : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.55)] animate-pulse'
                  }`}
                />
                <span
                  title={source.name}
                  className={`hidden sm:block text-[7px] md:text-[9px] font-semibold leading-tight whitespace-pre-line wrap-break-word text-center max-w-14 md:max-w-20 ${source.isConnected ? 'text-slate-400' : 'text-red-400'}`}
                >
                  {source.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? '알림음 켜기' : '알림음 끄기'}
            className="inline-flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-full border border-slate-700 bg-slate-950/60 text-slate-200 hover:text-white hover:border-slate-500 transition"
          >
            {isMuted ? <VolumeOff className="w-3 h-3 md:w-4 md:h-4" /> : <Volume2 className="w-3 h-3 md:w-4 md:h-4" />}
          </button>
          <div className="flex flex-col items-end">
            <div className="flex items-center space-x-1 md:space-x-2 text-base md:text-2xl font-mono font-bold text-white leading-none">
              <Clock className="w-3.5 h-3.5 md:w-5 md:h-5 text-blue-400" />
              <span>{format(now, 'HH:mm:ss')}</span>
            </div>
            <span className="hidden sm:block text-[9px] md:text-xs text-slate-400 font-semibold mt-1">
              {format(now, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
