import { EventKinds, EventLevels, EventSources } from './types';

export const LEVEL_CONFIG = {
  [EventLevels.Info]: {
    bg: 'bg-slate-500',
    text: 'text-white',
    border: 'border-slate-400',
    label: '정보',
    iconColor: 'text-slate-300',
  },
  [EventLevels.Minor]: {
    bg: 'bg-blue-600',
    text: 'text-white',
    border: 'border-blue-400',
    label: '주의',
    iconColor: 'text-blue-200',
  },
  [EventLevels.Moderate]: {
    bg: 'bg-yellow-500',
    text: 'text-slate-900',
    border: 'border-yellow-300',
    label: '경계',
    iconColor: 'text-yellow-800',
  },
  [EventLevels.Severe]: {
    bg: 'bg-orange-600',
    text: 'text-white',
    border: 'border-orange-400',
    label: '심각',
    iconColor: 'text-orange-200',
  },
  [EventLevels.Critical]: {
    bg: 'bg-red-700',
    text: 'text-white',
    border: 'border-red-400',
    label: '위험',
    iconColor: 'text-red-100',
  },
};

export const EVENT_KIND_LABELS: Record<EventKinds, string> = {
  [EventKinds.Other]: '기타',
  [EventKinds.Quake]: '지진',
  [EventKinds.Ai]: 'AI',
  [EventKinds.Drought]: '가뭄',
  [EventKinds.Livestock]: '가축질병',
  [EventKinds.Wind]: '강풍',
  [EventKinds.Dry]: '건조',
  [EventKinds.Transport]: '교통',
  [EventKinds.TrafficCrash]: '교통사고',
  [EventKinds.TrafficCtrl]: '교통통제',
  [EventKinds.Finance]: '금융',
  [EventKinds.Snow]: '대설',
  [EventKinds.FineDust]: '미세먼지',
  [EventKinds.CivDef]: '민방공',
  [EventKinds.Collapse]: '붕괴',
  [EventKinds.Wildfire]: '산불',
  [EventKinds.Landslide]: '산사태',
  [EventKinds.Water]: '수도',
  [EventKinds.Fog]: '안개',
  [EventKinds.Energy]: '에너지',
  [EventKinds.Epidemic]: '전염병',
  [EventKinds.Blackout]: '정전',
  [EventKinds.Tsunami]: '지진해일',
  [EventKinds.Typhoon]: '태풍',
  [EventKinds.Terror]: '테러',
  [EventKinds.Telecom]: '통신',
  [EventKinds.Explosion]: '폭발',
  [EventKinds.Heat]: '폭염',
  [EventKinds.HighSeas]: '풍랑',
  [EventKinds.Cold]: '한파',
  [EventKinds.Rain]: '호우',
  [EventKinds.Flood]: '홍수',
  [EventKinds.Fire]: '화재',
  [EventKinds.Pollution]: '환경오염',
  [EventKinds.YellowDust]: '황사',
  [EventKinds.O3]: '오존',
};

export const STATUS_SOURCE_LABELS: Record<EventSources, string> = {
  [EventSources.SafekoreaSms]: '행안부\n(문자)',
  [EventSources.KmaMicroEarthquake]: '기상청\n(미소)',
  [EventSources.KmaPewsEarthquake]: '기상청\n(지진)',
  [EventSources.NfdsFireDispatch]: '소방청\n(화재)',
  [EventSources.KmaWeatherWarning]: '기상청\n(특보)',
  [EventSources.UticTrafficIncident]: '경찰청\n(교통)',
  [EventSources.AirkoreaPmWarning]: '환경부\n(PM)',
  [EventSources.AirkoreaO3Warning]: '환경부\n(O3)',
  [EventSources.ForestFireInfo]: '산림청\n(산불)',
};

export const EVENT_SOURCE_LABELS: Record<EventSources, string> = {
  [EventSources.SafekoreaSms]: '행안부',
  [EventSources.KmaMicroEarthquake]: '기상청',
  [EventSources.KmaPewsEarthquake]: '기상청',
  [EventSources.NfdsFireDispatch]: '소방청',
  [EventSources.KmaWeatherWarning]: '기상청',
  [EventSources.UticTrafficIncident]: '경찰청',
  [EventSources.AirkoreaPmWarning]: '환경부',
  [EventSources.AirkoreaO3Warning]: '환경부',
  [EventSources.ForestFireInfo]: '산림청',
};

export const SOURCE_DISPLAY_ORDER: EventSources[] = [
  EventSources.SafekoreaSms,
  EventSources.KmaMicroEarthquake,
  EventSources.KmaPewsEarthquake,
  EventSources.KmaWeatherWarning,
  EventSources.NfdsFireDispatch,
  EventSources.UticTrafficIncident,
  EventSources.AirkoreaPmWarning,
  EventSources.AirkoreaO3Warning,
  EventSources.ForestFireInfo,
];

export const MAX_CATEGORIES_DISPLAY = 6;
export const SIDEBAR_MIN_LEVEL = EventLevels.Moderate;
