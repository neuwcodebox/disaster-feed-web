import { EventLevel } from './types';

export const LEVEL_CONFIG = {
  [EventLevel.INFO]: {
    bg: 'bg-slate-500',
    text: 'text-white',
    border: 'border-slate-400',
    label: '정보',
    iconColor: 'text-slate-300',
  },
  [EventLevel.MINOR]: {
    bg: 'bg-blue-600',
    text: 'text-white',
    border: 'border-blue-400',
    label: '주의',
    iconColor: 'text-blue-200',
  },
  [EventLevel.MODERATE]: {
    bg: 'bg-yellow-500',
    text: 'text-slate-900',
    border: 'border-yellow-300',
    label: '경계',
    iconColor: 'text-yellow-800',
  },
  [EventLevel.SEVERE]: {
    bg: 'bg-orange-600',
    text: 'text-white',
    border: 'border-orange-400',
    label: '심각',
    iconColor: 'text-orange-200',
  },
  [EventLevel.CRITICAL]: {
    bg: 'bg-red-700',
    text: 'text-white',
    border: 'border-red-400',
    label: '위험',
    iconColor: 'text-red-100',
  },
};

export const MAX_CATEGORIES_DISPLAY = 6;
export const SIDEBAR_MIN_LEVEL = EventLevel.MODERATE;
