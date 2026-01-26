import { useEffect, useState } from 'react';
import type { DisasterEvent } from '../types';

type UseExpiryClockOptions = {
  events: DisasterEvent[];
  maxEventAgeMs: number;
};

const findOldestWithinWindow = <T extends { timestamp: number }>(items: T[], threshold: number): T | null => {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.timestamp >= threshold) {
      return item;
    }
  }
  return null;
};

const getNextExpiryMs = ({ events, maxEventAgeMs }: UseExpiryClockOptions, nowMs: number): number | null => {
  let nextExpiry: number | null = null;

  if (maxEventAgeMs > 0 && events.length > 0) {
    const threshold = nowMs - maxEventAgeMs;
    const oldestEvent = findOldestWithinWindow(events, threshold);
    if (oldestEvent) {
      nextExpiry = oldestEvent.timestamp + maxEventAgeMs;
    }
  }

  return nextExpiry;
};

export const useExpiryClock = (options: UseExpiryClockOptions): number => {
  const { events, maxEventAgeMs } = options;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const latestEventTimestamp = events[0]?.timestamp ?? 0;

  useEffect(() => {
    if (latestEventTimestamp === 0) {
      return;
    }
    setNowMs(Date.now());
  }, [latestEventTimestamp]);

  useEffect(() => {
    const nextExpiry = getNextExpiryMs(
      {
        events,
        maxEventAgeMs,
      },
      nowMs,
    );
    if (nextExpiry === null) {
      return;
    }

    const delay = Math.max(0, nextExpiry - nowMs);
    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now());
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [events, maxEventAgeMs, nowMs]);

  return nowMs;
};
