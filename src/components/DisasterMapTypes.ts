import type { EventLevels } from '../types';

export type RegionLevels = {
  codes2: Map<string, EventLevels>;
  codes5: Map<string, EventLevels>;
};

export type GeoRegionProperties = {
  SIG_CD: string;
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

export type EmojiLabel = {
  id: string;
  position: [number, number];
  level: EventLevels;
  tokens: string[];
  size: number;
};

export type EmojiMarker = {
  id: string;
  tokens: string[];
  x: number;
  y: number;
  size: number;
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
};
