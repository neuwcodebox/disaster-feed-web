import { EventLevels } from '../types';

export const MAX_EVENTS_PER_CATEGORY = 50;
export const METRICS_FETCH_LIMIT = 2000;
export const METRICS_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ALERT_SOUND_WINDOW_MS = 1000;
export const ALERT_SOUND_MIN_LEVEL = EventLevels.Moderate;
export const MAP_LARGE_SCREEN_QUERY = '(min-width: 1536px)';
export const ALERT_SOUND_LEVELS: EventLevels[] = [EventLevels.Moderate, EventLevels.Severe, EventLevels.Critical];
export const SCORE_RESORT_INTERVAL_MS = 15000;
export const MAX_EVENT_AGE_MS = 3 * 24 * 60 * 60 * 1000;
export const SIDEBAR_EVENT_LIMIT = 30;
