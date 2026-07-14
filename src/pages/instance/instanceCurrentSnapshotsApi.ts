import fetchClient from '../../utils/fetchClient';
import type {
  CurrentConfigSnapshot,
  CurrentConfigSnapshotsResponse,
} from './instanceCurrentSnapshots.types';

export class CurrentConfigSnapshotsApiError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CurrentConfigSnapshotsApiError';
    this.code = code;
  }
}

type CurrentConfigSnapshotsRequest = {
  hostId: string;
  instanceIds: string[];
  signal?: AbortSignal;
};

export async function getCurrentConfigSnapshotsByInstances({
  hostId,
  instanceIds,
  signal,
}: CurrentConfigSnapshotsRequest): Promise<CurrentConfigSnapshotsResponse> {
  const command = {
    host: 'lightapi.net',
    service: 'config',
    action: 'getCurrentConfigSnapshotsByInstances',
    version: '0.1.0',
    data: { hostId, instanceIds, configPhase: 'R' },
  };

  try {
    const response = await fetchClient('/portal/query', {
      method: 'POST',
      body: command,
      signal,
    });
    return validateResponse(response, hostId, instanceIds);
  } catch (caught: unknown) {
    if (caught instanceof DOMException && caught.name === 'AbortError') throw caught;
    if (caught instanceof CurrentConfigSnapshotsApiError) throw caught;
    const code = errorCode(caught);
    throw new CurrentConfigSnapshotsApiError(errorMessage(code), code);
  }
}

function validateResponse(value: unknown, hostId: string, instanceIds: string[]): CurrentConfigSnapshotsResponse {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const response = value as Partial<CurrentConfigSnapshotsResponse>;
  if (typeof response.resolvedAt !== 'string' || !Array.isArray(response.snapshots)
    || response.snapshots.length !== instanceIds.length
    || !response.comparisonLimits
    || !positiveNumber(response.comparisonLimits.maxProperties)
    || !positiveNumber(response.comparisonLimits.maxResponseBytes)) {
    throw invalidResponse();
  }
  response.snapshots.forEach((snapshot, index) => validateSnapshot(snapshot, hostId, instanceIds[index]));
  return response as CurrentConfigSnapshotsResponse;
}

function validateSnapshot(snapshot: CurrentConfigSnapshot, hostId: string, instanceId: string) {
  if (!snapshot || snapshot.hostId !== hostId || snapshot.instanceId !== instanceId
    || !text(snapshot.instanceName) || !text(snapshot.serviceId) || !text(snapshot.snapshotId)
    || !text(snapshot.snapshotTs) || !nonNegativeNumber(snapshot.propertyCount)) {
    throw invalidResponse();
  }
}

function invalidResponse() {
  return new CurrentConfigSnapshotsApiError('The server returned an invalid current-snapshot response.');
}

function errorCode(caught: unknown): string | undefined {
  if (!caught || typeof caught !== 'object') return undefined;
  const error = caught as Record<string, unknown>;
  if (typeof error.code === 'string') return error.code;
  if (error.data && typeof error.data === 'object' && typeof (error.data as Record<string, unknown>).code === 'string') {
    return (error.data as Record<string, unknown>).code as string;
  }
  return undefined;
}

function errorMessage(code?: string) {
  switch (code) {
    case 'CURRENT_CONFIG_SNAPSHOT_UNAVAILABLE':
      return 'At least one selected instance has no current configuration snapshot.';
    case 'CURRENT_CONFIG_SNAPSHOT_CARDINALITY':
      return 'At least one selected instance has multiple current snapshots. Resolve the snapshot data conflict before comparing.';
    case 'CURRENT_CONFIG_SNAPSHOT_FORBIDDEN':
      return 'You are not authorized to compare one or more selected instances.';
    case 'CURRENT_CONFIG_SNAPSHOT_MIXED_SERVICE':
    case 'CURRENT_CONFIG_SNAPSHOT_INVALID_SERVICE':
    case 'CURRENT_CONFIG_SNAPSHOT_SERVICE_MISMATCH':
      return 'The selected instances do not resolve to one shared service.';
    case 'CURRENT_CONFIG_SNAPSHOT_TOO_LARGE':
      return 'The current snapshots exceed the comparison property limit. Select fewer instances.';
    case 'CURRENT_CONFIG_SNAPSHOT_INVALID_REQUEST':
      return 'The selected instances cannot be resolved. Review the selection and try again.';
    default:
      return 'Unable to resolve current configuration snapshots. Try again.';
  }
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() !== '';
}

function positiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function nonNegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
