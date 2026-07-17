import type { DisasterEvent, EventLevels } from '../../types';
import { resolveRegionMatch } from './DisasterMapRegionCodes';
import type { GeoRegionFeature, GeoRegionIndex, PulseRegion, ResolvedRegionMatch } from './DisasterMapTypes';

export type RegionEventMatch = {
  event: DisasterEvent;
  match: ResolvedRegionMatch;
};

export type ResolvedRegionLevels = {
  current: Map<string, EventLevels>;
  legacy: Map<string, EventLevels>;
};

export const collectRegionEventMatches = (
  events: DisasterEvent[],
  currentIndex: GeoRegionIndex | null,
  legacyIndex: GeoRegionIndex | null,
): RegionEventMatch[] => {
  const matches: RegionEventMatch[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!event.regionCodes || event.geo) {
      continue;
    }
    const seen = new Set<string>();
    for (let j = 0; j < event.regionCodes.length; j += 1) {
      const match = resolveRegionMatch(event.regionCodes[j], currentIndex, legacyIndex);
      if (!match) {
        continue;
      }
      const key = `${match.source}:${match.code}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      matches.push({ event, match });
    }
  }
  return matches;
};

export const collectRegionLevels = (matches: RegionEventMatch[]): ResolvedRegionLevels => {
  const current = new Map<string, EventLevels>();
  const legacy = new Map<string, EventLevels>();
  for (let i = 0; i < matches.length; i += 1) {
    const { event, match } = matches[i];
    const target = match.source === 'current' ? current : legacy;
    for (let j = 0; j < match.features.length; j += 1) {
      const code = match.features[j].properties.SIG_CD;
      const existing = target.get(code);
      if (!existing || event.level > existing) {
        target.set(code, event.level);
      }
    }
  }
  return { current, legacy };
};

export const buildMatchedRegionIndex = (matches: RegionEventMatch[]): GeoRegionIndex | null => {
  if (matches.length === 0) {
    return null;
  }
  const byCode = new Map<string, GeoRegionFeature>();
  const byPrefix = new Map<string, GeoRegionFeature[]>();
  const prefixCodes = new Map<string, Set<string>>();

  for (let i = 0; i < matches.length; i += 1) {
    const features = matches[i].match.features;
    for (let j = 0; j < features.length; j += 1) {
      const feature = features[j];
      const code = feature.properties.SIG_CD;
      const prefix = code.slice(0, 2);
      byCode.set(code, feature);

      let seenCodes = prefixCodes.get(prefix);
      if (!seenCodes) {
        seenCodes = new Set<string>();
        prefixCodes.set(prefix, seenCodes);
      }
      if (seenCodes.has(code)) {
        continue;
      }
      seenCodes.add(code);

      const prefixFeatures = byPrefix.get(prefix);
      if (prefixFeatures) {
        prefixFeatures.push(feature);
      } else {
        byPrefix.set(prefix, [feature]);
      }
    }
  }

  return { byCode, byPrefix };
};

export const buildRegionEmojiEvents = (matches: RegionEventMatch[]): DisasterEvent[] => {
  const events: DisasterEvent[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const { event, match } = matches[i];
    events.push({ ...event, regionCodes: [match.code.padEnd(10, '0')] });
  }
  return events;
};

export const collectPulseRegionFeatures = (
  pulseRegions: PulseRegion[],
  regionIndex: GeoRegionIndex | null,
  source: PulseRegion['source'],
): GeoRegionFeature[] => {
  if (!regionIndex) {
    return [];
  }
  const features: GeoRegionFeature[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < pulseRegions.length; i += 1) {
    const pulse = pulseRegions[i];
    if (pulse.source !== source) {
      continue;
    }
    const matchedFeatures = pulse.isWide ? regionIndex.byPrefix.get(pulse.code) : undefined;
    if (matchedFeatures) {
      for (let j = 0; j < matchedFeatures.length; j += 1) {
        const feature = matchedFeatures[j];
        const code = feature.properties.SIG_CD;
        if (!seen.has(code)) {
          seen.add(code);
          features.push(feature);
        }
      }
      continue;
    }
    const feature = regionIndex.byCode.get(pulse.code);
    if (feature && !seen.has(pulse.code)) {
      seen.add(pulse.code);
      features.push(feature);
    }
  }
  return features;
};
