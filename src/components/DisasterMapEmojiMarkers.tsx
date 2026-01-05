import type { Map as MaplibreMap } from 'maplibre-gl';
import type React from 'react';
import { getEventKindIcon } from '../constants';
import { type DisasterEvent, EventLevels } from '../types';
import { normalizeRegionCode, resolveRegionPrefix } from './DisasterMapRegionCodes';
import type { EmojiLabel, EmojiMarker, GeoRegionFeature, GeoRegionIndex } from './DisasterMapTypes';

type RegionKindSummary = {
  kindLevels: Map<number, EventLevels>;
  level: EventLevels;
  events: DisasterEvent[];
  eventIds: Set<string>;
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

type EmojiMarkerVariant = 'region' | 'point';

type MarkerLayout = {
  columnCount: number;
  rowCount: number;
  gap: number;
  width: number;
  height: number;
};

export type MarkerBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type MarkerVariantStyle = {
  fontWeight: number;
  textShadow: string;
  zIndex: number;
};

type DisasterMapEmojiMarkersProps = {
  markers: EmojiMarker[];
  variant: EmojiMarkerVariant;
};

const EMOJI_SIZES: Record<EventLevels, number> = {
  [EventLevels.Info]: 10,
  [EventLevels.Minor]: 11,
  [EventLevels.Moderate]: 12,
  [EventLevels.Severe]: 13,
  [EventLevels.Critical]: 15,
};

const MAX_EMOJI_PER_LABEL = 8;
const POINT_CLUSTER_PRECISION = 10000;
const EMOJI_FONT_FAMILY = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif';
const MARKER_COLOR = '#f8fafc';

const MARKER_VARIANTS: Record<EmojiMarkerVariant, MarkerVariantStyle> = {
  region: {
    fontWeight: 600,
    textShadow: '0 0 6px rgba(6, 10, 18, 0.6), 0 0 10px rgba(6, 10, 18, 0.35)',
    zIndex: 10,
  },
  point: {
    fontWeight: 700,
    textShadow: '0 0 6px rgba(6, 10, 18, 0.7), 0 0 12px rgba(6, 10, 18, 0.45)',
    zIndex: 20,
  },
};

const ensureRegionKindSummary = (target: Map<string, RegionKindSummary>, code: string): RegionKindSummary => {
  const existing = target.get(code);
  if (existing) {
    return existing;
  }
  const created: RegionKindSummary = {
    kindLevels: new Map(),
    level: EventLevels.Info,
    events: [],
    eventIds: new Set(),
  };
  target.set(code, created);
  return created;
};

const appendRegionEvent = (summary: RegionKindSummary, event: DisasterEvent) => {
  if (summary.eventIds.has(event.id)) {
    return;
  }
  summary.eventIds.add(event.id);
  summary.events.push(event);
};

const updateKindLevels = (target: Map<number, EventLevels>, kind: number, level: EventLevels) => {
  const existing = target.get(kind);
  if (!existing || level > existing) {
    target.set(kind, level);
  }
};

const mergeKindLevels = (target: Map<number, EventLevels>, source: Map<number, EventLevels>) => {
  for (const [kind, level] of source.entries()) {
    updateKindLevels(target, kind, level);
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

export const collectPointEmojiLabels = (events: DisasterEvent[]): EmojiLabel[] => {
  const clusters = new Map<
    string,
    {
      lngSum: number;
      latSum: number;
      count: number;
      level: EventLevels;
      kinds: Map<number, EventLevels>;
      events: DisasterEvent[];
    }
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
        events: [],
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
    cluster.events.push(event);
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
      events: cluster.events,
    });
  }
  return labels;
};

