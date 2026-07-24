import fetchClient from '../../../utils/fetchClient';
import type {
  OperatorActionResponse,
  ReplayCandidateResponse,
  ReplayFailure,
  ReplayPlan,
  ReplayStatus,
} from './types';

const commandUrl = (action: string, data: Record<string, unknown>) => {
  const command = { host: 'lightapi.net', service: 'user', action, version: '0.1.0', data };
  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(command));
};

const invoke = async <T>(action: string, data: Record<string, unknown>): Promise<T> => {
  try {
    return await fetchClient(commandUrl(action, data)) as T;
  } catch (cause) {
    const value = cause as { code?: unknown; message?: unknown } | string | null;
    const code = typeof value === 'object' && value && typeof value.code === 'string' ? value.code : 'REQUEST_FAILED';
    // Server detail is intentionally not copied into the browser: a legacy
    // exception message could contain event content. The stable code is enough
    // to correlate with the server-side audit trail.
    throw new Error(`Event replay request failed (${code.slice(0, 128)}). Review the server audit trail.`);
  }
};

export const replayApi = {
  listCandidates: (hostId: string, projectionName: string, consumerGroup: string, page: number, pageSize: number) =>
    invoke<ReplayCandidateResponse>('listEventReplayCandidate', {
      hostId, projectionName, consumerGroup, status: 'OPEN', page, pageSize,
    }),
  getFailure: (hostId: string, failureId: string) =>
    invoke<ReplayFailure>('getEventReplayFailure', { hostId, failureId }),
  createPlan: (hostId: string, projectionName: string, consumerGroup: string, failureIds: string[],
    strategy: string, validationMode: string, reason: string, repairId?: string) => invoke<ReplayPlan>('createEventReplayPlan', {
      hostId, projectionName, consumerGroup, failureIds, strategy, validationMode, reason, repairId,
    }),
  getReplay: (hostId: string, replayRequestId: string) =>
    invoke<ReplayStatus>('getEventReplay', { hostId, replayRequestId }),
  approve: (hostId: string, replayRequestId: string, planHash: string, reason: string) =>
    invoke<Partial<ReplayStatus>>('approveEventReplay', { hostId, replayRequestId, planHash, reason }),
  execute: (hostId: string, replayRequestId: string, planHash: string, reason: string) =>
    invoke<Partial<ReplayStatus>>('executeEventReplay', { hostId, replayRequestId, planHash, reason }),
  cancel: (hostId: string, replayRequestId: string, planHash: string, reason: string) =>
    invoke<Partial<ReplayStatus>>('cancelEventReplay', { hostId, replayRequestId, planHash, reason }),
  requestWaiver: (hostId: string, failureIds: string[], reason: string) =>
    invoke<OperatorActionResponse>('waiveEventReplayFailure', {
      hostId, failureIds, expectedStatuses: failureIds.map(() => 'OPEN'), acknowledgeDependencyImpact: true, reason,
    }),
  approveWaiver: (hostId: string, waiverRequestId: string, failureIds: string[],
    expectedDownstreamBlockedFailureIds: string[], reason: string) =>
    invoke<OperatorActionResponse>('waiveEventReplayFailure', {
      hostId, waiverRequestId, failureIds, expectedDownstreamBlockedFailureIds, reason,
    }),
  requestBarrierRelease: (hostId: string, barrierId: string, expectedEpoch: number,
    owningFailureId: string, reason: string) => invoke<OperatorActionResponse>('releaseEventReplayBarrier', {
      hostId, barrierId, expectedEpoch, owningFailureId, action: 'RELEASE_WITH_GAP', reason,
    }),
  approveBarrierRelease: (hostId: string, actionRequestId: string, reason: string) =>
    invoke<OperatorActionResponse>('releaseEventReplayBarrier', { hostId, actionRequestId, reason }),
};
