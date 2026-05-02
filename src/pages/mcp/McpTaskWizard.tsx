import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import RouterOutlinedIcon from "@mui/icons-material/RouterOutlined";
import type { SyntheticEvent } from "react";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserState } from "../../contexts/UserContext";
import { taskRegistry } from "../../tasks/taskRegistry";
import type { TaskDefinition, TaskResolvedContext, TaskStep, TaskStepStatus } from "../../tasks/types";
import {
  buildContextRoute,
  buildTaskContextRoute,
  buildTaskStepRoute,
  mergeTaskContext,
  saveStoredTaskContext,
} from "../../tasks/taskUtils";
import { useTaskProgress } from "../../tasks/useTaskProgress";

const DEFAULT_MCP_TRANSPORT_CONFIG = JSON.stringify({
  transport: "streamable http",
  url: "https://lightapi.net/mcp",
});

type WorkflowId = "api" | "server";

type WorkflowOption = {
  id: WorkflowId;
  taskId: string;
  label: string;
  description: string;
};

type StepAction = {
  label: string;
  route?: string;
  disabled?: boolean;
  variant?: "contained" | "outlined";
  onClick?: () => void;
};

const workflows: WorkflowOption[] = [
  {
    id: "api",
    taskId: "mcp-onboard-api",
    label: "API To MCP Gateway",
    description: "Use an existing API or create one, link it to a gateway, then expose selected endpoints as MCP tools.",
  },
  {
    id: "server",
    taskId: "register-standalone-mcp-server",
    label: "Standalone MCP Server",
    description: "Register an MCP server as an API, add its transport version, link it to a gateway, then review tools.",
  },
];

function statusLabel(status: TaskStepStatus) {
  switch (status) {
    case "complete":
      return "Complete";
    case "blocked":
      return "Blocked";
    case "optional":
      return "Optional";
    case "skipped":
      return "Skipped";
    case "ready":
      return "Ready";
    default:
      return "Unknown";
  }
}

function contextChips(context: TaskResolvedContext) {
  return [
    ["API", context.apiId],
    ["Version", context.apiVersionId],
    ["Instance API", context.instanceApiId],
    ["Instance", context.instanceId],
    ["Mode", context.deploymentMode],
  ].filter(([, value]) => !!value) as Array<[string, string]>;
}

function routeAction(
  label: string,
  task: TaskDefinition,
  step: TaskStep,
  route: string,
  searchParams: URLSearchParams,
  context: TaskResolvedContext,
  disabled = false,
): StepAction {
  return {
    label,
    route: buildTaskStepRoute(task.id, { ...step, route }, searchParams, context),
    disabled,
    variant: disabled ? "outlined" : "contained",
  };
}

function stepActions(
  workflow: WorkflowId,
  task: TaskDefinition,
  step: TaskStep,
  searchParams: URLSearchParams,
  context: TaskResolvedContext,
  setDeploymentMode: (mode: "centralized" | "distributed") => void,
): StepAction[] {
  if (task.id === "mcp-onboard-api") {
    if (step.id === "select-api") {
      return [
        routeAction("Browse APIs", task, step, "/app/marketplace", searchParams, context),
        routeAction("Create API", task, step, "/app/form/createApi", searchParams, context, false),
      ];
    }
    if (step.id === "api-version") {
      return [
        routeAction("Add API Version", task, step, "/app/form/createApiVersion", searchParams, context, !context.apiId),
        routeAction("Browse APIs", task, step, "/app/marketplace", searchParams, context),
      ];
    }
    if (step.id === "deployment-mode") {
      return [
        {
          label: "Centralized Gateway",
          variant: context.deploymentMode === "centralized" ? "contained" : "outlined",
          onClick: () => setDeploymentMode("centralized"),
          disabled: !context.apiVersionId,
        },
        {
          label: "Distributed Sidecar",
          variant: context.deploymentMode === "distributed" ? "contained" : "outlined",
          onClick: () => setDeploymentMode("distributed"),
          disabled: !context.apiVersionId,
        },
      ];
    }
    if (step.id === "gateway-link") {
      return [
        routeAction("Link Instance API", task, step, "/app/instance/InstanceApi", searchParams, context, !context.apiVersionId),
      ];
    }
    if (step.id === "tools") {
      return [
        routeAction("Configure Tools", task, step, "/app/instance/InstanceApiMcpTool", searchParams, context, !context.instanceApiId),
      ];
    }
    if (step.id === "access") {
      return [
        routeAction("Configure Access", task, step, "/app/access/rolePermission", searchParams, context, !context.apiVersionId),
      ];
    }
  }

  if (task.id === "register-standalone-mcp-server") {
    if (step.id === "server") {
      return [
        routeAction("Register Server", task, step, "/app/form/createApi", searchParams, context),
      ];
    }
    if (step.id === "version") {
      const versionRoute = `/app/form/createApiVersion?apiType=mcp&transportConfig=${encodeURIComponent(DEFAULT_MCP_TRANSPORT_CONFIG)}`;
      return [
        routeAction("Add MCP Version", task, step, versionRoute, searchParams, context, !context.apiId),
      ];
    }
    if (step.id === "gateway") {
      return [
        {
          label: "Use Centralized Gateway",
          variant: context.deploymentMode === "centralized" ? "contained" : "outlined",
          onClick: () => setDeploymentMode("centralized"),
          disabled: !context.apiVersionId,
        },
        routeAction("Link Gateway", task, step, "/app/instance/InstanceApi", searchParams, context, !context.apiVersionId),
      ];
    }
    if (step.id === "tools") {
      return [
        routeAction("Review Tools", task, step, "/app/instance/InstanceApiMcpTool", searchParams, context, !context.instanceApiId),
      ];
    }
  }

  return [
    routeAction("Open", task, step, step.route, searchParams, context),
  ];
}

