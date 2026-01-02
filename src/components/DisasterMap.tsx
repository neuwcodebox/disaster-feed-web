import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { X } from 'lucide-react';
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

type RegionTargets = {
  codes2: Set<string>;
  codes5: Set<string>;
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

const EMPTY_GEOJSON: GeoRegionFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
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

  const regionTargets = useMemo(() => collectRegionTargets(events), [events]);
  const eventPoints = useMemo(() => collectEventPoints(events), [events]);

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

    return [regionLayer, pointsLayer];
  }, [eventPoints, regionData, regionTargets]);

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
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-900/80 backdrop-blur 2xl:hidden">
        <div className="flex items-center gap-2 text-sm md:text-base font-semibold text-slate-100">
          <span className="inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
          재난 지도
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="지도 닫기"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs md:text-sm text-slate-200 hover:text-white hover:border-slate-500 transition"
        >
          <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
          닫기
        </button>
      </div>
      <div ref={containerRef} className="flex-1" />
    </section>
  );
};

export default DisasterMap;
