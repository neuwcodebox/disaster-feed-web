import { describe, expect, it } from 'vitest';
import { type DisasterEvent, EventLevels } from '../../types';
import { buildRegionEmojiLabels, collectPointEmojiLabels } from './DisasterMapEmojiMarkers';
import type { RegionEventMatch } from './DisasterMapRegions';

const createEvent = (overrides: Partial<DisasterEvent> = {}): DisasterEvent => ({
  id: crypto.randomUUID(),
  sourceId: 1,
  source: '행안부',
  kind: 1,
  category: '기타',
  title: '재난문자 테스트',
  level: EventLevels.Info,
  timestamp: Date.now(),
  receivedAtMs: Date.now(),
  geo: null,
  regionCodes: null,
  ...overrides,
});

const createRegionMatch = (event: DisasterEvent, code: string, isWide = false): RegionEventMatch => ({
  event,
  match: {
    code,
    features: [],
    isWide,
    source: 'current',
  },
});

describe('지도 이모지 마커 이벤트', () => {
  it('동일한 포인트 이벤트 ID는 팝업에 한 번만 표시한다', () => {
    const event = createEvent({ geo: { lat: 37.5, lng: 127 } });
    const labels = collectPointEmojiLabels([event, { ...event }]);

    expect(labels).toHaveLength(1);
    expect(labels[0].events.map(({ id }) => id)).toEqual([event.id]);
    expect(labels[0].events[0]).toBe(event);
  });

  it('여러 지역에 매칭된 이벤트 ID는 각 지역 팝업에 한 번만 표시한다', () => {
    const event = createEvent({ id: 'shared-event' });
    const matches = [
      createRegionMatch(event, '11', true),
      createRegionMatch(event, '11110'),
      createRegionMatch(event, '26110'),
    ];
    const centroids = {
      byCode: new Map([
        ['11110', [126.98, 37.57] as [number, number]],
        ['26110', [129.03, 35.1] as [number, number]],
      ]),
      byPrefix: new Map<string, [number, number]>(),
    };

    const labels = buildRegionEmojiLabels(matches, centroids);

    expect(labels).toHaveLength(2);
    for (let i = 0; i < labels.length; i += 1) {
      expect(labels[i].events.map(({ id }) => id)).toEqual([event.id]);
      expect(labels[i].events[0]).toBe(event);
    }
  });

  it('기초 지역과 광역 이벤트를 합쳐도 최신순을 유지한다', () => {
    const olderEvent = createEvent({ id: 'older-event', timestamp: 100 });
    const newerEvent = createEvent({ id: 'newer-event', timestamp: 200 });
    const matches = [createRegionMatch(newerEvent, '11', true), createRegionMatch(olderEvent, '11110')];
    const centroids = {
      byCode: new Map([['11110', [126.98, 37.57] as [number, number]]]),
      byPrefix: new Map<string, [number, number]>(),
    };

    const labels = buildRegionEmojiLabels(matches, centroids);

    expect(labels[0].events).toEqual([newerEvent, olderEvent]);
  });
});
