import type { PageDefinition, TaskContextKey, TaskDefinition, TaskResolvedContext, TaskStep } from "./types";
import { hasAnyRole } from "../utils/ownershipScope";

const taskStoragePrefix = "portal-view.taskContext.";
const taskSkipStoragePrefix = "portal-view.taskSkippedSteps.";
const taskHistoryStorageKey = "portal-view.recentTaskContexts";
const pageHistoryStorageKey = "portal-view.recentPages";
const maxRecentTasks = 8;
const maxRecentPages = 8;

export type RecentTaskContext = {
  taskId: string;
  context: TaskResolvedContext;
  updatedAt: number;
};

export type RecentTaskWithDefinition = RecentTaskContext & {
  task: TaskDefinition;
};

export type RecentPageContext = {
  pageId: string;
  route: string;
  context: TaskResolvedContext;
  updatedAt: number;
};

export type RecentPageWithDefinition = RecentPageContext & {
  page: PageDefinition;
};

export type SuggestedTaskOptions = {
  maxItems?: number;
  excludeTaskIds?: string[];
  activeTaskId?: string | null;
};

export const taskContextKeys: TaskContextKey[] = [
  "apiId",
  "apiVersionId",
  "instanceApiId",
  "instanceId",
  "runtimeInstanceId",
  "pathPrefix",
  "hostId",
  "sourceHostId",
  "targetHostId",
  "entityType",
  "deploymentMode",
  "userId",
  "toUserId",
  "conversationId",
  "configId",
  "propertyId",
  "environment",
  "productId",
  "productVersionId",
  "deploymentId",
  "deploymentInstanceId",
  "platformId",
  "pipelineId",
  "serviceId",
  "systemEnv",
  "runtimeEnv",
  "instanceAppId",
  "instanceFileId",
  "appId",
  "clientId",
  "roleId",
  "groupId",
  "positionId",
  "attributeId",
  "endpointId",
  "tableId",
  "valueId",
  "relationId",
  "language",
  "agentDefId",
  "skillId",
  "parentSkillId",
  "toolId",
  "paramId",
  "memId",
  "sessionId",
  "sessionHistoryId",
  "dependsOnSkillId",
  "domain",
  "processId",
  "providerId",
  "tokenId",
  "kid",
  "wfDefId",
  "workflowRole",
  "wfInstanceId",
  "wfTaskId",
  "taskId",
  "taskAsstId",
  "auditLogId",
  "assigneeId",
  "categoryId",
  "categoryCode",
  "correlationId",
  "sourceTypeId",
  "schemaId",
  "schemaVersion",
  "ruleId",
  "testId",
  "snapshotId",
  "tagId",
  "scheduleId",
  "errorCode",
  "metadataType",
  "accountSection",
  "contentType",
  "blogId",
  "cityId",
];

export function canAccess(roles: string | null | undefined, requiredRoles?: string[]) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (hasAnyRole(roles, ["admin"])) return true;
  if (requiredRoles.includes("access-admin")) return hasAnyRole(roles, requiredRoles);
  if (hasAnyRole(roles, ["host-admin"])) return true;
  return hasAnyRole(roles, requiredRoles);
}

