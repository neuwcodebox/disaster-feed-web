import type { DisasterEvent, EventLevels } from '../../types';

export type RegionLevels = {
  codes2: Map<string, EventLevels>;
  codes5: Map<string, EventLevels>;
};

export type GeoRegionProperties = {
  SIG_CD: string;
  SIG_KOR_NM?: string;
  sido?: string;
};

export type GeoRegionPolygonGeometry = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type GeoRegionMultiPolygonGeometry = {
  type: 'MultiPolygon';
  coordinates: number[][][][];
};

export type GeoRegionGeometry = GeoRegionPolygonGeometry | GeoRegionMultiPolygonGeometry;

export type GeoRegionFeature = {
  type: 'Feature';
  properties: GeoRegionProperties;
  geometry: GeoRegionGeometry;
};

export type GeoRegionFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoRegionFeature[];
};

export type GeoRegionIndex = {
  byCode: Map<string, GeoRegionFeature>;
  byPrefix: Map<string, GeoRegionFeature[]>;
};

export type GeoRegionSource = 'current' | 'legacy';

export type ResolvedRegionMatch = {
  code: string;
  features: GeoRegionFeature[];
  isWide: boolean;
  source: GeoRegionSource;
};

export type EmojiLabel = {
  id: string;
  position: [number, number];
  level: EventLevels;
  tokens: string[];
  size: number;
  events: DisasterEvent[];
};

export type EmojiMarker = {
  id: string;
  tokens: string[];
  x: number;
  y: number;
  size: number;
  level: EventLevels;
};

export type PulsePoint = {
  id: string;
  position: [number, number];
  level: EventLevels;
  title: string;
  startedAt: number;
};

export type PulseRegion = {
  code: string;
  level: EventLevels;
  startedAt: number;
  isWide: boolean;
  source: GeoRegionSource;
};
