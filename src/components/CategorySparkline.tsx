import type React from 'react';
import { EventLevels, type EventMetric } from '../types';

interface CategorySparklineProps {
  metrics: EventMetric[];
  hours?: number;
}

const HOUR_MS = 60 * 60 * 1000;
const MIN_BAR_HEIGHT = 1.5;
const CAP_HEIGHT = 1.5;
const BASELINE_MAX_SCORE = 5;

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
  const displayMaxScore = Math.max(BASELINE_MAX_SCORE, maxScore);
  const normalizedMaxScore = displayMaxScore;

  const width = 72;
  const height = 18;
  const gap = bucketCount > 18 ? 0.5 : 1;
  const barWidth = (width - gap * (bucketCount - 1)) / bucketCount;
  const guideLines: React.ReactElement[] = [];
  if (displayMaxScore > 0) {
    const GUIDE_STEP = 10;
    const GUIDE_STEP_LARGE = 50;
    const MAX_GUIDE_COUNT = 4;
    const guideCount = Math.floor((displayMaxScore - 1) / GUIDE_STEP);
    const useLargeStep = guideCount > MAX_GUIDE_COUNT;
    const ticks10: number[] = [];
    const ticks50: number[] = [];
    const showFineGuides = displayMaxScore <= 100;

    if (showFineGuides) {
      for (let tick = GUIDE_STEP; tick < displayMaxScore; tick += GUIDE_STEP) {
        ticks10.push(tick);
      }
    }

    if (useLargeStep) {
      for (let tick = GUIDE_STEP_LARGE; tick < displayMaxScore; tick += GUIDE_STEP_LARGE) {
        ticks50.push(tick);
      }
    }

    const renderGuideLine = (tickValue: number, className: string, strokeWidth: number) => {
      const y = height - (tickValue / normalizedMaxScore) * height;

      guideLines.push(
        <line
          key={`guide-line-${tickValue}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="currentColor"
          className={className}
          strokeWidth={strokeWidth}
        />,
      );
    };

    for (let i = 0; i < ticks10.length; i += 1) {
      renderGuideLine(ticks10[i], 'text-slate-700/50', 0.6);
    }

    for (let i = 0; i < ticks50.length; i += 1) {
      renderGuideLine(ticks50[i], 'text-slate-600/80', 0.8);
    }
  }
  const bars: React.ReactElement[] = [];
  for (let i = 0; i < buckets.length; i += 1) {
    const score = buckets[i];
    const normalized = (score / normalizedMaxScore) * height;
    const barHeight = Math.max(MIN_BAR_HEIGHT, normalized);
    const capHeight = Math.min(CAP_HEIGHT, barHeight);
    const x = i * (barWidth + gap);
    const y = height - barHeight;
    const level = bucketMaxLevels[i];
    const isEmpty = !bucketHasEvents[i];
    const isCurrentBar = i === bucketCount - 1;
    const bucketTime = startTime + i * HOUR_MS;
    const colorClass = LEVEL_BAR_COLOR[level];
    const baseOpacity = isEmpty ? 'opacity-25' : 'opacity-65';
    const capOpacity = isEmpty ? 'opacity-45' : 'opacity-90';
    const pulseOpacity = isEmpty ? 'opacity-45' : 'opacity-90';

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
          className={`${colorClass} ${isCurrentBar ? pulseOpacity : capOpacity}`}
        >
          {isCurrentBar ? (
            <animate attributeName="opacity" values="0.35;0.95;0.35" dur="1.8s" repeatCount="indefinite" />
          ) : null}
        </rect>
      </g>,
    );
  }

  return (
    <div className="relative w-full h-4 md:h-5">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`최근 ${bucketCount}시간 이벤트 점수 막대 추이`}
      >
        {guideLines}
        {bars}
      </svg>
    </div>
  );
};

export default CategorySparkline;
