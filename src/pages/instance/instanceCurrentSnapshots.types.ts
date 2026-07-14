import type { SnapshotComparisonLimits } from '../snapshot/configSnapshotValues.types';

export type InstanceComparisonCandidate = {
  hostId: string;
  instanceId: string;
  instanceName?: string;
  serviceId?: string;
  envTag?: string;
  current?: boolean;
};

export type CurrentConfigSnapshot = {
  hostId: string;
  instanceId: string;
  instanceName: string;
  serviceId: string;
  environment?: string | null;
  snapshotId: string;
  snapshotTs: string;
  propertyCount: number;
};

export type CurrentConfigSnapshotsResponse = {
  resolvedAt: string;
  comparisonLimits: SnapshotComparisonLimits;
  snapshots: CurrentConfigSnapshot[];
};
