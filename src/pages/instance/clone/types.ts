export type PropertyAction = 'COPY' | 'REPLACE' | 'OMIT';
export type CloneStatus = 'ACCEPTED' | 'PROJECTED' | 'SNAPSHOT_READY' | 'FAILED_DLQ';

export type PropertySelection = {
  scopeType: 'INSTANCE' | 'INSTANCE_API' | 'INSTANCE_APP' | 'INSTANCE_APP_API' | 'DEPLOYMENT_INSTANCE';
  sourceParentIds: Record<string, string>;
  propertyId: string;
  expectedAggregateVersion: number;
  action: PropertyAction;
  replacementValue?: string | null;
};

export type PlanRow = {
  selector: string;
  label: string;
  maskedValue?: string | null;
  selected: boolean;
  warnings: string[];
};

export type ClonePlan = {
  cloneRequestId: string;
  targetInstanceId: string;
  resolvedTarget: {
    instanceName: string;
    envTag: string;
    environment: string;
    serviceId: string;
    productVersionId: string;
    ownerUserId?: string | null;
    ownerPositionId?: string | null;
    instanceOverrides?: Record<string, unknown>;
  };
  graphRevision: number;
  sourceGraphDigest: string;
  catalogSchemaDigest: string;
  planHash: string;
  rows: PlanRow[];
  propertySelections: PropertySelection[];
  warnings: string[];
  eventCount: number;
  payloadBytes: number;
  maxEvents: number;
  maxPayloadBytes: number;
  snapshotLookup: Record<string, string>;
};

export type CloneExecution = {
  cloneRequestId: string;
  targetInstanceId: string;
  status: CloneStatus;
  transactionId: string;
  terminalEventId: string;
  snapshotId?: string | null;
  eventCount: number;
  payloadBytes: number;
  idempotentReplay: boolean;
  statusAction: 'getInstanceCloneStatus';
  retryAfterSeconds?: number;
};

export type CloneStatusResult = Pick<CloneExecution, 'cloneRequestId' | 'targetInstanceId' | 'status' | 'snapshotId' | 'eventCount' | 'payloadBytes'> & {
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type SourceInstance = {
  hostId: string;
  instanceId: string;
  instanceName?: string;
  envTag?: string;
  environment?: string;
  serviceId?: string;
  productVersionId?: string;
  aggregateVersion?: number;
  readonly?: boolean;
};
