import type React from 'react';
import { useMemo } from 'react';
import { getRegionFillColor } from './DisasterMapPalette';
import { getPulseColor, getPulseRadius, getRegionPulseFillColor, getRegionPulseLineColor } from './DisasterMapPulse';
import type {
  EmojiLabel,
  GeoRegionFeature,
  GeoRegionGeometry,
  GeoRegionIndex,
  PulsePoint,
  PulseRegion,
  RegionLevels,
} from './DisasterMapTypes';

type CapitalInsetMapProps = {
  regionIndex: GeoRegionIndex | null;
  regionLevels: RegionLevels;
  pointEmojiLabels: EmojiLabel[];
  regionEmojiLabels: EmojiLabel[];
  isLargeScreen: boolean;
  pulsePoints: PulsePoint[];
  pulseRegions: PulseRegion[];
  pulseNow: number;
};

type GeoBounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

type InsetSize = {
  width: number;
  height: number;
};

type InsetPath = {
  id: string;
  d: string;
  fill: string;
};

type EmojiMarker = {
  id: string;
  tokens: string[];
  x: number;
  y: number;
  size: number;
  level: number;
};

type PulseRegionLookup = {
  codes2: Map<string, PulseRegion>;
  codes5: Map<string, PulseRegion>;
};

type InsetPulsePoint = {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
};

type InsetPulseRegion = {
  id: string;
  d: string;
  fill: string;
  stroke: string;
};

const CAPITAL_REGION_PREFIXES = ['11', '28', '41'] as const;
const CAPITAL_INSET_SIZE: InsetSize = { width: 200, height: 140 };
const CAPITAL_INSET_SIZE_LARGE: InsetSize = { width: 240, height: 170 };
const CAPITAL_INSET_PADDING_RATIO = 0.25;
const DEFAULT_CAPITAL_BOUNDS: GeoBounds = {
  minLng: 126.1,
  minLat: 36.6,
  maxLng: 128.3,
  maxLat: 38.4,
};
const INSET_POINT_EMOJI_SCALE = 0.9;
const INSET_REGION_EMOJI_SCALE = 0.82;
const INSET_BASE_FILL = 'rgba(12, 18, 28, 0.6)';
const INSET_STROKE = 'rgba(148, 163, 184, 0.35)';
const INSET_PULSE_RADIUS_SCALE = 0.6;
const INSET_PULSE_LINE_WIDTH = 1.3;
const INSET_REGION_PULSE_LINE_WIDTH = 1.1;

const createEmptyBounds = (): GeoBounds => ({
  minLng: Number.POSITIVE_INFINITY,
  minLat: Number.POSITIVE_INFINITY,
  maxLng: Number.NEGATIVE_INFINITY,
  maxLat: Number.NEGATIVE_INFINITY,
});

const updateBounds = (bounds: GeoBounds, lng: number, lat: number) => {
  bounds.minLng = Math.min(bounds.minLng, lng);
  bounds.minLat = Math.min(bounds.minLat, lat);
  bounds.maxLng = Math.max(bounds.maxLng, lng);
  bounds.maxLat = Math.max(bounds.maxLat, lat);
};

const updateBoundsWithRing = (ring: number[][], bounds: GeoBounds) => {
  for (let i = 0; i < ring.length; i += 1) {
    const [lng, lat] = ring[i];
    updateBounds(bounds, lng, lat);
  }
};

const updateBoundsWithGeometry = (geometry: GeoRegionGeometry, bounds: GeoBounds) => {
  if (geometry.type === 'Polygon') {
    for (let i = 0; i < geometry.coordinates.length; i += 1) {
      updateBoundsWithRing(geometry.coordinates[i], bounds);
    }
    return;
  }
  for (let i = 0; i < geometry.coordinates.length; i += 1) {
    const polygon = geometry.coordinates[i];
    for (let j = 0; j < polygon.length; j += 1) {
      updateBoundsWithRing(polygon[j], bounds);
    }
  }
};

