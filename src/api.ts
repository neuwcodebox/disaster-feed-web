import { z } from 'zod';
import { EVENT_KIND_LABELS, EVENT_SOURCE_LABELS, SOURCE_DISPLAY_ORDER } from './constants';
import { type DisasterEvent, EventKinds, EventLevels, EventSources, type SourceStatus } from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

const schemaEvent = z.object({
  id: z.string(),
  source: z.enum(EventSources),
  kind: z.enum(EventKinds),
  title: z.string(),
  body: z.string().nullable(),
  fetchedAt: z.string(),
  occurredAt: z.string().nullable(),
  regionText: z.string().nullable(),
  level: z.enum(EventLevels),
  payload: z.record(z.string(), z.unknown()).nullable(),
});

const schemaSourceStatus = z.object({
  sourceId: z.number().int(),
  sourceKey: z.string(),
  status: z.string(),
  pollIntervalSec: z.number().int(),
  lastSuccessAt: z.string().nullable(),
  latestEventAt: z.string().nullable(),
  lagSec: z.number().int(),
  staleAfterSec: z.number().int(),
});

const schemaSourcesResponse = z.object({
  generatedAt: z.string(),
  sources: z.array(schemaSourceStatus),
});

export type ApiEvent = z.infer<typeof schemaEvent>;

const resolveBaseUrl = (): string => {
  if (!apiBaseUrl) {
    return window.location.origin;
  }
  if (apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://')) {
    return apiBaseUrl;
  }
  const prefix = apiBaseUrl.startsWith('/') ? '' : '/';
  return `${window.location.origin}${prefix}${apiBaseUrl}`;
};

const buildApiUrl = (path: string): string => {
  const base = resolveBaseUrl();
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase).toString();
};

const parseDateMs = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return null;
  }
  return ms;
};

const getSourceLabel = (sourceId: number, sourceKey?: string): string => {
  const label = EVENT_SOURCE_LABELS[sourceId as EventSources];
  return label ?? sourceKey ?? `#${sourceId}`;
};

const getKindLabel = (kind: number): string => {
  const label = EVENT_KIND_LABELS[kind as EventKinds];
  return label ?? '기타';
};

export const createEventSource = (since?: string): EventSource => {
  const url = new URL(buildApiUrl('/api/events/stream'));
  if (since) {
    url.searchParams.set('since', since);
  }
  return new EventSource(url.toString());
};

export const fetchSourceStatuses = async (): Promise<SourceStatus[]> => {
  const response = await fetch(buildApiUrl('/api/ingest/sources'));
  if (!response.ok) {
    throw new Error(`Failed to fetch source statuses: ${response.status}`);
  }
  const payload = schemaSourcesResponse.parse(await response.json());
  const generatedAtMs = parseDateMs(payload.generatedAt) ?? Date.now();
  const mapped: SourceStatus[] = [];
  for (let i = 0; i < payload.sources.length; i += 1) {
    const source = payload.sources[i];
    const lastSuccessMs = parseDateMs(source.lastSuccessAt);
    const staleThresholdMs = source.staleAfterSec * 1000;
    const isStale = lastSuccessMs ? generatedAtMs - lastSuccessMs > staleThresholdMs : false;
    const isConnected = source.status === 'ok' && !!lastSuccessMs && !isStale;
    mapped.push({
      sourceId: source.sourceId,
      name: getSourceLabel(source.sourceId, source.sourceKey),
      isConnected,
      lastUpdate: lastSuccessMs ?? generatedAtMs,
    });
  }
  const orderLookup = new Map<number, number>();
  for (let i = 0; i < SOURCE_DISPLAY_ORDER.length; i += 1) {
    orderLookup.set(SOURCE_DISPLAY_ORDER[i], i);
  }
  mapped.sort((a, b) => {
    const orderA = orderLookup.get(a.sourceId) ?? Number.POSITIVE_INFINITY;
    const orderB = orderLookup.get(b.sourceId) ?? Number.POSITIVE_INFINITY;
    return orderA - orderB;
  });
  return mapped;
};

export const fetchInitialEvents = async (): Promise<ApiEvent[]> => {
  const response = await fetch(buildApiUrl('/api/events'));
  if (!response.ok) {
    throw new Error(`Failed to fetch initial events: ${response.status}`);
  }
  const payload = z.array(schemaEvent).parse(await response.json());
  return payload;
};

export const parseEventData = (raw: string): ApiEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = schemaEvent.safeParse(parsed);
  if (!result.success) {
    console.warn('Invalid event payload', result.error);
    return null;
  }
  return result.data;
};

export const toDisasterEvent = (event: ApiEvent): DisasterEvent => {
  const occurredAtMs = parseDateMs(event.occurredAt);
  const fetchedAtMs = parseDateMs(event.fetchedAt);
  const timestamp = occurredAtMs ?? fetchedAtMs ?? Date.now();
  return {
    id: event.id,
    sourceId: event.source,
    source: getSourceLabel(event.source),
    kind: event.kind,
    category: getKindLabel(event.kind),
    title: event.title,
    content: event.body ?? undefined,
    level: event.level,
    timestamp,
    fetchedAt: event.fetchedAt,
    occurredAt: event.occurredAt,
    regionText: event.regionText,
  };
};

export const getFetchedAtMs = (event: ApiEvent): number | null => parseDateMs(event.fetchedAt);
