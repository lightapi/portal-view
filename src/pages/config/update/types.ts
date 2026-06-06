import type { ConfigUpdateScopeId } from './configUpdateScopes';

export type ConfigValueType = 'string' | 'boolean' | 'integer' | 'float' | 'map' | 'list' | string;

export type ConfigUpdateProperty = {
  scope: ConfigUpdateScopeId;
  hostId: string;
  environment?: string;
  productId?: string;
  productVersionId?: string;
  productVersion?: string;
  instanceId?: string;
  instanceApiId?: string;
  instanceAppId?: string;
  configId: string;
  configName: string;
  configPhase?: string;
  configType?: string;
  classPath?: string;
  configDesc?: string;
  propertyId: string;
  propertyName: string;
  propertyType?: string;
  displayOrder?: number;
  required?: boolean;
  propertyDesc?: string;
  valueType?: ConfigValueType;
  resourceType?: string;
  defaultValue?: string;
  defaultSourceType?: string;
  inheritedValue?: string;
  overrideValue?: string | null;
  overrideAggregateVersion?: number | null;
  overrideUpdateUser?: string | null;
  overrideUpdateTs?: string | null;
  effectiveValue?: string | null;
  effectiveSourceType?: string | null;
  propertySource?: string | null;
  propertySourceType?: string | null;
  schemaId?: string | null;
  schemaVersion?: string | null;
  schemaType?: string | null;
  schemaStatus?: string | null;
  hasSchema?: boolean;
  overridden?: boolean;
  canUpdate?: boolean;
  canDeleteOverride?: boolean;
};

export type ConfigSchemaRef = {
  schemaId: string;
  hostId?: string | null;
  schemaVersion: string;
  schemaType?: string | null;
  specVersion?: string | null;
  schemaName?: string | null;
  schemaStatus?: string | null;
  schemaBody?: string | null;
  source?: string | null;
};

export type ConfigUpdateResponse = {
  total: number;
  properties: ConfigUpdateProperty[];
};

export type DraftOperation = 'create' | 'update' | 'reset';

export type ConfigUpdateDraft = {
  operation: DraftOperation;
  nextValue?: string;
  previousValue?: string | null;
  error?: string;
};

export type ConfigUpdateTarget = {
  environment?: string;
  productId?: string;
  productVersionId?: string;
  instanceId?: string;
  instanceApiId?: string;
  instanceAppId?: string;
};

export type ConfigUpdateFilters = {
  resourceTypes?: string[];
  configTypes?: string[];
  propertyTypes?: string[];
  configPhases?: string[];
};

export type ConfigTargetOption = {
  id: string;
  label: string;
};
