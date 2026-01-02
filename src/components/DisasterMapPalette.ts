import { EventLevels } from '../types';

const REGION_FILL_ALPHA = 70;

export const LEVEL_COLORS: Record<EventLevels, [number, number, number, number]> = {
  [EventLevels.Info]: [160, 170, 180, 180],
  [EventLevels.Minor]: [70, 130, 230, 200],
  [EventLevels.Moderate]: [232, 210, 128, 210],
  [EventLevels.Severe]: [248, 140, 70, 220],
  [EventLevels.Critical]: [244, 112, 120, 230],
};

export const LEVEL_RADII: Record<EventLevels, number> = {
  [EventLevels.Info]: 3,
  [EventLevels.Minor]: 6,
  [EventLevels.Moderate]: 9,
  [EventLevels.Severe]: 16,
  [EventLevels.Critical]: 24,
};

export const getRegionFillColor = (level: EventLevels): [number, number, number, number] => {
  const [r, g, b] = LEVEL_COLORS[level];
  return [r, g, b, REGION_FILL_ALPHA];
};
