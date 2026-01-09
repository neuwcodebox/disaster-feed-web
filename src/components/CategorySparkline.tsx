import type React from 'react';
import { EventLevels, type EventMetric } from '../types';

interface CategorySparklineProps {
  metrics: EventMetric[];
  hours?: number;
}

const HOUR_MS = 60 * 60 * 1000;
const MIN_BAR_HEIGHT = 1.5;
const CAP_HEIGHT = 1.5;

const LEVEL_BAR_COLOR: Record<EventLevels, string> = {
  [EventLevels.Info]: 'text-slate-400',
  [EventLevels.Minor]: 'text-blue-400',
  [EventLevels.Moderate]: 'text-yellow-400',
  [EventLevels.Severe]: 'text-orange-400',
  [EventLevels.Critical]: 'text-red-400',
};

const CategorySparkline: React.FC<CategorySparklineProps> = ({ metrics, hours = 12 }) => {
  const bucketCount = Math.max(2, hours);
  const buckets = new Array<number>(bucketCount).fill(0);
  const bucketMaxLevels = new Array<EventLevels>(bucketCount).fill(EventLevels.Info);
  const bucketHasEvents = new Array<boolean>(bucketCount).fill(false);
  const now = Date.now();
  const currentHourStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  const startTime = currentHourStart - (bucketCount - 1) * HOUR_MS;

  for (const metric of metrics) {
    if (metric.timestamp < startTime) {
      continue;
    }
    const index = Math.floor((metric.timestamp - startTime) / HOUR_MS);
    if (index >= bucketCount) {
      continue;
    }
    buckets[index] += 1;
    if (!bucketHasEvents[index] || metric.level > bucketMaxLevels[index]) {
      bucketMaxLevels[index] = metric.level;
    }
    bucketHasEvents[index] = true;
  }

  let maxScore = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    if (buckets[i] > maxScore) {
      maxScore = buckets[i];
    }
  }
  if (maxScore === 0) {
    maxScore = 1;
  }

  const width = 72;
  const height = 18;
  const gap = bucketCount > 18 ? 0.5 : 1;
  const barWidth = (width - gap * (bucketCount - 1)) / bucketCount;
  const bars: React.ReactElement[] = [];
  for (let i = 0; i < buckets.length; i += 1) {
    const score = buckets[i];
    const normalized = (score / maxScore) * height;
    const barHeight = Math.max(MIN_BAR_HEIGHT, normalized);
    const capHeight = Math.min(CAP_HEIGHT, barHeight);
    const x = i * (barWidth + gap);
    const y = height - barHeight;
    const level = bucketMaxLevels[i];
    const isEmpty = !bucketHasEvents[i];
    const bucketTime = startTime + i * HOUR_MS;
    const colorClass = LEVEL_BAR_COLOR[level];
    const baseOpacity = isEmpty ? 'opacity-25' : 'opacity-65';
    const capOpacity = isEmpty ? 'opacity-45' : 'opacity-90';

    bars.push(
      <g key={`bar-${bucketTime}`}>
        <rect
          x={x}
          y={y}
          width={barWidth}
          height={barHeight}
          rx={barWidth > 2 ? 1 : 0.5}
          fill="currentColor"
          className={`${colorClass} ${baseOpacity}`}
        />
        <rect
          x={x}
          y={y}
          width={barWidth}
          height={capHeight}
          rx={barWidth > 2 ? 1 : 0.5}
          fill="currentColor"
          className={`${colorClass} ${capOpacity}`}
        />
      </g>,
    );
  }

  return (
    <div className="flex items-center">
      <svg
        className="h-4 w-full md:h-5"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`최근 ${bucketCount}시간 이벤트 점수 막대 추이`}
      >
        {bars}
      </svg>
    </div>
  );
};

export default CategorySparkline;
