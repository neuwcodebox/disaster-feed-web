import { SOURCE_DISPLAY_ORDER, STATUS_SOURCE_LABELS } from '../constants';
import type { SourceStatus } from '../types';

export const createInitialSourceStatuses = (): SourceStatus[] => {
  const initial: SourceStatus[] = [];
  for (let i = 0; i < SOURCE_DISPLAY_ORDER.length; i += 1) {
    const sourceId = SOURCE_DISPLAY_ORDER[i];
    initial.push({
      sourceId,
      name: STATUS_SOURCE_LABELS[sourceId] ?? `#${sourceId}`,
      isConnected: false,
      lastUpdate: 0,
    });
  }
  return initial;
};

export const INITIAL_SOURCE_STATUSES = createInitialSourceStatuses();
