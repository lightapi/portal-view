import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Tooltip,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useUserState } from "../../contexts/UserContext";
import { allPageRegistry } from "../../tasks/pageRegistry";
import { taskRegistry } from "../../tasks/taskRegistry";
import type { TaskDefinition, TaskResolvedContext, TaskStepStatus } from "../../tasks/types";
import {
  buildContextRoute,
  buildTaskStepRoute,
  buildTaskContextRoute,
  canAccess,
  clearStoredTaskContext,
  restoreSkippedTaskStep,
  skipTaskStep,
  taskContextKeys,
  taskProgress,
} from "../../tasks/taskUtils";
import { useTaskProgress } from "../../tasks/useTaskProgress";

function relatedPages(task: TaskDefinition, roles: string | null | undefined) {
  const keywords = new Set(task.keywords);
  return allPageRegistry
    .filter((page) => page.keywords.some((keyword) => keywords.has(keyword)))
    .filter((page) => canAccess(roles, page.roles))
    .slice(0, 8);
}

function stepStatusLabel(status: TaskStepStatus) {
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

function stepStatusColor(status: TaskStepStatus) {
  switch (status) {
    case "complete":
      return "success.main";
    case "blocked":
      return "text.disabled";
    case "optional":
      return "text.secondary";
    case "skipped":
      return "warning.main";
    case "ready":
      return "primary.main";
    default:
      return "text.disabled";
  }
}

function stepButtonLabel(status: TaskStepStatus, index: number) {
  if (status === "complete") return "Review";
  if (status === "skipped") return "Review";
  if (status === "blocked") return "Blocked";
  return index === 0 ? "Start" : "Open";
}

function contextLabel(key: string) {
  return key
    .replace(/Id$/, " ID")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function visibleContextEntries(context: TaskResolvedContext) {
  return taskContextKeys
    .map((key) => ({ key, value: context[key] }))
    .filter((entry): entry is { key: typeof taskContextKeys[number]; value: string } => !!entry.value);
}

export default function TaskDetail() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const [contextResetToken, setContextResetToken] = useState(0);
  const { roles, host } = useUserState() as { roles?: string | null; host?: string | null };

  const task = useMemo(
    () => taskRegistry.find((item) => item.id === taskId),
    [taskId],
  );

  const pages = useMemo(() => (task ? relatedPages(task, roles) : []), [task, roles]);
  const progressSearchParams = useMemo(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (contextResetToken) nextParams.set("_contextReset", String(contextResetToken));
    return nextParams;
  }, [contextResetToken, searchParams]);
  const taskProgressState = useTaskProgress(task, progressSearchParams, host ?? undefined);

  if (!task) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" action={<Button onClick={() => navigate("/app/tasks")}>Task Center</Button>}>
          The requested task was not found.
        </Alert>
      </Box>
    );
  }

  const progress = taskProgress(task);
  const accessible = canAccess(roles, task.roles);
  const contextEntries = visibleContextEntries(taskProgressState.context);
  const nextStep = task.steps.find((step) => {
    const stepState = taskProgressState.steps.find((item) => item.stepId === step.id);
    const status = stepState?.status ?? (step.required ? "ready" : "optional");
    return status === "ready";
  }) ?? task.steps.find((step) => {
    const stepState = taskProgressState.steps.find((item) => item.stepId === step.id);
    const status = stepState?.status ?? (step.required ? "ready" : "optional");
    return status === "optional";
  });

  const handleClearContext = () => {
    clearStoredTaskContext(task.id);
    setContextResetToken(Date.now());
    navigate(`/app/tasks/${task.id}`, { replace: true });
  };

  const handleSkipStep = (stepId: string) => {
    skipTaskStep(task.id, stepId);
    setContextResetToken(Date.now());
  };

  const handleRestoreStep = (stepId: string) => {
    restoreSkippedTaskStep(task.id, stepId);
    setContextResetToken(Date.now());
  };
  const taskCenterRoute = buildContextRoute(
    `/app/tasks?taskCategory=${encodeURIComponent(task.category)}`,
    taskProgressState.context,
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(taskCenterRoute)}
            sx={{ mb: 1, textTransform: "none" }}
          >
            Task Center
          </Button>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75, flexWrap: "wrap" }}>
            <Typography variant="h5" fontWeight={700}>{task.title}</Typography>
            <Chip size="small" label={task.category} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {task.description}
          </Typography>
          {nextStep && (
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={() => navigate(buildTaskStepRoute(task.id, nextStep, searchParams, taskProgressState.context))}
              sx={{ mt: 2, textTransform: "none" }}
            >
              Continue: {nextStep.title}
            </Button>
          )}
        </Box>

        {!accessible && (
          <Alert severity="info">
            This task requires {task.roles?.join(", ")} access. You can review the task shape, but protected pages may not be available.
          </Alert>
        )}

        {contextEntries.length > 0 && (
          <Box
            sx={{
              p: 2,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "background.paper",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Current Context
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                  {contextEntries.map(({ key, value }) => (
                    <Tooltip key={key} title={value}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${contextLabel(key)}: ${value.length > 24 ? `${value.slice(0, 24)}...` : value}`}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Box>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={handleClearContext}
                sx={{ textTransform: "none", flexShrink: 0 }}
              >
                Clear Context
              </Button>
            </Stack>
          </Box>
        )}

        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <Chip label={`${progress.totalSteps} steps`} />
          <Chip variant="outlined" label={`${progress.requiredSteps} required`} />
          <Chip variant="outlined" label={`${progress.optionalSteps} optional`} />
          {taskProgressState.completeCount > 0 && (
            <Chip color="success" variant="outlined" label={`${taskProgressState.completeCount} complete`} />
          )}
          {taskProgressState.blockedCount > 0 && (
            <Chip variant="outlined" label={`${taskProgressState.blockedCount} blocked`} />
          )}
          {taskProgressState.skippedCount > 0 && (
            <Chip color="warning" variant="outlined" label={`${taskProgressState.skippedCount} skipped`} />
          )}
          {taskProgressState.loading && (
            <Chip variant="outlined" label="Refreshing progress" />
          )}
        </Stack>

        {taskProgressState.error && (
          <Alert severity="warning">{taskProgressState.error}</Alert>
        )}

        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Checklist
          </Typography>
          <Stack spacing={1.25}>
            {task.steps.map((step, index) => {
              const stepState = taskProgressState.steps.find((item) => item.stepId === step.id);
              const status = stepState?.status ?? (step.required ? "ready" : "optional");
              const blocked = status === "blocked";
              const skipped = status === "skipped";
              const canSkip = !step.required && status !== "complete" && !blocked;

              return (
                <Box
                  key={step.id}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    p: 2,
                    border: "1px solid",
                    borderColor: status === "complete" ? "success.light" : "divider",
                    borderRadius: 2,
                    bgcolor: blocked ? "action.hover" : "background.paper",
                  }}
                >
                  <Box sx={{ pt: 0.25, color: stepStatusColor(status) }}>
                    {status === "complete" ? <CheckCircleOutlineIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap" }}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {index + 1}. {step.title}
                      </Typography>
                      <Chip
                        size="small"
                        color={status === "complete" ? "success" : skipped ? "warning" : "default"}
                        variant={status === "ready" ? "filled" : "outlined"}
                        label={stepStatusLabel(status)}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {step.description}
                    </Typography>
                    {stepState?.message && (
                      <Typography variant="caption" color={blocked ? "text.disabled" : "text.secondary"} sx={{ display: "block", mt: 0.75 }}>
                        {stepState.message}
                      </Typography>
                    )}
                    {step.dependsOn && step.dependsOn.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                        Depends on: {step.dependsOn.join(", ")}
                      </Typography>
                    )}
                  </Box>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ flexShrink: 0 }}
                  >
                    {canSkip && (
                      <Button
                        variant="text"
                        color={skipped ? "primary" : "inherit"}
                        onClick={() => (skipped ? handleRestoreStep(step.id) : handleSkipStep(step.id))}
                        sx={{ textTransform: "none" }}
                      >
                        {skipped ? "Include" : "Skip"}
                      </Button>
                    )}
                    <Button
                      variant={index === 0 && status !== "complete" && !skipped ? "contained" : "outlined"}
                      endIcon={!blocked ? <ArrowForwardIcon /> : undefined}
                      disabled={blocked}
                      onClick={() => navigate(buildTaskStepRoute(task.id, step, searchParams, taskProgressState.context))}
                      sx={{ textTransform: "none" }}
                    >
                      {stepButtonLabel(status, index)}
                    </Button>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>

        {pages.length > 0 && (
          <Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Related Pages
            </Typography>
            <Stack spacing={1}>
              {pages.map((page) => (
                <Box
                  key={page.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    p: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>{page.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{page.description}</Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={() => navigate(buildTaskContextRoute(task.id, page.route, taskProgressState.context))}
                    sx={{ textTransform: "none", flexShrink: 0 }}
                  >
                    Open
                  </Button>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
