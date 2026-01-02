import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import maplibregl from 'maplibre-gl';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type DisasterEvent, EventLevels } from '../types';

interface DisasterMapProps {
  events: DisasterEvent[];
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
  [EventLevels.Info]: [120, 180, 220, 180],
  [EventLevels.Minor]: [96, 190, 230, 190],
  [EventLevels.Moderate]: [232, 210, 128, 210],
  [EventLevels.Severe]: [240, 170, 104, 220],
  [EventLevels.Critical]: [244, 112, 120, 230],
};

const LEVEL_RADII: Record<EventLevels, number> = {
  [EventLevels.Info]: 4,
  [EventLevels.Minor]: 5,
  [EventLevels.Moderate]: 6,
  [EventLevels.Severe]: 7,
  [EventLevels.Critical]: 8,
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

const DisasterMap: React.FC<DisasterMapProps> = ({ events }) => {
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

  return (
    <section className="relative w-full aspect-3/4 lg:aspect-auto lg:h-full lg:w-125 shrink-0 border-t border-slate-900/80 lg:border-t-0 lg:border-l bg-slate-950 overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
    </section>
  );
};

export default DisasterMap;
