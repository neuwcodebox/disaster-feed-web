import type { Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getEmojiMarkerBounds } from './DisasterMapEmojiMarkers';
import type { EmojiLabel, EmojiMarker } from './DisasterMapTypes';

type ScreenPoint = {
  x: number;
  y: number;
};

type EmojiMarkerSelectionArgs = {
  map: MaplibreMap | null;
  pointMarkers: EmojiMarker[];
  regionMarkers: EmojiMarker[];
  pointLabels: EmojiLabel[];
  regionLabels: EmojiLabel[];
  hitPadding?: number;
};

type EmojiMarkerSelectionResult = {
  selectedMarker: EmojiMarker | null;
  selectedLabel: EmojiLabel | null;
};

const EMOJI_MARKER_HIT_PADDING = 6;

type MarkerWithRenderOrder = {
  marker: EmojiMarker;
  renderOrder: number;
};

const findTopmostEmojiMarkerAtPoint = (
  markers: MarkerWithRenderOrder[],
  point: ScreenPoint,
  padding: number,
): EmojiMarker | null => {
  let best: MarkerWithRenderOrder | null = null;
  for (let i = 0; i < markers.length; i += 1) {
    const candidate = markers[i];
    const bounds = getEmojiMarkerBounds(candidate.marker, padding);
    if (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom) {
      continue;
    }
    if (
      !best ||
      candidate.marker.level > best.marker.level ||
      (candidate.marker.level === best.marker.level && candidate.renderOrder > best.renderOrder)
    ) {
      best = candidate;
    }
  }
  return best?.marker ?? null;
};

export const useEmojiMarkerSelection = ({
  map,
  pointMarkers,
  regionMarkers,
  pointLabels,
  regionLabels,
  hitPadding = EMOJI_MARKER_HIT_PADDING,
}: EmojiMarkerSelectionArgs): EmojiMarkerSelectionResult => {
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const renderOrderRef = useRef<MarkerWithRenderOrder[]>([]);

  useEffect(() => {
    const combined: MarkerWithRenderOrder[] = [];
    for (let i = 0; i < regionMarkers.length; i += 1) {
      combined.push({ marker: regionMarkers[i], renderOrder: i });
    }
    const offset = combined.length;
    for (let i = 0; i < pointMarkers.length; i += 1) {
      combined.push({ marker: pointMarkers[i], renderOrder: offset + i });
    }
    renderOrderRef.current = combined;
  }, [pointMarkers, regionMarkers]);

  const labelById = useMemo(() => {
    const labelMap = new Map<string, EmojiLabel>();
    for (let i = 0; i < pointLabels.length; i += 1) {
      labelMap.set(pointLabels[i].id, pointLabels[i]);
    }
    for (let i = 0; i < regionLabels.length; i += 1) {
      labelMap.set(regionLabels[i].id, regionLabels[i]);
    }
    return labelMap;
  }, [pointLabels, regionLabels]);

  useEffect(() => {
    if (!selectedMarkerId) {
      return;
    }
    if (!labelById.has(selectedMarkerId)) {
      setSelectedMarkerId(null);
    }
  }, [labelById, selectedMarkerId]);

  useEffect(() => {
    if (!map) {
      setSelectedMarkerId(null);
      return;
    }
    const handleMapClick = (event: MapMouseEvent) => {
      const hit = findTopmostEmojiMarkerAtPoint(renderOrderRef.current, event.point, hitPadding);
      setSelectedMarkerId((prev) => {
        if (!hit) {
          return null;
        }
        if (prev === hit.id) {
          return null;
        }
        return hit.id;
      });
    };
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [hitPadding, map]);

  const selectedLabel = selectedMarkerId ? (labelById.get(selectedMarkerId) ?? null) : null;
  const selectedMarker = useMemo(() => {
    if (!selectedMarkerId) {
      return null;
    }
    for (let i = 0; i < pointMarkers.length; i += 1) {
      const marker = pointMarkers[i];
      if (marker.id === selectedMarkerId) {
        return marker;
      }
    }
    for (let i = 0; i < regionMarkers.length; i += 1) {
      const marker = regionMarkers[i];
      if (marker.id === selectedMarkerId) {
        return marker;
      }
    }
    return null;
  }, [pointMarkers, regionMarkers, selectedMarkerId]);

  return {
    selectedMarker,
    selectedLabel,
  };
};
