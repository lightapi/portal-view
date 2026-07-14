import fetchClient from '../../utils/fetchClient';
import type { SnapshotValuesInclude, SnapshotValuesResponse } from './configSnapshotValues.types';

export class SnapshotValuesApiError extends Error {
  readonly statusCode?: number;
  readonly code?: string;

  constructor(message: string, statusCode?: number, code?: string) {
    super(message);
    this.name = 'SnapshotValuesApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

type SnapshotValuesRequest = {
  hostId: string;
  snapshotIds: string[];
  include: SnapshotValuesInclude[];
  signal?: AbortSignal;
};

export async function getConfigSnapshotValues({
  hostId,
  snapshotIds,
  include,
  signal,
}: SnapshotValuesRequest): Promise<SnapshotValuesResponse> {
  const command = {
    host: 'lightapi.net',
    service: 'config',
    action: 'getConfigSnapshotValues',
    version: '0.1.0',
    data: { hostId, snapshotIds, configPhase: 'R', include },
  };

  try {
    return await fetchClient('/portal/query', {
      method: 'POST',
      body: command,
      signal,
    }) as SnapshotValuesResponse;
  } catch (caught: unknown) {
    if (caught instanceof DOMException && caught.name === 'AbortError') throw caught;
    const error = caught && typeof caught === 'object' ? caught as Record<string, unknown> : {};
    const statusCode = numberValue(error.statusCode) ?? numberValue(error.status);
    const code = typeof error.code === 'string' ? error.code : undefined;
    const message = statusCode === 413 || code?.includes('TOO_LARGE')
      ? 'The selected snapshots exceed the property or response-size limit. Select fewer snapshots or download them individually.'
      : 'Unable to load complete snapshot values.';
    throw new SnapshotValuesApiError(message, statusCode, code);
  }
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export async function verifySnapshotYamlDigest(yaml: string, expectedDigest: string) {
  const bytes = new TextEncoder().encode(yaml);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
  return expectedDigest.toLowerCase() === `sha256:${hex}`;
}
