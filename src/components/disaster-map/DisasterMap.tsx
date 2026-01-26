import type { Layer } from '@deck.gl/core';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { MapIcon, RotateCcw, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type DisasterEvent, EventLevels } from '../../types';
import { filterEventsByAge } from '../../utils/eventFilters';
import CapitalInsetMap from './CapitalInsetMap';
import DisasterMapEmojiMarkers, {
  buildRegionCentroids,
  buildRegionEmojiLabels,
  collectPointEmojiLabels,
  projectEmojiMarkers,
} from './DisasterMapEmojiMarkers';
import { getRegionFillColor, LEVEL_COLORS, LEVEL_RADII } from './DisasterMapPalette';
import {
  getPulseColor,
  getPulseRadius,
  getRegionPulseFillColor,
  getRegionPulseLineColor,
  PULSE_DURATION_MS,
  REGION_PULSE_DURATION_MS,
} from './DisasterMapPulse';
import { normalizeRegionCode, resolveRegionPrefix } from './DisasterMapRegionCodes';
import type {
  EmojiLabel,
  EmojiMarker,
  GeoRegionFeature,
  GeoRegionFeatureCollection,
  GeoRegionIndex,
  GeoRegionProperties,
  PulsePoint,
  PulseRegion,
  RegionLevels,
} from './DisasterMapTypes';
import EmojiMarkerPopup from './EmojiMarkerPopup';
import { useEmojiMarkerSelection } from './useEmojiMarkerSelection';

interface DisasterMapProps {
  events: DisasterEvent[];
  isOpen: boolean;
  isLargeScreen: boolean;
  onClose: () => void;
  maxEventAgeMs: number;
}

type MapPoint = {
  id: string;
  position: [number, number];
  level: EventLevels;
  title: string;
};

type PulseRegionLookup = {
  codes2: Map<string, PulseRegion>;
  codes5: Map<string, PulseRegion>;
};

const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const MAP_CENTER: [number, number] = [127.7, 36.4];
const MAP_DEFAULT_VIEW = {
  center: MAP_CENTER,
  zoom: 6,
  pitch: 0,
  bearing: 0,
};

const PULSE_MAX_POINTS = 12;
const REGION_PULSE_LINE_WIDTH = 2.2;
const REGION_PULSE_MAX_AREAS = 10;
const EMPTY_GEOJSON: GeoRegionFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};
const WINDOW_STEP_MS = 15 * 60 * 1000;
const WINDOW_REFRESH_INTERVAL_MS = 60000;
const NATIONWIDE_REQUIRED_CODES = new Set<string>([
  '1100000000',
  '2600000000',
  '2700000000',
  '2800000000',
  '2900000000',
  '3000000000',
  '3100000000',
  '3611000000',
  '4100000000',
  '4300000000',
  '4400000000',
  '4600000000',
  '4700000000',
  '4800000000',
  '5100000000',
  '5200000000',
]);

