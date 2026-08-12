import fetchClient from '../../../utils/fetchClient';
import type {
  OperatorActionResponse,
  CreateReplayRepairResponse,
  RepairChangeShape,
  RepairDecision,
  ReplayCandidateResponse,
  ReplayFailure,
  ReplayPlan,
  ReplayRepair,
  ReplayStatus,
} from './types';

type ReplayService = 'query' | 'command';

const replayRequest = (action: string, data: Record<string, unknown>) =>
  ({ host: 'lightapi.net', service: 'user', action, version: '0.1.0', data });

const publicCodes = [
  'AGGREGATE_PROJECTION_BLOCKED', 'AGGREGATE_REPAIR_REQUIRED', 'EVENT_REPAIR_REQUIRED',
  'REPLAY_EXECUTION_PAUSED', 'REPAIR_SCHEMA_VALIDATION_FAILED', 'REPAIR_APPROVER_MUST_DIFFER',
  'REPAIR_NOT_APPROVED', 'REPAIR_FINGERPRINT_MISMATCH', 'STALE_PLAN', 'EVENT_NOT_REPLAYABLE',
  'INVALID_REPLAY_STATE',
] as const;

const publicMessage: Partial<Record<(typeof publicCodes)[number], string>> = {
  AGGREGATE_PROJECTION_BLOCKED: 'This ordered scope is blocked by an open projection failure.',
  AGGREGATE_REPAIR_REQUIRED: 'This ordered scope has invalid data and requires an approved repair.',
  EVENT_REPAIR_REQUIRED: 'Exact replay would repeat the invalid data. Create and approve a repair.',
  REPLAY_EXECUTION_PAUSED: 'Replay execution is paused. Planning and approvals remain available.',
  REPAIR_SCHEMA_VALIDATION_FAILED: 'The proposed business-field changes did not pass the repair schema.',
  REPAIR_APPROVER_MUST_DIFFER: 'A different authorized user must review this repair.',
  REPAIR_NOT_APPROVED: 'The repair is no longer approved for this operation. Refresh its status.',
  REPAIR_FINGERPRINT_MISMATCH: 'The immutable repair fingerprint changed. Review the audit trail and re-plan.',
  STALE_PLAN: 'The immutable plan is stale. Refresh the failure and create a new plan.',
  INVALID_REPLAY_STATE: 'This operation is incompatible with the current failure state. Ordered failures must be repaired or replayed.',
};

const resultCode = (value: unknown) => {
  const object = typeof value === 'object' && value ? value as Record<string, unknown> : null;
  const candidates = [object?.code, object?.message, object?.description, object?.data, value];
  const text = candidates.filter((candidate): candidate is string => typeof candidate === 'string').join(' ');
  return publicCodes.find((code) => text.includes(code)) || 'REQUEST_FAILED';
};

const invoke = async <T>(service: ReplayService, action: string, data: Record<string, unknown>): Promise<T> => {
  const request = replayRequest(action, data);
  try {
    return await fetchClient(service === 'command' ? '/portal/command' : '/portal/query', {
      method: 'POST', body: request,
    }) as T;
  } catch (cause) {
    const code = resultCode(cause);
    // Server detail is intentionally not copied into the browser: a legacy
    // exception message could contain event content. The stable code is enough
    // to correlate with the server-side audit trail.
    const guidance = code === 'REQUEST_FAILED' ? 'Review the server audit trail.' : publicMessage[code] || 'Review the current replay state.';
    throw new Error(`Event replay request failed (${code}). ${guidance}`);
  }
};

export const replayApi = {
  listCandidates: (hostId: string, projectionName: string, consumerGroup: string, page: number, pageSize: number) =>
    invoke<ReplayCandidateResponse>('query', 'listEventReplayCandidate', {
      hostId, projectionName, consumerGroup, status: 'OPEN', page, pageSize,
    }),
  getFailure: (hostId: string, failureId: string) =>
    invoke<ReplayFailure>('query', 'getEventReplayFailure', { hostId, failureId }),
  createPlan: (hostId: string, projectionName: string, consumerGroup: string, failureIds: string[],
    strategy: string, validationMode: string, reason: string, repairId?: string) => invoke<ReplayPlan>('command', 'createEventReplayPlan', {
      hostId, projectionName, consumerGroup, failureIds, strategy, validationMode, reason, repairId,
    }),
  createRepair: (hostId: string, failureId: string, expectedOriginalTransactionFingerprint: string,
    repairSchemaVersion: string, changeShape: RepairChangeShape, changes: Record<string, unknown>, reason: string) =>
    invoke<CreateReplayRepairResponse>('command', 'createEventReplayRepair', {
      hostId, failureId, expectedOriginalTransactionFingerprint, repairSchemaVersion, changeShape, changes, reason,
    }),
  getRepair: (hostId: string, repairId: string) =>
    invoke<ReplayRepair>('query', 'getEventReplayRepair', { hostId, repairId }),
  decideRepair: (hostId: string, repairId: string, expectedCorrectedTransactionFingerprint: string,
    decision: RepairDecision, reason: string) => invoke<Partial<ReplayRepair>>('command', 'approveEventReplayRepair', {
      hostId, repairId, expectedCorrectedTransactionFingerprint, decision, reason,
    }),
  getReplay: (hostId: string, replayRequestId: string) =>
    invoke<ReplayStatus>('query', 'getEventReplay', { hostId, replayRequestId }),
  approve: (hostId: string, replayRequestId: string, planHash: string, reason: string) =>
    invoke<Partial<ReplayStatus>>('command', 'approveEventReplay', { hostId, replayRequestId, planHash, reason }),
  execute: (hostId: string, replayRequestId: string, planHash: string, reason: string) =>
    invoke<Partial<ReplayStatus>>('command', 'executeEventReplay', { hostId, replayRequestId, planHash, reason }),
  cancel: (hostId: string, replayRequestId: string, planHash: string, reason: string) =>
    invoke<Partial<ReplayStatus>>('command', 'cancelEventReplay', { hostId, replayRequestId, planHash, reason }),
  requestWaiver: (hostId: string, failureIds: string[], reason: string) =>
    invoke<OperatorActionResponse>('command', 'waiveEventReplayFailure', {
      hostId, failureIds, expectedStatuses: failureIds.map(() => 'OPEN'), acknowledgeDependencyImpact: true, reason,
    }),
  approveWaiver: (hostId: string, waiverRequestId: string, failureIds: string[],
    expectedDownstreamBlockedFailureIds: string[], reason: string) =>
    invoke<OperatorActionResponse>('command', 'waiveEventReplayFailure', {
      hostId, waiverRequestId, failureIds, expectedDownstreamBlockedFailureIds, reason,
    }),
  requestBarrierRelease: (hostId: string, barrierId: string, expectedEpoch: number,
    owningFailureId: string, reason: string) => invoke<OperatorActionResponse>('command', 'releaseEventReplayBarrier', {
      hostId, barrierId, expectedEpoch, owningFailureId, action: 'RELEASE_WITH_GAP', reason,
    }),
  approveBarrierRelease: (hostId: string, actionRequestId: string, reason: string) =>
    invoke<OperatorActionResponse>('command', 'releaseEventReplayBarrier', { hostId, actionRequestId, reason }),
};
