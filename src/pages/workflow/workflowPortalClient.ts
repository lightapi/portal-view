import {apiPost} from '../../api/apiPost';

export type WorkflowOperationError = Error & {
  code?: string;
  operationId?: string;
  requestedBy?: string;
  requestedTs?: string;
  operationState?: 'failed';
};

export function portalError(value: any): WorkflowOperationError {
  if (value instanceof Error && 'code' in value) return value as WorkflowOperationError;
  const nested = value?.error && typeof value.error === 'object' ? value.error : value;
  const metadata = nested?.metadata && typeof nested.metadata === 'object' ? nested.metadata : {};
  const details = metadata?.details && typeof metadata.details === 'object' ? metadata.details
    : nested?.details && typeof nested.details === 'object' ? nested.details : {};
  const code = nested?.code ?? nested?.statusCode;
  const message = nested?.description ?? nested?.message ?? value?.message ?? 'Workflow operation failed.';
  const error = new Error(`${code ? `${code}: ` : ''}${message}`) as WorkflowOperationError;
  error.code = code;
  error.operationId = details.operationId ?? nested?.operationId;
  error.requestedBy = details.requestedBy ?? nested?.requestedBy;
  error.requestedTs = details.requestedTs ?? nested?.requestedTs;
  if (metadata.operationState === 'failed') error.operationState = 'failed';
  return error;
}

export async function workflowCommand<T = any>(action: string, data: Record<string, unknown>, service = 'workflow'): Promise<T> {
  const result = await apiPost({url: '/portal/command', headers: {}, body: {
    host: 'lightapi.net', service, action, version: '0.1.0', data,
  }});
  if (result.error || result.aborted) throw portalError(result.error ?? {message: 'Request aborted; outcome unconfirmed.'});
  return result.data as T;
}

export const workflowPortalClient = {
  publishBindings: (hostId: string, toolIds: string[]) => workflowCommand<{results: any[]}>(
    'publishWorkflowToolBindings', {hostId, toolIds}, 'genai'),
  retireBinding: (hostId: string, instanceId: string, toolId: string, expectedAggregateVersion: number) =>
    workflowCommand('retireWorkflowToolBinding', {hostId, instanceId, toolId, expectedAggregateVersion}, 'genai'),
  decideBinding: (hostId: string, bindingId: string, expectedBindingDigest: string,
    decision: 'approve' | 'reject', comment?: string) => workflowCommand('decideWorkflowToolBinding',
    {hostId, bindingId, expectedBindingDigest, decision, ...(comment ? {comment} : {})}),
  revokeBinding: (hostId: string, bindingId: string, expectedBindingDigest: string, comment: string) =>
    workflowCommand('revokeWorkflowToolBinding', {hostId, bindingId, expectedBindingDigest, comment}),
  refreshBindings: (hostId: string, toolIds: string[]) => workflowCommand('refreshWorkflowToolBindingStatus', {hostId, toolIds}),
  retryOperation: (hostId: string, operationId: string) => workflowCommand('retryWorkflowOperation', {hostId, operationId}),
  start: (hostId: string, wfDefId: string, input: Record<string, unknown>, idempotencyKey: string) =>
    workflowCommand('startWorkflow', {hostId, wfDefId, input, idempotencyKey}),
  sync: (hostId: string, wfDefId: string) =>
    workflowCommand('syncWfDefinition', {hostId, wfDefId}),
};
