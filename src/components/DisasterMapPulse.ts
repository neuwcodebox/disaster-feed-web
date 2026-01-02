import { LEVEL_COLORS, LEVEL_RADII } from './DisasterMapPalette';
import type { PulsePoint, PulseRegion } from './DisasterMapTypes';

export const PULSE_DURATION_MS = 2400;
export const REGION_PULSE_DURATION_MS = 2800;

const PULSE_RADIUS_OFFSET = 8;
const PULSE_RADIUS_GROWTH = 42;
const PULSE_MAX_ALPHA = 210;
const REGION_PULSE_MAX_ALPHA = 130;
const REGION_PULSE_LINE_ALPHA = 210;

const easeOutCubic = (value: number): number => 1 - (1 - value) ** 3;

const getPulseProgress = (startedAt: number, now: number, duration: number): number => {
  if (now <= startedAt) {
    return 0;
  }
  const elapsed = now - startedAt;
  if (elapsed >= duration) {
    return 1;
  }
  return elapsed / duration;
};

export const getPulseRadius = (point: PulsePoint, now: number, scale = 1): number => {
  const progress = easeOutCubic(getPulseProgress(point.startedAt, now, PULSE_DURATION_MS));
  const baseRadius = LEVEL_RADII[point.level] ?? 6;
  return (baseRadius + PULSE_RADIUS_OFFSET + PULSE_RADIUS_GROWTH * progress) * scale;
};

export const getPulseColor = (point: PulsePoint, now: number): [number, number, number, number] => {
  const progress = getPulseProgress(point.startedAt, now, PULSE_DURATION_MS);
  const [r, g, b] = LEVEL_COLORS[point.level];
  const alpha = Math.round(PULSE_MAX_ALPHA * (1 - progress));
  return [r, g, b, alpha];
};

export const getRegionPulseFillColor = (pulse: PulseRegion, now: number): [number, number, number, number] => {
  const progress = easeOutCubic(getPulseProgress(pulse.startedAt, now, REGION_PULSE_DURATION_MS));
  const [r, g, b] = LEVEL_COLORS[pulse.level];
  const alpha = Math.round(REGION_PULSE_MAX_ALPHA * (1 - progress));
  return [r, g, b, alpha];
};

export const getRegionPulseLineColor = (pulse: PulseRegion, now: number): [number, number, number, number] => {
  const progress = easeOutCubic(getPulseProgress(pulse.startedAt, now, REGION_PULSE_DURATION_MS));
  const [r, g, b] = LEVEL_COLORS[pulse.level];
  const alpha = Math.round(REGION_PULSE_LINE_ALPHA * (1 - progress));
  return [r, g, b, alpha];
};
