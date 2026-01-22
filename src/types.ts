export enum EventLevels {
  Info = 1,
  Minor = 2,
  Moderate = 3,
  Severe = 4,
  Critical = 5,
}

export enum EventKinds {
  Other = 1,
  Quake = 2,
  Ai = 3,
  Drought = 4,
  Livestock = 5,
  Wind = 6,
  Dry = 7,
  Transport = 8,
  TrafficCrash = 9,
  TrafficCtrl = 10,
  Finance = 11,
  Snow = 12,
  FineDust = 13,
  CivDef = 14,
  Collapse = 15,
  Wildfire = 16,
  Landslide = 17,
  Water = 18,
  Fog = 19,
  Energy = 20,
  Epidemic = 21,
  Blackout = 22,
  Tsunami = 23,
  Typhoon = 24,
  Terror = 25,
  Telecom = 26,
  Explosion = 27,
  Heat = 28,
  HighSeas = 29,
  Cold = 30,
  Rain = 31,
  Flood = 32,
  Fire = 33,
  Pollution = 34,
  YellowDust = 35,
  O3 = 36,
  CrowdDensity = 37,
  WildAnimal = 38,
  Cyber = 39,
  SpaceWeather = 40,
}

export enum EventSources {
  SafekoreaSms = 1,
  KmaMicroEarthquake = 2,
  KmaPewsEarthquake = 3,
  NfdsFireDispatch = 4,
  KmaWeatherWarning = 5,
  UticTrafficIncident = 6,
  AirkoreaPmWarning = 7,
  AirkoreaO3Warning = 8,
  ForestFireInfo = 9,
  YnaNews = 10,
  NcscCyberCrisis = 11,
  NctcTerrorAlert = 12,
  KpxPowerSupply = 13,
  FloodAlert = 14,
  ForestFireWarning = 15,
  LandslideForecast = 16,
  MoisPressRelease = 17,
  MsitPressRelease = 18,
  KasaSpaceWeatherWarning = 19,
  KasaSpaceWeatherCrisisAlert = 20,
  KmaOverseasEarthquake = 21,
}

export type EventGeo = {
  lat: number;
  lng: number;
};

export interface DisasterEvent {
  id: string;
  sourceId: number;
  source: string;
  kind: number;
  category: string;
  title: string;
  content?: string;
  level: EventLevels;
  timestamp: number;
  fetchedAt: string;
  occurredAt: string | null;
  regionText: string | null;
  geo: EventGeo | null;
  regionCodes: string[] | null;
  isRealtime: boolean;
}

export type EventMetric = {
  id: string;
  category: string;
  level: EventLevels;
  timestamp: number;
};

export type CategoryGroup = {
  category: string;
  latestEvent: DisasterEvent;
  events: DisasterEvent[];
};

export type CategorySortMode = 'latest' | 'score';

export interface SourceStatus {
  sourceId: number;
  name: string;
  isConnected: boolean;
  lastUpdate: number;
}
