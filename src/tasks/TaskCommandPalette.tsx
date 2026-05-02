import {
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import SearchIcon from "@mui/icons-material/Search";
import StorageIcon from "@mui/icons-material/Storage";
import WebAssetIcon from "@mui/icons-material/WebAsset";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserState } from "../contexts/UserContext";
import { searchEntities } from "./entitySearch";
import { allPageRegistry } from "./pageRegistry";
import { taskRegistry } from "./taskRegistry";
import type { TaskDefinition, TaskResolvedContext } from "./types";
import {
  buildContextRoute,
  buildTaskContextRoute,
  canAccess,
  contextFromSearchParams,
  mergeTaskContext,
  recentPageContextsWithDefinitions,
  recentTaskContextsWithDefinitions,
  relativeTaskTime,
  searchPages,
  searchTasks,
  suggestedTasksForContext,
  taskContextLabel,
  taskContextFromSearch,
  visibleTaskContextEntries,
} from "./taskUtils";

type TaskCommandPaletteProps = {
  collapsed?: boolean;
};

type CommandResult = {
  id: string;
  type: "Task" | "Page" | "Form" | "Entity";
  title: string;
  description: string;
  category: string;
  route: string;
  context?: TaskResolvedContext;
};

export default function TaskCommandPalette({ collapsed = false }: TaskCommandPaletteProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { roles, host } = useUserState() as { roles?: string | null; host?: string | null };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entityResults, setEntityResults] = useState<CommandResult[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const activeTaskContext = useMemo(() => taskContextFromSearch(searchParams), [searchParams]);
  const ambientContext = useMemo(
    () => activeTaskContext?.context ?? contextFromSearchParams(searchParams),
    [activeTaskContext?.context, searchParams],
  );
  const normalizedQuery = query.trim();
  const currentContextEntries = useMemo(
    () => visibleTaskContextEntries(ambientContext, 3),
    [ambientContext],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || normalizedQuery.length < 2) {
      setEntityResults([]);
      setEntityLoading(false);
      return;
    }

    let cancelled = false;
    setEntityLoading(true);
    const timeoutId = window.setTimeout(() => {
      searchEntities(host, roles, normalizedQuery, 2)
        .then((results) => {
          if (cancelled) return;
          setEntityResults(results.map((result) => ({
            id: result.id,
            type: "Entity" as const,
            title: result.title,
            description: result.description,
            category: result.category,
            route: result.route,
            context: result.context,
          })));
        })
        .catch(() => {
          if (!cancelled) setEntityResults([]);
        })
        .finally(() => {
          if (!cancelled) setEntityLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [host, normalizedQuery, open, roles]);

  useEffect(() => {
    if (!open) setEntityResults([]);
  }, [open]);

  const recentTasks = useMemo(() => {
    if (normalizedQuery) return [];

    return recentTaskContextsWithDefinitions(taskRegistry, roles, 4);
  }, [normalizedQuery, open, roles]);

  const recentPages = useMemo(() => {
    if (normalizedQuery) return [];

    return recentPageContextsWithDefinitions(allPageRegistry, roles, 4);
  }, [normalizedQuery, open, roles]);

  const contextualTasks = useMemo(() => {
    if (normalizedQuery) return [];

    return suggestedTasksForContext(taskRegistry, ambientContext, roles, {
      activeTaskId: activeTaskContext?.taskId,
      excludeTaskIds: recentTasks.map(({ taskId }) => taskId),
      maxItems: 4,
    });
  }, [activeTaskContext?.taskId, ambientContext, normalizedQuery, recentTasks, roles]);

  const results = useMemo<CommandResult[]>(() => {
    const hiddenTaskIds = new Set([
      ...recentTasks.map(({ taskId }) => taskId),
      ...contextualTasks.map((task) => task.id),
    ]);
    const tasks = searchTasks(taskRegistry, query)
      .filter((task) => canAccess(roles, task.roles))
      .filter((task) => normalizedQuery || !hiddenTaskIds.has(task.id))
      .slice(0, 6)
      .map((task) => ({
        id: task.id,
        type: "Task" as const,
        title: task.title,
        description: task.description,
        category: task.category,
        route: `/app/tasks/${task.id}`,
      }));

    const pages = searchPages(allPageRegistry, query)
      .filter((page) => canAccess(roles, page.roles))
      .map((page) => ({
        id: page.id,
        type: page.kind ?? "Page",
        title: page.title,
        description: page.description,
        category: page.category,
        route: page.route,
      }))
      .slice(0, 10);

    return [...tasks, ...entityResults, ...pages];
  }, [contextualTasks, entityResults, normalizedQuery, query, recentTasks, roles]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const openResult = (result: CommandResult) => {
    close();
    if (result.type === "Task") {
      navigate(buildContextRoute(result.route, ambientContext));
      return;
    }

    const resultContext = result.context
      ? mergeTaskContext(ambientContext, result.context)
      : ambientContext;

    if (activeTaskContext) {
      navigate(buildTaskContextRoute(
        activeTaskContext.taskId,
        result.route,
        resultContext,
        activeTaskContext.returnTo,
      ));
      return;
    }

    navigate(buildContextRoute(result.route, resultContext));
  };

  const openRecentTask = (task: TaskDefinition, context: TaskResolvedContext) => {
    close();
    navigate(buildContextRoute(`/app/tasks/${task.id}`, context));
  };

  const openContextualTask = (task: TaskDefinition) => {
    close();
    navigate(buildContextRoute(`/app/tasks/${task.id}`, ambientContext));
  };

  const openRecentPage = (route: string, context: TaskResolvedContext) => {
    close();
    navigate(buildContextRoute(route, context));
  };

  return (
    <>
      {collapsed ? (
        <Tooltip title="Search">
          <IconButton
            size="small"
            onClick={() => setOpen(true)}
            sx={{
              color: "text.secondary",
              "&:hover": { color: "primary.main", bgcolor: "action.hover" },
            }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <ButtonBase
          onClick={() => setOpen(true)}
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            px: 1,
            py: 0.75,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            color: "text.secondary",
            textAlign: "left",
            "&:hover": {
              borderColor: "primary.main",
              color: "primary.main",
              bgcolor: "action.hover",
            },
          }}
        >
          <SearchIcon sx={{ fontSize: 20, mr: 1, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ fontSize: 14 }}>
            Search
          </Typography>
        </ButtonBase>
      )}

      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <SearchIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Search
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <TextField
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tasks, pages, forms, entities"
              fullWidth
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {!normalizedQuery && contextualTasks.length > 0 && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <FactCheckOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Suggested Tasks
                  </Typography>
                </Stack>
                <List disablePadding>
                  {contextualTasks.map((task) => (
                    <ListItemButton
                      key={`context:${task.id}`}
                      onClick={() => openContextualTask(task)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Box sx={{ mr: 1.25, color: "primary.main", display: "flex" }}>
                        <FactCheckOutlinedIcon fontSize="small" />
                      </Box>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                            <Typography variant="subtitle2" fontWeight={700}>
                              {task.title}
                            </Typography>
                            <Chip size="small" variant="outlined" label={task.category} />
                          </Stack>
                        }
                        secondary={
                          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75, mt: 0.75 }}>
                            {currentContextEntries.map(({ key, value }) => (
                              <Chip
                                key={key}
                                size="small"
                                label={`${taskContextLabel(key)}: ${value.length > 16 ? `${value.slice(0, 16)}...` : value}`}
                              />
                            ))}
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}

            {!normalizedQuery && contextualTasks.length > 0 && (recentTasks.length > 0 || recentPages.length > 0) && <Divider />}

            {!normalizedQuery && recentTasks.length > 0 && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <AccessTimeIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Recent Tasks
                  </Typography>
                </Stack>
                <List disablePadding>
                  {recentTasks.map(({ task, context, updatedAt }) => {
                    const entries = visibleTaskContextEntries(context, 3);
                    return (
                      <ListItemButton
                        key={`recent:${task.id}`}
                        onClick={() => openRecentTask(task, context)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Box sx={{ mr: 1.25, color: "primary.main", display: "flex" }}>
                          <FactCheckOutlinedIcon fontSize="small" />
                        </Box>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                              <Typography variant="subtitle2" fontWeight={700}>
                                {task.title}
                              </Typography>
                              <Chip size="small" variant="outlined" label={relativeTaskTime(updatedAt)} />
                            </Stack>
                          }
                          secondary={
                            entries.length > 0 ? (
                              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75, mt: 0.75 }}>
                                {entries.map(({ key, value }) => (
                                  <Chip
                                    key={key}
                                    size="small"
                                    label={`${taskContextLabel(key)}: ${value.length > 16 ? `${value.slice(0, 16)}...` : value}`}
                                  />
                                ))}
                              </Stack>
                            ) : task.description
                          }
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Box>
            )}

            {!normalizedQuery && recentTasks.length > 0 && recentPages.length > 0 && <Divider />}

            {!normalizedQuery && recentPages.length > 0 && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <AccessTimeIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Recent Pages And Forms
                  </Typography>
                </Stack>
                <List disablePadding>
                  {recentPages.map(({ page, route, context, updatedAt }) => {
                    const entries = visibleTaskContextEntries(context, 3);
                    return (
                      <ListItemButton
                        key={`recent-page:${page.id}`}
                        onClick={() => openRecentPage(route, context)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Box sx={{ mr: 1.25, color: "text.secondary", display: "flex" }}>
                          {page.kind === "Form"
                            ? <DescriptionOutlinedIcon fontSize="small" />
                            : <WebAssetIcon fontSize="small" />}
                        </Box>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                              <Typography variant="subtitle2" fontWeight={700}>
                                {page.title}
                              </Typography>
                              <Chip size="small" variant="outlined" label={page.kind ?? "Page"} />
                              <Chip size="small" variant="outlined" label={relativeTaskTime(updatedAt)} />
                            </Stack>
                          }
                          secondary={
                            entries.length > 0 ? (
                              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75, mt: 0.75 }}>
                                {entries.map(({ key, value }) => (
                                  <Chip
                                    key={key}
                                    size="small"
                                    label={`${taskContextLabel(key)}: ${value.length > 16 ? `${value.slice(0, 16)}...` : value}`}
                                  />
                                ))}
                              </Stack>
                            ) : page.description
                          }
                        />
                        <Chip size="small" label={page.category} />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Box>
            )}

            {entityLoading && normalizedQuery && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Searching entities
                </Typography>
              </Stack>
            )}

            {results.length === 0 && recentTasks.length === 0 && recentPages.length === 0 && contextualTasks.length === 0 && !entityLoading ? (
              <Box sx={{ py: 4, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  No results
                </Typography>
              </Box>
            ) : results.length > 0 ? (
              <List disablePadding>
                {results.map((result) => (
                  <ListItemButton
                    key={`${result.type}:${result.id}`}
                    onClick={() => openResult(result)}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Box sx={{ mr: 1.25, color: result.type === "Task" ? "primary.main" : "text.secondary", display: "flex" }}>
                      {result.type === "Task"
                        ? <FactCheckOutlinedIcon fontSize="small" />
                        : result.type === "Entity"
                          ? <StorageIcon fontSize="small" />
                          : result.type === "Form"
                            ? <DescriptionOutlinedIcon fontSize="small" />
                            : <WebAssetIcon fontSize="small" />}
                    </Box>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {result.title}
                          </Typography>
                          <Chip size="small" variant="outlined" label={result.type} />
                        </Stack>
                      }
                      secondary={result.description}
                    />
                    <Chip size="small" label={result.category} />
                  </ListItemButton>
                ))}
              </List>
            ) : null}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
