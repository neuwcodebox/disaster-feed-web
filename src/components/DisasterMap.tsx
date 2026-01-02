import type { Layer } from '@deck.gl/core';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { MapIcon, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type DisasterEvent, EventLevels } from '../types';

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

type PulsePoint = MapPoint & {
  startedAt: number;
};

type PulseRegion = {
  code: string;
  level: EventLevels;
  startedAt: number;
  isWide: boolean;
};

type RegionTargets = {
  codes2: Set<string>;
  codes5: Set<string>;
};

type GeoRegionIndex = {
  byCode: Map<string, GeoRegionFeature>;
  byPrefix: Map<string, GeoRegionFeature[]>;
};

type PulseRegionLookup = {
  codes2: Map<string, PulseRegion>;
  codes5: Map<string, PulseRegion>;
};

type GeoRegionProperties = {
  SIG_CD: string;
};

type GeoRegionPolygonGeometry = {
  type: 'Polygon';
  coordinates: number[][][];
};

type GeoRegionMultiPolygonGeometry = {
  type: 'MultiPolygon';
  coordinates: number[][][][];
};

type GeoRegionGeometry = GeoRegionPolygonGeometry | GeoRegionMultiPolygonGeometry;

type GeoRegionFeature = {
  type: 'Feature';
  properties: GeoRegionProperties;
  geometry: GeoRegionGeometry;
};

type GeoRegionFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoRegionFeature[];
};

const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const MAP_CENTER: [number, number] = [127.7, 36.5];

const LEVEL_COLORS: Record<EventLevels, [number, number, number, number]> = {
  [EventLevels.Info]: [160, 170, 180, 180],
  [EventLevels.Minor]: [70, 130, 230, 200],
  [EventLevels.Moderate]: [232, 210, 128, 210],
  [EventLevels.Severe]: [248, 140, 70, 220],
  [EventLevels.Critical]: [244, 112, 120, 230],
};

const LEVEL_RADII: Record<EventLevels, number> = {
  [EventLevels.Info]: 3,
  [EventLevels.Minor]: 6,
  [EventLevels.Moderate]: 9,
  [EventLevels.Severe]: 16,
  [EventLevels.Critical]: 24,
};

const PULSE_DURATION_MS = 2400;
const PULSE_RADIUS_OFFSET = 8;
const PULSE_RADIUS_GROWTH = 42;
const PULSE_MAX_ALPHA = 210;
const PULSE_MAX_POINTS = 12;
const REGION_PULSE_DURATION_MS = 2800;
const REGION_PULSE_MAX_ALPHA = 130;
const REGION_PULSE_LINE_ALPHA = 210;
const REGION_PULSE_LINE_WIDTH = 2.2;
const REGION_PULSE_MAX_AREAS = 10;

const EMPTY_GEOJSON: GeoRegionFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const easeOutCubic = (value: number): number => 1 - (1 - value) ** 3;

const getPulseProgress = (startedAt: number, now: number, duration: number): number => {
  if (now <= startedAt) {
    return 0;
  }
  const elapsed = now - startedAt;
  if (elapsed >= duration) {
    return 1;
  }
  return elapsed / duration;
};

const getPulseRadius = (point: PulsePoint, now: number): number => {
  const progress = easeOutCubic(getPulseProgress(point.startedAt, now, PULSE_DURATION_MS));
  const baseRadius = LEVEL_RADII[point.level] ?? 6;
  return baseRadius + PULSE_RADIUS_OFFSET + PULSE_RADIUS_GROWTH * progress;
};

const getPulseColor = (point: PulsePoint, now: number): [number, number, number, number] => {
  const progress = getPulseProgress(point.startedAt, now, PULSE_DURATION_MS);
  const [r, g, b] = LEVEL_COLORS[point.level];
  const alpha = Math.round(PULSE_MAX_ALPHA * (1 - progress));
  return [r, g, b, alpha];
};

const getRegionPulseFillColor = (pulse: PulseRegion, now: number): [number, number, number, number] => {
  const progress = easeOutCubic(getPulseProgress(pulse.startedAt, now, REGION_PULSE_DURATION_MS));
  const [r, g, b] = LEVEL_COLORS[pulse.level];
  const alpha = Math.round(REGION_PULSE_MAX_ALPHA * (1 - progress));
  return [r, g, b, alpha];
};

const getRegionPulseLineColor = (pulse: PulseRegion, now: number): [number, number, number, number] => {
  const progress = easeOutCubic(getPulseProgress(pulse.startedAt, now, REGION_PULSE_DURATION_MS));
  const [r, g, b] = LEVEL_COLORS[pulse.level];
  const alpha = Math.round(REGION_PULSE_LINE_ALPHA * (1 - progress));
  return [r, g, b, alpha];
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

const collectRegionTargets = (events: DisasterEvent[]): RegionTargets => {
  const codes2 = new Set<string>();
  const codes5 = new Set<string>();
  for (let i = 0; i < events.length; i += 1) {
    const regionCodes = events[i].regionCodes;
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
        codes2.add(prefix);
      } else {
        codes5.add(prefix);
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

const DisasterMap: React.FC<DisasterMapProps> = ({ events, isOpen, isLargeScreen, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [regionData, setRegionData] = useState<GeoRegionFeatureCollection | null>(null);
  const [pulsePoints, setPulsePoints] = useState<PulsePoint[]>([]);
  const [pulseRegions, setPulseRegions] = useState<PulseRegion[]>([]);
  const [pulseNow, setPulseNow] = useState(0);
  const knownEventIdsRef = useRef<Set<string>>(new Set());
  const hasSeededEventsRef = useRef(false);

  const regionTargets = useMemo(() => collectRegionTargets(events), [events]);
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
        const isActive = regionTargets.codes5.has(code) || regionTargets.codes2.has(code.slice(0, 2));
        if (isActive) {
          return [86, 142, 191, 70];
        }
        return [12, 18, 28, 40];
      },
      updateTriggers: {
        getFillColor: [regionTargets],
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
    regionTargets,
  ]);

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
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }
    overlay.setProps({ layers });
  }, [layers]);

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
      <div ref={containerRef} className="flex-1" />
    </section>
  );
};

export default DisasterMap;
