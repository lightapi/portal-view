export type PublishableTool = {
  toolId: string;
  name: string;
  endpointId?: string;
  apiVersionId?: string;
  apiName?: string;
  apiVersion?: string;
  executionPlacement?: string;
};

export function publicationScope(tools: PublishableTool[]) {
  const endpointTools = tools.filter(tool => Boolean(tool.endpointId));
  const apiVersions = new Set(endpointTools.map(tool => tool.apiVersionId).filter(Boolean));
  if (endpointTools.length === tools.length && apiVersions.size === 1) {
    return {mode: 'REPLACE_API_SCOPE', apiVersionId: [...apiVersions][0]};
  }
  return {mode: 'ADD_OR_UPDATE', apiVersionId: undefined};
}
