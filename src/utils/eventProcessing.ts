import type { DisasterEvent, EventMetric } from '../types';
import { EventLevels } from '../types';

const LEVEL_BASE_SCORES: Record<EventLevels, number> = {
  [EventLevels.Info]: 10,
  [EventLevels.Minor]: 20,
  [EventLevels.Moderate]: 40,
  [EventLevels.Severe]: 80,
  [EventLevels.Critical]: 160,
};
const SCORE_DECAY_PER_MINUTE = 1;
const SCORE_DECAY_PER_MS = SCORE_DECAY_PER_MINUTE / 60000;

const getEventScoreWeight = (event: DisasterEvent): number => {
  const baseScore = LEVEL_BASE_SCORES[event.level] ?? 0;
  // 점수 감쇠율이 동일하므로 정렬용 가중치는 고정 값으로 계산합니다.
  return baseScore + event.timestamp * SCORE_DECAY_PER_MS;
};

export const compareEventsByOccurrence = (a: DisasterEvent, b: DisasterEvent): number => {
  if (a.timestamp !== b.timestamp) {
    return b.timestamp - a.timestamp;
  }
  return b.id.localeCompare(a.id);
};

export const compareMetricsByOccurrence = (a: EventMetric, b: EventMetric): number => {
  if (a.timestamp !== b.timestamp) {
    return b.timestamp - a.timestamp;
  }
  return b.id.localeCompare(a.id);
};

export const compareEventsByScoreStatic = (a: DisasterEvent, b: DisasterEvent): number => {
  const scoreDiff = getEventScoreWeight(b) - getEventScoreWeight(a);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }
  return compareEventsByOccurrence(a, b);
};

export const limitEventsByCategory = (items: DisasterEvent[], maxPerCategory: number): DisasterEvent[] => {
  const counts = new Map<string, number>();
  const limited: DisasterEvent[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const event = items[i];
    const count = counts.get(event.category) ?? 0;
    if (count >= maxPerCategory) {
      continue;
    }
    counts.set(event.category, count + 1);
    limited.push(event);
  }
  return limited;
};

export const insertSorted = <T>(items: T[], item: T, compare: (left: T, right: T) => number): T[] => {
  const next = items.slice();
  let insertIndex = next.length;
  for (let i = 0; i < next.length; i += 1) {
    if (compare(item, next[i]) < 0) {
      insertIndex = i;
      break;
    }
  }
  next.splice(insertIndex, 0, item);
  return next;
};

export const toMetricFromEvent = (event: DisasterEvent): EventMetric => ({
  id: event.id,
  category: event.category,
  level: event.level,
  timestamp: event.timestamp,
});
