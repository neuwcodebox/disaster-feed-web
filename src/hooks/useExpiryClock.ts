import { useEffect, useState } from 'react';
import type { DisasterEvent, EventMetric } from '../types';

type UseExpiryClockOptions = {
  events: DisasterEvent[];
  metrics: EventMetric[];
  maxEventAgeMs: number;
  metricsWindowMs: number;
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

const getNextExpiryMs = (
  { events, metrics, maxEventAgeMs, metricsWindowMs }: UseExpiryClockOptions,
  nowMs: number,
): number | null => {
  let nextExpiry: number | null = null;

  if (maxEventAgeMs > 0 && events.length > 0) {
    const threshold = nowMs - maxEventAgeMs;
    const oldestEvent = findOldestWithinWindow(events, threshold);
    if (oldestEvent) {
      nextExpiry = oldestEvent.timestamp + maxEventAgeMs;
    }
  }

  if (metricsWindowMs > 0 && metrics.length > 0) {
    const threshold = nowMs - metricsWindowMs;
    const oldestMetric = findOldestWithinWindow(metrics, threshold);
    if (oldestMetric) {
      const metricExpiry = oldestMetric.timestamp + metricsWindowMs;
      if (nextExpiry === null || metricExpiry < nextExpiry) {
        nextExpiry = metricExpiry;
      }
    }
  }

  return nextExpiry;
};

export const useExpiryClock = (options: UseExpiryClockOptions): number => {
  const { events, metrics, maxEventAgeMs, metricsWindowMs } = options;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const latestEventTimestamp = events[0]?.timestamp ?? 0;
  const latestMetricTimestamp = metrics[0]?.timestamp ?? 0;

  useEffect(() => {
    if (latestEventTimestamp === 0 && latestMetricTimestamp === 0) {
      return;
    }
    setNowMs(Date.now());
  }, [latestEventTimestamp, latestMetricTimestamp]);

  useEffect(() => {
    const nextExpiry = getNextExpiryMs(
      {
        events,
        metrics,
        maxEventAgeMs,
        metricsWindowMs,
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
  }, [events, metrics, maxEventAgeMs, metricsWindowMs, nowMs]);

  return nowMs;
};
