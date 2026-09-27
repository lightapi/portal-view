export type WorkflowBindingStatusInput = {
  executionPlacement?: string;
  publicationStatus?: string | null;
  publicationComment?: string | null;
  needsPublish?: boolean;
  publishedBindingDigest?: string | null;
  gatewayBindingDigest?: string | null;
};

export function workflowBindingStatus(tool: WorkflowBindingStatusInput): {label: string; detail?: string} | null {
  if (tool.executionPlacement !== 'workflow') return null;
  switch (tool.publicationStatus) {
    case 'pendingApproval': return {label: 'Pending approval'};
    case 'rejected': return {label: 'Rejected', detail: tool.publicationComment ?? undefined};
    case 'revoked': return {label: 'Revoked', detail: tool.publicationComment ?? undefined};
    case 'failed': return {label: 'Failed', detail: tool.publicationComment ?? undefined};
  }
  // An edited binding is stale even if an older approved revision is still on Gateway.
  if (tool.needsPublish || tool.publicationStatus !== 'active') return {label: 'Needs publish'};
  if (!tool.gatewayBindingDigest || tool.publishedBindingDigest !== tool.gatewayBindingDigest) {
    return {label: 'Approved, not yet on Gateway'};
  }
  return {label: 'Active'};
}
