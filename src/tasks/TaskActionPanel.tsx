import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserState } from "../contexts/UserContext";
import { taskRegistry } from "./taskRegistry";
import type { TaskDefinition, TaskResolvedContext, TaskStep } from "./types";
import { buildContextRoute, buildTaskStepRoute, canAccess } from "./taskUtils";

type TaskActionPanelProps = {
  title?: string;
  context: TaskResolvedContext;
  taskIds?: string[];
  maxActions?: number;
};

type TaskAction = {
  task: TaskDefinition;
  step: TaskStep;
  label: string;
};

function has(context: TaskResolvedContext, key: keyof TaskResolvedContext) {
  return !!context[key];
}

function hasConfigUpdateTarget(context: TaskResolvedContext) {
  return !!(
    context.environment
    || context.productId
    || context.productVersionId
    || context.instanceId
    || context.instanceApiId
    || context.instanceAppId
  );
}

function selectTaskStep(task: TaskDefinition, context: TaskResolvedContext): TaskStep {
  if (task.id === "publish-api") {
    if (!has(context, "apiId")) return task.steps.find((step) => step.id === "create-api") ?? task.steps[0];
    if (!has(context, "apiVersionId")) return task.steps.find((step) => step.id === "create-version") ?? task.steps[0];
    return task.steps.find((step) => step.id === "review-marketplace") ?? task.steps[0];
  }

  if (task.id === "mcp-onboard-api") {
    if (!has(context, "apiId") && !has(context, "instanceApiId")) {
      return task.steps.find((step) => step.id === "select-api") ?? task.steps[0];
    }
    if (!has(context, "apiVersionId") && !has(context, "instanceApiId")) {
      return task.steps.find((step) => step.id === "api-version") ?? task.steps[0];
    }
    if (!has(context, "deploymentMode") && !has(context, "instanceApiId")) {
      return task.steps.find((step) => step.id === "deployment-mode") ?? task.steps[0];
    }
    if (!has(context, "instanceApiId")) {
      return task.steps.find((step) => step.id === "gateway-link") ?? task.steps[0];
    }
    if (!context.mcpToolsConfigured) {
      return task.steps.find((step) => step.id === "tools") ?? task.steps[0];
    }
    return task.steps.find((step) => step.id === "access") ?? task.steps[0];
  }

  if (task.id === "register-standalone-mcp-server") {
    if (!has(context, "apiId")) return task.steps.find((step) => step.id === "server") ?? task.steps[0];
    if (!has(context, "apiVersionId")) return task.steps.find((step) => step.id === "version") ?? task.steps[0];
    if (!has(context, "instanceApiId")) return task.steps.find((step) => step.id === "gateway") ?? task.steps[0];
    return task.steps.find((step) => step.id === "tools") ?? task.steps[0];
  }

  if (task.id === "configure-access-control") {
    if (has(context, "groupId") || has(context, "positionId") || has(context, "attributeId") || has(context, "userId")) {
      return task.steps.find((step) => step.id === "group") ?? task.steps[0];
    }
    return task.steps.find((step) => has(context, "apiVersionId") && step.id === "permission") ?? task.steps[0];
  }

  if (task.id === "promote-configuration") {
    if (!context.promotionExportReady) return task.steps.find((step) => step.id === "export") ?? task.steps[0];
    if (!context.promotionExecuted) return task.steps.find((step) => step.id === "import") ?? task.steps[0];
    return task.steps.find((step) => step.id === "history") ?? task.steps[0];
  }

  if (task.id === "portal-snapshot-migration") {
    if (!context.snapshotExportReady) return task.steps.find((step) => step.id === "export") ?? task.steps[0];
    return task.steps.find((step) => step.id === "convert") ?? task.steps[0];
  }

  if (task.id === "manage-user-host-access") {
    if (!has(context, "hostId")) return task.steps.find((step) => step.id === "host") ?? task.steps[0];
    if (!has(context, "userId")) return task.steps.find((step) => step.id === "user") ?? task.steps[0];
    return task.steps.find((step) => step.id === "membership") ?? task.steps[0];
  }

  if (task.id === "manage-my-account") {
    if (context.accountSection === "password") return task.steps.find((step) => step.id === "password") ?? task.steps[0];
    if (context.accountSection === "orders") return task.steps.find((step) => step.id === "orders") ?? task.steps[0];
    if (context.accountSection === "messages") return task.steps.find((step) => step.id === "messages") ?? task.steps[0];
    if (context.accountSection === "payment") return task.steps.find((step) => step.id === "payment") ?? task.steps[0];
    return task.steps.find((step) => step.id === "profile") ?? task.steps[0];
  }

  if (task.id === "manage-client-app") {
    if (!has(context, "appId")) return task.steps.find((step) => step.id === "app") ?? task.steps[0];
    if (has(context, "tokenId") || has(context, "clientId")) {
      return task.steps.find((step) => step.id === "token") ?? task.steps[0];
    }
    if (has(context, "instanceAppId") || has(context, "instanceId")) {
      return task.steps.find((step) => step.id === "instance-app") ?? task.steps[0];
    }
    return task.steps.find((step) => step.id === "oauth-client") ?? task.steps[0];
  }

  if (task.id === "manage-portal-metadata") {
    if (context.metadataType === "error" || has(context, "errorCode")) return task.steps.find((step) => step.id === "error") ?? task.steps[0];
    if (context.metadataType === "schedule" || has(context, "scheduleId")) return task.steps.find((step) => step.id === "schedule") ?? task.steps[0];
    if (context.metadataType === "tag" || has(context, "tagId")) return task.steps.find((step) => step.id === "tag") ?? task.steps[0];
    if (context.metadataType === "category" || has(context, "categoryId")) return task.steps.find((step) => step.id === "category") ?? task.steps[0];
    return task.steps.find((step) => step.id === "org") ?? task.steps[0];
  }

  if (task.id === "manage-community-content") {
    if (context.contentType === "message") return task.steps.find((step) => step.id === "message") ?? task.steps[0];
    if (context.contentType === "entity" || has(context, "entityType")) return task.steps.find((step) => step.id === "entity") ?? task.steps[0];
    if (context.contentType === "city" || has(context, "cityId")) return task.steps.find((step) => step.id === "city-map") ?? task.steps[0];
    if (context.contentType === "blog" || has(context, "blogId")) return task.steps.find((step) => step.id === "blog") ?? task.steps[0];
    return task.steps.find((step) => step.id === "blog") ?? task.steps[0];
  }

  if (task.id === "manage-configuration") {
    if (hasConfigUpdateTarget(context)) return task.steps.find((step) => step.id === "instance-api") ?? task.steps[0];
    if (!has(context, "configId")) return task.steps.find((step) => step.id === "config") ?? task.steps[0];
    return task.steps.find((step) => step.id === "properties") ?? task.steps[0];
  }

  if (task.id === "capture-config-snapshot") {
    if (!has(context, "instanceId")) return task.steps.find((step) => step.id === "instance") ?? task.steps[0];
    if (!has(context, "snapshotId")) return task.steps.find((step) => step.id === "snapshot") ?? task.steps[0];
    return task.steps.find((step) => step.id === "properties") ?? task.steps[0];
  }

  if (task.id === "manage-deployment") {
    if (!has(context, "platformId")) return task.steps.find((step) => step.id === "platform") ?? task.steps[0];
    if (!has(context, "pipelineId")) return task.steps.find((step) => step.id === "pipeline") ?? task.steps[0];
    if (!has(context, "deploymentInstanceId") && !has(context, "instanceId")) {
      return task.steps.find((step) => step.id === "deployment-instance") ?? task.steps[0];
    }
    return task.steps.find((step) => step.id === "deployment") ?? task.steps[0];
  }

  if (task.id === "manage-instance") {
    if (!has(context, "instanceId")) return task.steps.find((step) => step.id === "instance") ?? task.steps[0];
    if (has(context, "instanceApiId") && !has(context, "pathPrefix")) {
      return task.steps.find((step) => step.id === "path-prefix") ?? task.steps[0];
    }
    if (has(context, "instanceAppId") && has(context, "instanceApiId")) {
      return task.steps.find((step) => step.id === "app-api-link") ?? task.steps[0];
    }
    if (has(context, "apiVersionId") || has(context, "apiId")) {
      return task.steps.find((step) => step.id === "api-link") ?? task.steps[0];
    }
    if (has(context, "appId")) return task.steps.find((step) => step.id === "app-link") ?? task.steps[0];
    return task.steps.find((step) => step.id === "api-link") ?? task.steps[0];
  }

  if (task.id === "manage-product-release") {
    if (!has(context, "productVersionId")) return task.steps.find((step) => step.id === "product-version") ?? task.steps[0];
    if (!has(context, "systemEnv") && !has(context, "runtimeEnv")) return task.steps.find((step) => step.id === "environment") ?? task.steps[0];
    if (!has(context, "pipelineId")) return task.steps.find((step) => step.id === "pipeline") ?? task.steps[0];
    if (!has(context, "configId")) return task.steps.find((step) => step.id === "config") ?? task.steps[0];
    return task.steps.find((step) => step.id === "properties") ?? task.steps[0];
  }

  if (task.id === "manage-reference-data") {
    if (has(context, "valueId")) return task.steps.find((step) => step.id === "locale") ?? task.steps[0];
    if (has(context, "tableId")) return task.steps.find((step) => step.id === "value") ?? task.steps[0];
    if (has(context, "relationId")) return task.steps.find((step) => step.id === "relation") ?? task.steps[0];
    return task.steps.find((step) => step.id === "table") ?? task.steps[0];
  }

  if (task.id === "manage-genai-assets") {
    if (has(context, "skillId") && has(context, "toolId")) return task.steps.find((step) => step.id === "skill-tool") ?? task.steps[0];
    if (has(context, "agentDefId") && has(context, "skillId")) return task.steps.find((step) => step.id === "agent-skill") ?? task.steps[0];
    if (has(context, "toolId") && !has(context, "paramId")) return task.steps.find((step) => step.id === "tool-param") ?? task.steps[0];
    if (has(context, "agentDefId") && has(context, "memId")) return task.steps.find((step) => step.id === "memory") ?? task.steps[0];
    if (has(context, "sessionId") || has(context, "sessionHistoryId")) return task.steps.find((step) => step.id === "session-history") ?? task.steps[0];
    if (!has(context, "agentDefId")) return task.steps.find((step) => step.id === "agent") ?? task.steps[0];
    if (!has(context, "skillId")) return task.steps.find((step) => step.id === "skill") ?? task.steps[0];
    if (!has(context, "toolId")) return task.steps.find((step) => step.id === "tool") ?? task.steps[0];
    return task.steps.find((step) => step.id === "agent-skill") ?? task.steps[0];
  }

  if (task.id === "manage-oauth-provider") {
    if (has(context, "tokenId")) return task.steps.find((step) => step.id === "tokens") ?? task.steps[0];
    if (has(context, "clientId")) return task.steps.find((step) => step.id === "tokens") ?? task.steps[0];
    if (has(context, "apiId") && has(context, "providerId")) return task.steps.find((step) => step.id === "apis") ?? task.steps[0];
    if (has(context, "providerId") && has(context, "kid")) return task.steps.find((step) => step.id === "keys") ?? task.steps[0];
    if (has(context, "providerId")) return task.steps.find((step) => step.id === "clients") ?? task.steps[0];
    return task.steps.find((step) => step.id === "provider") ?? task.steps[0];
  }

  if (task.id === "manage-workflow") {
    if (has(context, "auditLogId") || has(context, "correlationId")) return task.steps.find((step) => step.id === "audit") ?? task.steps[0];
    if (has(context, "taskAsstId") || has(context, "assigneeId")) return task.steps.find((step) => step.id === "assignment") ?? task.steps[0];
    if (has(context, "taskId") || has(context, "wfTaskId")) return task.steps.find((step) => step.id === "task") ?? task.steps[0];
    if (has(context, "processId") || has(context, "wfInstanceId")) return task.steps.find((step) => step.id === "process") ?? task.steps[0];
    if (has(context, "wfDefId")) return task.steps.find((step) => step.id === "start") ?? task.steps[0];
    return task.steps.find((step) => step.id === "definition") ?? task.steps[0];
  }

  if (task.id === "manage-schema-rules") {
    if (has(context, "testId")) return task.steps.find((step) => step.id === "test-case") ?? task.steps[0];
    if (has(context, "ruleId")) return task.steps.find((step) => step.id === "detail") ?? task.steps[0];
    if (has(context, "schemaId")) return task.steps.find((step) => step.id === "rule") ?? task.steps[0];
    return task.steps.find((step) => step.id === "rule") ?? task.steps[0];
  }

  return task.steps[0];
}

