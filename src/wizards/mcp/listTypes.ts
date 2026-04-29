export type McpStatus =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'no-version' }
  | { phase: 'no-gateway'; apiVersionId: string; apiVersion: string }
  | { phase: 'unconfigured'; instanceApiId: string; apiVersionId: string; apiVersion: string; instanceName: string }
  | { phase: 'no-tools'; instanceApiId: string; apiVersionId: string; apiVersion: string; instanceName: string; tools: string[] }
  | { phase: 'ready'; instanceApiId: string; apiVersionId: string; apiVersion: string; instanceName: string; toolCount: number; tools: string[] };

export type StatusPhase = McpStatus['phase'];

// ── Picker types (used by SelectExistingApiStep) ──
// Like ApiVersionRow but instanceApiId/instanceName are optional because
// the picker shows versions not yet linked to any gateway.
export type PickerMcpState = 'unconfigured' | 'no-tools' | 'ready';

export type PickerVersionRow = {
  apiVersionId: string;
  apiVersion: string;
  instanceApiId?: string;
  instanceName?: string;
  distributedInstanceIds?: string[];  // non-lg instanceIds this version is deployed on
  mcpState?: PickerMcpState;
};

export type PickerApiRow = {
  apiId: string;
  apiName?: string;
  apiDesc?: string;
  /** null while loading; empty array = no versions */
  versions: PickerVersionRow[] | null;
};
