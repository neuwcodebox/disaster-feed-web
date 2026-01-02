import type React from 'react';
import type { EmojiMarker } from './DisasterMapTypes';

type EmojiMarkerVariant = 'region' | 'point';

type MarkerLayout = {
  columnCount: number;
  rowCount: number;
  gap: number;
  width: number;
  height: number;
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

const getMarkerLayout = (marker: EmojiMarker): MarkerLayout => {
  const tokenCount = Math.max(1, marker.tokens.length);
  const columnCount = Math.ceil(Math.sqrt(tokenCount));
  const rowCount = Math.ceil(tokenCount / columnCount);
  const gap = Math.max(1, Math.round(marker.size * 0.1));
  const width = columnCount * marker.size + (columnCount - 1) * gap;
  const height = rowCount * marker.size + (rowCount - 1) * gap;
  return { columnCount, rowCount, gap, width, height };
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
