import type { DisasterEvent, EventMetric } from '../types';

export const filterEventsByAge = (items: DisasterEvent[], nowMs: number, maxAgeMs: number): DisasterEvent[] => {
  if (maxAgeMs <= 0) {
    return items;
  }
  if (items.length === 0) {
    return items;
  }
  const threshold = nowMs - maxAgeMs;
  const oldest = items[items.length - 1];
  if (oldest.timestamp >= threshold) {
    return items;
  }
  let cutoffIndex = items.length;
  // timestamp 내림차순 정렬을 전제로 최초로 오래된 지점만 찾습니다.
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].timestamp < threshold) {
      cutoffIndex = i;
      break;
    }
  }
  if (cutoffIndex === items.length) {
    return items;
  }
  return items.slice(0, cutoffIndex);
};

export const filterMetricsByAge = (items: EventMetric[], nowMs: number, windowMs: number): EventMetric[] => {
  if (windowMs <= 0) {
    return items;
  }
  if (items.length === 0) {
    return items;
  }
  const threshold = nowMs - windowMs;
  const oldest = items[items.length - 1];
  if (oldest.timestamp >= threshold) {
    return items;
  }
  let cutoffIndex = items.length;
  // timestamp 내림차순 정렬을 전제로 최초로 오래된 지점만 찾습니다.
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].timestamp < threshold) {
      cutoffIndex = i;
      break;
    }
  }
  if (cutoffIndex === items.length) {
    return items;
  }
  return items.slice(0, cutoffIndex);
};
