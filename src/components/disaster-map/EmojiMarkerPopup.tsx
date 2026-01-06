import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getEventKindIcon } from '../../constants';
import type { EmojiLabel, EmojiMarker } from './DisasterMapTypes';

type EmojiMarkerPopupProps = {
  container: HTMLDivElement | null;
  marker: EmojiMarker | null;
  label: EmojiLabel | null;
  maxEvents?: number;
  offset?: number;
};

type ElementSize = {
  width: number;
  height: number;
};

const EMOJI_MARKER_MAX_EVENTS = 4;
const EMOJI_MARKER_POPUP_OFFSET = 12;
const EMOJI_MARKER_EDGE_PADDING = 8;

const formatRelativeTime = (timestamp: number) =>
  formatDistanceToNow(timestamp, {
    addSuffix: true,
    locale: ko,
  });

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const EmojiMarkerPopup: React.FC<EmojiMarkerPopupProps> = ({
  container,
  marker,
  label,
  maxEvents = EMOJI_MARKER_MAX_EVENTS,
  offset = EMOJI_MARKER_POPUP_OFFSET,
}) => {
  const [popupElement, setPopupElement] = useState<HTMLDivElement | null>(null);
  const [popupSize, setPopupSize] = useState<ElementSize | null>(null);
  const [containerSize, setContainerSize] = useState<ElementSize | null>(null);

  useEffect(() => {
    const element = popupElement;
    if (!element) {
      setPopupSize(null);
      return;
    }
    const update = () => {
      setPopupSize({ width: element.offsetWidth, height: element.offsetHeight });
    };
    update();
    const observer = new ResizeObserver(() => {
      update();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [popupElement]);

  useEffect(() => {
    if (!container) {
      setContainerSize(null);
      return;
    }
    const update = () => {
      setContainerSize({ width: container.clientWidth, height: container.clientHeight });
    };
    update();
    const observer = new ResizeObserver(() => {
      update();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [container]);

  const position = useMemo(() => {
    if (!marker || !popupSize || !containerSize) {
      return null;
    }
    const maxLeft = Math.max(
      EMOJI_MARKER_EDGE_PADDING,
      containerSize.width - popupSize.width - EMOJI_MARKER_EDGE_PADDING,
    );
    const left = clamp(marker.x - popupSize.width / 2, EMOJI_MARKER_EDGE_PADDING, maxLeft);
    let top = marker.y - offset - popupSize.height;
    if (top < EMOJI_MARKER_EDGE_PADDING) {
      top = marker.y + offset;
    }
    const maxTop = Math.max(
      EMOJI_MARKER_EDGE_PADDING,
      containerSize.height - popupSize.height - EMOJI_MARKER_EDGE_PADDING,
    );
    top = clamp(top, EMOJI_MARKER_EDGE_PADDING, maxTop);
    return { left, top };
  }, [containerSize, marker, offset, popupSize]);

  if (!marker || !label || label.events.length === 0) {
    return null;
  }

  const visibleEvents = label.events.slice(0, maxEvents);
  const remainingEventCount = Math.max(0, label.events.length - visibleEvents.length);
  const isReady = Boolean(position && popupSize && containerSize);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        ref={setPopupElement}
        className="min-w-55 max-w-[320px] rounded-xl border border-slate-800/80 bg-slate-950/90 p-3 text-slate-100 shadow-[0_12px_30px_rgba(2,6,23,0.55)] backdrop-blur"
        style={{
          position: 'absolute',
          left: position ? position.left : marker.x,
          top: position ? position.top : marker.y,
          visibility: isReady ? 'visible' : 'hidden',
        }}
      >
        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
          <span>이벤트 목록</span>
          <span>{label.events.length}건</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {visibleEvents.map((event) => (
            <div key={event.id} className="flex items-start gap-2">
              <span className="text-base leading-none" aria-hidden="true">
                {getEventKindIcon(event.kind)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-100">{event.title}</div>
                {event.content && (
                  <div className="mt-0.5 truncate text-[10px] font-medium text-slate-400">{event.content}</div>
                )}
                <div className="text-[10px] font-medium text-slate-400">
                  {formatRelativeTime(event.timestamp)} · {event.source}
                </div>
              </div>
            </div>
          ))}
        </div>
        {remainingEventCount > 0 && (
          <div className="mt-2 text-[10px] font-semibold text-slate-500">외 {remainingEventCount}건</div>
        )}
      </div>
    </div>
  );
};

export default EmojiMarkerPopup;