const formatWindowLabel = (durationMs: number): string => {
  const totalMinutes = Math.max(1, Math.round(durationMs / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes}분`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    if (remainingMinutes === 0) {
      return `${totalHours}시간`;
    }
    return `${totalHours}시간 ${remainingMinutes}분`;
  }
  const totalDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  if (remainingHours === 0) {
    return `${totalDays}일`;
  }
  return `${totalDays}일 ${remainingHours}시간`;
};

const isNationwideRegionCodes = (regionCodes: string[] | null): boolean => {
  if (!regionCodes || regionCodes.length === 0) {
    return false;
  }
  const normalizedCodes = new Set<string>();
  for (let i = 0; i < regionCodes.length; i += 1) {
    const normalized = normalizeRegionCode(regionCodes[i]);
    if (normalized) {
      normalizedCodes.add(normalized);
    }
  }
  if (normalizedCodes.size === 0) {
    return false;
  }
  for (const requiredCode of NATIONWIDE_REQUIRED_CODES) {
    if (!normalizedCodes.has(requiredCode)) {
      return false;
    }
  }
  return true;
};

const isNationwideLowLevelEvent = (event: DisasterEvent): boolean => {
  if (event.level > EventLevels.Minor) {
    return false;
  }
  if (event.geo) {
    return false;
  }
  return isNationwideRegionCodes(event.regionCodes);
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

const collectRegionLevels = (events: DisasterEvent[]): RegionLevels => {
  const codes2 = new Map<string, EventLevels>();
  const codes5 = new Map<string, EventLevels>();
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];

    if (event.geo) {
      continue;
    }

    const level = event.level;
    const regionCodes = event.regionCodes;

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

const DisasterMap: React.FC<DisasterMapProps> = ({ events, isOpen, isLargeScreen, onClose, maxEventAgeMs }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
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
  const [windowAgeMs, setWindowAgeMs] = useState(Math.round(maxEventAgeMs / 4));
  const [windowNowMs, setWindowNowMs] = useState(() => Date.now());

  const sliderStepMs = Math.min(WINDOW_STEP_MS, maxEventAgeMs);
  const sliderMinMs = sliderStepMs;

  useEffect(() => {
    setWindowAgeMs((prev) => (prev > maxEventAgeMs ? maxEventAgeMs : prev));
  }, [maxEventAgeMs]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setWindowNowMs(Date.now());
    }, WINDOW_REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const visibleEvents = useMemo(
    () => filterEventsByAge(events, windowNowMs, windowAgeMs),
    [events, windowAgeMs, windowNowMs],
  );
  const mapEvents = useMemo(() => {
    const nextMapEvents: DisasterEvent[] = [];
    for (let i = 0; i < visibleEvents.length; i += 1) {
      const event = visibleEvents[i];
      if (isNationwideLowLevelEvent(event)) {
        continue;
      }
      nextMapEvents.push(event);
    }
    return nextMapEvents;
  }, [visibleEvents]);
  const regionLevels = useMemo(() => collectRegionLevels(mapEvents), [mapEvents]);
  const eventPoints = useMemo(() => collectEventPoints(mapEvents), [mapEvents]);
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
    () => buildRegionEmojiLabels(mapEvents, regionCentroids),
    [mapEvents, regionCentroids],
  );
  const pointEmojiLabels = useMemo(() => collectPointEmojiLabels(mapEvents), [mapEvents]);
  const { selectedMarker: selectedEmojiMarker, selectedLabel: selectedEmojiLabel } = useEmojiMarkerSelection({
    map: mapInstance,
    pointMarkers: pointEmojiMarkers,
    regionMarkers: regionEmojiMarkers,
    pointLabels: pointEmojiLabels,
    regionLabels: regionEmojiLabels,
  });
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
    const threshold = now - windowAgeMs;

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      nextIds.add(event.id);
      if (knownEventIdsRef.current.has(event.id)) {
        continue;
      }
      if (!event.isRealtime) {
        continue;
      }
      if (event.timestamp < threshold) {
        continue;
      }
      if (isNationwideLowLevelEvent(event)) {
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
      } else if (event.regionCodes) {
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
  }, [events, windowAgeMs]);

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
    const nextPointMarkers = projectEmojiMarkers(pointEmojiLabelsRef.current, map);
    const nextRegionMarkers = projectEmojiMarkers(regionEmojiLabelsRef.current, map);
    setPointEmojiMarkers(nextPointMarkers);
    setRegionEmojiMarkers(nextRegionMarkers);
  }, []);

  const handleResetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    map.easeTo({ ...MAP_DEFAULT_VIEW, duration: 700 });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const container = containerRef.current;
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE_URL,
      ...MAP_DEFAULT_VIEW,
      attributionControl: false,
    });

    mapRef.current = map;
    setMapInstance(map);

    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    overlayRef.current = overlay;
    map.addControl(overlay);
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
      setMapInstance(null);
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

  const resetButtonSizeClass = isLargeScreen
    ? 'gap-1 px-2 py-1 text-[8px] md:text-[10px]'
    : 'gap-2 px-3 py-1.5 text-xs md:text-sm';
  const resetIconSizeClass = isLargeScreen ? 'w-3 h-3 md:w-3.5 md:h-3.5' : 'w-3.5 h-3.5 md:w-4 md:h-4';
  const windowLabel = useMemo(() => formatWindowLabel(windowAgeMs), [windowAgeMs]);
  const maxWindowLabel = useMemo(() => formatWindowLabel(maxEventAgeMs), [maxEventAgeMs]);
  const minWindowLabel = useMemo(() => formatWindowLabel(sliderMinMs), [sliderMinMs]);

  return (
    <section
      role={isLargeScreen ? undefined : 'dialog'}
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 flex flex-col bg-slate-950 border-t border-slate-900/80 transition-[transform,opacity] duration-300 ease-out 2xl:static 2xl:z-auto 2xl:translate-y-0 2xl:opacity-100 2xl:pointer-events-auto 2xl:h-full 2xl:w-100 2xl:shrink-0 2xl:border-t-0 2xl:border-l ${
        isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-900/80 backdrop-blur 2xl:py-5">
        <div className="flex items-center gap-2 text-sm md:text-base 2xl:text-xl font-semibold text-slate-300">
          <MapIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
          재난 지도
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetView}
            aria-label="지도 초기화"
            className={`inline-flex items-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-200 hover:text-white hover:border-slate-500 transition ${resetButtonSizeClass}`}
          >
            <RotateCcw className={resetIconSizeClass} />
            <span>초기화</span>
          </button>
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
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          <DisasterMapEmojiMarkers markers={regionEmojiMarkers} variant="region" />
          <DisasterMapEmojiMarkers markers={pointEmojiMarkers} variant="point" />
        </div>
        <EmojiMarkerPopup container={containerRef.current} marker={selectedEmojiMarker} label={selectedEmojiLabel} />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 sm:inset-x-5 sm:bottom-5">
          <div className="pointer-events-auto flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/85 p-3 shadow-[0_16px_36px_rgba(2,6,23,0.55)] backdrop-blur md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-200">최근 {windowLabel}</div>
              <button
                type="button"
                onClick={() => setWindowAgeMs(maxEventAgeMs)}
                disabled={windowAgeMs >= maxEventAgeMs}
                className="rounded-full border border-slate-700/80 px-2 py-1 text-[10px] md:text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-default disabled:border-slate-800 disabled:text-slate-600"
              >
                전체 보기
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] md:text-xs text-slate-500 whitespace-nowrap">{minWindowLabel}</span>
              <input
                id="map-time-window"
                type="range"
                min={sliderMinMs}
                max={maxEventAgeMs}
                step={sliderStepMs}
                value={windowAgeMs}
                onChange={(event) => {
                  setWindowAgeMs(Number(event.target.value));
                }}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-linear-to-r from-slate-700 via-slate-600 to-blue-500 accent-blue-400"
                aria-label="지도 표시 시간 범위"
              />
              <span className="text-[10px] md:text-xs text-slate-500 whitespace-nowrap">{maxWindowLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DisasterMap;
