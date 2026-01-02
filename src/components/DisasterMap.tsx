import type { Layer } from '@deck.gl/core';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { MapIcon, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getEventKindIcon } from '../constants';
import { type DisasterEvent, EventLevels } from '../types';
import CapitalInsetMap from './CapitalInsetMap';
import { getRegionFillColor, LEVEL_COLORS, LEVEL_RADII } from './DisasterMapPalette';
import {
  getPulseColor,
  getPulseRadius,
  getRegionPulseFillColor,
  getRegionPulseLineColor,
  PULSE_DURATION_MS,
  REGION_PULSE_DURATION_MS,
} from './DisasterMapPulse';
import type {
  EmojiLabel,
  GeoRegionFeature,
  GeoRegionFeatureCollection,
  GeoRegionIndex,
  GeoRegionProperties,
  PulsePoint,
  PulseRegion,
  RegionLevels,
} from './DisasterMapTypes';

interface DisasterMapProps {
  events: DisasterEvent[];
  isOpen: boolean;
  isLargeScreen: boolean;
  onClose: () => void;
}

type MapPoint = {
  id: string;
  position: [number, number];
  level: EventLevels;
  title: string;
};

type EmojiMarker = {
  id: string;
  tokens: string[];
  x: number;
  y: number;
  size: number;
};

type PulseRegionLookup = {
  codes2: Map<string, PulseRegion>;
  codes5: Map<string, PulseRegion>;
};

type RegionKindSummary = {
  kindLevels: Map<number, EventLevels>;
  level: EventLevels;
};

type RegionKindSummaries = {
  codes2: Map<string, RegionKindSummary>;
  codes5: Map<string, RegionKindSummary>;
};

type RegionCentroidIndex = {
  byCode: Map<string, [number, number]>;
  byPrefix: Map<string, [number, number]>;
};

type PolygonCentroid = {
  position: [number, number];
  area: number;
};

const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const MAP_CENTER: [number, number] = [127.7, 36.5];

const EMOJI_SIZES: Record<EventLevels, number> = {
  [EventLevels.Info]: 10,
  [EventLevels.Minor]: 11,
  [EventLevels.Moderate]: 12,
  [EventLevels.Severe]: 13,
  [EventLevels.Critical]: 15,
};

