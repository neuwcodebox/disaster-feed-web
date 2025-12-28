import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import CategoryGrid from './components/CategoryGrid';
import FooterMarquee from './components/FooterMarquee';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { MAX_CATEGORIES_DISPLAY, SIDEBAR_MIN_LEVEL } from './constants';
import { type CategoryGroup, type DisasterEvent, EventLevel, type SourceStatus } from './types';

const App: React.FC = () => {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([
    { name: '기상청', isConnected: true, lastUpdate: Date.now() },
    { name: '산림청', isConnected: true, lastUpdate: Date.now() },
    { name: '행안부', isConnected: true, lastUpdate: Date.now() },
    { name: '환경부', isConnected: true, lastUpdate: Date.now() },
    { name: '해경청', isConnected: true, lastUpdate: Date.now() },
  ]);

  useEffect(() => {
    const mockCategories = ['지진', '산불', '호우', '태풍', '대설', '강풍', '황사', '폭염'];
    const mockSources = ['기상청', '산림청', '행안부', '환경부', '해경청'];
    const mockLevels = Object.values(EventLevel);

    const createRandomEvent = (): DisasterEvent => {
      const source = mockSources[Math.floor(Math.random() * mockSources.length)];
      const category = mockCategories[Math.floor(Math.random() * mockCategories.length)];
      const level = mockLevels[Math.floor(Math.random() * mockLevels.length)];

      return {
        id: Math.random().toString(36).substr(2, 9),
        category,
        source,
        level,
        title: `${category} 관련 긴급 안내 - ${source}`,
        content:
          level === EventLevel.CRITICAL || level === EventLevel.SEVERE
            ? `인근 주민들께서는 즉시 안전한 곳으로 대피하시고, TV나 라디오 등 재난 방송에 귀를 기울여 주시기 바랍니다.`
            : `${category} 상황을 모니터링 중입니다. 외출 시 유의하시기 바랍니다.`,
        timestamp: Date.now(),
      };
    };

    const initialEvents = Array.from({ length: 30 }).map(createRandomEvent);
    setEvents(initialEvents);

    const interval = setInterval(() => {
      const newEvent = createRandomEvent();
      setEvents((prev) => [newEvent, ...prev].slice(0, 100));

      // Update source status when event arrives
      setSourceStatuses((prev) =>
        prev.map((s) => (s.name === newEvent.source ? { ...s, lastUpdate: Date.now(), isConnected: true } : s)),
      );
    }, 6000);

    // Simulate occasional disconnection for broadcast realism
    const connectionSimulation = setInterval(() => {
      setSourceStatuses((prev) =>
        prev.map((s) => {
          // Randomly "disconnect" or "reconnect"
          const isStillConnected = Math.random() > 0.05;
          return { ...s, isConnected: isStillConnected };
        }),
      );
    }, 15000);

    return () => {
      clearInterval(interval);
      clearInterval(connectionSimulation);
    };
  }, []);

  const sidebarEvents = useMemo(() => {
    return events
      .filter((e) => {
        const priorityMap = {
          [EventLevel.INFO]: 0,
          [EventLevel.MINOR]: 1,
          [EventLevel.MODERATE]: 2,
          [EventLevel.SEVERE]: 3,
          [EventLevel.CRITICAL]: 4,
        };
        return priorityMap[e.level] >= priorityMap[SIDEBAR_MIN_LEVEL];
      })
      .slice(0, 8);
  }, [events]);

  const categoryGroups = useMemo(() => {
    const groups: Record<string, DisasterEvent[]> = {};
    events.forEach((e) => {
      if (!groups[e.category]) {
        groups[e.category] = [];
      }
      groups[e.category].push(e);
    });

    const sortedGroups: CategoryGroup[] = Object.keys(groups).map((cat) => ({
      category: cat,
      latestEvent: groups[cat][0],
      events: groups[cat],
    }));

    return sortedGroups
      .sort((a, b) => b.latestEvent.timestamp - a.latestEvent.timestamp)
      .slice(0, MAX_CATEGORIES_DISPLAY);
  }, [events]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 text-slate-50 border-[12px] border-slate-900 select-none">
      <Header sourceStatuses={sourceStatuses} />

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Recent Critical/Severe Events */}
        <Sidebar events={sidebarEvents} />

        {/* Right Main Grid: Category-wise latest events with fixed layout */}
        <CategoryGrid groups={categoryGroups} />
      </main>

      {/* Ticker footer for additional broadcast feel */}
      <FooterMarquee events={events.slice(0, 10)} />
    </div>
  );
};

export default App;
