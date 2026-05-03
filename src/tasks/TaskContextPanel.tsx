import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import HelpLink from "../components/HelpLink";
import { taskRegistry } from "./taskRegistry";
import { buildTaskReturnRoute, taskContextFromSearch } from "./taskUtils";

export default function TaskContextPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const taskContext = useMemo(() => taskContextFromSearch(searchParams), [searchParams]);
  const task = useMemo(
    () => taskRegistry.find((item) => item.id === taskContext?.taskId),
    [taskContext?.taskId],
  );
  const step = useMemo(
    () => task?.steps.find((item) => item.id === taskContext?.stepId),
    [task, taskContext?.stepId],
  );

  if (!taskContext || !task) return null;

  const returnRoute = buildTaskReturnRoute(
    task.id,
    taskContext.returnTo,
    searchParams,
    taskContext.context,
  );

  const handleExitTask = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("task");
    nextParams.delete("returnTo");
    nextParams.delete("taskStep");
    const nextQuery = nextParams.toString();
    navigate(`${location.pathname}${nextQuery ? `?${nextQuery}` : ""}${location.hash}`, { replace: true });
  };

  return (
    <Box
      sx={{
        px: 3,
        py: 1.25,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <FactCheckOutlinedIcon color="primary" fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {task.title}
              </Typography>
              {step && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={step.required ? "Required step" : "Optional step"}
                />
              )}
            </Stack>
            {step && (
              <Typography variant="caption" color="text.secondary">
                {step.title}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, flexWrap: "wrap", rowGap: 1 }}>
          <HelpLink
            helpPath={step?.helpPath ?? task.helpPath}
            label="Task Help"
            tooltip={step ? `Help: ${step.title}` : `Help: ${task.title}`}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(returnRoute)}
            sx={{ textTransform: "none" }}
          >
            Back to Checklist
          </Button>
          <Button
            size="small"
            color="inherit"
            startIcon={<CloseIcon />}
            onClick={handleExitTask}
            sx={{ textTransform: "none" }}
          >
            Exit Task
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