function actionLabel(task: TaskDefinition, step: TaskStep) {
  if (task.id === "publish-api" && step.id === "create-version") return "Add API Version";
  if (task.id === "mcp-onboard-api" && step.id === "deployment-mode") return "Choose MCP Mode";
  if (task.id === "mcp-onboard-api" && step.id === "gateway-link") return "Link To Gateway";
  if (task.id === "mcp-onboard-api" && step.id === "tools") return "Configure MCP Tools";
  if (task.id === "mcp-onboard-api" && step.id === "access") return "Configure MCP Access";
  if (task.id === "promote-configuration" && step.id === "export") return "Export Promotion";
  if (task.id === "promote-configuration" && step.id === "import") return "Import Promotion";
  if (task.id === "portal-snapshot-migration" && step.id === "export") return "Export Snapshot";
  if (task.id === "portal-snapshot-migration" && step.id === "convert") return "Convert Snapshot";
  if (task.id === "configure-access-control" && step.id === "group") return "Manage Assignments";
  if (task.id === "manage-user-host-access" && step.id === "host") return "Review Hosts";
  if (task.id === "manage-user-host-access" && step.id === "user") return "Review Users";
  if (task.id === "manage-user-host-access" && step.id === "membership") return "Assign Host";
  if (task.id === "manage-my-account" && step.id === "profile") return "Review Profile";
  if (task.id === "manage-my-account" && step.id === "payment") return "Review Payment";
  if (task.id === "manage-my-account" && step.id === "messages") return "Review Messages";
  if (task.id === "manage-my-account" && step.id === "orders") return "Review Orders";
  if (task.id === "manage-my-account" && step.id === "password") return "Change Password";
  if (task.id === "manage-client-app" && step.id === "app") return "Review Apps";
  if (task.id === "manage-client-app" && step.id === "oauth-client") return "Review OAuth Clients";
  if (task.id === "manage-client-app" && step.id === "instance-app") return "Link Instances";
  if (task.id === "manage-client-app" && step.id === "token") return "Manage Tokens";
  if (task.id === "manage-portal-metadata" && step.id === "org") return "Review Organizations";
  if (task.id === "manage-portal-metadata" && step.id === "category") return "Review Categories";
  if (task.id === "manage-portal-metadata" && step.id === "tag") return "Review Tags";
  if (task.id === "manage-portal-metadata" && step.id === "schedule") return "Review Schedules";
  if (task.id === "manage-portal-metadata" && step.id === "error") return "Review Error Codes";
  if (task.id === "manage-community-content" && step.id === "blog") return "Review Blogs";
  if (task.id === "manage-community-content" && step.id === "city-map") return "Review City Map";
  if (task.id === "manage-community-content" && step.id === "entity") return "Review Entity";
  if (task.id === "manage-community-content" && step.id === "message") return "Send Message";
  if (task.id === "manage-configuration" && step.id === "config") return "Review Configs";
  if (task.id === "manage-configuration" && step.id === "properties") return "Manage Properties";
  if (task.id === "manage-configuration" && step.id === "instance-api") return "Update Config";
  if (task.id === "capture-config-snapshot" && step.id === "instance") return "Review Instances";
  if (task.id === "capture-config-snapshot" && step.id === "snapshot") return "Review Snapshots";
  if (task.id === "capture-config-snapshot" && step.id === "properties") return "Review Properties";
  if (task.id === "manage-deployment" && step.id === "platform") return "Review Platforms";
  if (task.id === "manage-deployment" && step.id === "pipeline") return "Manage Pipelines";
  if (task.id === "manage-deployment" && step.id === "deployment-instance") return "Manage Deploy Instances";
  if (task.id === "manage-deployment" && step.id === "deployment") return "Review Deployments";
  if (task.id === "manage-instance" && step.id === "instance") return "Review Instances";
  if (task.id === "manage-instance" && step.id === "runtime") return "Manage Runtime";
  if (task.id === "manage-instance" && step.id === "api-link") return "Link APIs";
  if (task.id === "manage-instance" && step.id === "app-link") return "Link Apps";
  if (task.id === "manage-instance" && step.id === "app-api-link") return "Link App APIs";
  if (task.id === "manage-instance" && step.id === "path-prefix") return "Manage Prefixes";
  if (task.id === "manage-product-release" && step.id === "product-version") return "Review Versions";
  if (task.id === "manage-product-release" && step.id === "environment") return "Manage Environments";
  if (task.id === "manage-product-release" && step.id === "pipeline") return "Attach Pipelines";
  if (task.id === "manage-product-release" && step.id === "config") return "Attach Configs";
  if (task.id === "manage-product-release" && step.id === "properties") return "Attach Properties";
  if (task.id === "manage-reference-data" && step.id === "table") return "Review Tables";
  if (task.id === "manage-reference-data" && step.id === "value") return "Manage Values";
  if (task.id === "manage-reference-data" && step.id === "locale") return "Manage Locales";
  if (task.id === "manage-reference-data" && step.id === "relation-type") return "Review Relation Types";
  if (task.id === "manage-reference-data" && step.id === "relation") return "Manage Relations";
  if (task.id === "manage-genai-assets" && step.id === "agent") return "Review Agents";
  if (task.id === "manage-genai-assets" && step.id === "skill") return "Manage Skills";
  if (task.id === "manage-genai-assets" && step.id === "tool") return "Manage Tools";
  if (task.id === "manage-genai-assets" && step.id === "agent-skill") return "Link Agent Skills";
  if (task.id === "manage-genai-assets" && step.id === "skill-tool") return "Link Skill Tools";
  if (task.id === "manage-genai-assets" && step.id === "tool-param") return "Manage Params";
  if (task.id === "manage-genai-assets" && step.id === "memory") return "Manage Memory";
  if (task.id === "manage-genai-assets" && step.id === "session-history") return "Review Sessions";
  if (task.id === "manage-oauth-provider" && step.id === "provider") return "Review Providers";
  if (task.id === "manage-oauth-provider" && step.id === "keys") return "Review Keys";
  if (task.id === "manage-oauth-provider" && step.id === "apis") return "Link APIs";
  if (task.id === "manage-oauth-provider" && step.id === "clients") return "Link Clients";
  if (task.id === "manage-oauth-provider" && step.id === "client") return "Review Clients";
  if (task.id === "manage-oauth-provider" && step.id === "tokens") return "Manage Tokens";
  if (task.id === "manage-workflow" && step.id === "definition") return "Review Definitions";
  if (task.id === "manage-workflow" && step.id === "start") return "Start Workflow";
  if (task.id === "manage-workflow" && step.id === "process") return "Review Processes";
  if (task.id === "manage-workflow" && step.id === "task") return "Review Tasks";
  if (task.id === "manage-workflow" && step.id === "assignment") return "Manage Assignments";
  if (task.id === "manage-workflow" && step.id === "worklist") return "Review Worklists";
  if (task.id === "manage-workflow" && step.id === "audit") return "Review Audit";
  if (task.id === "manage-schema-rules" && step.id === "schema") return "Review Schemas";
  if (task.id === "manage-schema-rules" && step.id === "rule") return "Review Rules";
  if (task.id === "manage-schema-rules" && step.id === "detail") return "Review Rule Detail";
  if (task.id === "manage-schema-rules" && step.id === "test-case") return "Add Test Case";
  return step.title;
}