export default function McpTaskWizard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { host } = useUserState() as { host?: string | null };

  const workflowId = (searchParams.get("workflow") === "server" ? "server" : "api") as WorkflowId;
  const workflow = workflows.find((item) => item.id === workflowId) ?? workflows[0];
  const task = useMemo(
    () => taskRegistry.find((item) => item.id === workflow.taskId),
    [workflow.taskId],
  );
  const taskProgress = useTaskProgress(task, searchParams, host ?? undefined);

  if (!task) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">MCP setup task is not registered.</Alert>
      </Box>
    );
  }

  const chips = contextChips(taskProgress.context);

  const handleWorkflowChange = (_event: SyntheticEvent, value: WorkflowId) => {
    const nextWorkflow = workflows.find((item) => item.id === value) ?? workflows[0];
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("workflow", value);
    nextParams.set("task", nextWorkflow.taskId);
    nextParams.set("returnTo", `/app/tasks/${nextWorkflow.taskId}`);
    nextParams.delete("taskStep");
    setSearchParams(nextParams);
  };

  const setDeploymentMode = (mode: "centralized" | "distributed") => {
    const nextContext = mergeTaskContext(taskProgress.context, { deploymentMode: mode });
    saveStoredTaskContext(task.id, nextContext);
    const setupStep = task.steps.find((step) => step.id === "deployment-mode" || step.id === "gateway") ?? task.steps[0];
    const route = buildTaskStepRoute(
      task.id,
      { ...setupStep, route: `/app/mcp/setup?workflow=${workflowId}` },
      searchParams,
      nextContext,
    );
    navigate(route, { replace: true });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <HubOutlinedIcon color="primary" />
            <Typography variant="h5" fontWeight={700}>MCP Gateway Setup</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {workflow.description}
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
          <Tabs
            value={workflowId}
            onChange={handleWorkflowChange}
            variant="scrollable"
            sx={{ minHeight: 40, flexGrow: 1 }}
          >
            {workflows.map((item) => (
              <Tab
                key={item.id}
                value={item.id}
                label={item.label}
                sx={{ minHeight: 40, textTransform: "none", fontWeight: 700 }}
              />
            ))}
          </Tabs>
          <Button
            variant="outlined"
            onClick={() => navigate(buildContextRoute(`/app/tasks/${task.id}`, taskProgress.context))}
            sx={{ textTransform: "none", flexShrink: 0 }}
          >
            Task Checklist
          </Button>
          <Button
            variant="outlined"
            startIcon={<RouterOutlinedIcon />}
            onClick={() => navigate(buildTaskContextRoute(task.id, "/app/mcp/gateway", taskProgress.context))}
            sx={{ textTransform: "none", flexShrink: 0 }}
          >
            Gateway View
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate(buildContextRoute(
              `/app/mcp/wizard${workflowId === "server" ? "?flow=server" : "?flow=onboard"}`,
              taskProgress.context,
            ))}
            sx={{ textTransform: "none", flexShrink: 0 }}
          >
            Legacy Wizard
          </Button>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700}>{task.title}</Typography>
              <Typography variant="body2" color="text.secondary">{task.description}</Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Chip size="small" label={`${taskProgress.completeCount} complete`} color={taskProgress.completeCount > 0 ? "success" : "default"} />
              {taskProgress.blockedCount > 0 && <Chip size="small" label={`${taskProgress.blockedCount} blocked`} variant="outlined" />}
              {taskProgress.loading && <Chip size="small" label="Refreshing" variant="outlined" />}
            </Stack>
          </Stack>
          {chips.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                {chips.map(([label, value]) => (
                  <Chip key={label} size="small" variant="outlined" label={`${label}: ${value}`} />
                ))}
              </Stack>
            </>
          )}
        </Paper>

        {taskProgress.error && <Alert severity="warning">{taskProgress.error}</Alert>}

        <Stack spacing={1.25}>
          {task.steps.map((step, index) => {
            const state = taskProgress.steps.find((item) => item.stepId === step.id);
            const status = state?.status ?? (step.required ? "ready" : "optional");
            const actions = stepActions(workflowId, task, step, searchParams, taskProgress.context, setDeploymentMode);
            const disabled = status === "blocked";

            return (
              <Paper
                key={step.id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: disabled ? "action.hover" : "background.paper",
                  borderColor: status === "complete" ? "success.light" : "divider",
                }}
              >
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ color: status === "complete" ? "success.main" : disabled ? "text.disabled" : "primary.main", pt: 0.25 }}>
                      {status === "complete" ? <CheckCircleOutlineIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {index + 1}. {step.title}
                        </Typography>
                        <Chip size="small" label={statusLabel(status)} variant={status === "ready" ? "filled" : "outlined"} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {step.description}
                      </Typography>
                      {state?.message && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                          {state.message}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, flexShrink: 0 }}>
                    {actions.map((action) => (
                      <Button
                        key={action.label}
                        size="small"
                        variant={action.variant ?? "outlined"}
                        disabled={disabled || action.disabled}
                        endIcon={action.route ? <ArrowForwardIcon /> : undefined}
                        startIcon={!action.route && action.variant === "contained" ? <AddIcon /> : undefined}
                        onClick={() => {
                          if (action.onClick) action.onClick();
                          if (action.route) navigate(action.route);
                        }}
                        sx={{ textTransform: "none" }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Stack>
    </Box>
  );
}
