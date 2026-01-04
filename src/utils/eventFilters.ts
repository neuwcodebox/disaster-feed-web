import type { DisasterEvent } from '../types';

export const filterEventsByAge = (items: DisasterEvent[], nowMs: number, maxAgeMs: number): DisasterEvent[] => {
  if (maxAgeMs <= 0) {
    return items;
  }
  const threshold = nowMs - maxAgeMs;
  const filtered: DisasterEvent[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const event = items[i];
    if (event.timestamp >= threshold) {
      filtered.push(event);
    }
  }
  return filtered;
};
