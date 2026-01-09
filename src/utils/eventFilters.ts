import type { DisasterEvent, EventMetric } from '../types';

export const filterEventsByAge = (items: DisasterEvent[], nowMs: number, maxAgeMs: number): DisasterEvent[] => {
  if (maxAgeMs <= 0) {
    return items;
  }
  const threshold = nowMs - maxAgeMs;
  const filtered: DisasterEvent[] = [];
  // timestamp 내림차순 정렬을 전제로 오래된 구간에서 빠르게 종료합니다.
  for (let i = 0; i < items.length; i += 1) {
    const event = items[i];
    if (event.timestamp < threshold) {
      break;
    }
    filtered.push(event);
  }
  return filtered;
};

export const filterMetricsByAge = (items: EventMetric[], nowMs: number, windowMs: number): EventMetric[] => {
  if (windowMs <= 0) {
    return items;
  }
  const threshold = nowMs - windowMs;
  const filtered: EventMetric[] = [];
  // timestamp 내림차순 정렬을 전제로 오래된 구간에서 빠르게 종료합니다.
  for (let i = 0; i < items.length; i += 1) {
    const metric = items[i];
    if (metric.timestamp < threshold) {
      break;
    }
    filtered.push(metric);
  }
  return filtered;
};
