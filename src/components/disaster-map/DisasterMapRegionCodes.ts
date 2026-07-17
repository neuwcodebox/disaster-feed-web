import type {
  GeoRegionFeature,
  GeoRegionFeatureCollection,
  GeoRegionIndex,
  GeoRegionSource,
  ResolvedRegionMatch,
} from './DisasterMapTypes';

const NATIONWIDE_REQUIRED_CODES = new Set<string>([
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
]);

const CURRENT_INTEGRATED_REGION_CODE = '1200000000';
const LEGACY_INTEGRATED_REGION_CODES = ['2900000000', '4600000000'] as const;

export const normalizeRegionCode = (code: string): string | null => {
  const digits = code.replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  if (digits.length >= 10) {
    return digits.slice(0, 10);
  }
  return digits.padEnd(10, '0');
};

export const buildGeoRegionIndex = (data: GeoRegionFeatureCollection): GeoRegionIndex => {
  const byCode = new Map<string, GeoRegionFeature>();
  const byPrefix = new Map<string, GeoRegionFeature[]>();

  for (let i = 0; i < data.features.length; i += 1) {
    const feature = data.features[i];
    const code = feature.properties.SIG_CD;
    byCode.set(code, feature);

    const prefix = code.slice(0, 2);
    const features = byPrefix.get(prefix);
    if (features) {
      features.push(feature);
    } else {
      byPrefix.set(prefix, [feature]);
    }
  }

  return { byCode, byPrefix };
};

const resolveFromIndex = (
  prefix: string,
  index: GeoRegionIndex | null,
  source: GeoRegionSource,
): ResolvedRegionMatch | null => {
  if (!index) {
    return null;
  }

  if (prefix.length === 5) {
    const feature = index.byCode.get(prefix);
    if (feature) {
      return { code: prefix, features: [feature], isWide: false, source };
    }
  }

  const sido = prefix.slice(0, 2);
  const features = index.byPrefix.get(sido);
  if (!features || features.length === 0) {
    return null;
  }

  return { code: sido, features, isWide: true, source };
};

export const resolveRegionMatch = (
  code: string,
  currentIndex: GeoRegionIndex | null,
  legacyIndex: GeoRegionIndex | null,
): ResolvedRegionMatch | null => {
  const normalized = normalizeRegionCode(code);
  if (!normalized) {
    return null;
  }

  const prefix = resolveRegionPrefix(normalized);
  if (prefix.length === 5) {
    const currentFeature = currentIndex?.byCode.get(prefix);
    if (currentFeature) {
      return { code: prefix, features: [currentFeature], isWide: false, source: 'current' };
    }

    const legacyFeature = legacyIndex?.byCode.get(prefix);
    if (legacyFeature) {
      return { code: prefix, features: [legacyFeature], isWide: false, source: 'legacy' };
    }
  }

  return resolveFromIndex(prefix, currentIndex, 'current') ?? resolveFromIndex(prefix, legacyIndex, 'legacy');
};

export const isNationwideRegionCodes = (regionCodes: string[] | null): boolean => {
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

  for (const requiredCode of NATIONWIDE_REQUIRED_CODES) {
    if (!normalizedCodes.has(requiredCode)) {
      return false;
    }
  }

  if (normalizedCodes.has(CURRENT_INTEGRATED_REGION_CODE)) {
    return true;
  }

  for (let i = 0; i < LEGACY_INTEGRATED_REGION_CODES.length; i += 1) {
    if (!normalizedCodes.has(LEGACY_INTEGRATED_REGION_CODES[i])) {
      return false;
    }
  }

  return true;
};

export const resolveRegionPrefix = (normalized: string): string => {
  const sigungu = normalized.slice(2, 5);
  if (sigungu === '000') {
    return normalized.slice(0, 2);
  }
  return normalized.slice(0, 5);
};
