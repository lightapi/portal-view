import {
  Box,
  Breadcrumbs,
  Chip,
  Link as MuiLink,
  Stack,
  Typography,
} from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useUserState } from "../contexts/UserContext";
import HelpLink from "../components/HelpLink";
import { allPageRegistry } from "./pageRegistry";
import { taskRegistry } from "./taskRegistry";
import {
  buildContextRoute,
  contextFromSearchParams,
  pageDefinitionForRoute,
  suggestedTasksForContext,
  taskContextLabel,
  visibleTaskContextEntries,
} from "./taskUtils";

function taskIdFromPath(pathname: string) {
  const match = pathname.match(/^\/app\/tasks\/([^/]+)$/);
  return match?.[1];
}

export default function TaskPageContextBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { roles } = useUserState() as { roles?: string | null };
  const context = contextFromSearchParams(searchParams);
  const contextEntries = visibleTaskContextEntries(context, 3);
  const taskId = taskIdFromPath(location.pathname);
  const task = taskRegistry.find((item) => item.id === taskId);
  const suggestedTasks = suggestedTasksForContext(taskRegistry, context, roles, {
    activeTaskId: task?.id,
    maxItems: 3,
  });
  const page = task
    ? undefined
    : pageDefinitionForRoute(allPageRegistry, location.pathname);

  if (!task && !page) return null;

  const title = task?.title ?? page?.title ?? "";
  const category = task ? "Tasks" : page?.category;
  const description = task?.description ?? page?.description;
  const helpPath = task?.helpPath ?? page?.helpPath;
  const taskCenterRoute = task
    ? buildContextRoute(`/app/tasks?taskCategory=${encodeURIComponent(task.category)}`, context)
    : buildContextRoute("/app/tasks", context);

  return (
    <Box
      sx={{
        px: 3,
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1}
        alignItems={{ xs: "flex-start", lg: "center" }}
        justifyContent="space-between"
      >
        <Box sx={{ minWidth: 0 }}>
          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" />}
            sx={{ "& .MuiBreadcrumbs-ol": { flexWrap: "wrap" } }}
          >
            <MuiLink component={RouterLink} to="/app/dashboard" underline="hover" color="inherit" variant="caption">
              Home
            </MuiLink>
            {task ? (
              <MuiLink
                component={RouterLink}
                to={taskCenterRoute}
                underline="hover"
                color="inherit"
                variant="caption"
              >
                Tasks
              </MuiLink>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {category}
              </Typography>
            )}
            <Typography variant="caption" color="text.primary" fontWeight={700}>
              {title}
            </Typography>
          </Breadcrumbs>
          {description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                mt: 0.25,
                maxWidth: 760,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {description}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.75, flexShrink: 0 }}>
          <HelpLink
            helpPath={helpPath}
            tooltip={`Help: ${title}`}
            buttonVariant="text"
          />
          <Chip size="small" variant="outlined" label={task ? task.category : page?.kind ?? "Page"} />
          {contextEntries.map(({ key, value }) => (
            <Chip
              key={key}
              size="small"
              label={`${taskContextLabel(key)}: ${value.length > 18 ? `${value.slice(0, 18)}...` : value}`}
            />
          ))}
          {suggestedTasks.map((suggestedTask) => (
            <Chip
              key={suggestedTask.id}
              size="small"
              color="primary"
              variant="outlined"
              label={`Task: ${suggestedTask.title}`}
              onClick={() => navigate(buildContextRoute(`/app/tasks/${suggestedTask.id}`, context))}
              sx={{
                maxWidth: 220,
                "& .MuiChip-label": {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