const buildBoundsFromFeatures = (features: GeoRegionFeature[]): GeoBounds | null => {
  if (features.length === 0) {
    return null;
  }
  const bounds = createEmptyBounds();
  for (let i = 0; i < features.length; i += 1) {
    updateBoundsWithGeometry(features[i].geometry, bounds);
  }
  if (
    !Number.isFinite(bounds.minLng) ||
    !Number.isFinite(bounds.minLat) ||
    !Number.isFinite(bounds.maxLng) ||
    !Number.isFinite(bounds.maxLat)
  ) {
    return null;
  }
  return bounds;
};

const padBounds = (bounds: GeoBounds, ratio: number): GeoBounds => {
  const lngSpan = bounds.maxLng - bounds.minLng;
  const latSpan = bounds.maxLat - bounds.minLat;
  if (!Number.isFinite(lngSpan) || !Number.isFinite(latSpan) || lngSpan <= 0 || latSpan <= 0) {
    return bounds;
  }
  const lngPad = lngSpan * ratio;
  const latPad = latSpan * ratio;
  return {
    minLng: bounds.minLng - lngPad,
    minLat: bounds.minLat - latPad,
    maxLng: bounds.maxLng + lngPad,
    maxLat: bounds.maxLat + latPad,
  };
};

const projectToInset = (lng: number, lat: number, bounds: GeoBounds, size: InsetSize): { x: number; y: number } => {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * size.width;
  const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * size.height;
  return { x, y };
};

const formatInsetNumber = (value: number): string => `${Math.round(value * 10) / 10}`;

const buildInsetPath = (geometry: GeoRegionGeometry, bounds: GeoBounds, size: InsetSize): string => {
  const segments: string[] = [];
  const buildRing = (ring: number[][]) => {
    if (ring.length === 0) {
      return;
    }
    let segment = '';
    for (let i = 0; i < ring.length; i += 1) {
      const [lng, lat] = ring[i];
      const { x, y } = projectToInset(lng, lat, bounds, size);
      segment += `${i === 0 ? 'M' : 'L'}${formatInsetNumber(x)},${formatInsetNumber(y)}`;
    }
    segment += 'Z';
    segments.push(segment);
  };
  if (geometry.type === 'Polygon') {
    for (let i = 0; i < geometry.coordinates.length; i += 1) {
      buildRing(geometry.coordinates[i]);
    }
    return segments.join(' ');
  }
  for (let i = 0; i < geometry.coordinates.length; i += 1) {
    const polygon = geometry.coordinates[i];
    for (let j = 0; j < polygon.length; j += 1) {
      buildRing(polygon[j]);
    }
  }
  return segments.join(' ');
};

const isPointInBounds = (lng: number, lat: number, bounds: GeoBounds): boolean =>
  lng >= bounds.minLng && lng <= bounds.maxLng && lat >= bounds.minLat && lat <= bounds.maxLat;

const toRgba = (color: [number, number, number, number]): string => {
  const alpha = Math.round((color[3] / 255) * 1000) / 1000;
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
};

const buildInsetMarkers = (labels: EmojiLabel[], bounds: GeoBounds, size: InsetSize, scale: number): EmojiMarker[] => {
  const markers: EmojiMarker[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const [lng, lat] = label.position;
    if (!isPointInBounds(lng, lat, bounds)) {
      continue;
    }
    const { x, y } = projectToInset(lng, lat, bounds, size);
    markers.push({
      id: label.id,
      tokens: label.tokens,
      x,
      y,
      size: Math.max(8, Math.round(label.size * scale)),
      level: label.level,
    });
  }
  return markers;
};