const PULSE_MAX_POINTS = 12;
const REGION_PULSE_LINE_WIDTH = 2.2;
const REGION_PULSE_MAX_AREAS = 10;
const MAX_EMOJI_PER_LABEL = 8;
const POINT_CLUSTER_PRECISION = 10000;
const EMPTY_GEOJSON: GeoRegionFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const mergePulseRegions = (prev: PulseRegion[], incoming: PulseRegion[]): PulseRegion[] => {
  if (incoming.length === 0) {
    return prev;
  }
  const merged = new Map<string, PulseRegion>();
  for (let i = 0; i < prev.length; i += 1) {
    const pulse = prev[i];
    const key = `${pulse.isWide ? '2' : '5'}-${pulse.code}`;
    merged.set(key, pulse);
  }
  for (let i = 0; i < incoming.length; i += 1) {
    const pulse = incoming[i];
    const key = `${pulse.isWide ? '2' : '5'}-${pulse.code}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, pulse);
      continue;
    }
    const level = Math.max(existing.level, pulse.level);
    const startedAt = Math.max(existing.startedAt, pulse.startedAt);
    merged.set(key, { ...pulse, level, startedAt });
  }
  const combined: PulseRegion[] = [];
  for (const value of merged.values()) {
    combined.push(value);
  }
  if (combined.length <= REGION_PULSE_MAX_AREAS) {
    return combined;
  }
  combined.sort((a, b) => a.startedAt - b.startedAt);
  return combined.slice(combined.length - REGION_PULSE_MAX_AREAS);
};

const normalizeRegionCode = (code: string): string | null => {
  const digits = code.replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  if (digits.length >= 10) {
    return digits.slice(0, 10);
  }
  return digits.padEnd(10, '0');
};

const resolveRegionPrefix = (normalized: string): string => {
  const sigungu = normalized.slice(2, 5);
  if (sigungu === '000') {
    return normalized.slice(0, 2);
  }
  return normalized.slice(0, 5);
};

const collectRegionLevels = (events: DisasterEvent[]): RegionLevels => {
  const codes2 = new Map<string, EventLevels>();
  const codes5 = new Map<string, EventLevels>();
  for (let i = 0; i < events.length; i += 1) {
    const regionCodes = events[i].regionCodes;
    const level = events[i].level;
    if (!regionCodes) {
      continue;
    }
    for (let j = 0; j < regionCodes.length; j += 1) {
      const normalized = normalizeRegionCode(regionCodes[j]);
      if (!normalized) {
        continue;
      }
      const prefix = resolveRegionPrefix(normalized);
      if (prefix.length === 2) {
        const existing = codes2.get(prefix);
        if (!existing || level > existing) {
          codes2.set(prefix, level);
        }
      } else {
        const existing = codes5.get(prefix);
        if (!existing || level > existing) {
          codes5.set(prefix, level);
        }
      }
    }
  }
  return { codes2, codes5 };
};

const collectEventPoints = (events: DisasterEvent[]): MapPoint[] => {
  const points: MapPoint[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!event.geo) {
      continue;
    }
    points.push({
      id: event.id,
      position: [event.geo.lng, event.geo.lat],
      level: event.level,
      title: event.title,
    });
  }
  return points;
};

const ensureRegionKindSummary = (target: Map<string, RegionKindSummary>, code: string): RegionKindSummary => {
  const existing = target.get(code);
  if (existing) {
    return existing;
  }
  const created: RegionKindSummary = {
    kindLevels: new Map(),
    level: EventLevels.Info,
  };
  target.set(code, created);
  return created;
};

const updateKindLevels = (target: Map<number, EventLevels>, kind: number, level: EventLevels) => {
  const existing = target.get(kind);
  if (!existing || level > existing) {
    target.set(kind, level);
  }
};

const buildEmojiTokens = (kindLevels: Map<number, EventLevels>, limit: number): string[] => {
  const entries: { kind: number; level: EventLevels }[] = [];
  for (const [kind, level] of kindLevels.entries()) {
    entries.push({ kind, level });
  }
  if (entries.length === 0) {
    return [];
  }
  entries.sort((a, b) => {
    if (a.level !== b.level) {
      return b.level - a.level;
    }
    return a.kind - b.kind;
  });
  const icons: string[] = [];
  const seenIcons = new Set<string>();
  for (let i = 0; i < entries.length; i += 1) {
    const icon = getEventKindIcon(entries[i].kind);
    if (seenIcons.has(icon)) {
      continue;
    }
    seenIcons.add(icon);
    icons.push(icon);
  }
  if (icons.length <= limit) {
    return icons;
  }
  const trimmed = icons.slice(0, limit);
  trimmed.push(`+${icons.length - limit}`);
  return trimmed;
};

const collectPointEmojiLabels = (events: DisasterEvent[]): EmojiLabel[] => {
  const clusters = new Map<
    string,
    { lngSum: number; latSum: number; count: number; level: EventLevels; kinds: Map<number, EventLevels> }
  >();
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!event.geo) {
      continue;
    }
    const keyLng = Math.round(event.geo.lng * POINT_CLUSTER_PRECISION);
    const keyLat = Math.round(event.geo.lat * POINT_CLUSTER_PRECISION);
    const key = `${keyLng}:${keyLat}`;
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = {
        lngSum: 0,
        latSum: 0,
        count: 0,
        level: event.level,
        kinds: new Map<number, EventLevels>(),
      };
      clusters.set(key, cluster);
    }
    cluster.lngSum += event.geo.lng;
    cluster.latSum += event.geo.lat;
    cluster.count += 1;
    if (event.level > cluster.level) {
      cluster.level = event.level;
    }
    updateKindLevels(cluster.kinds, event.kind, event.level);
  }
  const labels: EmojiLabel[] = [];
  for (const [key, cluster] of clusters.entries()) {
    const tokens = buildEmojiTokens(cluster.kinds, MAX_EMOJI_PER_LABEL);
    if (tokens.length === 0) {
      continue;
    }
    labels.push({
      id: `point-${key}`,
      position: [cluster.lngSum / cluster.count, cluster.latSum / cluster.count],
      level: cluster.level,
      tokens,
      size: EMOJI_SIZES[cluster.level] ?? 14,
    });
  }
  return labels;
};

const collectRegionKindSummaries = (events: DisasterEvent[]): RegionKindSummaries => {
  const codes2 = new Map<string, RegionKindSummary>();
  const codes5 = new Map<string, RegionKindSummary>();
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!event.regionCodes) {
      continue;
    }
    for (let j = 0; j < event.regionCodes.length; j += 1) {
      const normalized = normalizeRegionCode(event.regionCodes[j]);
      if (!normalized) {
        continue;
      }
      const prefix = resolveRegionPrefix(normalized);
      const target = prefix.length === 2 ? codes2 : codes5;
      const summary = ensureRegionKindSummary(target, prefix);
      if (event.level > summary.level) {
        summary.level = event.level;
      }
      updateKindLevels(summary.kindLevels, event.kind, event.level);
    }
  }
  return { codes2, codes5 };
};

const getRingCentroid = (ring: number[][]): PolygonCentroid | null => {
  if (ring.length < 3) {
    return null;
  }
  let areaSum = 0;
  let cx = 0;
  let cy = 0;
  const count = ring.length;
  for (let i = 0; i < count; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % count];
    const cross = x0 * y1 - x1 * y0;
    areaSum += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (!Number.isFinite(areaSum) || Math.abs(areaSum) < 1e-8) {
    let avgX = 0;
    let avgY = 0;
    for (let i = 0; i < count; i += 1) {
      avgX += ring[i][0];
      avgY += ring[i][1];
    }
    return {
      position: [avgX / count, avgY / count],
      area: 1,
    };
  }
  const area = areaSum / 2;
  return {
    position: [cx / (6 * area), cy / (6 * area)],
    area: Math.abs(area),
  };
};

const getFeatureCentroid = (feature: GeoRegionFeature): PolygonCentroid | null => {
  const geometry = feature.geometry;
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];
    return ring ? getRingCentroid(ring) : null;
  }
  if (geometry.type === 'MultiPolygon') {
    let best: PolygonCentroid | null = null;
    for (let i = 0; i < geometry.coordinates.length; i += 1) {
      const ring = geometry.coordinates[i][0];
      if (!ring) {
        continue;
      }
      const centroid = getRingCentroid(ring);
      if (!centroid) {
        continue;
      }
      if (!best || centroid.area > best.area) {
        best = centroid;
      }
    }
    return best;
  }
  return null;
};

const buildRegionCentroids = (regionIndex: GeoRegionIndex | null): RegionCentroidIndex | null => {
  if (!regionIndex) {
    return null;
  }
  const byCode = new Map<string, [number, number]>();
  const byCodeArea = new Map<string, number>();
  for (const [code, feature] of regionIndex.byCode.entries()) {
    const centroid = getFeatureCentroid(feature);
    if (!centroid) {
      continue;
    }
    byCode.set(code, centroid.position);
    byCodeArea.set(code, centroid.area);
  }
  const byPrefix = new Map<string, [number, number]>();
  for (const [prefix, features] of regionIndex.byPrefix.entries()) {
    let sumLng = 0;
    let sumLat = 0;
    let totalArea = 0;
    for (let i = 0; i < features.length; i += 1) {
      const code = features[i].properties.SIG_CD;
      const position = byCode.get(code);
      const area = byCodeArea.get(code);
      if (!position || !area) {
        continue;
      }
      sumLng += position[0] * area;
      sumLat += position[1] * area;
      totalArea += area;
    }
    if (totalArea > 0) {
      byPrefix.set(prefix, [sumLng / totalArea, sumLat / totalArea]);
    }
  }
  return { byCode, byPrefix };
};

const buildRegionEmojiLabels = (
  events: DisasterEvent[],
  centroids: RegionCentroidIndex | null,
  regionIndex: GeoRegionIndex | null,
): EmojiLabel[] => {
  if (!centroids || !regionIndex) {
    return [];
  }
  const summaries = collectRegionKindSummaries(events);
  const labels: EmojiLabel[] = [];
  const codes5WithLabels = new Set<string>();
  for (const [code, summary] of summaries.codes5.entries()) {
    const position = centroids.byCode.get(code);
    if (!position) {
      continue;
    }
    const tokens = buildEmojiTokens(summary.kindLevels, MAX_EMOJI_PER_LABEL);
    if (tokens.length === 0) {
      continue;
    }
    labels.push({
      id: `region-5-${code}`,
      position,
      level: summary.level,
      tokens,
      size: EMOJI_SIZES[summary.level] ?? 12,
    });
    codes5WithLabels.add(code);
  }
  for (const [code, summary] of summaries.codes2.entries()) {
    const features = regionIndex.byPrefix.get(code);
    if (!features) {
      continue;
    }
    const tokens = buildEmojiTokens(summary.kindLevels, MAX_EMOJI_PER_LABEL);
    if (tokens.length === 0) {
      continue;
    }
    for (let i = 0; i < features.length; i += 1) {
      const regionCode = features[i].properties.SIG_CD;
      if (codes5WithLabels.has(regionCode)) {
        continue;
      }
      const position = centroids.byCode.get(regionCode);
      if (!position) {
        continue;
      }
      labels.push({
        id: `region-2-${code}-${regionCode}`,
        position,
        level: summary.level,
        tokens,
        size: EMOJI_SIZES[summary.level] ?? 12,
      });
    }
  }
  return labels;
};

const projectEmojiMarkers = (labels: EmojiLabel[], map: maplibregl.Map): EmojiMarker[] => {
  const markers: EmojiMarker[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const point = map.project(new maplibregl.LngLat(label.position[0], label.position[1]));
    markers.push({
      id: label.id,
      tokens: label.tokens,
      x: point.x,
      y: point.y,
      size: label.size,
    });
  }
  return markers;
};

const DisasterMap: React.FC<DisasterMapProps> = ({ events, isOpen, isLargeScreen, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [regionData, setRegionData] = useState<GeoRegionFeatureCollection | null>(null);
  const [pulsePoints, setPulsePoints] = useState<PulsePoint[]>([]);
  const [pulseRegions, setPulseRegions] = useState<PulseRegion[]>([]);
  const [pulseNow, setPulseNow] = useState(0);
  const [pointEmojiMarkers, setPointEmojiMarkers] = useState<EmojiMarker[]>([]);
  const [regionEmojiMarkers, setRegionEmojiMarkers] = useState<EmojiMarker[]>([]);
  const knownEventIdsRef = useRef<Set<string>>(new Set());
  const hasSeededEventsRef = useRef(false);
  const pointEmojiLabelsRef = useRef<EmojiLabel[]>([]);
  const regionEmojiLabelsRef = useRef<EmojiLabel[]>([]);

  const regionLevels = useMemo(() => collectRegionLevels(events), [events]);
  const eventPoints = useMemo(() => collectEventPoints(events), [events]);
  const regionIndex = useMemo<GeoRegionIndex | null>(() => {
    if (!regionData) {
      return null;
    }
    const byCode = new Map<string, GeoRegionFeature>();
    const byPrefix = new Map<string, GeoRegionFeature[]>();
    const features = regionData.features;
    for (let i = 0; i < features.length; i += 1) {
      const feature = features[i];
      const code = feature.properties.SIG_CD;
      byCode.set(code, feature);
      const prefix = code.slice(0, 2);
      const list = byPrefix.get(prefix);
      if (list) {
        list.push(feature);
      } else {
        byPrefix.set(prefix, [feature]);
      }
    }
    return { byCode, byPrefix };
  }, [regionData]);
  const regionCentroids = useMemo(() => buildRegionCentroids(regionIndex), [regionIndex]);
  const regionEmojiLabels = useMemo(
    () => buildRegionEmojiLabels(events, regionCentroids, regionIndex),
    [events, regionCentroids, regionIndex],
  );
  const pointEmojiLabels = useMemo(() => collectPointEmojiLabels(events), [events]);
  const pulseRegionLookup = useMemo<PulseRegionLookup>(() => {
    const codes2 = new Map<string, PulseRegion>();
    const codes5 = new Map<string, PulseRegion>();
    for (let i = 0; i < pulseRegions.length; i += 1) {
      const pulse = pulseRegions[i];
      if (pulse.isWide) {
        codes2.set(pulse.code, pulse);
      } else {
        codes5.set(pulse.code, pulse);
      }
    }
    return { codes2, codes5 };
  }, [pulseRegions]);
  const pulseRegionFeatures = useMemo<GeoRegionFeature[]>(() => {
    if (!regionIndex || pulseRegions.length === 0) {
      return [];
    }
    const features: GeoRegionFeature[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < pulseRegions.length; i += 1) {
      const pulse = pulseRegions[i];
      if (pulse.isWide) {
        const list = regionIndex.byPrefix.get(pulse.code);
        if (!list) {
          continue;
        }
        for (let j = 0; j < list.length; j += 1) {
          const feature = list[j];
          const code = feature.properties.SIG_CD;
          if (seen.has(code)) {
            continue;
          }
          seen.add(code);
          features.push(feature);
        }
      } else {
        const feature = regionIndex.byCode.get(pulse.code);
        if (!feature) {
          continue;
        }
        const code = feature.properties.SIG_CD;
        if (!seen.has(code)) {
          seen.add(code);
          features.push(feature);
        }
      }
    }
    return features;
  }, [pulseRegions, regionIndex]);

  useEffect(() => {
    const nextIds = new Set<string>();
    const nextPulses: PulsePoint[] = [];
    const nextRegionPulses: PulseRegion[] = [];
    const now = Date.now();

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      nextIds.add(event.id);
      if (knownEventIdsRef.current.has(event.id)) {
        continue;
      }
      if (!event.isRealtime) {
        continue;
      }
      if (event.geo) {
        nextPulses.push({
          id: event.id,
          position: [event.geo.lng, event.geo.lat],
          level: event.level,
          title: event.title,
          startedAt: now,
        });
      }
      if (event.regionCodes) {
        for (let j = 0; j < event.regionCodes.length; j += 1) {
          const normalized = normalizeRegionCode(event.regionCodes[j]);
          if (!normalized) {
            continue;
          }
          const prefix = resolveRegionPrefix(normalized);
          nextRegionPulses.push({
            code: prefix,
            level: event.level,
            startedAt: now,
            isWide: prefix.length === 2,
          });
        }
      }
    }

    if (!hasSeededEventsRef.current) {
      knownEventIdsRef.current = nextIds;
      hasSeededEventsRef.current = true;
      return;
    }

    knownEventIdsRef.current = nextIds;

    const hasPointPulses = nextPulses.length > 0;
    const hasRegionPulses = nextRegionPulses.length > 0;

    if (hasPointPulses) {
      setPulsePoints((prev) => {
        const merged = [...prev, ...nextPulses];
        if (merged.length <= PULSE_MAX_POINTS) {
          return merged;
        }
        return merged.slice(merged.length - PULSE_MAX_POINTS);
      });
    }

    if (hasRegionPulses) {
      setPulseRegions((prev) => mergePulseRegions(prev, nextRegionPulses));
    }

    if (hasPointPulses || hasRegionPulses) {
      setPulseNow(now);
    }
  }, [events]);

  useEffect(() => {
    if (pulsePoints.length === 0 && pulseRegions.length === 0) {
      return;
    }
    let frameId = 0;

    const tick = () => {
      const now = Date.now();
      setPulseNow(now);
      setPulsePoints((prev) => {
        if (prev.length === 0) {
          return prev;
        }
        let hasExpired = false;
        const next: PulsePoint[] = [];
        for (let i = 0; i < prev.length; i += 1) {
          const point = prev[i];
          if (now - point.startedAt <= PULSE_DURATION_MS) {
            next.push(point);
          } else {
            hasExpired = true;
          }
        }
        return hasExpired ? next : prev;
      });
      setPulseRegions((prev) => {
        if (prev.length === 0) {
          return prev;
        }
        let hasExpired = false;
        const next: PulseRegion[] = [];
        for (let i = 0; i < prev.length; i += 1) {
          const pulse = prev[i];
          if (now - pulse.startedAt <= REGION_PULSE_DURATION_MS) {
            next.push(pulse);
          } else {
            hasExpired = true;
          }
        }
        return hasExpired ? next : prev;
      });
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [pulsePoints.length, pulseRegions.length]);

  useEffect(() => {
    let isActive = true;

    const loadRegions = async () => {
      try {
        const response = await fetch('/regions/SIG.json');
        if (!response.ok) {
          throw new Error(`Failed to load regions: ${response.status}`);
        }
        const payload = (await response.json()) as GeoRegionFeatureCollection;
        if (isActive) {
          setRegionData(payload);
        }
      } catch (error) {
        console.warn('행정 구역 GeoJSON 로딩에 실패했습니다.', error);
      }
    };

    void loadRegions();

    return () => {
      isActive = false;
    };
  }, []);

  const layers = useMemo(() => {
    const regionLayer = new GeoJsonLayer<GeoRegionProperties>({
      id: 'regions',
      data: regionData ?? EMPTY_GEOJSON,
      stroked: true,
      filled: true,
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1,
      getLineWidth: 1,
      getLineColor: [110, 130, 150, 90],
      getFillColor: (feature) => {
        const code = feature.properties.SIG_CD;
        const level5 = regionLevels.codes5.get(code);
        const level2 = regionLevels.codes2.get(code.slice(0, 2));
        let level = level5 ?? level2;
        if (level5 !== undefined && level2 !== undefined) {
          level = Math.max(level5, level2);
        }
        if (level) {
          return getRegionFillColor(level);
        }
        return [12, 18, 28, 40];
      },
      updateTriggers: {
        getFillColor: [regionLevels],
      },
    });

    const regionPulseLayer =
      pulseRegionFeatures.length > 0
        ? new GeoJsonLayer<GeoRegionProperties>({
            id: 'region-pulse',
            data: pulseRegionFeatures,
            stroked: true,
            filled: true,
            lineWidthUnits: 'pixels',
            lineWidthMinPixels: 1,
            getLineWidth: REGION_PULSE_LINE_WIDTH,
            getLineColor: (feature) => {
              const code = feature.properties.SIG_CD;
              const pulse = pulseRegionLookup.codes5.get(code) ?? pulseRegionLookup.codes2.get(code.slice(0, 2));
              if (!pulse) {
                return [0, 0, 0, 0];
              }
              return getRegionPulseLineColor(pulse, pulseNow);
            },
            getFillColor: (feature) => {
              const code = feature.properties.SIG_CD;
              const pulse = pulseRegionLookup.codes5.get(code) ?? pulseRegionLookup.codes2.get(code.slice(0, 2));
              if (!pulse) {
                return [0, 0, 0, 0];
              }
              return getRegionPulseFillColor(pulse, pulseNow);
            },
            updateTriggers: {
              getLineColor: [pulseNow, pulseRegions],
              getFillColor: [pulseNow, pulseRegions],
            },
          })
        : null;

    const pointsLayer = new ScatterplotLayer<MapPoint>({
      id: 'event-points',
      data: eventPoints,
      opacity: 1,
      radiusUnits: 'pixels',
      getPosition: (point) => point.position,
      getFillColor: (point) => LEVEL_COLORS[point.level],
      getRadius: (point) => LEVEL_RADII[point.level] ?? 700,
      getLineColor: [235, 248, 255, 220],
      lineWidthUnits: 'pixels',
      getLineWidth: 1.5,
    });

    const pulseLayer =
      pulsePoints.length > 0
        ? new ScatterplotLayer<PulsePoint>({
            id: 'event-pulse',
            data: pulsePoints,
            opacity: 1,
            radiusUnits: 'pixels',
            getPosition: (point) => point.position,
            getRadius: (point) => getPulseRadius(point, pulseNow),
            stroked: true,
            filled: false,
            lineWidthUnits: 'pixels',
            getLineWidth: 2.2,
            getLineColor: (point) => getPulseColor(point, pulseNow),
            updateTriggers: {
              getRadius: [pulseNow],
              getLineColor: [pulseNow],
            },
          })
        : null;

    const nextLayers: Layer[] = [regionLayer];
    if (regionPulseLayer) {
      nextLayers.push(regionPulseLayer);
    }
    nextLayers.push(pointsLayer);
    if (pulseLayer) {
      nextLayers.push(pulseLayer);
    }

    return nextLayers;
  }, [
    eventPoints,
    pulseNow,
    pulsePoints,
    pulseRegionFeatures,
    pulseRegionLookup,
    pulseRegions,
    regionData,
    regionLevels,
  ]);

  const updateEmojiMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      setPointEmojiMarkers([]);
      setRegionEmojiMarkers([]);
      return;
    }
    setPointEmojiMarkers(projectEmojiMarkers(pointEmojiLabelsRef.current, map));
    setRegionEmojiMarkers(projectEmojiMarkers(regionEmojiLabelsRef.current, map));
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const container = containerRef.current;
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE_URL,
      center: MAP_CENTER,
      zoom: 6,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    mapRef.current = map;

    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    overlayRef.current = overlay;
    map.addControl(overlay);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      const style = map.getStyle();
      const layers = style?.layers ?? [];
      for (let i = 0; i < layers.length; i += 1) {
        const layer = layers[i];
        if (layer.type !== 'symbol') {
          continue;
        }
        const layerId = layer.id.toLowerCase();
        if (layerId.includes('label') || layerId.includes('place') || layerId.includes('poi')) {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
      }
      map.resize();
      updateEmojiMarkers();
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, [updateEmojiMarkers]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }
    overlay.setProps({ layers });
  }, [layers]);

  useEffect(() => {
    pointEmojiLabelsRef.current = pointEmojiLabels;
    regionEmojiLabelsRef.current = regionEmojiLabels;
    updateEmojiMarkers();
  }, [pointEmojiLabels, regionEmojiLabels, updateEmojiMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    let frameId = 0;

    const scheduleUpdate = () => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateEmojiMarkers();
      });
    };

    map.on('move', scheduleUpdate);
    map.on('resize', scheduleUpdate);
    scheduleUpdate();

    return () => {
      map.off('move', scheduleUpdate);
      map.off('resize', scheduleUpdate);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [updateEmojiMarkers]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    mapRef.current?.resize();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isLargeScreen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLargeScreen, isOpen, onClose]);

  return (
    <section
      role={isLargeScreen ? undefined : 'dialog'}
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 flex flex-col bg-slate-950 border-t border-slate-900/80 transition-[transform,opacity] duration-300 ease-out 2xl:static 2xl:z-auto 2xl:translate-y-0 2xl:opacity-100 2xl:pointer-events-auto 2xl:h-full 2xl:w-100 2xl:shrink-0 2xl:border-t-0 2xl:border-l ${
        isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`flex items-center px-4 py-3 bg-slate-950/90 border-b border-slate-900/80 backdrop-blur 2xl:py-5 ${
          isLargeScreen ? 'justify-start' : 'justify-between'
        }`}
      >
        <div className="flex items-center gap-2 text-sm md:text-base 2xl:text-xl font-semibold text-slate-300">
          <MapIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
          재난 지도
        </div>
        {!isLargeScreen && (
          <button
            type="button"
            onClick={onClose}
            aria-label="지도 닫기"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs md:text-sm text-slate-200 hover:text-white hover:border-slate-500 transition"
          >
            <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
            닫기
          </button>
        )}
      </div>
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0 h-full" />
        <CapitalInsetMap
          regionIndex={regionIndex}
          regionLevels={regionLevels}
          pointEmojiLabels={pointEmojiLabels}
          regionEmojiLabels={regionEmojiLabels}
          isLargeScreen={isLargeScreen}
          pulsePoints={pulsePoints}
          pulseRegions={pulseRegions}
          pulseNow={pulseNow}
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {regionEmojiMarkers.map((marker) => {
            const tokenCount = Math.max(1, marker.tokens.length);
            const columnCount = Math.ceil(Math.sqrt(tokenCount));
            const rowCount = Math.ceil(tokenCount / columnCount);
            const gap = Math.max(1, Math.round(marker.size * 0.1));
            const width = columnCount * marker.size + (columnCount - 1) * gap;
            const height = rowCount * marker.size + (rowCount - 1) * gap;
            return (
              <span
                key={marker.id}
                style={{
                  position: 'absolute',
                  left: marker.x,
                  top: marker.y,
                  transform: 'translate(-50%, -50%)',
                  fontSize: `${marker.size}px`,
                  fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif',
                  fontWeight: 600,
                  lineHeight: 1,
                  color: '#f8fafc',
                  textShadow: '0 0 6px rgba(6, 10, 18, 0.6), 0 0 10px rgba(6, 10, 18, 0.35)',
                  zIndex: 10,
                  display: 'grid',
                  placeItems: 'center',
                  gridTemplateColumns: `repeat(${columnCount}, ${marker.size}px)`,
                  gap: `${gap}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                }}
              >
                {marker.tokens.map((token) => (
                  <span
                    key={`${marker.id}-${token}`}
                    style={{
                      width: `${marker.size}px`,
                      height: `${marker.size}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {token}
                  </span>
                ))}
              </span>
            );
          })}
          {pointEmojiMarkers.map((marker) => {
            const tokenCount = Math.max(1, marker.tokens.length);
            const columnCount = Math.ceil(Math.sqrt(tokenCount));
            const rowCount = Math.ceil(tokenCount / columnCount);
            const gap = Math.max(1, Math.round(marker.size * 0.1));
            const width = columnCount * marker.size + (columnCount - 1) * gap;
            const height = rowCount * marker.size + (rowCount - 1) * gap;
            return (
              <span
                key={marker.id}
                style={{
                  position: 'absolute',
                  left: marker.x,
                  top: marker.y,
                  transform: 'translate(-50%, -50%)',
                  fontSize: `${marker.size}px`,
                  fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif',
                  fontWeight: 700,
                  lineHeight: 1,
                  color: '#f8fafc',
                  textShadow: '0 0 6px rgba(6, 10, 18, 0.7), 0 0 12px rgba(6, 10, 18, 0.45)',
                  zIndex: 20,
                  display: 'grid',
                  placeItems: 'center',
                  gridTemplateColumns: `repeat(${columnCount}, ${marker.size}px)`,
                  gap: `${gap}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                }}
              >
                {marker.tokens.map((token) => (
                  <span
                    key={`${marker.id}-${token}`}
                    style={{
                      width: `${marker.size}px`,
                      height: `${marker.size}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {token}
                  </span>
                ))}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default DisasterMap;
