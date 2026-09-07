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
  | "bankId"
  | "docId"
  | "unitId"
  | "entityId"
  | "fromUnitId"
  | "toUnitId"
  | "linkType"
  | "directiveId"
  | "reflectionId"
  | "sessionId"
  | "dependsOnSkillId"
  | "domain"
  | "processId"
  | "providerId"
  | "tokenId"
  | "kid"
  | "wfDefId"
  | "workflowRole"
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
  /** Destination when the step's entity does not exist yet - normally a create form. */
  route: string;
  /**
   * Destination when the step is already complete - normally the matching update form.
   * Re-entering a completed step must not reopen a create form for an entity that already
   * exists: that form can only be prefilled with the identifying context keys, and
   * submitting it fails as a duplicate. The update form pairs with a `prefill` block in
   * Forms.json so the record is loaded from the server. Keep in sync with the
   * "completedRoute forms exist" test in taskRegistry.completedRoute.test.ts.
   */
  completedRoute?: string;
  /**
   * Context keys that must resolve before `completedRoute` may be used. These are the keys the
   * destination form needs to identify its record; without them the update form cannot load.
   * Must cover the destination form's `prefill.identity` - enforced by
   * taskRegistry.completedRoute.test.ts.
   */
  completedRequires?: TaskContextKey[];
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
  agentProfileExists?: boolean;
  agentProfileIncomplete?: boolean;
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
