export type ReplayCandidate = {
  failureId: string;
  status: string;
  eventCount: number;
  replayPolicy: string;
  firstFailedTs: string;
  lastFailedTs: string;
  errorCode?: string | null;
  encryptedPayloadBytes?: number;
  decryptedPayloadBytes?: number;
  payloadAvailable: boolean;
};

export type ReplayEventMetadata = {
  ordinal: number;
  eventId: string;
  eventType: string;
  schemaVersion: string;
  aggregateId?: string | null;
  aggregateType?: string | null;
  aggregateVersion?: number | null;
  rootInstanceId?: string | null;
  graphRevision?: number | null;
  sourceProcessor?: string | null;
  sourceTopic?: string | null;
  sourcePartition?: number | null;
  sourceOffset?: number | null;
  payloadAvailable: boolean;
  payloadStorage?: string | null;
  encryptedPayloadBytes?: number;
  decryptedPayloadBytes?: number;
  sensitivePayload?: boolean;
  replayPolicy?: string;
};

export type ReplayFailure = ReplayCandidate & {
  hostId: string;
  projectionName: string;
  consumerGroup: string;
  originalTransactionId?: string | null;
  contentFingerprint: string;
  dependencyScopes: Array<Record<string, unknown>>;
  errorType?: string | null;
  errorMessage?: string | null;
  failureCount?: number;
  events: ReplayEventMetadata[];
};

export type ReplayCandidateResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: ReplayCandidate[];
};

export type ReplayWarning = { code: string; message: string };

export type ReplayPlan = {
  replayRequestId: string;
  status: string;
  planHash: string;
  selectedTransactionCount: number;
  addedDependencyTransactionCount: number;
  transactionCount: number;
  eventCount: number;
  strategy: string;
  validationMode: string;
  projectionCommitted: boolean;
  isolationScope?: { mode?: string; rootInstanceIds?: string[] };
  warnings?: ReplayWarning[];
  expiresAt: string;
  repairId?: string | null;
};

export type ReplayItem = {
  ordinal: number;
  failureId: string;
  expectedContentFingerprint: string;
  dependencyReason: string;
  addedDependency: boolean;
  status: string;
  attemptCount: number;
  repairId?: string | null;
};

export type ReplayAttempt = {
  itemOrdinal: number;
  attemptNumber: number;
  workerId: string;
  result: string;
  projectionCommitted: boolean;
  startedTs: string;
  completedTs?: string | null;
  errorCode?: string | null;
};

export type RepairChangeShape = 'SINGLE_EVENT_FIELDS' | 'PER_EVENT_FIELDS';
export type RepairDecision = 'APPROVE' | 'REJECT';

export type ReplayRepairEvent = {
  ordinal: number;
  eventId: string;
  originalPayloadDigest: string;
  correctedPayloadDigest: string;
  changedFieldNames: string[];
};

export type ReplayRepair = {
  repairId: string;
  failureId: string;
  status: 'AWAITING_APPROVAL' | 'APPROVED' | 'APPLIED' | 'CANCELLED' | 'REJECTED' | string;
  reason: string;
  repairSchemaVersion: string;
  changedFieldNames: string[];
  originalTransactionFingerprint: string;
  correctedTransactionFingerprint: string;
  requesterUserId: string;
  requestedTs: string;
  reviewerUserId?: string | null;
  decisionTs?: string | null;
  approverUserId?: string | null;
  approvedTs?: string | null;
  appliedBy?: string | null;
  appliedTs?: string | null;
  completedTs?: string | null;
  linkedReplayRequestId?: string | null;
  linkedReplayStatus?: string | null;
  events: ReplayRepairEvent[];
};

export type CreateReplayRepairResponse = {
  repairId: string;
  status: string;
  changedFieldNames: string[];
  correctedTransactionFingerprint: string;
};

export type ReplayBarrier = {
  barrierId: string;
  scopeType: string;
  scopeKey: string;
  state: string;
  ownerType: string;
  barrierEpoch: number;
  quarantineFailureId?: string | null;
  installedTs?: string | null;
  releasedTs?: string | null;
};

export type ReplayStatus = {
  replayRequestId: string;
  hostId: string;
  projectionName: string;
  consumerGroup: string;
  strategy: string;
  validationMode: string;
  reason: string;
  planHash: string;
  planMetadata?: Record<string, unknown>;
  status: string;
  transactionCount: number;
  eventCount: number;
  encryptedPayloadBytes: number;
  decryptedPayloadBytes: number;
  requestedBy: string;
  requestedTs: string;
  approvedBy?: string | null;
  approvedTs?: string | null;
  startedBy?: string | null;
  startedTs?: string | null;
  completedTs?: string | null;
  expiresAt: string;
  failureCode?: string | null;
  failureMessage?: string | null;
  isolationMode?: string | null;
  projectionCommitted: boolean;
  repairStatus?: string | null;
  stale: boolean;
  items: ReplayItem[];
  attempts: ReplayAttempt[];
  barriers: ReplayBarrier[];
  deferred: { count: number; encryptedBytes: number; capacityState?: string };
  publication?: { count: number; encryptedBytes: number };
};

export type OperatorActionResponse = {
  status: string;
  actionRequestId?: string;
  waiverRequestId?: string;
  barrierId?: string;
  failureIds?: string[];
  downstreamBlockedFailureIds?: string[];
  released?: boolean;
  projectionMetadataAdvanced?: boolean;
};
