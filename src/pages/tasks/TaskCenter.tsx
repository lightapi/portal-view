import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserState } from "../../contexts/UserContext";
import { allPageRegistry } from "../../tasks/pageRegistry";
import { taskRegistry } from "../../tasks/taskRegistry";
import type { TaskCategory, TaskDefinition, TaskResolvedContext } from "../../tasks/types";
import {
  buildContextRoute,
  canAccess,
  contextFromSearchParams,
  recentTaskContextsWithDefinitions,
  relativeTaskTime,
  searchPages,
  searchTasks,
  suggestedTasksForContext,
  taskContextLabel,
  taskProgress,
  visibleTaskContextEntries,
} from "../../tasks/taskUtils";

function groupTasks(tasks: TaskDefinition[]) {
  return tasks.reduce<Record<string, TaskDefinition[]>>((acc, task) => {
    acc[task.category] = [...(acc[task.category] ?? []), task];
    return acc;
  }, {});
}

type CategoryFilter = "All" | TaskCategory;

export default function TaskCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { roles } = useUserState() as { roles?: string | null };
  const query = searchParams.get("q") ?? "";
  const normalizedQuery = query.trim();
  const ambientContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);

  const visiblePages = useMemo(
    () => searchPages(allPageRegistry, query).filter((page) => canAccess(roles, page.roles)).slice(0, 12),
    [query, roles],
  );

  const currentContextEntries = useMemo(
    () => visibleTaskContextEntries(ambientContext),
    [ambientContext],
  );

  const recentTasks = useMemo(
    () => recentTaskContextsWithDefinitions(taskRegistry, roles, 4),
    [roles],
  );
  const suggestedTasks = useMemo(() => {
    if (normalizedQuery) return [];

    return suggestedTasksForContext(taskRegistry, ambientContext, roles, {
      excludeTaskIds: recentTasks.map(({ task }) => task.id),
      maxItems: 4,
    });
  }, [ambientContext, normalizedQuery, recentTasks, roles]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(
      taskRegistry
        .filter((task) => canAccess(roles, task.roles))
        .map((task) => task.category),
    )),
    [roles],
  );

  const categoryFilter = useMemo<CategoryFilter>(() => {
    const value = searchParams.get("taskCategory");
    if (!value || value === "All") return "All";
    return categoryOptions.includes(value as TaskCategory) ? value as TaskCategory : "All";
  }, [categoryOptions, searchParams]);

  const updateCategoryFilter = (value: CategoryFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value === "All") {
      nextParams.delete("taskCategory");
    } else {
      nextParams.set("taskCategory", value);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const updateSearchQuery = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextParams.set("q", value);
    } else {
      nextParams.delete("q");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const hiddenTaskIds = useMemo(() => (
    normalizedQuery
      ? new Set<string>()
      : new Set([
        ...recentTasks.map(({ task }) => task.id),
        ...suggestedTasks.map((task) => task.id),
      ])
  ), [normalizedQuery, recentTasks, suggestedTasks]);

  const searchableTasks = useMemo(() => (
    searchTasks(taskRegistry, query)
      .filter((task) => canAccess(roles, task.roles))
      .filter((task) => !hiddenTaskIds.has(task.id))
  ), [hiddenTaskIds, query, roles]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<CategoryFilter, number>> & { All: number } = {
      All: searchableTasks.length,
    };
    for (const task of searchableTasks) {
      counts[task.category] = (counts[task.category] ?? 0) + 1;
    }
    return counts;
  }, [searchableTasks]);

  const visibleTasks = useMemo(() => (
    categoryFilter === "All"
      ? searchableTasks
      : searchableTasks.filter((task) => task.category === categoryFilter)
  ), [categoryFilter, searchableTasks]);

  const grouped = useMemo(() => groupTasks(visibleTasks), [visibleTasks]);

  const openTask = (task: TaskDefinition, context: TaskResolvedContext = ambientContext) => {
    navigate(buildContextRoute(`/app/tasks/${task.id}`, context));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <FactCheckOutlinedIcon color="primary" />
            <Typography variant="h5" fontWeight={700}>Task Center</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Start from the work you need to finish. Tasks guide you across existing pages and forms without hiding the underlying portal tools.
          </Typography>
        </Box>

        <TextField
          value={query}
          onChange={(event) => updateSearchQuery(event.target.value)}
          placeholder="Search tasks, pages, forms, or entities..."
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

        <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
          <Tabs
            value={categoryFilter}
            onChange={(_, value) => updateCategoryFilter(value as CategoryFilter)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Task categories"
            sx={{
              minHeight: 40,
              "& .MuiTab-root": {
                minHeight: 40,
                textTransform: "none",
                fontWeight: 700,
              },
            }}
          >
            <Tab value="All" label={`All (${categoryCounts.All})`} />
            {categoryOptions.map((category) => {
              const count = categoryCounts[category] ?? 0;
              return (
                <Tab
                  key={category}
                  value={category}
                  label={`${category} (${count})`}
                  disabled={categoryFilter !== category && count === 0}
                />
              );
            })}
          </Tabs>
        </Box>

        {!normalizedQuery && suggestedTasks.length > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <FactCheckOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>
                Suggested Tasks
              </Typography>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                gap: 1.5,
              }}
            >
              {suggestedTasks.map((task) => {
                const progress = taskProgress(task);
                return (
                  <Box
                    key={task.id}
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      flexDirection: { xs: "column", sm: "row" },
                      gap: 1.5,
                      p: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      bgcolor: "background.paper",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75, flexWrap: "wrap" }}>
                        <Typography variant="subtitle2" fontWeight={700}>{task.title}</Typography>
                        <Chip size="small" variant="outlined" label={task.category} />
                        <Chip size="small" label={`${progress.totalSteps} steps`} />
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                        {currentContextEntries.map(({ key, value }) => (
                          <Chip
                            key={key}
                            size="small"
                            label={`${taskContextLabel(key)}: ${value.length > 18 ? `${value.slice(0, 18)}...` : value}`}
                          />
                        ))}
                      </Stack>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => openTask(task)}
                      sx={{ textTransform: "none", flexShrink: 0 }}
                    >
                      Open
                    </Button>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {!normalizedQuery && recentTasks.length > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <AccessTimeIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>
                Recent Tasks
              </Typography>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                gap: 1.5,
              }}
            >
              {recentTasks.map(({ task, context, updatedAt }) => {
                const entries = visibleTaskContextEntries(context);
                return (
                  <Box
                    key={task.id}
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      flexDirection: { xs: "column", sm: "row" },
                      gap: 1.5,
                      p: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      bgcolor: "background.paper",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75, flexWrap: "wrap" }}>
                        <Typography variant="subtitle2" fontWeight={700}>{task.title}</Typography>
                        <Chip size="small" variant="outlined" label={relativeTaskTime(updatedAt)} />
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                        {entries.map(({ key, value }) => (
                          <Chip
                            key={key}
                            size="small"
                            label={`${taskContextLabel(key)}: ${value.length > 18 ? `${value.slice(0, 18)}...` : value}`}
                          />
                        ))}
                      </Stack>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => openTask(task, context)}
                      sx={{ textTransform: "none", flexShrink: 0 }}
                    >
                      Continue
                    </Button>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {visibleTasks.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>No matching tasks</Typography>
            <Typography variant="body2" color="text.secondary">
              Try a different keyword or open a specific page from the sidebar.
            </Typography>
          </Box>
        ) : (
          Object.entries(grouped).map(([category, tasks]) => (
            <Box key={category}>
              <Typography
                variant="overline"
                sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: "0.08em" }}
              >
                {category}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  gap: 2,
                  mt: 1,
                }}
              >
                {tasks.map((task) => {
                  const progress = taskProgress(task);
                  return (
                    <Card key={task.id} variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                            <Chip size="small" label={`${progress.totalSteps} steps`} />
                            <Chip size="small" variant="outlined" label={`${progress.requiredSteps} required`} />
                            {progress.optionalSteps > 0 && (
                              <Chip size="small" variant="outlined" label={`${progress.optionalSteps} optional`} />
                            )}
                          </Stack>
                          <Typography variant="h6" fontWeight={700}>{task.title}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            {task.description}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          endIcon={<ArrowForwardIcon />}
                          onClick={() => openTask(task)}
                          sx={{ alignSelf: "flex-start", textTransform: "none" }}
                        >
                          Open Task
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          ))
        )}

        {normalizedQuery && visiblePages.length > 0 && (
          <Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Direct Pages And Forms
            </Typography>
            <Stack spacing={1}>
              {visiblePages.map((page) => (
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
                  <Button size="small" onClick={() => navigate(buildContextRoute(page.route, ambientContext))} sx={{ textTransform: "none", flexShrink: 0 }}>
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
