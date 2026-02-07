import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Activity, Bell, BellOff, Clock, Users } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { fetchStreamClientsTotal } from '../api';
import { EVENT_SOURCE_LABELS } from '../constants';
import type { EventSources, SourceStatus } from '../types';

type StatusDisplayState = 'connected' | 'partial' | 'disconnected';

type StatusDisplayItem = {
  key: string;
  label: string;
  state: StatusDisplayState;
  title?: string;
};

type StatusGroup = {
  label: string;
  total: number;
  connected: number;
  items: string[];
};

const STATUS_VISUALS: Record<StatusDisplayState, { dot: string; text: string }> = {
  connected: {
    dot: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.55)]',
    text: 'text-slate-400',
  },
  partial: {
    dot: 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.55)]',
    text: 'text-yellow-300',
  },
  disconnected: {
    dot: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.55)] animate-pulse',
    text: 'text-red-400',
  },
};

const resolveStatusGroupLabel = (source: SourceStatus): string =>
  EVENT_SOURCE_LABELS[source.sourceId as EventSources] ?? source.name;

const buildStatusItems = (sourceStatuses: SourceStatus[]): StatusDisplayItem[] => {
  const groups: StatusGroup[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (let i = 0; i < sourceStatuses.length; i += 1) {
    const source = sourceStatuses[i];
    const groupLabel = resolveStatusGroupLabel(source);
    const key = groupLabel;
    let index = groupIndexByKey.get(key);

    if (index === undefined) {
      index = groups.length;
      groupIndexByKey.set(key, index);
      groups.push({
        label: groupLabel,
        total: 0,
        connected: 0,
        items: [],
      });
    }

    const group = groups[index];
    group.total += 1;
    if (source.isConnected) {
      group.connected += 1;
    }
    const itemLabel = source.isConnected ? source.name : `(X)${source.name}`;
    group.items.push(itemLabel);
  }

  const items: StatusDisplayItem[] = [];
  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i];
    let state: StatusDisplayState = 'partial';
    if (group.connected === 0) {
      state = 'disconnected';
    } else if (group.connected === group.total) {
      state = 'connected';
    }
    const countText = `${group.connected}/${group.total}`;
    items.push({
      key: group.label,
      label: `${group.label}\n(${countText})`,
      state,
      title: `${group.label} (${countText})\n${group.items.join(', ')}`,
    });
  }

  return items;
};

interface HeaderProps {
  sourceStatuses: SourceStatus[];
  isStreamConnected: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

const Header: React.FC<HeaderProps> = ({ sourceStatuses, isStreamConnected, isMuted, onToggleMute }) => {
  const [now, setNow] = useState(new Date());
  const [streamClientTotal, setStreamClientTotal] = useState<number | null>(null);
  const statusItems = buildStatusItems(sourceStatuses);

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
        <div
          className={`p-1.5 md:p-2 rounded-lg shadow-[0_0_15px_rgba(15,23,42,0.4)] ${
            isStreamConnected
              ? 'bg-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.4)]'
              : 'bg-slate-600 shadow-[0_0_12px_rgba(71,85,105,0.35)]'
          }`}
        >
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
        <div className="flex items-center gap-1.5 md:gap-2 bg-slate-950/50 p-1 md:p-1.5 rounded-lg border border-slate-800 justify-center">
          <div className="hidden sm:flex px-1.5 border-r border-slate-800 flex-col items-center justify-center">
            <span className="text-[7px] font-black text-slate-500 uppercase leading-none tracking-tighter">DATA</span>
            <span className="text-[7px] font-black text-slate-500 uppercase leading-none tracking-tighter">STATUS</span>
          </div>
          <div className="flex items-start justify-center gap-x-1 gap-y-0.5 md:gap-x-1.5 md:gap-y-1 min-w-0">
            {statusItems.map((item) => {
              const visuals = STATUS_VISUALS[item.state];
              return (
                <div key={item.key} className="flex flex-col items-center min-w-0">
                  <div
                    className={`w-1 h-1 md:w-2 md:h-2 rounded-full mb-0.5 transition-all duration-500 ${visuals.dot}`}
                  />
                  <span
                    title={item.title ?? item.label}
                    className={`hidden sm:block text-[7px] md:text-[9px] font-semibold leading-tight whitespace-pre-line wrap-break-word text-center max-w-14 md:max-w-20 ${visuals.text}`}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? '알림음 켜기' : '알림음 끄기'}
            className="inline-flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-full border border-slate-700 bg-slate-950/60 text-slate-200 hover:text-white hover:border-slate-500 transition"
          >
            {isMuted ? <BellOff className="w-3 h-3 md:w-4 md:h-4" /> : <Bell className="w-3 h-3 md:w-4 md:h-4" />}
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
