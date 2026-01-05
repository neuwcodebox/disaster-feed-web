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

const findEmojiMarkerAtPoint = (markers: EmojiMarker[], point: ScreenPoint, padding: number): EmojiMarker | null => {
  let best: EmojiMarker | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    const bounds = getEmojiMarkerBounds(marker, padding);
    if (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom) {
      continue;
    }
    const dx = point.x - marker.x;
    const dy = point.y - marker.y;
    const distance = dx * dx + dy * dy;
    if (!best || distance < bestDistance) {
      best = marker;
      bestDistance = distance;
    }
  }
  return best;
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
  const pointMarkersRef = useRef<EmojiMarker[]>(pointMarkers);
  const regionMarkersRef = useRef<EmojiMarker[]>(regionMarkers);

  useEffect(() => {
    pointMarkersRef.current = pointMarkers;
  }, [pointMarkers]);

  useEffect(() => {
    regionMarkersRef.current = regionMarkers;
  }, [regionMarkers]);

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
      const pointHit = findEmojiMarkerAtPoint(pointMarkersRef.current, event.point, hitPadding);
      const hit = pointHit ? pointHit : findEmojiMarkerAtPoint(regionMarkersRef.current, event.point, hitPadding);
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
