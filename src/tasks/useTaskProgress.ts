import { useEffect, useMemo, useState } from "react";
import fetchClient from "../utils/fetchClient";
import type {
  TaskDefinition,
  TaskResolvedContext,
  TaskStep,
  TaskStepProgress,
  TaskStepStatus,
} from "./types";
import {
  contextFromSearchParams,
  loadSkippedTaskStepIds,
  loadStoredTaskContext,
  mergeTaskContext,
  saveStoredTaskContext,
} from "./taskUtils";

type UseTaskProgressResult = {
  context: TaskResolvedContext;
  loading: boolean;
  error: string | null;
  steps: TaskStepProgress[];
  completeCount: number;
  blockedCount: number;
  skippedCount: number;
};

type InstanceApiRecord = {
  apiId?: string;
  apiVersionId?: string;
  instanceId?: string;
};

type McpToolEndpoint = {
  selected?: boolean;
};

type ApiVersionRecord = {
  apiId?: string;
  apiVersionId?: string;
  apiType?: string;
};

type AgentDefinitionRecord = {
  agentDefId?: string;
  apiVersionId?: string;
};

function has(context: TaskResolvedContext, key: keyof TaskResolvedContext) {
  return !!context[key];
}

function stepProgress(stepId: string, status: TaskStepStatus, message?: string): TaskStepProgress {
  return { stepId, status, message };
}

function normalizeApiType(apiType: string | undefined) {
  const normalized = apiType?.trim().toLowerCase();
  return normalized === "agent" ? "agt" : normalized;
}

function defaultProgress(task: TaskDefinition): TaskStepProgress[] {
  return task.steps.map((step) => (
    step.required
      ? stepProgress(step.id, "ready", "Open this step to continue.")
      : stepProgress(step.id, "optional", "Optional step.")
  ));
}

function publishApiStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const apiKnown = context.apiExists || has(context, "apiId") || has(context, "apiVersionId");
  const versionKnown = context.apiVersionExists || has(context, "apiVersionId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "create-api",
    apiKnown
      ? stepProgress("create-api", "complete", "API context is available.")
      : stepProgress("create-api", "ready", "Create or select the API to publish."),
  );
  progressByStep.set(
    "create-version",
    versionKnown
      ? stepProgress("create-version", "complete", "At least one API version is available.")
      : apiKnown
        ? stepProgress("create-version", "ready", "Add the API version metadata and specification.")
        : stepProgress("create-version", "blocked", "Create or select an API first."),
  );
  progressByStep.set(
    "review-marketplace",
    versionKnown
      ? stepProgress("review-marketplace", "optional", "Review the listing before consumers use it.")
      : stepProgress("review-marketplace", "blocked", "Add an API version first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function registerAiAgentStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const apiKnown = context.apiExists || has(context, "apiId") || has(context, "apiVersionId") || has(context, "agentDefId");
  const versionKnown = has(context, "apiVersionId") || has(context, "agentDefId");
  const profileKnown = context.agentProfileExists || (has(context, "agentDefId") && context.agentProfileIncomplete !== true);
  const skillKnown = has(context, "skillId");
  const toolKnown = has(context, "toolId");
  const runtimeKnown = has(context, "instanceApiId") || has(context, "instanceId") || has(context, "runtimeInstanceId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "api",
    apiKnown
      ? stepProgress("api", "complete", "API context is available.")
      : stepProgress("api", "ready", "Create or select the API that represents the agent."),
  );
  progressByStep.set(
    "version",
    versionKnown
      ? stepProgress("version", "complete", "Agent API version context is available.")
      : apiKnown
        ? stepProgress("version", "ready", "Create the API version with API type agt.")
        : stepProgress("version", "blocked", "Create or select an API first."),
  );
  progressByStep.set(
    "profile",
    profileKnown
      ? stepProgress("profile", "complete", "Agent profile exists for this API version.")
      : versionKnown
        ? stepProgress("profile", "ready", "Create the agent definition for this API version.")
        : stepProgress("profile", "blocked", "Create the agent API version first."),
  );
  progressByStep.set(
    "skills",
    skillKnown
      ? stepProgress("skills", "complete", "Agent skill context is available.")
      : profileKnown
        ? stepProgress("skills", "optional", "Attach skills when the agent needs reusable behavior.")
        : stepProgress("skills", "blocked", "Create the agent profile first."),
  );
  progressByStep.set(
    "tools",
    toolKnown
      ? stepProgress("tools", "complete", "Tool context is available.")
      : skillKnown
        ? stepProgress("tools", "optional", "Review tools exposed through the assigned skills.")
        : profileKnown
          ? stepProgress("tools", "optional", "No assigned skill context is available. Review this step only after assigning skills.")
          : stepProgress("tools", "blocked", "Create the agent profile first."),
  );
  progressByStep.set(
    "access",
    context.accessConfigured
      ? stepProgress("access", "complete", "Access control exists for this agent API version.")
      : profileKnown || versionKnown
        ? stepProgress("access", "optional", "Create role permissions before exposing the agent.")
        : stepProgress("access", "blocked", "Create the agent API version first."),
  );
  progressByStep.set(
    "runtime",
    runtimeKnown
      ? stepProgress("runtime", "complete", "Runtime or instance link context is available.")
      : profileKnown || versionKnown
        ? stepProgress("runtime", "optional", "Link this agent version to a runtime instance when deployed.")
        : stepProgress("runtime", "blocked", "Create the agent API version first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function accessControlStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const roleKnown = context.roleExists || has(context, "roleId");
  const assigneeKnown = has(context, "groupId") || has(context, "positionId") || has(context, "attributeId") || has(context, "userId");
  const permissionKnown = context.accessConfigured;
  const permissionContextKnown = roleKnown || has(context, "apiVersionId") || has(context, "endpointId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "role",
    roleKnown
      ? stepProgress("role", "complete", "Role context is available.")
      : stepProgress("role", "ready", "Create or select the role for this access policy."),
  );
  progressByStep.set(
    "group",
    assigneeKnown
      ? stepProgress("group", "complete", "A user, group, position, or attribute context is available.")
      : roleKnown
        ? stepProgress("group", "optional", "Connect the role to users, groups, positions, or attributes as needed.")
      : stepProgress("group", "blocked", "Create or select a role first."),
  );
  progressByStep.set(
    "permission",
    permissionKnown
      ? stepProgress("permission", "complete", "Role permission records already exist for this context.")
      : permissionContextKnown
        ? stepProgress("permission", "ready", "Review or create role permissions for this context.")
        : stepProgress("permission", "blocked", "Select a role or API version first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function promotionStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const sourceKnown = has(context, "sourceHostId") || has(context, "hostId");
  const targetKnown = has(context, "targetHostId");
  const exportReady = context.promotionExportReady;
  const dryRunReady = context.promotionDryRunReady;
  const executed = context.promotionExecuted;
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "export",
    exportReady
      ? stepProgress("export", "complete", "Promotion payload is ready for import.")
      : sourceKnown
        ? stepProgress("export", "ready", "Select entities and export the promotion payload.")
        : stepProgress("export", "ready", "Select the source host and entities to export."),
  );
  progressByStep.set(
    "import",
    executed
      ? stepProgress("import", "complete", "Promotion has been executed.")
      : dryRunReady
        ? stepProgress("import", "ready", "Review the dry run and execute when ready.")
        : exportReady || targetKnown
          ? stepProgress("import", "ready", "Run a dry run against the target host before executing.")
          : stepProgress("import", "blocked", "Export a promotion payload first."),
  );
  progressByStep.set(
    "history",
    executed
      ? stepProgress("history", "optional", "Review the promotion history or audit results.")
      : stepProgress("history", "blocked", "Execute the promotion before reviewing history."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function snapshotStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const sourceKnown = has(context, "sourceHostId") || has(context, "hostId");
  const targetKnown = has(context, "targetHostId");
  const exportReady = context.snapshotExportReady;
  const converted = context.snapshotConverted;
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "export",
    exportReady
      ? stepProgress("export", "complete", "Snapshot export is ready.")
      : sourceKnown
        ? stepProgress("export", "ready", "Export a host or global snapshot.")
        : stepProgress("export", "ready", "Select the source host and export a snapshot."),
  );
  progressByStep.set(
    "convert",
    converted
      ? stepProgress("convert", "complete", "Snapshot conversion has completed.")
      : exportReady || targetKnown
        ? stepProgress("convert", "optional", "Convert the snapshot for a target host when needed.")
        : stepProgress("convert", "blocked", "Export a snapshot before converting it."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function userHostStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const hostKnown = has(context, "hostId");
  const userKnown = has(context, "userId");
  const membershipKnown = hostKnown && userKnown;
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "host",
    hostKnown
      ? stepProgress("host", "complete", "Host context is available.")
      : stepProgress("host", "ready", "Create or select the target host."),
  );
  progressByStep.set(
    "user",
    userKnown
      ? stepProgress("user", "complete", "User context is available.")
      : stepProgress("user", "ready", "Onboard or select the user."),
  );
  progressByStep.set(
    "membership",
    membershipKnown
      ? stepProgress("membership", "complete", "Host and user context are available for membership.")
      : hostKnown || userKnown
        ? stepProgress("membership", "ready", "Complete the missing host or user field, then assign membership.")
        : stepProgress("membership", "blocked", "Select a host and user first."),
  );
  progressByStep.set(
    "switch",
    membershipKnown
      ? stepProgress("switch", "optional", "Confirm or switch the user's active host when needed.")
      : stepProgress("switch", "blocked", "Assign host membership first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function accountStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const userKnown = has(context, "userId");
  const activeSection = context.accountSection;
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "profile",
    userKnown
      ? stepProgress("profile", "complete", "User context is available.")
      : stepProgress("profile", "ready", "Review or update your profile."),
  );
  progressByStep.set(
    "payment",
    activeSection === "payment"
      ? stepProgress("payment", "ready", "Review or update payment settings.")
      : stepProgress("payment", "optional", "Review payment settings when needed."),
  );
  progressByStep.set(
    "messages",
    activeSection === "messages"
      ? stepProgress("messages", "ready", "Review or reply to private messages.")
      : stepProgress("messages", "optional", "Review private messages when needed."),
  );
  progressByStep.set(
    "orders",
    activeSection === "orders"
      ? stepProgress("orders", "ready", "Review order activity.")
      : stepProgress("orders", "optional", "Review order activity when needed."),
  );
  progressByStep.set(
    "password",
    activeSection === "password"
      ? stepProgress("password", "ready", "Change your password.")
      : stepProgress("password", "optional", "Change your password when needed."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function clientAppStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const appKnown = has(context, "appId");
  const clientKnown = has(context, "clientId");
  const instanceAppKnown = has(context, "instanceAppId") || has(context, "instanceId");
  const tokenKnown = has(context, "tokenId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "app",
    appKnown
      ? stepProgress("app", "complete", "Client app context is available.")
      : stepProgress("app", "ready", "Create or select the client application."),
  );
  progressByStep.set(
    "oauth-client",
    clientKnown
      ? stepProgress("oauth-client", "complete", "OAuth client context is available.")
      : appKnown
        ? stepProgress("oauth-client", "optional", "Create or review OAuth clients for this app.")
        : stepProgress("oauth-client", "blocked", "Create or select a client app first."),
  );
  progressByStep.set(
    "instance-app",
    instanceAppKnown
      ? stepProgress("instance-app", "complete", "Instance app context is available.")
      : appKnown
        ? stepProgress("instance-app", "optional", "Link this app to instances when needed.")
        : stepProgress("instance-app", "blocked", "Create or select a client app first."),
  );
  progressByStep.set(
    "token",
    tokenKnown
      ? stepProgress("token", "complete", "Client token context is available.")
      : clientKnown
        ? stepProgress("token", "optional", "Create or review tokens for this OAuth client.")
        : stepProgress("token", "blocked", "Create or select an OAuth client first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function portalMetadataStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const activeType = context.metadataType;
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "org",
    has(context, "domain")
      ? stepProgress("org", "complete", "Organization context is available.")
      : activeType === "org"
        ? stepProgress("org", "ready", "Create or select an organization.")
        : stepProgress("org", "optional", "Manage organizations when needed."),
  );
  progressByStep.set(
    "category",
    has(context, "categoryId")
      ? stepProgress("category", "complete", "Category context is available.")
      : activeType === "category"
        ? stepProgress("category", "ready", "Create or select a category.")
        : stepProgress("category", "optional", "Manage categories when needed."),
  );
  progressByStep.set(
    "tag",
    has(context, "tagId")
      ? stepProgress("tag", "complete", "Tag context is available.")
      : activeType === "tag"
        ? stepProgress("tag", "ready", "Create or select a tag.")
        : stepProgress("tag", "optional", "Manage tags when needed."),
  );
  progressByStep.set(
    "schedule",
    has(context, "scheduleId")
      ? stepProgress("schedule", "complete", "Schedule context is available.")
      : activeType === "schedule"
        ? stepProgress("schedule", "ready", "Create or select a schedule.")
        : stepProgress("schedule", "optional", "Manage schedules when needed."),
  );
  progressByStep.set(
    "error",
    has(context, "errorCode")
      ? stepProgress("error", "complete", "Error-code context is available.")
      : activeType === "error"
        ? stepProgress("error", "ready", "Create or select an error code.")
        : stepProgress("error", "optional", "Manage error-code definitions when needed."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function communityContentStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const activeType = context.contentType;
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "blog",
    has(context, "blogId")
      ? stepProgress("blog", "complete", "Blog context is available.")
      : activeType === "blog"
        ? stepProgress("blog", "ready", "Create or select a blog entry.")
        : stepProgress("blog", "optional", "Manage blog content when needed."),
  );
  progressByStep.set(
    "city-map",
    has(context, "cityId")
      ? stepProgress("city-map", "complete", "City map context is available.")
      : activeType === "city"
        ? stepProgress("city-map", "ready", "Create or update city map data.")
        : stepProgress("city-map", "optional", "Manage city map data when needed."),
  );
  progressByStep.set(
    "entity",
    has(context, "entityType")
      ? stepProgress("entity", "complete", "Community entity context is available.")
      : activeType === "entity"
        ? stepProgress("entity", "ready", "Create or update the community entity profile.")
        : stepProgress("entity", "optional", "Manage community entity profile when needed."),
  );
  progressByStep.set(
    "message",
    activeType === "message"
      ? stepProgress("message", "ready", "Send or reply to a private message.")
      : stepProgress("message", "optional", "Send a private message when needed."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function configStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const configKnown = has(context, "configId");
  const scopedTargetKnown = has(context, "environment")
    || has(context, "productId")
    || has(context, "productVersionId")
    || has(context, "instanceId")
    || has(context, "instanceApiId")
    || has(context, "instanceAppId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "config",
    configKnown
      ? stepProgress("config", "complete", "Config context is available.")
      : stepProgress("config", "ready", "Create or select the configuration record."),
  );
  progressByStep.set(
    "properties",
    configKnown
      ? stepProgress("properties", "optional", "Attach properties and scope-specific overrides as needed.")
      : stepProgress("properties", "blocked", "Create or select a config first."),
  );
  progressByStep.set(
    "instance-api",
    scopedTargetKnown
      ? stepProgress("instance-api", "complete", "Scoped config update target is available.")
      : configKnown
        ? stepProgress("instance-api", "optional", "Open the unified config update page for scoped overrides.")
        : stepProgress("instance-api", "optional", "Select a target to update scoped config values."),
  );
  progressByStep.set(
    "promote",
    configKnown
      ? stepProgress("promote", "optional", "Promote the config when it is ready for another environment.")
      : stepProgress("promote", "blocked", "Create or select a config first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function configSnapshotStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const instanceKnown = has(context, "instanceId");
  const snapshotKnown = has(context, "snapshotId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "instance",
    instanceKnown
      ? stepProgress("instance", "complete", "Instance context is available.")
      : stepProgress("instance", "ready", "Select the instance to snapshot."),
  );
  progressByStep.set(
    "snapshot",
    snapshotKnown
      ? stepProgress("snapshot", "complete", "Snapshot context is available.")
      : instanceKnown
        ? stepProgress("snapshot", "ready", "Create or review a snapshot for this instance.")
        : stepProgress("snapshot", "blocked", "Select an instance first."),
  );
  progressByStep.set(
    "properties",
    snapshotKnown
      ? stepProgress("properties", "optional", "Review captured properties and related views.")
      : stepProgress("properties", "blocked", "Create or select a snapshot first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function deploymentStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const platformKnown = has(context, "platformId");
  const pipelineKnown = has(context, "pipelineId");
  const deploymentInstanceKnown = has(context, "deploymentInstanceId") || has(context, "instanceId");
  const deploymentKnown = has(context, "deploymentId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "platform",
    platformKnown
      ? stepProgress("platform", "complete", "Platform context is available.")
      : stepProgress("platform", "ready", "Create or select the deployment platform."),
  );
  progressByStep.set(
    "pipeline",
    pipelineKnown
      ? stepProgress("pipeline", "complete", "Pipeline context is available.")
      : platformKnown
        ? stepProgress("pipeline", "ready", "Create or select a pipeline for this platform.")
        : stepProgress("pipeline", "blocked", "Create or select a platform first."),
  );
  progressByStep.set(
    "deployment-instance",
    deploymentInstanceKnown
      ? stepProgress("deployment-instance", "complete", "Deployment instance context is available.")
      : pipelineKnown || has(context, "instanceId") || has(context, "serviceId")
        ? stepProgress("deployment-instance", "optional", "Map an instance, service, environment, and pipeline as needed.")
        : stepProgress("deployment-instance", "blocked", "Create or select a pipeline first."),
  );
  progressByStep.set(
    "deployment",
    deploymentKnown
      ? stepProgress("deployment", "complete", "Deployment context is available.")
      : deploymentInstanceKnown
        ? stepProgress("deployment", "optional", "Review or create deployment records for this deployment instance.")
        : stepProgress("deployment", "blocked", "Create or select a deployment instance first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function instanceStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const instanceKnown = has(context, "instanceId");
  const runtimeKnown = has(context, "runtimeInstanceId");
  const instanceApiKnown = has(context, "instanceApiId");
  const instanceAppKnown = has(context, "instanceAppId");
  const appApiKnown = instanceAppKnown && instanceApiKnown;
  const pathPrefixKnown = has(context, "pathPrefix");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "instance",
    instanceKnown
      ? stepProgress("instance", "complete", "Instance context is available.")
      : stepProgress("instance", "ready", "Create or select the instance."),
  );
  progressByStep.set(
    "runtime",
    runtimeKnown
      ? stepProgress("runtime", "complete", "Runtime endpoint context is available.")
      : instanceKnown || has(context, "serviceId")
        ? stepProgress("runtime", "optional", "Register runtime address and status details when needed.")
        : stepProgress("runtime", "blocked", "Create or select an instance first."),
  );
  progressByStep.set(
    "api-link",
    instanceApiKnown
      ? stepProgress("api-link", "complete", "Instance API link context is available.")
      : instanceKnown || has(context, "apiVersionId")
        ? stepProgress("api-link", "optional", "Attach API versions to this instance when needed.")
        : stepProgress("api-link", "blocked", "Create or select an instance first."),
  );
  progressByStep.set(
    "app-link",
    instanceAppKnown
      ? stepProgress("app-link", "complete", "Instance app context is available.")
      : instanceKnown || has(context, "appId")
        ? stepProgress("app-link", "optional", "Attach app versions to this instance when needed.")
        : stepProgress("app-link", "blocked", "Create or select an instance first."),
  );
  progressByStep.set(
    "app-api-link",
    appApiKnown
      ? stepProgress("app-api-link", "complete", "Instance app API association context is available.")
      : instanceApiKnown || instanceAppKnown
        ? stepProgress("app-api-link", "optional", "Connect app and API links when both are available.")
        : stepProgress("app-api-link", "blocked", "Create an app link or API link first."),
  );
  progressByStep.set(
    "path-prefix",
    pathPrefixKnown
      ? stepProgress("path-prefix", "complete", "Path prefix context is available.")
      : instanceApiKnown
        ? stepProgress("path-prefix", "optional", "Add path prefixes when route mapping requires them.")
        : stepProgress("path-prefix", "blocked", "Create or select an instance API link first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function productReleaseStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const productVersionKnown = has(context, "productVersionId");
  const environmentKnown = has(context, "systemEnv") || has(context, "runtimeEnv");
  const pipelineKnown = has(context, "pipelineId");
  const configKnown = has(context, "configId");
  const propertyKnown = has(context, "propertyId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "product-version",
    productVersionKnown
      ? stepProgress("product-version", "complete", "Product version context is available.")
      : stepProgress("product-version", "ready", "Create or select the product version."),
  );
  progressByStep.set(
    "environment",
    environmentKnown
      ? stepProgress("environment", "complete", "Environment context is available.")
      : productVersionKnown
        ? stepProgress("environment", "optional", "Attach system and runtime environments as needed.")
        : stepProgress("environment", "blocked", "Create or select a product version first."),
  );
  progressByStep.set(
    "pipeline",
    pipelineKnown
      ? stepProgress("pipeline", "complete", "Pipeline context is available.")
      : productVersionKnown
        ? stepProgress("pipeline", "optional", "Attach deployment pipelines as needed.")
        : stepProgress("pipeline", "blocked", "Create or select a product version first."),
  );
  progressByStep.set(
    "config",
    configKnown
      ? stepProgress("config", "complete", "Config context is available.")
      : productVersionKnown
        ? stepProgress("config", "optional", "Attach configs used by this product version.")
        : stepProgress("config", "blocked", "Create or select a product version first."),
  );
  progressByStep.set(
    "properties",
    propertyKnown
      ? stepProgress("properties", "complete", "Property context is available.")
      : configKnown || productVersionKnown
        ? stepProgress("properties", "optional", "Attach individual config properties when needed.")
        : stepProgress("properties", "blocked", "Attach a config first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function referenceDataStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const tableKnown = has(context, "tableId");
  const valueKnown = has(context, "valueId");
  const localeKnown = has(context, "language");
  const relationTypeKnown = has(context, "relationId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "table",
    tableKnown
      ? stepProgress("table", "complete", "Reference table context is available.")
      : stepProgress("table", "ready", "Create or select a reference table."),
  );
  progressByStep.set(
    "value",
    valueKnown
      ? stepProgress("value", "complete", "Reference value context is available.")
      : tableKnown
        ? stepProgress("value", "optional", "Create or review values for this reference table.")
        : stepProgress("value", "blocked", "Create or select a reference table first."),
  );
  progressByStep.set(
    "locale",
    localeKnown
      ? stepProgress("locale", "complete", "Locale context is available.")
      : valueKnown
        ? stepProgress("locale", "optional", "Create or review localized labels for this value.")
        : stepProgress("locale", "blocked", "Create or select a reference value first."),
  );
  progressByStep.set(
    "relation-type",
    relationTypeKnown
      ? stepProgress("relation-type", "complete", "Relation type context is available.")
      : stepProgress("relation-type", "optional", "Create or select a relation type when relationships are needed."),
  );
  progressByStep.set(
    "relation",
    relationTypeKnown
      ? stepProgress("relation", "optional", "Create or review value relations for this relation type.")
      : stepProgress("relation", "blocked", "Create or select a relation type first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function genAiStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const agentKnown = has(context, "agentDefId");
  const skillKnown = has(context, "skillId");
  const toolKnown = has(context, "toolId");
  const parameterKnown = has(context, "paramId");
  const memoryKnown = has(context, "memId");
  const sessionKnown = has(context, "sessionId") || has(context, "sessionHistoryId") || has(context, "processId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "agent",
    agentKnown
      ? stepProgress("agent", "complete", "Agent definition context is available.")
      : stepProgress("agent", "ready", "Create or select an agent definition."),
  );
  progressByStep.set(
    "skill",
    skillKnown
      ? stepProgress("skill", "complete", "Skill context is available.")
      : stepProgress("skill", "ready", "Create or select a skill."),
  );
  progressByStep.set(
    "tool",
    toolKnown
      ? stepProgress("tool", "complete", "Tool context is available.")
      : stepProgress("tool", "ready", "Create or select a tool."),
  );
  progressByStep.set(
    "agent-skill",
    agentKnown && skillKnown
      ? stepProgress("agent-skill", "complete", "Agent and skill context are available for linking.")
      : agentKnown || skillKnown
        ? stepProgress("agent-skill", "optional", "Complete the missing agent or skill field, then link them.")
        : stepProgress("agent-skill", "blocked", "Create or select an agent and skill first."),
  );
  progressByStep.set(
    "skill-tool",
    skillKnown && toolKnown
      ? stepProgress("skill-tool", "complete", "Skill and tool context are available for linking.")
      : skillKnown || toolKnown
        ? stepProgress("skill-tool", "optional", "Complete the missing skill or tool field, then link them.")
        : stepProgress("skill-tool", "blocked", "Create or select a skill and tool first."),
  );
  progressByStep.set(
    "tool-param",
    parameterKnown
      ? stepProgress("tool-param", "complete", "Tool parameter context is available.")
      : toolKnown
        ? stepProgress("tool-param", "optional", "Create or review parameters for this tool.")
        : stepProgress("tool-param", "blocked", "Create or select a tool first."),
  );
  progressByStep.set(
    "memory",
    memoryKnown
      ? stepProgress("memory", "complete", "Memory context is available.")
      : agentKnown || has(context, "userId") || sessionKnown || has(context, "domain")
        ? stepProgress("memory", "optional", "Create or review memory records for this context.")
        : stepProgress("memory", "blocked", "Create or select an agent, user, session, or domain first."),
  );
  progressByStep.set(
    "session-history",
    sessionKnown
      ? stepProgress("session-history", "complete", "Session history context is available.")
      : stepProgress("session-history", "optional", "Review session history when troubleshooting an agent run."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function oauthProviderStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const providerKnown = has(context, "providerId");
  const keyKnown = has(context, "kid");
  const apiKnown = has(context, "apiId");
  const clientKnown = has(context, "clientId");
  const tokenKnown = has(context, "tokenId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "provider",
    providerKnown
      ? stepProgress("provider", "complete", "OAuth provider context is available.")
      : stepProgress("provider", "ready", "Create or select an OAuth provider."),
  );
  progressByStep.set(
    "keys",
    keyKnown
      ? stepProgress("keys", "complete", "Provider key context is available.")
      : providerKnown
        ? stepProgress("keys", "optional", "Review signing and token keys for this provider.")
        : stepProgress("keys", "blocked", "Create or select a provider first."),
  );
  progressByStep.set(
    "apis",
    apiKnown && providerKnown
      ? stepProgress("apis", "complete", "Provider and API context are available.")
      : providerKnown
        ? stepProgress("apis", "optional", "Attach APIs to this provider as needed.")
        : stepProgress("apis", "blocked", "Create or select a provider first."),
  );
  progressByStep.set(
    "clients",
    clientKnown && providerKnown
      ? stepProgress("clients", "complete", "Provider and client context are available.")
      : providerKnown
        ? stepProgress("clients", "optional", "Attach clients to this provider as needed.")
        : stepProgress("clients", "blocked", "Create or select a provider first."),
  );
  progressByStep.set(
    "client",
    clientKnown
      ? stepProgress("client", "complete", "OAuth client context is available.")
      : stepProgress("client", "optional", "Create or review OAuth clients."),
  );
  progressByStep.set(
    "tokens",
    tokenKnown
      ? stepProgress("tokens", "complete", "Client token context is available.")
      : clientKnown
        ? stepProgress("tokens", "optional", "Create or revoke tokens for this client.")
        : stepProgress("tokens", "blocked", "Create or select a client first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function workflowStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const definitionKnown = has(context, "wfDefId");
  const processKnown = has(context, "processId") || has(context, "wfInstanceId");
  const taskKnown = has(context, "taskId") || has(context, "wfTaskId");
  const assignmentKnown = has(context, "taskAsstId") || has(context, "assigneeId");
  const worklistKnown = has(context, "assigneeId") || has(context, "categoryId");
  const auditKnown = has(context, "auditLogId") || has(context, "correlationId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "definition",
    definitionKnown
      ? stepProgress("definition", "complete", "Workflow definition context is available.")
      : stepProgress("definition", "ready", "Create or select a workflow definition."),
  );
  progressByStep.set(
    "start",
    processKnown
      ? stepProgress("start", "complete", "Workflow process context is available.")
      : definitionKnown
        ? stepProgress("start", "optional", "Start a workflow instance from this definition when needed.")
        : stepProgress("start", "blocked", "Create or select a workflow definition first."),
  );
  progressByStep.set(
    "process",
    processKnown
      ? stepProgress("process", "complete", "Process context is available.")
      : definitionKnown
        ? stepProgress("process", "optional", "Review process instances for this workflow definition.")
        : stepProgress("process", "blocked", "Create or select a workflow definition first."),
  );
  progressByStep.set(
    "task",
    taskKnown
      ? stepProgress("task", "complete", "Workflow task context is available.")
      : processKnown
        ? stepProgress("task", "optional", "Review tasks created by this process.")
        : stepProgress("task", "blocked", "Review or select a process first."),
  );
  progressByStep.set(
    "assignment",
    assignmentKnown
      ? stepProgress("assignment", "complete", "Assignment or assignee context is available.")
      : taskKnown
        ? stepProgress("assignment", "optional", "Create or review assignments for this task.")
        : stepProgress("assignment", "blocked", "Review or select a task first."),
  );
  progressByStep.set(
    "worklist",
    worklistKnown
      ? stepProgress("worklist", "complete", "Worklist context is available.")
      : assignmentKnown
        ? stepProgress("worklist", "optional", "Review assignee worklists and category status.")
        : stepProgress("worklist", "blocked", "Review an assignment or assignee first."),
  );
  progressByStep.set(
    "audit",
    auditKnown
      ? stepProgress("audit", "complete", "Audit context is available.")
      : stepProgress("audit", "optional", "Review audit logs when troubleshooting workflow activity."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function schemaRuleStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const schemaKnown = has(context, "schemaId");
  const ruleKnown = has(context, "ruleId");
  const testKnown = has(context, "testId");
  const progressByStep = new Map<string, TaskStepProgress>();

  progressByStep.set(
    "schema",
    schemaKnown
      ? stepProgress("schema", "complete", "Schema context is available.")
      : stepProgress("schema", "optional", "Create or select a schema when the rule depends on structured validation."),
  );
  progressByStep.set(
    "rule",
    ruleKnown
      ? stepProgress("rule", "complete", "Rule context is available.")
      : stepProgress("rule", "ready", "Create or select a rule."),
  );
  progressByStep.set(
    "detail",
    ruleKnown
      ? stepProgress("detail", "optional", "Review rule conditions, actions, and raw configuration.")
      : stepProgress("detail", "blocked", "Create or select a rule first."),
  );
  progressByStep.set(
    "test-case",
    testKnown
      ? stepProgress("test-case", "complete", "Rule test case context is available.")
      : ruleKnown
        ? stepProgress("test-case", "optional", "Add executable test cases for this rule.")
        : stepProgress("test-case", "blocked", "Create or select a rule first."),
  );

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function mcpStepProgress(task: TaskDefinition, context: TaskResolvedContext): TaskStepProgress[] {
  const progressByStep = new Map<string, TaskStepProgress>();
  const apiKnown = has(context, "apiId") || has(context, "apiVersionId") || has(context, "instanceApiId");
  const versionKnown = has(context, "apiVersionId") || has(context, "instanceApiId");
  const instanceApiKnown = has(context, "instanceApiId");
  const deploymentKnown = has(context, "deploymentMode") || instanceApiKnown;

  if (task.id === "mcp-onboard-api") {
    progressByStep.set(
      "select-api",
      apiKnown
        ? stepProgress("select-api", "complete", "API context is available.")
        : stepProgress("select-api", "ready", "Select an existing API or create a new API."),
    );
    progressByStep.set(
      "api-version",
      versionKnown
        ? stepProgress("api-version", "complete", "API version context is available.")
        : apiKnown
          ? stepProgress("api-version", "ready", "Create or select the version to expose.")
          : stepProgress("api-version", "blocked", "Select or create an API first."),
    );
    progressByStep.set(
      "deployment-mode",
      deploymentKnown
        ? stepProgress("deployment-mode", "complete", "Deployment mode has been selected.")
        : versionKnown
          ? stepProgress("deployment-mode", "ready", "Choose centralized gateway or distributed sidecar.")
          : stepProgress("deployment-mode", "blocked", "Select an API version first."),
    );
    progressByStep.set(
      "gateway-link",
      instanceApiKnown
        ? stepProgress("gateway-link", "complete", "Gateway or sidecar link is available.")
        : versionKnown
          ? stepProgress("gateway-link", "ready", "Link this API version to an instance.")
          : stepProgress("gateway-link", "blocked", "Select an API version first."),
    );
    progressByStep.set(
      "tools",
      context.mcpToolsConfigured
        ? stepProgress("tools", "complete", "MCP tools are already configured.")
        : instanceApiKnown
          ? stepProgress("tools", "ready", "Select which tools to expose.")
          : stepProgress("tools", "blocked", "Link the API version to an instance first."),
    );
    progressByStep.set(
      "access",
      context.accessConfigured
        ? stepProgress("access", "complete", "Access control exists for this API version.")
        : versionKnown
          ? stepProgress("access", "optional", "Recommended after selecting tools.")
          : stepProgress("access", "blocked", "Select an API version first."),
    );
  }

  if (task.id === "register-standalone-mcp-server") {
    progressByStep.set(
      "server",
      apiKnown
        ? stepProgress("server", "complete", "MCP server API context is available.")
        : stepProgress("server", "ready", "Register the MCP server."),
    );
    progressByStep.set(
      "version",
      versionKnown
        ? stepProgress("version", "complete", "MCP server version context is available.")
        : apiKnown
          ? stepProgress("version", "ready", "Add transport and version details.")
          : stepProgress("version", "blocked", "Register the MCP server first."),
    );
    progressByStep.set(
      "gateway",
      instanceApiKnown
        ? stepProgress("gateway", "complete", "Gateway link is available.")
        : versionKnown && deploymentKnown
          ? stepProgress("gateway", "ready", "Link this server version to a gateway.")
          : versionKnown
            ? stepProgress("gateway", "ready", "Choose the gateway instance for this server.")
            : stepProgress("gateway", "blocked", "Add a server version first."),
    );
    progressByStep.set(
      "tools",
      context.mcpToolsConfigured
        ? stepProgress("tools", "complete", "MCP tools are configured.")
        : instanceApiKnown
          ? stepProgress("tools", "ready", "Review the exposed tools.")
          : stepProgress("tools", "blocked", "Link the server to a gateway first."),
    );
  }

  return task.steps.map((step) => progressByStep.get(step.id) ?? fallbackStepProgress(step, context));
}

function fallbackStepProgress(step: TaskStep, context: TaskResolvedContext): TaskStepProgress {
  if (!step.required) return stepProgress(step.id, "optional", "Optional step.");
  if (!step.dependsOn || step.dependsOn.length === 0) return stepProgress(step.id, "ready", "Open this step to continue.");
  if (has(context, "apiId") || has(context, "apiVersionId") || has(context, "instanceApiId")) {
    return stepProgress(step.id, "ready", "Open this step to continue.");
  }
  return stepProgress(step.id, "blocked", "Complete the previous required step first.");
}

function applySkippedStepProgress(
  task: TaskDefinition,
  steps: TaskStepProgress[],
  skippedStepIds: Set<string>,
) {
  return steps.map((stepProgressItem) => {
    if (!skippedStepIds.has(stepProgressItem.stepId) || stepProgressItem.status === "complete") {
      return stepProgressItem;
    }

    const step = task.steps.find((item) => item.id === stepProgressItem.stepId);
    if (!step || step.required) return stepProgressItem;

    return {
      ...stepProgressItem,
      status: "skipped" as const,
      message: "Skipped for now. Restore this step if it becomes relevant.",
    };
  });
}

async function resolveMcpContext(host: string, baseContext: TaskResolvedContext) {
  const nextContext: TaskResolvedContext = { ...baseContext };

  if (nextContext.instanceApiId) {
    const filters = JSON.stringify([{ id: "instanceApiId", value: nextContext.instanceApiId }]);
    const cmd = {
      host: "lightapi.net",
      service: "instance",
      action: "getInstanceApi",
      version: "0.1.0",
      data: { hostId: host, offset: 0, limit: 10, active: true, filters, sorting: "[]", globalFilter: "" },
    };
    const data = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd)));
    const instanceApis = Array.isArray(data?.instanceApis)
      ? data.instanceApis as InstanceApiRecord[]
      : [];
    const instanceApi = instanceApis[0];
    if (instanceApi) {
      if (instanceApi.apiId) nextContext.apiId = instanceApi.apiId;
      if (instanceApi.apiVersionId) nextContext.apiVersionId = instanceApi.apiVersionId;
      if (instanceApi.instanceId) nextContext.instanceId = instanceApi.instanceId;
    }
  }

  if (nextContext.instanceApiId && nextContext.apiVersionId) {
    const cmd = {
      host: "lightapi.net",
      service: "instance",
      action: "getInstanceApiMcpTool",
      version: "0.1.0",
      data: {
        hostId: host,
        instanceApiId: nextContext.instanceApiId,
        apiVersionId: nextContext.apiVersionId,
      },
    };
    const data = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd)));
    const endpoints = Array.isArray(data?.endpoints)
      ? data.endpoints as McpToolEndpoint[]
      : [];
    nextContext.mcpToolsConfigured = !!data?.exists && endpoints.some((endpoint) => endpoint.selected);
  }

  if (nextContext.apiVersionId) {
    const cmd = {
      host: "lightapi.net",
      service: "role",
      action: "queryRolePermission",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: 0,
        limit: 1,
        active: true,
        filters: JSON.stringify([{ id: "apiVersionId", value: nextContext.apiVersionId }]),
        sorting: "[]",
        globalFilter: "",
      },
    };
    const data = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd)));
    const rolePermissions = Array.isArray(data?.rolePermissions) ? data.rolePermissions : [];
    nextContext.accessConfigured = rolePermissions.length > 0;
  }

  return nextContext;
}

async function resolvePublishApiContext(host: string, baseContext: TaskResolvedContext) {
  const nextContext: TaskResolvedContext = { ...baseContext };

  if (nextContext.apiId) {
    const apiCmd = {
      host: "lightapi.net",
      service: "service",
      action: "getApi",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: 0,
        limit: 1,
        active: true,
        filters: JSON.stringify([{ id: "apiId", value: nextContext.apiId }]),
        sorting: "[]",
        globalFilter: "",
      },
    };
    const apiData = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(apiCmd)));
    nextContext.apiExists = (apiData?.services ?? []).length > 0;

    const versionCmd = {
      host: "lightapi.net",
      service: "service",
      action: "getApiVersion",
      version: "0.1.0",
      data: {
        hostId: host,
        apiId: nextContext.apiId,
        offset: 0,
        limit: 100,
        active: true,
        filters: "[]",
        sorting: "[]",
        globalFilter: "",
      },
    };
    const versionData = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(versionCmd)));
    const versions = Array.isArray(versionData)
      ? versionData as ApiVersionRecord[]
      : Array.isArray(versionData?.apiVersions)
        ? versionData.apiVersions as ApiVersionRecord[]
        : [];
    nextContext.apiVersionExists = versions.length > 0 || !!nextContext.apiVersionId;
    if (!nextContext.apiVersionId && versions.length === 1 && versions[0]?.apiVersionId) {
      nextContext.apiVersionId = versions[0].apiVersionId;
    }
  } else if (nextContext.apiVersionId) {
    nextContext.apiExists = true;
    nextContext.apiVersionExists = true;
  }

  return nextContext;
}

async function resolveRegisterAiAgentContext(host: string, baseContext: TaskResolvedContext) {
  const nextContext = await resolvePublishApiContext(host, baseContext);

  if (nextContext.apiId) {
    const versionCmd = {
      host: "lightapi.net",
      service: "service",
      action: "getApiVersion",
      version: "0.1.0",
      data: {
        hostId: host,
        apiId: nextContext.apiId,
        offset: 0,
        limit: 100,
        active: true,
        filters: "[]",
        sorting: "[]",
        globalFilter: "",
      },
    };
    const versionData = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(versionCmd)));
    const versions = Array.isArray(versionData)
      ? versionData as ApiVersionRecord[]
      : Array.isArray(versionData?.apiVersions)
        ? versionData.apiVersions as ApiVersionRecord[]
        : [];
    const agentVersions = versions.filter((version) => normalizeApiType(version.apiType) === "agt");
    nextContext.apiVersionExists = agentVersions.length > 0;

    if (!baseContext.apiVersionId && !baseContext.agentDefId) {
      if (agentVersions.length === 1 && agentVersions[0]?.apiVersionId) {
        nextContext.apiVersionId = agentVersions[0].apiVersionId;
        nextContext.agentDefId = agentVersions[0].apiVersionId;
      } else {
        delete nextContext.apiVersionId;
        delete nextContext.agentDefId;
      }
    }
  }

  if (!nextContext.agentDefId && nextContext.apiVersionId) {
    nextContext.agentDefId = nextContext.apiVersionId;
  }
  if (!nextContext.apiVersionId && nextContext.agentDefId) {
    nextContext.apiVersionId = nextContext.agentDefId;
    nextContext.apiVersionExists = true;
  }

  if (nextContext.agentDefId) {
    const agentCmd = {
      host: "lightapi.net",
      service: "genai",
      action: "getAgentDefinition",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: 0,
        limit: 1,
        active: true,
        filters: JSON.stringify([{ id: "agentDefId", value: nextContext.agentDefId }]),
        sorting: "[]",
        globalFilter: "",
      },
    };
    const agentData = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(agentCmd)));
    const agentDefinitions = Array.isArray(agentData)
      ? agentData as AgentDefinitionRecord[]
      : Array.isArray(agentData?.agentDefinitions)
        ? agentData.agentDefinitions as AgentDefinitionRecord[]
        : Array.isArray(agentData?.agents)
          ? agentData.agents as AgentDefinitionRecord[]
          : [];
    const agentDefinition = agentDefinitions[0];
    nextContext.agentProfileExists = !!agentDefinition;
    nextContext.agentProfileIncomplete = !!nextContext.apiVersionId && !agentDefinition;
    if (agentDefinition?.apiVersionId) nextContext.apiVersionId = agentDefinition.apiVersionId;
    if (agentDefinition?.agentDefId) nextContext.agentDefId = agentDefinition.agentDefId;
  } else if (nextContext.apiVersionId) {
    nextContext.agentProfileExists = false;
    nextContext.agentProfileIncomplete = true;
  }

  if (nextContext.apiVersionId) {
    const permissionCmd = {
      host: "lightapi.net",
      service: "role",
      action: "queryRolePermission",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: 0,
        limit: 1,
        active: true,
        filters: JSON.stringify([{ id: "apiVersionId", value: nextContext.apiVersionId }]),
        sorting: "[]",
        globalFilter: "",
      },
    };
    const permissionData = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(permissionCmd)));
    nextContext.accessConfigured = (permissionData?.rolePermissions ?? []).length > 0;
  }

  return nextContext;
}

async function resolveAccessContext(host: string, baseContext: TaskResolvedContext) {
  const nextContext: TaskResolvedContext = { ...baseContext };

  if (nextContext.roleId) {
    const roleCmd = {
      host: "lightapi.net",
      service: "role",
      action: "getRole",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: 0,
        limit: 1,
        active: true,
        filters: JSON.stringify([{ id: "roleId", value: nextContext.roleId }]),
        sorting: "[]",
        globalFilter: "",
      },
    };
    const roleData = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(roleCmd)));
    nextContext.roleExists = (roleData?.roles ?? []).length > 0;
  }

  if (nextContext.roleId || nextContext.apiVersionId || nextContext.endpointId) {
    const filters = [
      ...(nextContext.roleId ? [{ id: "roleId", value: nextContext.roleId }] : []),
      ...(nextContext.apiVersionId ? [{ id: "apiVersionId", value: nextContext.apiVersionId }] : []),
      ...(nextContext.endpointId ? [{ id: "endpointId", value: nextContext.endpointId }] : []),
    ];
    const permissionCmd = {
      host: "lightapi.net",
      service: "role",
      action: "queryRolePermission",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: 0,
        limit: 1,
        active: true,
        filters: JSON.stringify(filters),
        sorting: "[]",
        globalFilter: "",
      },
    };
    const permissionData = await fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(permissionCmd)));
    nextContext.accessConfigured = (permissionData?.rolePermissions ?? []).length > 0;
  }

  return nextContext;
}

function shouldResolveTask(task: TaskDefinition, context: TaskResolvedContext) {
  if (["mcp-onboard-api", "register-standalone-mcp-server"].includes(task.id)) {
    return !!(context.instanceApiId || context.apiVersionId);
  }
  if (task.id === "publish-api") {
    return !!(context.apiId || context.apiVersionId);
  }
  if (task.id === "register-ai-agent") {
    return !!(context.apiId || context.apiVersionId || context.agentDefId);
  }
  if (task.id === "configure-access-control") {
    return !!(context.roleId || context.apiVersionId || context.endpointId);
  }
  return false;
}

function resolveTaskContext(task: TaskDefinition, host: string, context: TaskResolvedContext) {
  if (["mcp-onboard-api", "register-standalone-mcp-server"].includes(task.id)) {
    return resolveMcpContext(host, context);
  }
  if (task.id === "publish-api") {
    return resolvePublishApiContext(host, context);
  }
  if (task.id === "register-ai-agent") {
    return resolveRegisterAiAgentContext(host, context);
  }
  if (task.id === "configure-access-control") {
    return resolveAccessContext(host, context);
  }
  return Promise.resolve(context);
}

export function useTaskProgress(
  task: TaskDefinition | undefined,
  searchParams: URLSearchParams,
  host: string | undefined,
): UseTaskProgressResult {
  const baseContext = useMemo(() => {
    if (!task) return contextFromSearchParams(searchParams);
    return mergeTaskContext(
      loadStoredTaskContext(task.id),
      contextFromSearchParams(searchParams),
    );
  }, [searchParams, task]);
  const [context, setContext] = useState<TaskResolvedContext>(baseContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skippedStepIds = useMemo(
    () => (task ? new Set(loadSkippedTaskStepIds(task.id)) : new Set<string>()),
    [searchParams, task],
  );

  useEffect(() => {
    let cancelled = false;
    setContext(baseContext);
    setError(null);
    if (task) saveStoredTaskContext(task.id, baseContext);

    if (!task || !host || !shouldResolveTask(task, baseContext)) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    resolveTaskContext(task, host, baseContext)
      .then((resolved) => {
        if (!cancelled) {
          setContext(resolved);
          saveStoredTaskContext(task.id, resolved);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Task progress could not be refreshed from the portal APIs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [baseContext, host, task]);

  const steps = useMemo(() => {
    if (!task) return [];
    let resolvedSteps: TaskStepProgress[];
    if (["mcp-onboard-api", "register-standalone-mcp-server"].includes(task.id)) {
      resolvedSteps = mcpStepProgress(task, context);
    } else if (task.id === "publish-api") {
      resolvedSteps = publishApiStepProgress(task, context);
    } else if (task.id === "register-ai-agent") {
      resolvedSteps = registerAiAgentStepProgress(task, context);
    } else if (task.id === "configure-access-control") {
      resolvedSteps = accessControlStepProgress(task, context);
    } else if (task.id === "promote-configuration") {
      resolvedSteps = promotionStepProgress(task, context);
    } else if (task.id === "portal-snapshot-migration") {
      resolvedSteps = snapshotStepProgress(task, context);
    } else if (task.id === "manage-user-host-access") {
      resolvedSteps = userHostStepProgress(task, context);
    } else if (task.id === "manage-my-account") {
      resolvedSteps = accountStepProgress(task, context);
    } else if (task.id === "manage-client-app") {
      resolvedSteps = clientAppStepProgress(task, context);
    } else if (task.id === "manage-portal-metadata") {
      resolvedSteps = portalMetadataStepProgress(task, context);
    } else if (task.id === "manage-community-content") {
      resolvedSteps = communityContentStepProgress(task, context);
    } else if (task.id === "manage-configuration") {
      resolvedSteps = configStepProgress(task, context);
    } else if (task.id === "capture-config-snapshot") {
      resolvedSteps = configSnapshotStepProgress(task, context);
    } else if (task.id === "manage-deployment") {
      resolvedSteps = deploymentStepProgress(task, context);
    } else if (task.id === "manage-instance") {
      resolvedSteps = instanceStepProgress(task, context);
    } else if (task.id === "manage-product-release") {
      resolvedSteps = productReleaseStepProgress(task, context);
    } else if (task.id === "manage-reference-data") {
      resolvedSteps = referenceDataStepProgress(task, context);
    } else if (task.id === "manage-genai-assets") {
      resolvedSteps = genAiStepProgress(task, context);
    } else if (task.id === "manage-oauth-provider") {
      resolvedSteps = oauthProviderStepProgress(task, context);
    } else if (task.id === "manage-workflow") {
      resolvedSteps = workflowStepProgress(task, context);
    } else if (task.id === "manage-schema-rules") {
      resolvedSteps = schemaRuleStepProgress(task, context);
    } else {
      resolvedSteps = defaultProgress(task);
    }

    return applySkippedStepProgress(task, resolvedSteps, skippedStepIds);
  }, [context, skippedStepIds, task]);

  return {
    context,
    loading,
    error,
    steps,
    completeCount: steps.filter((step) => step.status === "complete").length,
    blockedCount: steps.filter((step) => step.status === "blocked").length,
    skippedCount: steps.filter((step) => step.status === "skipped").length,
  };
}