export function searchTasks(tasks: TaskDefinition[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return tasks;

  return tasks.filter((task) => {
    const fields = [
      task.title,
      task.description,
      task.category,
      ...task.keywords,
      ...task.steps.flatMap((step) => [
        step.title,
        step.description,
        ...(step.keywords ?? []),
      ]),
    ];
    return fields.some((field) => field.toLowerCase().includes(q));
  });
}

export function searchPages(pages: PageDefinition[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return pages.filter((page) => {
    const fields = [
      page.title,
      page.description,
      page.category,
      page.route,
      ...page.keywords,
      ...(page.entities ?? []),
    ];
    return fields.some((field) => field.toLowerCase().includes(q));
  });
}

function normalizePageRoute(route: string) {
  const path = route.split("?")[0].replace(/\/+$/, "");
  return path || "/";
}

export function pageDefinitionForRoute(pages: PageDefinition[], route: string) {
  const normalizedRoute = normalizePageRoute(route).toLowerCase();
  return pages.find((page) => normalizePageRoute(page.route).toLowerCase() === normalizedRoute);
}

export function contextFromSearchParams(searchParams: URLSearchParams): TaskResolvedContext {
  const context: TaskResolvedContext = {};
  for (const key of taskContextKeys) {
    const value = searchParams.get(key);
    if (value) context[key] = value;
  }
  return context;
}

export function contextFromObject(value: unknown): TaskResolvedContext {
  const context: TaskResolvedContext = {};
  const collect = (sourceValue: unknown, depth: number) => {
    if (!sourceValue || typeof sourceValue !== "object" || depth > 3) return;

    const source = sourceValue as Record<string, unknown>;
    for (const key of taskContextKeys) {
      const raw = source[key];
      if (typeof raw === "string" && raw.trim()) context[key] = raw;
    }

    for (const raw of Object.values(source)) {
      collect(raw, depth + 1);
    }
  };

  collect(value, 0);

  return context;
}

export function mergeTaskContext(...contexts: TaskResolvedContext[]) {
  return contexts.reduce<TaskResolvedContext>(
    (acc, context) => ({ ...acc, ...context }),
    {},
  );
}

export function taskContextLabel(key: string) {
  return key
    .replace(/Id$/, " ID")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

export function visibleTaskContextEntries(context: TaskResolvedContext, limit = 4) {
  return taskContextKeys
    .map((key) => ({ key, value: context[key] }))
    .filter((entry): entry is { key: typeof taskContextKeys[number]; value: string } => !!entry.value)
    .slice(0, limit);
}

export function relativeTaskTime(value: number) {
  const elapsedSeconds = Math.max(1, Math.floor((Date.now() - value) / 1000));
  if (elapsedSeconds < 60) return "Just now";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

export function contextualTaskIdsForContext(context: TaskResolvedContext) {
  const taskIds = new Set<string>();
  const add = (...ids: string[]) => ids.forEach((id) => taskIds.add(id));

  if (context.apiId || context.apiVersionId || context.endpointId || context.serviceId) {
    add("publish-api", "register-ai-agent", "mcp-onboard-api", "configure-access-control", "manage-instance");
  }
  if (context.instanceApiId || context.pathPrefix) {
    add("mcp-onboard-api", "manage-instance", "configure-access-control", "manage-configuration");
  }
  if (context.instanceId || context.runtimeInstanceId || context.instanceAppId || context.instanceFileId) {
    add("manage-instance", "manage-deployment", "manage-configuration", "capture-config-snapshot");
  }
  if (context.hostId || context.userId) {
    add("manage-user-host-access");
  }
  if (context.configId || context.propertyId || context.environment) {
    add("manage-configuration", "manage-product-release", "promote-configuration");
  }
  if (context.productId || context.productVersionId) {
    add("manage-product-release", "manage-configuration", "manage-deployment");
  }
  if (context.deploymentId || context.deploymentInstanceId || context.platformId || context.pipelineId) {
    add("manage-deployment", "manage-product-release");
  }
  if (context.sourceHostId || context.targetHostId) {
    add("promote-configuration", "portal-snapshot-migration");
  }
  if (context.appId || context.clientId) {
    add("manage-client-app", "manage-oauth-provider", "manage-instance");
  }
  if (context.roleId || context.groupId || context.positionId || context.attributeId) {
    add("configure-access-control", "manage-user-host-access");
  }
  if (context.tableId || context.valueId || context.relationId || context.language) {
    add("manage-reference-data", "portal-snapshot-migration");
  }
  if (context.agentDefId || context.skillId || context.toolId || context.paramId || context.memId || context.sessionId || context.sessionHistoryId) {
    add("register-ai-agent", "manage-genai-assets");
  }
  if (context.providerId || context.tokenId || context.kid) {
    add("manage-oauth-provider");
  }
  if (context.wfDefId || context.wfInstanceId || context.wfTaskId || context.taskId || context.taskAsstId || context.auditLogId || context.assigneeId || context.correlationId) {
    add("manage-workflow");
  }
  if (context.schemaId || context.ruleId || context.testId) {
    add("manage-schema-rules");
  }
  if (context.snapshotId) {
    add("capture-config-snapshot", "portal-snapshot-migration");
  }
  if (context.tagId || context.categoryId || context.scheduleId || context.errorCode || context.domain || context.metadataType) {
    add("manage-portal-metadata");
  }
  if (context.blogId || context.cityId || context.entityType || context.contentType) {
    add("manage-community-content");
  }
  if (context.accountSection) {
    add("manage-my-account");
  }

  return Array.from(taskIds);
}

export function recentTaskContextsWithDefinitions(
  tasks: TaskDefinition[],
  roles: string | null | undefined,
  maxItems = maxRecentTasks,
): RecentTaskWithDefinition[] {
  return loadRecentTaskContexts()
    .map((entry) => {
      const task = tasks.find((item) => item.id === entry.taskId);
      if (!task || !canAccess(roles, task.roles)) return null;
      return { ...entry, task };
    })
    .filter((entry): entry is RecentTaskWithDefinition => !!entry)
    .slice(0, maxItems);
}

export function recentPageContextsWithDefinitions(
  pages: PageDefinition[],
  roles: string | null | undefined,
  maxItems = maxRecentPages,
): RecentPageWithDefinition[] {
  return loadRecentPageContexts()
    .map((entry) => {
      const page = pages.find((item) => item.id === entry.pageId)
        ?? pageDefinitionForRoute(pages, entry.route);
      if (!page || !canAccess(roles, page.roles)) return null;
      return { ...entry, page };
    })
    .filter((entry): entry is RecentPageWithDefinition => !!entry)
    .slice(0, maxItems);
}

export function suggestedTasksForContext(
  tasks: TaskDefinition[],
  context: TaskResolvedContext,
  roles: string | null | undefined,
  options: SuggestedTaskOptions = {},
) {
  if (visibleTaskContextEntries(context).length === 0) return [];

  const excludedTaskIds = new Set(options.excludeTaskIds ?? []);
  if (options.activeTaskId) excludedTaskIds.add(options.activeTaskId);

  return contextualTaskIdsForContext(context)
    .map((taskId) => tasks.find((task) => task.id === taskId))
    .filter((task): task is TaskDefinition => !!task && canAccess(roles, task.roles))
    .filter((task) => !excludedTaskIds.has(task.id))
    .slice(0, options.maxItems ?? tasks.length);
}

export function loadRecentPageContexts(): RecentPageContext[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.sessionStorage.getItem(pageHistoryStorageKey);
    const entries = value ? JSON.parse(value) : [];
    if (!Array.isArray(entries)) return [];

    return entries
      .filter((entry): entry is RecentPageContext => (
        entry
        && typeof entry.pageId === "string"
        && typeof entry.route === "string"
        && typeof entry.updatedAt === "number"
        && entry.context
        && typeof entry.context === "object"
      ))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, maxRecentPages);
  } catch {
    return [];
  }
}

export function saveRecentPageContext(page: PageDefinition, context: TaskResolvedContext) {
  if (typeof window === "undefined") return;

  try {
    const contextForHistory = storedContextForHistory(context);
    const entries = loadRecentPageContexts().filter((entry) => entry.pageId !== page.id);
    const nextEntries = [
      { pageId: page.id, route: page.route, context: contextForHistory, updatedAt: Date.now() },
      ...entries,
    ].slice(0, maxRecentPages);

    window.sessionStorage.setItem(pageHistoryStorageKey, JSON.stringify(nextEntries));
  } catch {
    // Ignore storage quota or private mode failures. Search still works without history.
  }
}

function hasMeaningfulTaskContext(context: TaskResolvedContext) {
  return taskContextKeys.some((key) => !!context[key])
    || context.mcpToolsConfigured !== undefined
    || context.accessConfigured !== undefined
    || context.apiExists !== undefined
    || context.apiVersionExists !== undefined
    || context.roleExists !== undefined
    || context.agentProfileExists !== undefined
    || context.agentProfileIncomplete !== undefined
    || context.promotionExportReady !== undefined
    || context.promotionDryRunReady !== undefined
    || context.promotionExecuted !== undefined
    || context.snapshotExportReady !== undefined
    || context.snapshotConverted !== undefined;
}

function storedContextForHistory(context: TaskResolvedContext) {
  const storedContext: TaskResolvedContext = {};
  for (const key of taskContextKeys) {
    const value = context[key];
    if (value) storedContext[key] = value;
  }
  if (context.mcpToolsConfigured !== undefined) storedContext.mcpToolsConfigured = context.mcpToolsConfigured;
  if (context.accessConfigured !== undefined) storedContext.accessConfigured = context.accessConfigured;
  if (context.apiExists !== undefined) storedContext.apiExists = context.apiExists;
  if (context.apiVersionExists !== undefined) storedContext.apiVersionExists = context.apiVersionExists;
  if (context.roleExists !== undefined) storedContext.roleExists = context.roleExists;
  if (context.agentProfileExists !== undefined) storedContext.agentProfileExists = context.agentProfileExists;
  if (context.agentProfileIncomplete !== undefined) storedContext.agentProfileIncomplete = context.agentProfileIncomplete;
  if (context.promotionExportReady !== undefined) storedContext.promotionExportReady = context.promotionExportReady;
  if (context.promotionDryRunReady !== undefined) storedContext.promotionDryRunReady = context.promotionDryRunReady;
  if (context.promotionExecuted !== undefined) storedContext.promotionExecuted = context.promotionExecuted;
  if (context.snapshotExportReady !== undefined) storedContext.snapshotExportReady = context.snapshotExportReady;
  if (context.snapshotConverted !== undefined) storedContext.snapshotConverted = context.snapshotConverted;

  return storedContext;
}

export function loadRecentTaskContexts(): RecentTaskContext[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.sessionStorage.getItem(taskHistoryStorageKey);
    const entries = value ? JSON.parse(value) : [];
    if (!Array.isArray(entries)) return [];

    return entries
      .filter((entry): entry is RecentTaskContext => (
        entry
        && typeof entry.taskId === "string"
        && typeof entry.updatedAt === "number"
        && entry.context
        && typeof entry.context === "object"
      ))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, maxRecentTasks);
  } catch {
    return [];
  }
}

