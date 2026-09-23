export type PublishableTool = {
  toolId: string;
  name: string;
  endpointId?: string;
  apiVersionId?: string;
  apiName?: string;
  apiVersion?: string;
  executionPlacement?: string;
};

export type AccessReadiness = {
  toolId: string;
  endpointKey: string;
  state: string;
};

export function externallyManagedToolIds(readiness: AccessReadiness[]) {
  return new Set(readiness
    .filter(item => item.state === 'PRESERVED_API' || item.state === 'PRESERVED_EXTERNAL')
    .map(item => item.toolId));
}

export function toolsMissingAccessPolicy(
  toolIds: string[],
  previewPolicyIds: string[],
  currentPolicyIds: string[],
  readiness: AccessReadiness[],
) {
  const inherited = externallyManagedToolIds(readiness);
  const configured = new Set([...previewPolicyIds, ...currentPolicyIds]);
  return toolIds.filter(toolId => !inherited.has(toolId) && !configured.has(toolId));
}

export function shouldShowOwnershipPlaceholder(
  readiness: AccessReadiness | undefined,
  hasPolicy: boolean,
) {
  return !readiness && !hasPolicy;
}

export function publicationScope(tools: PublishableTool[]) {
  const endpointTools = tools.filter(tool => Boolean(tool.endpointId));
  const apiVersions = new Set(endpointTools.map(tool => tool.apiVersionId).filter(Boolean));
  if (endpointTools.length === tools.length && apiVersions.size === 1) {
    return {mode: 'REPLACE_API_SCOPE', apiVersionId: [...apiVersions][0]};
  }
  return {mode: 'ADD_OR_UPDATE', apiVersionId: undefined};
}
