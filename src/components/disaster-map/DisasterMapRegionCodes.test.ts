import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildGeoRegionIndex,
  isNationwideRegionCodes,
  normalizeRegionCode,
  resolveRegionMatch,
  resolveRegionPrefix,
} from './DisasterMapRegionCodes';
import type { GeoRegionFeatureCollection } from './DisasterMapTypes';

const loadRegions = (filename: string): GeoRegionFeatureCollection =>
  JSON.parse(
    readFileSync(new URL(`../../../public/regions/${filename}`, import.meta.url), 'utf8'),
  ) as GeoRegionFeatureCollection;

const currentRegions = loadRegions('SIG-20260701.json');
const legacyRegions = loadRegions('SIG-legacy.json');
const currentIndex = buildGeoRegionIndex(currentRegions);
const legacyIndex = buildGeoRegionIndex(legacyRegions);

const BASE_NATIONWIDE_CODES = [
  '1100000000',
  '2600000000',
  '2700000000',
  '2800000000',
  '3000000000',
  '3100000000',
  '3611000000',
  '4100000000',
  '4300000000',
  '4400000000',
  '4700000000',
  '4800000000',
  '5100000000',
  '5200000000',
];

describe('행정구역 코드 정규화', () => {
  it('10자리 문자열과 시도·시군구 접두사를 안전하게 만든다', () => {
    expect(normalizeRegionCode('28125-12345')).toBe('2812512345');
    expect(normalizeRegionCode('12')).toBe('1200000000');
    expect(normalizeRegionCode('지역없음')).toBeNull();
    expect(resolveRegionPrefix('1200000000')).toBe('12');
    expect(resolveRegionPrefix('2812512345')).toBe('28125');
  });
});

describe('신·구 경계 선택', () => {
  it.each(['12210', '28125', '28155', '28275', '28290'])('현행 자산에 %s 경계가 있다', (code) => {
    expect(currentIndex.byCode.has(code)).toBe(true);
  });

  it('신규 코드는 현행 경계에서, 폐지 코드는 legacy 경계에서 찾는다', () => {
    expect(resolveRegionMatch('2812500000', currentIndex, legacyIndex)?.source).toBe('current');
    expect(resolveRegionMatch('2814000000', currentIndex, legacyIndex)?.source).toBe('legacy');
    expect(resolveRegionMatch('2826000000', currentIndex, legacyIndex)?.source).toBe('legacy');
  });

  it('시군구 경계가 없으면 같은 체계의 시도 경계로 폴백한다', () => {
    const currentFallback = resolveRegionMatch('1299900000', currentIndex, legacyIndex);
    const legacyFallback = resolveRegionMatch('2999900000', currentIndex, legacyIndex);

    expect(currentFallback).toMatchObject({ code: '12', isWide: true, source: 'current' });
    expect(currentFallback?.features.length).toBeGreaterThan(1);
    expect(legacyFallback).toMatchObject({ code: '29', isWide: true, source: 'legacy' });
  });

  it('legacy 자산에 광주·전남과 기존 인천 경계가 남아 있다', () => {
    for (const code of ['29110', '46110', '28110', '28140', '28260']) {
      expect(legacyIndex.byCode.has(code)).toBe(true);
    }
  });
});

describe('전국 이벤트 판별', () => {
  it('현행 통합 코드와 과거 광주·전남 코드 조합을 동등하게 인정한다', () => {
    expect(isNationwideRegionCodes([...BASE_NATIONWIDE_CODES, '1200000000'])).toBe(true);
    expect(isNationwideRegionCodes([...BASE_NATIONWIDE_CODES, '2900000000', '4600000000'])).toBe(true);
    expect(isNationwideRegionCodes([...BASE_NATIONWIDE_CODES, '2900000000'])).toBe(false);
  });
});
