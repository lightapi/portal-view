export type TaskCategory =
  | "API Marketplace"
  | "MCP Gateway"
  | "Access Control"
  | "Platform Operations"
  | "Portal Administration";

export type TaskContextKey =
  | "apiId"
  | "apiVersionId"
  | "instanceApiId"
  | "instanceId"
  | "runtimeInstanceId"
  | "pathPrefix"
  | "hostId"
  | "sourceHostId"
  | "targetHostId"
  | "entityType"
  | "deploymentMode"
  | "userId"
  | "toUserId"
  | "conversationId"
  | "configId"
  | "propertyId"
  | "environment"
  | "productId"
  | "productVersionId"
  | "deploymentId"
  | "deploymentInstanceId"
  | "platformId"
  | "pipelineId"
  | "serviceId"
  | "systemEnv"
  | "runtimeEnv"
  | "instanceAppId"
  | "instanceFileId"
  | "appId"
  | "clientId"
  | "roleId"
  | "groupId"
  | "positionId"
  | "attributeId"
  | "endpointId"
  | "tableId"
  | "valueId"
  | "relationId"
  | "language"
  | "agentDefId"
  | "skillId"
  | "parentSkillId"
  | "toolId"
  | "paramId"
  | "memId"
  | "sessionId"
  | "sessionHistoryId"
  | "dependsOnSkillId"
  | "domain"
  | "processId"
  | "providerId"
  | "tokenId"
  | "kid"
  | "wfDefId"
  | "wfInstanceId"
  | "wfTaskId"
  | "taskId"
  | "taskAsstId"
  | "auditLogId"
  | "assigneeId"
  | "categoryId"
  | "categoryCode"
  | "correlationId"
  | "sourceTypeId"
  | "schemaId"
  | "schemaVersion"
  | "ruleId"
  | "testId"
  | "snapshotId"
  | "tagId"
  | "scheduleId"
  | "errorCode"
  | "metadataType"
  | "accountSection"
  | "contentType"
  | "blogId"
  | "cityId";

export type TaskStep = {
  id: string;
  title: string;
  description: string;
  route: string;
  helpPath?: string;
  required: boolean;
  dependsOn?: string[];
  keywords?: string[];
};

export type TaskStepStatus = "complete" | "ready" | "blocked" | "optional" | "skipped" | "unknown";

export type TaskStepProgress = {
  stepId: string;
  status: TaskStepStatus;
  message?: string;
};

export type TaskResolvedContext = Partial<Record<TaskContextKey, string>> & {
  apiExists?: boolean;
  apiVersionExists?: boolean;
  roleExists?: boolean;
  mcpToolsConfigured?: boolean;
  accessConfigured?: boolean;
  promotionExportReady?: boolean;
  promotionDryRunReady?: boolean;
  promotionExecuted?: boolean;
  snapshotExportReady?: boolean;
  snapshotConverted?: boolean;
};

export type TaskDefinition = {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  roles?: string[];
  helpPath?: string;
  keywords: string[];
  steps: TaskStep[];
};

export type PageDefinition = {
  id: string;
  title: string;
  description: string;
  route: string;
  category: string;
  kind?: "Page" | "Form";
  roles?: string[];
  helpPath?: string;
  keywords: string[];
  entities?: string[];
};