const collectRegionKindSummaries = (events: DisasterEvent[]): RegionKindSummaries => {
  const codes2 = new Map<string, RegionKindSummary>();
  const codes5 = new Map<string, RegionKindSummary>();
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!event.regionCodes || event.geo) {
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
      appendRegionEvent(summary, event);
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

export const buildRegionCentroids = (regionIndex: GeoRegionIndex | null): RegionCentroidIndex | null => {
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

export const buildRegionEmojiLabels = (
  events: DisasterEvent[],
  centroids: RegionCentroidIndex | null,
): EmojiLabel[] => {
  if (!centroids) {
    return [];
  }
  const summaries = collectRegionKindSummaries(events);
  const labels: EmojiLabel[] = [];
  for (const [code, position] of centroids.byCode.entries()) {
    const summary5 = summaries.codes5.get(code);
    const summary2 = summaries.codes2.get(code.slice(0, 2));
    if (!summary5 && !summary2) {
      continue;
    }
    const mergedKindLevels = new Map<number, EventLevels>();
    let level = EventLevels.Info;
    if (summary5) {
      level = Math.max(level, summary5.level);
      mergeKindLevels(mergedKindLevels, summary5.kindLevels);
    }
    if (summary2) {
      level = Math.max(level, summary2.level);
      mergeKindLevels(mergedKindLevels, summary2.kindLevels);
    }
    const mergedEventIds = new Set<string>();
    if (summary5) {
      for (let i = 0; i < summary5.events.length; i += 1) {
        mergedEventIds.add(summary5.events[i].id);
      }
    }
    if (summary2) {
      for (let i = 0; i < summary2.events.length; i += 1) {
        mergedEventIds.add(summary2.events[i].id);
      }
    }
    const mergedEvents: DisasterEvent[] = [];
    if (mergedEventIds.size > 0) {
      for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        if (mergedEventIds.has(event.id)) {
          mergedEvents.push(event);
        }
      }
    }
    const tokens = buildEmojiTokens(mergedKindLevels, MAX_EMOJI_PER_LABEL);
    if (tokens.length === 0) {
      continue;
    }
    labels.push({
      id: `region-${code}`,
      position,
      level,
      tokens,
      size: EMOJI_SIZES[level] ?? 12,
      events: mergedEvents,
    });
  }
  return labels;
};

export const projectEmojiMarkers = (labels: EmojiLabel[], map: MaplibreMap): EmojiMarker[] => {
  const markers: EmojiMarker[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const point = map.project([label.position[0], label.position[1]]);
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

const getMarkerLayout = (marker: EmojiMarker): MarkerLayout => {
  const tokenCount = Math.max(1, marker.tokens.length);
  const columnCount = Math.ceil(Math.sqrt(tokenCount));
  const rowCount = Math.ceil(tokenCount / columnCount);
  const gap = Math.max(1, Math.round(marker.size * 0.1));
  const width = columnCount * marker.size + (columnCount - 1) * gap;
  const height = rowCount * marker.size + (rowCount - 1) * gap;
  return { columnCount, rowCount, gap, width, height };
};

export const getEmojiMarkerBounds = (marker: EmojiMarker, padding = 0): MarkerBounds => {
  const layout = getMarkerLayout(marker);
  const halfWidth = layout.width / 2 + padding;
  const halfHeight = layout.height / 2 + padding;
  return {
    left: marker.x - halfWidth,
    top: marker.y - halfHeight,
    right: marker.x + halfWidth,
    bottom: marker.y + halfHeight,
  };
};

const getMarkerStyle = (
  marker: EmojiMarker,
  variantStyle: MarkerVariantStyle,
  layout: MarkerLayout,
): React.CSSProperties => ({
  position: 'absolute',
  left: marker.x,
  top: marker.y,
  transform: 'translate(-50%, -50%)',
  fontSize: `${marker.size}px`,
  fontFamily: EMOJI_FONT_FAMILY,
  fontWeight: variantStyle.fontWeight,
  lineHeight: 1,
  color: MARKER_COLOR,
  textShadow: variantStyle.textShadow,
  zIndex: variantStyle.zIndex,
  display: 'grid',
  placeItems: 'center',
  gridTemplateColumns: `repeat(${layout.columnCount}, ${marker.size}px)`,
  gap: `${layout.gap}px`,
  width: `${layout.width}px`,
  height: `${layout.height}px`,
});

const getTokenStyle = (size: number): React.CSSProperties => ({
  width: `${size}px`,
  height: `${size}px`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const DisasterMapEmojiMarkers: React.FC<DisasterMapEmojiMarkersProps> = ({ markers, variant }) => {
  if (markers.length === 0) {
    return null;
  }

  const variantStyle = MARKER_VARIANTS[variant];

  return (
    <>
      {markers.map((marker) => {
        const layout = getMarkerLayout(marker);
        const tokenStyle = getTokenStyle(marker.size);
        return (
          <span key={marker.id} style={getMarkerStyle(marker, variantStyle, layout)}>
            {marker.tokens.map((token) => (
              <span key={`${marker.id}-${token}`} style={tokenStyle}>
                {token}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
};

export default DisasterMapEmojiMarkers;
