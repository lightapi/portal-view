import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserState } from "../contexts/UserContext";
import { taskRegistry } from "./taskRegistry";
import type { TaskDefinition } from "./types";
import {
  buildContextRoute,
  canAccess,
  contextFromSearchParams,
  recentTaskContextsWithDefinitions,
  relativeTaskTime,
  suggestedTasksForContext,
  taskContextLabel,
  visibleTaskContextEntries,
} from "./taskUtils";

const fallbackTaskIds = [
  "mcp-onboard-api",
  "publish-api",
  "manage-configuration",
  "manage-instance",
  "configure-access-control",
];

type TaskLaunchWidgetProps = {
  maxItems?: number;
};

export default function TaskLaunchWidget({ maxItems = 3 }: TaskLaunchWidgetProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { roles } = useUserState() as { roles?: string | null };
  const ambientContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const ambientContextEntries = useMemo(
    () => visibleTaskContextEntries(ambientContext, 2),
    [ambientContext],
  );

  const recentTasks = useMemo(
    () => recentTaskContextsWithDefinitions(taskRegistry, roles, maxItems),
    [maxItems, roles],
  );

  const suggestedTasks = useMemo(() => {
    return suggestedTasksForContext(taskRegistry, ambientContext, roles, {
      excludeTaskIds: recentTasks.map(({ task }) => task.id),
      maxItems,
    });
  }, [ambientContext, maxItems, recentTasks, roles]);

  const fallbackTasks = useMemo(() => {
    const hiddenTaskIds = new Set([
      ...recentTasks.map(({ task }) => task.id),
      ...suggestedTasks.map((task) => task.id),
    ]);
    return fallbackTaskIds
      .map((taskId) => taskRegistry.find((task) => task.id === taskId))
      .filter((task): task is TaskDefinition => !!task && canAccess(roles, task.roles))
      .filter((task) => !hiddenTaskIds.has(task.id))
      .slice(0, maxItems);
  }, [maxItems, recentTasks, roles, suggestedTasks]);

  const openTask = (task: TaskDefinition, context = ambientContext) => {
    navigate(buildContextRoute(`/app/tasks/${task.id}`, context));
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <FactCheckOutlinedIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" fontWeight={700}>
          Task Navigator
        </Typography>
      </Stack>

      {recentTasks.length > 0 ? (
        <Stack spacing={1}>
          {recentTasks.map(({ task, context, updatedAt }) => {
            const entries = visibleTaskContextEntries(context, 2);
            return (
              <Box
                key={task.id}
                sx={{
                  p: 1.25,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "background.paper",
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {task.title}
                    </Typography>
                    <Chip size="small" variant="outlined" label={relativeTaskTime(updatedAt)} />
                  </Stack>
                  {entries.length > 0 && (
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                      {entries.map(({ key, value }) => (
                        <Chip
                          key={key}
                          size="small"
                          label={`${taskContextLabel(key)}: ${value.length > 14 ? `${value.slice(0, 14)}...` : value}`}
                        />
                      ))}
                    </Stack>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => openTask(task, context)}
                    sx={{ alignSelf: "flex-start", textTransform: "none" }}
                  >
                    Continue
                  </Button>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Start with a task and let the portal carry you across the right pages and forms.
        </Typography>
      )}

      {suggestedTasks.length > 0 && (
        <Stack spacing={1}>
          {suggestedTasks.map((task) => (
            <Box
              key={task.id}
              sx={{
                p: 1.25,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "background.paper",
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {task.title}
                  </Typography>
                  <Chip size="small" variant="outlined" label="Suggested" />
                </Stack>
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                  {ambientContextEntries.map(({ key, value }) => (
                    <Chip
                      key={key}
                      size="small"
                      label={`${taskContextLabel(key)}: ${value.length > 14 ? `${value.slice(0, 14)}...` : value}`}
                    />
                  ))}
                </Stack>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => openTask(task)}
                  sx={{ alignSelf: "flex-start", textTransform: "none" }}
                >
                  Open
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {fallbackTasks.length > 0 && (
        <Stack spacing={1}>
          {fallbackTasks.map((task) => (
            <Button
              key={task.id}
              size="small"
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              onClick={() => openTask(task)}
              sx={{ justifyContent: "space-between", textTransform: "none" }}
            >
              {task.title}
            </Button>
          ))}
        </Stack>
      )}

      <Button
        variant="contained"
        endIcon={<ArrowForwardIcon />}
        onClick={() => navigate(buildContextRoute("/app/tasks", ambientContext))}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        Open Task Center
      </Button>
    </Stack>
  );
}