export default function TaskActionPanel({
  title = "Task Actions",
  context,
  taskIds,
  maxActions = 4,
}: TaskActionPanelProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { roles } = useUserState() as { roles?: string | null };
  const hasEntityContext = !!(
    context.apiId
    || context.apiVersionId
    || context.instanceApiId
    || context.instanceId
    || context.runtimeInstanceId
    || context.pathPrefix
    || context.clientId
    || context.roleId
    || context.endpointId
    || context.hostId
    || context.userId
    || context.configId
    || context.propertyId
    || context.environment
    || context.productId
    || context.productVersionId
    || context.deploymentId
    || context.deploymentInstanceId
    || context.platformId
    || context.pipelineId
    || context.serviceId
    || context.systemEnv
    || context.runtimeEnv
    || context.instanceAppId
    || context.instanceFileId
    || context.appId
    || context.groupId
    || context.positionId
    || context.attributeId
    || context.sourceHostId
    || context.targetHostId
    || context.entityType
    || context.tableId
    || context.valueId
    || context.relationId
    || context.language
    || context.agentDefId
    || context.skillId
    || context.parentSkillId
    || context.toolId
    || context.paramId
    || context.memId
    || context.sessionId
    || context.sessionHistoryId
    || context.dependsOnSkillId
    || context.domain
    || context.processId
    || context.providerId
    || context.tokenId
    || context.kid
    || context.wfDefId
    || context.wfInstanceId
    || context.wfTaskId
    || context.taskId
    || context.taskAsstId
    || context.auditLogId
    || context.assigneeId
    || context.categoryId
    || context.correlationId
    || context.sourceTypeId
    || context.schemaId
    || context.schemaVersion
    || context.ruleId
    || context.testId
    || context.snapshotId
    || context.tagId
    || context.scheduleId
    || context.errorCode
    || context.metadataType
    || context.accountSection
    || context.contentType
    || context.blogId
    || context.cityId
  );

  const actions = useMemo<TaskAction[]>(() => {
    const allowedTaskIds = taskIds ? new Set(taskIds) : null;
    return taskRegistry
      .filter((task) => !allowedTaskIds || allowedTaskIds.has(task.id))
      .filter((task) => canAccess(roles, task.roles))
      .map((task) => {
        const step = selectTaskStep(task, context);
        return { task, step, label: actionLabel(task, step) };
      })
      .slice(0, maxActions);
  }, [context, maxActions, roles, taskIds]);

  if (!hasEntityContext || actions.length === 0) return null;

  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <FactCheckOutlinedIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={700}>
            {title}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {actions.map(({ task, step, label }) => (
            <Button
              key={`${task.id}:${step.id}`}
              size="small"
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate(buildTaskStepRoute(task.id, step, searchParams, context))}
              sx={{ textTransform: "none" }}
            >
              {label}
            </Button>
          ))}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {actions.map(({ task }) => (
            <Chip
              key={task.id}
              size="small"
              variant="outlined"
              label={task.title}
              onClick={() => navigate(buildContextRoute(`/app/tasks/${task.id}`, context))}
              sx={{ cursor: "pointer" }}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
