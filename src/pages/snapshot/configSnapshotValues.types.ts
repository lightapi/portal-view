export type SnapshotValueType = 'string' | 'boolean' | 'integer' | 'float' | 'map' | 'list';

export type ConfigSnapshotSummary = {
  snapshotId: string;
  snapshotTs: string;
  snapshotType: string;
  hostId: string;
  instanceId: string;
  instanceName: string;
  current: boolean;
  description: string | null;
  userId?: string;
  deploymentId?: string;
  environment?: string;
  productId?: string;
  productVersion?: string;
  serviceId: string;
  apiId?: string;
  apiVersion?: string;
  aggregateVersion?: number;
  propertyCount: number;
};

export type SnapshotValueEntry = {
  key: string;
  value: unknown;
  valueType: SnapshotValueType;
  sourceLevel: string;
};

export type SnapshotValues = ConfigSnapshotSummary & {
  sha256: string;
  entries?: SnapshotValueEntry[];
  yaml?: string;
};

export type SnapshotValuesResponse = {
  configPhase: 'R';
  snapshots: SnapshotValues[];
};

export type SnapshotComparisonLimits = {
  maxProperties: number;
  maxResponseBytes: number;
};

export type ConfigSnapshotListResponse = {
  snapshots: ConfigSnapshotSummary[];
  total: number;
  comparisonLimits: SnapshotComparisonLimits;
};

export type SnapshotValuesInclude = 'entries' | 'yaml';

