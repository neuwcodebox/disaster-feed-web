import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type DisasterEvent, EventLevels } from '../../types';
import { buildGeoRegionIndex } from './DisasterMapRegionCodes';
import { collectRegionEventMatches } from './DisasterMapRegions';
import type { GeoRegionFeatureCollection } from './DisasterMapTypes';

const loadRegions = (filename: string): GeoRegionFeatureCollection =>
  JSON.parse(
    readFileSync(new URL(`../../../public/regions/${filename}`, import.meta.url), 'utf8'),
  ) as GeoRegionFeatureCollection;

const currentIndex = buildGeoRegionIndex(loadRegions('SIG-20260701.json'));
const legacyIndex = buildGeoRegionIndex(loadRegions('SIG-legacy.json'));

const createEvent = (overrides: Partial<DisasterEvent>): DisasterEvent => ({
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

describe('지도 이벤트 분류', () => {
  it('geo 이벤트는 기존처럼 지역 폴리곤 대상에서 제외한다', () => {
    const event = createEvent({
      geo: { lat: 37.5, lng: 127 },
      regionCodes: ['2812500000'],
    });

    expect(collectRegionEventMatches([event], currentIndex, legacyIndex)).toEqual([]);
  });

  it('geo가 없는 이벤트만 신·구 지역 경계에 연결한다', () => {
    const currentEvent = createEvent({ regionCodes: ['2812500000'] });
    const legacyEvent = createEvent({ regionCodes: ['2814000000'] });
    const matches = collectRegionEventMatches([currentEvent, legacyEvent], currentIndex, legacyIndex);

    expect(matches.map(({ match }) => match.source)).toEqual(['current', 'legacy']);
  });
});