const CapitalInsetMap: React.FC<CapitalInsetMapProps> = ({
  regionIndex,
  regionLevels,
  pointEmojiLabels,
  regionEmojiLabels,
  isLargeScreen,
  pulsePoints,
  pulseRegions,
  pulseNow,
}) => {
  const capitalInsetSize = isLargeScreen ? CAPITAL_INSET_SIZE_LARGE : CAPITAL_INSET_SIZE;
  const capitalRegionFeatures = useMemo<GeoRegionFeature[]>(() => {
    if (!regionIndex) {
      return [];
    }
    const features: GeoRegionFeature[] = [];
    for (let i = 0; i < CAPITAL_REGION_PREFIXES.length; i += 1) {
      const prefix = CAPITAL_REGION_PREFIXES[i];
      const list = regionIndex.byPrefix.get(prefix);
      if (!list) {
        continue;
      }
      for (let j = 0; j < list.length; j += 1) {
        features.push(list[j]);
      }
    }
    return features;
  }, [regionIndex]);
  const capitalFocusFeatures = useMemo<GeoRegionFeature[]>(() => {
    if (!regionIndex) {
      return [];
    }
    const features = regionIndex.byPrefix.get('11');
    if (!features) {
      return [];
    }
    return [...features];
  }, [regionIndex]);
  const capitalBounds = useMemo<GeoBounds>(() => {
    const focusBounds = buildBoundsFromFeatures(capitalFocusFeatures);
    const bounds = focusBounds ?? buildBoundsFromFeatures(capitalRegionFeatures) ?? DEFAULT_CAPITAL_BOUNDS;
    return padBounds(bounds, CAPITAL_INSET_PADDING_RATIO);
  }, [capitalFocusFeatures, capitalRegionFeatures]);
  const capitalInsetPaths = useMemo<InsetPath[]>(() => {
    if (capitalRegionFeatures.length === 0) {
      return [];
    }
    const paths: InsetPath[] = [];
    for (let i = 0; i < capitalRegionFeatures.length; i += 1) {
      const feature = capitalRegionFeatures[i];
      const d = buildInsetPath(feature.geometry, capitalBounds, capitalInsetSize);
      if (!d) {
        continue;
      }
      const code = feature.properties.SIG_CD;
      const level5 = regionLevels.codes5.get(code);
      const level2 = regionLevels.codes2.get(code.slice(0, 2));
      let level = level5 ?? level2;
      if (level5 !== undefined && level2 !== undefined) {
        level = Math.max(level5, level2);
      }
      const fill = level ? toRgba(getRegionFillColor(level)) : INSET_BASE_FILL;
      paths.push({ id: `inset-${code}`, d, fill });
    }
    return paths;
  }, [capitalBounds, capitalInsetSize, capitalRegionFeatures, regionLevels]);
  const capitalInsetMarkers = useMemo(() => {
    return {
      regions: buildInsetMarkers(regionEmojiLabels, capitalBounds, capitalInsetSize, INSET_REGION_EMOJI_SCALE),
      points: buildInsetMarkers(pointEmojiLabels, capitalBounds, capitalInsetSize, INSET_POINT_EMOJI_SCALE),
    };
  }, [capitalBounds, capitalInsetSize, pointEmojiLabels, regionEmojiLabels]);
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
  const insetPulseRegions = useMemo<InsetPulseRegion[]>(() => {
    if (pulseRegionFeatures.length === 0) {
      return [];
    }
    const regions: InsetPulseRegion[] = [];
    for (let i = 0; i < pulseRegionFeatures.length; i += 1) {
      const feature = pulseRegionFeatures[i];
      const code = feature.properties.SIG_CD;
      const pulse = pulseRegionLookup.codes5.get(code) ?? pulseRegionLookup.codes2.get(code.slice(0, 2));
      if (!pulse) {
        continue;
      }
      const d = buildInsetPath(feature.geometry, capitalBounds, capitalInsetSize);
      if (!d) {
        continue;
      }
      regions.push({
        id: `pulse-${code}`,
        d,
        fill: toRgba(getRegionPulseFillColor(pulse, pulseNow)),
        stroke: toRgba(getRegionPulseLineColor(pulse, pulseNow)),
      });
    }
    return regions;
  }, [capitalBounds, capitalInsetSize, pulseNow, pulseRegionFeatures, pulseRegionLookup]);
  const insetPulsePoints = useMemo<InsetPulsePoint[]>(() => {
    if (pulsePoints.length === 0) {
      return [];
    }
    const points: InsetPulsePoint[] = [];
    for (let i = 0; i < pulsePoints.length; i += 1) {
      const pulse = pulsePoints[i];
      const [lng, lat] = pulse.position;
      if (!isPointInBounds(lng, lat, capitalBounds)) {
        continue;
      }
      const { x, y } = projectToInset(lng, lat, capitalBounds, capitalInsetSize);
      points.push({
        id: pulse.id,
        x,
        y,
        radius: getPulseRadius(pulse, pulseNow, INSET_PULSE_RADIUS_SCALE),
        color: toRgba(getPulseColor(pulse, pulseNow)),
      });
    }
    return points;
  }, [capitalBounds, capitalInsetSize, pulseNow, pulsePoints]);

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-30">
      <div
        className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-slate-950/85 shadow-[0_10px_30px_rgba(8,12,24,0.45)] ring-1 ring-slate-900/60"
        style={{ width: capitalInsetSize.width, height: capitalInsetSize.height }}
      >
        <svg
          width={capitalInsetSize.width}
          height={capitalInsetSize.height}
          viewBox={`0 0 ${capitalInsetSize.width} ${capitalInsetSize.height}`}
          className="absolute inset-0"
        >
          <title>수도권 확대 지도</title>
          <rect width="100%" height="100%" fill="rgba(6, 12, 22, 0.7)" />
          {capitalInsetPaths.map((path) => (
            <path key={path.id} d={path.d} fill={path.fill} stroke={INSET_STROKE} strokeWidth="1" fillRule="evenodd" />
          ))}
          {insetPulseRegions.map((path) => (
            <path
              key={path.id}
              d={path.d}
              fill={path.fill}
              stroke={path.stroke}
              strokeWidth={INSET_REGION_PULSE_LINE_WIDTH}
              fillRule="evenodd"
            />
          ))}
          {insetPulsePoints.map((pulse) => (
            <circle
              key={`pulse-point-${pulse.id}`}
              cx={pulse.x}
              cy={pulse.y}
              r={pulse.radius}
              fill="none"
              stroke={pulse.color}
              strokeWidth={INSET_PULSE_LINE_WIDTH}
            />
          ))}
        </svg>
        <div className="absolute inset-0">
          {capitalInsetMarkers.regions.map((marker) => {
            const tokenCount = Math.max(1, marker.tokens.length);
            const columnCount = Math.ceil(Math.sqrt(tokenCount));
            const rowCount = Math.ceil(tokenCount / columnCount);
            const gap = Math.max(1, Math.round(marker.size * 0.1));
            const width = columnCount * marker.size + (columnCount - 1) * gap;
            const height = rowCount * marker.size + (rowCount - 1) * gap;
            return (
              <span
                key={`inset-region-${marker.id}`}
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
                  textShadow: '0 0 6px rgba(4, 8, 16, 0.7), 0 0 10px rgba(4, 8, 16, 0.45)',
                  zIndex: marker.level,
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
                    key={`inset-region-${marker.id}-${token}`}
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
          {capitalInsetMarkers.points.map((marker) => {
            const tokenCount = Math.max(1, marker.tokens.length);
            const columnCount = Math.ceil(Math.sqrt(tokenCount));
            const rowCount = Math.ceil(tokenCount / columnCount);
            const gap = Math.max(1, Math.round(marker.size * 0.1));
            const width = columnCount * marker.size + (columnCount - 1) * gap;
            const height = rowCount * marker.size + (rowCount - 1) * gap;
            return (
              <span
                key={`inset-point-${marker.id}`}
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
                  zIndex: marker.level,
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
                    key={`inset-point-${marker.id}-${token}`}
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
        <div className="absolute left-2 top-2 z-50 rounded-full border border-slate-600/70 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
          수도권
        </div>
      </div>
    </div>
  );
};

export default CapitalInsetMap;
