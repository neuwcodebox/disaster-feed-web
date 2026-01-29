import { EventLevels } from '../../types';

const REGION_FILL_ALPHA = 70;

export const LEVEL_COLORS: Record<EventLevels, [number, number, number, number]> = {
  [EventLevels.Info]: [98, 116, 142, 180],
  [EventLevels.Minor]: [21, 93, 252, 200],
  [EventLevels.Moderate]: [240, 177, 0, 210],
  [EventLevels.Severe]: [245, 74, 0, 220],
  [EventLevels.Critical]: [193, 0, 7, 230],
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