export function saveRecentTaskContext(taskId: string, context: TaskResolvedContext) {
  if (typeof window === "undefined" || !hasMeaningfulTaskContext(context)) return;

  try {
    const contextForHistory = storedContextForHistory(context);
    const entries = loadRecentTaskContexts().filter((entry) => entry.taskId !== taskId);
    const nextEntries = [
      { taskId, context: contextForHistory, updatedAt: Date.now() },
      ...entries,
    ].slice(0, maxRecentTasks);

    window.sessionStorage.setItem(taskHistoryStorageKey, JSON.stringify(nextEntries));
  } catch {
    // Ignore storage quota or private mode failures. URL context still carries the task.
  }
}

export function removeRecentTaskContext(taskId: string) {
  if (typeof window === "undefined") return;

  try {
    const nextEntries = loadRecentTaskContexts().filter((entry) => entry.taskId !== taskId);
    if (nextEntries.length === 0) {
      window.sessionStorage.removeItem(taskHistoryStorageKey);
      return;
    }
    window.sessionStorage.setItem(taskHistoryStorageKey, JSON.stringify(nextEntries));
  } catch {
    // Ignore storage failures. The caller can still continue with URL context.
  }
}

export function loadStoredTaskContext(taskId: string): TaskResolvedContext {
  if (typeof window === "undefined") return {};

  try {
    const value = window.sessionStorage.getItem(`${taskStoragePrefix}${taskId}`);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

export function saveStoredTaskContext(taskId: string, context: TaskResolvedContext) {
  if (typeof window === "undefined") return;

  const storedContext = storedContextForHistory(context);

  try {
    window.sessionStorage.setItem(`${taskStoragePrefix}${taskId}`, JSON.stringify(storedContext));
    saveRecentTaskContext(taskId, storedContext);
  } catch {
    // Ignore storage quota or private mode failures. URL context still carries the task.
  }
}

export function loadSkippedTaskStepIds(taskId: string): string[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.sessionStorage.getItem(`${taskSkipStoragePrefix}${taskId}`);
    const entries = value ? JSON.parse(value) : [];
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function saveSkippedTaskStepIds(taskId: string, stepIds: string[]) {
  if (typeof window === "undefined") return;

  try {
    const uniqueStepIds = Array.from(new Set(stepIds));
    if (uniqueStepIds.length === 0) {
      window.sessionStorage.removeItem(`${taskSkipStoragePrefix}${taskId}`);
      return;
    }
    window.sessionStorage.setItem(`${taskSkipStoragePrefix}${taskId}`, JSON.stringify(uniqueStepIds));
  } catch {
    // Ignore storage failures. Skipping only affects the client-side checklist.
  }
}

export function skipTaskStep(taskId: string, stepId: string) {
  const stepIds = loadSkippedTaskStepIds(taskId);
  saveSkippedTaskStepIds(taskId, [...stepIds, stepId]);
}

export function restoreSkippedTaskStep(taskId: string, stepId: string) {
  const stepIds = loadSkippedTaskStepIds(taskId).filter((item) => item !== stepId);
  saveSkippedTaskStepIds(taskId, stepIds);
}

export function clearSkippedTaskSteps(taskId: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(`${taskSkipStoragePrefix}${taskId}`);
  } catch {
    // Ignore storage failures. The checklist can still be rebuilt from context.
  }
}

export function clearStoredTaskContext(taskId: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(`${taskStoragePrefix}${taskId}`);
    clearSkippedTaskSteps(taskId);
    removeRecentTaskContext(taskId);
  } catch {
    // Ignore storage failures. The caller can still continue with URL context.
  }
}

export function taskContextFromSearch(searchParams: URLSearchParams) {
  const taskId = searchParams.get("task") ?? "";
  if (!taskId) return null;

  return {
    taskId,
    stepId: searchParams.get("taskStep") ?? "",
    returnTo: searchParams.get("returnTo") ?? `/app/tasks/${taskId}`,
    context: mergeTaskContext(
      loadStoredTaskContext(taskId),
      contextFromSearchParams(searchParams),
    ),
  };
}

export function buildTaskStepRoute(
  taskId: string,
  step: TaskStep,
  searchParams: URLSearchParams,
  context: TaskResolvedContext = {},
) {
  const [path, query = ""] = step.route.split("?");
  const nextParams = new URLSearchParams(query);

  nextParams.set("task", taskId);
  nextParams.set("returnTo", `/app/tasks/${taskId}`);
  nextParams.set("taskStep", step.id);

  for (const key of taskContextKeys) {
    const value = context[key] ?? searchParams.get(key);
    if (value) nextParams.set(key, value);
  }

  const nextQuery = nextParams.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}

export function buildTaskContextRoute(
  taskId: string,
  route: string,
  context: TaskResolvedContext = {},
  returnTo = `/app/tasks/${taskId}`,
) {
  const [path, query = ""] = route.split("?");
  const nextParams = new URLSearchParams(query);

  nextParams.set("task", taskId);
  nextParams.set("returnTo", returnTo);

  for (const key of taskContextKeys) {
    const value = context[key];
    if (value) nextParams.set(key, value);
  }

  const nextQuery = nextParams.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}

export function buildContextRoute(
  route: string,
  context: TaskResolvedContext = {},
) {
  const [path, query = ""] = route.split("?");
  const nextParams = new URLSearchParams(query);

  for (const key of taskContextKeys) {
    const value = context[key];
    if (value) nextParams.set(key, value);
  }

  const nextQuery = nextParams.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}

export function buildTaskReturnRoute(
  taskId: string,
  returnTo: string | null | undefined,
  searchParams: URLSearchParams,
  context: TaskResolvedContext = {},
) {
  const fallback = `/app/tasks/${taskId}`;
  const target = returnTo || fallback;
  const [path, query = ""] = target.split("?");
  const nextParams = new URLSearchParams(query);

  for (const key of taskContextKeys) {
    const value = context[key] ?? searchParams.get(key);
    if (value) nextParams.set(key, value);
  }

  const nextQuery = nextParams.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}

export function buildTaskAwareRoute(
  route: string,
  searchParams: URLSearchParams,
  context: TaskResolvedContext = {},
) {
  const taskId = searchParams.get("task");
  if (!taskId) return route;

  const [path, query = ""] = route.split("?");
  const nextParams = new URLSearchParams(query);

  for (const key of ["task", "returnTo", "taskStep"]) {
    const value = searchParams.get(key);
    if (value) nextParams.set(key, value);
  }

  for (const key of taskContextKeys) {
    const value = context[key] ?? searchParams.get(key);
    if (value) nextParams.set(key, value);
  }

  const nextQuery = nextParams.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}

export function taskProgress(task: TaskDefinition) {
  const requiredSteps = task.steps.filter((step) => step.required).length;
  const optionalSteps = task.steps.length - requiredSteps;
  return { requiredSteps, optionalSteps, totalSteps: task.steps.length };
}
