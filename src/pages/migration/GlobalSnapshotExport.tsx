import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import TransformIcon from "@mui/icons-material/Transform";
import fetchClient from "../../utils/fetchClient";
import downloadJson from "../../utils/downloadJson";
import { useUserState } from "../../contexts/UserContext";
import TaskActionPanel from "../../tasks/TaskActionPanel";
import { taskRegistry } from "../../tasks/taskRegistry";
import type { TaskResolvedContext } from "../../tasks/types";
import {
  buildTaskStepRoute,
  mergeTaskContext,
  saveStoredTaskContext,
  taskContextFromSearch,
} from "../../tasks/taskUtils";

type HostType = {
  hostId: string;
  domain?: string;
  subDomain?: string;
  hostDesc?: string;
};

type ExportScope = "host" | "global" | "both";

const EXPORT_SCOPE_LABELS: Record<ExportScope, string> = {
  host: "Host",
  global: "Global",
  both: "Both",
};

const EXPORT_SCOPE_DESCRIPTIONS: Record<ExportScope, string> = {
  host: "Export rows owned by the selected source host.",
  global: "Export shared rows and tables that are not host-owned.",
  both: "Export host-owned rows plus shared global baseline data.",
};

const ENTITY_OPTIONS = [
  "user",
  "social_user",
  "org",
  "host",
  "user_host",
  "ref_table",
  "ref_value",
  "value_locale",
  "relation_type",
  "relation",
  "attribute",
  "attribute_permission",
  "attribute_user",
  "attribute_row_filter",
  "attribute_col_filter",
  "group",
  "group_permission",
  "group_user",
  "group_row_filter",
  "group_col_filter",
  "role",
  "role_permission",
  "role_user",
  "role_row_filter",
  "role_col_filter",
  "position",
  "position_permission",
  "position_user",
  "position_row_filter",
  "position_col_filter",
  "config",
  "config_property",
  "config_environment",
  "config_instance",
  "config_instance_api",
  "config_instance_app",
  "config_instance_app_api",
  "config_instance_file",
  "config_deployment_instance",
  "config_product",
  "config_product_version",
  "config_snapshot",
];

const SNAPSHOT_STORAGE_KEY_PREFIX = "globalSnapshotExport:";

export default function GlobalSnapshotExport() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host: userHost } = useUserState() as { host?: string };
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const taskContextState = useMemo(() => taskContextFromSearch(searchParams), [searchParams]);
  const initialSourceHostId = taskContextState?.context.sourceHostId || taskContextState?.context.hostId || userHost || "";

  const [hosts, setHosts] = useState<HostType[]>([]);
  const [sourceHostId, setSourceHostId] = useState(initialSourceHostId);
  const [exportScope, setExportScope] = useState<ExportScope>("host");
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<string>("");

  const taskActionContext = useMemo(
    () => mergeTaskContext(
      taskContextState?.context ?? {},
      {
        hostId: sourceHostId,
        sourceHostId,
        snapshotExportReady: !!result || !!taskContextState?.context.snapshotExportReady,
      },
    ),
    [result, sourceHostId, taskContextState?.context],
  );

  const buildSnapshotTaskContext = (updates: TaskResolvedContext = {}) => mergeTaskContext(
    taskContextState?.context ?? {},
    {
      hostId: sourceHostId,
      sourceHostId,
      snapshotExportReady: !!result || !!taskContextState?.context.snapshotExportReady,
    },
    updates,
  );

  useEffect(() => {
    const nextSourceHostId = taskContextState?.context.sourceHostId || taskContextState?.context.hostId;
    if (nextSourceHostId) setSourceHostId(nextSourceHostId);
  }, [taskContextState?.context.hostId, taskContextState?.context.sourceHostId]);

  useEffect(() => {
    const loadHosts = async () => {
      setLoadingHosts(true);
      setError("");
      try {
        const cmd = {
          host: "lightapi.net",
          service: "host",
          action: "getHost",
          version: "0.1.0",
          data: { offset: 0, limit: 200, active: true },
        };
        const json = (await fetchClient("/portal/query", {
          method: "POST",
          body: cmd,
        })) as { hosts?: HostType[] };
        setHosts(json.hosts || []);
      } catch (err: any) {
        setError(err?.message || "Failed to load hosts.");
      } finally {
        setLoadingHosts(false);
      }
    };

    loadHosts();
  }, []);

  const selectedHostLabel = useMemo(() => {
    const selected = hosts.find((host) => host.hostId === sourceHostId);
    if (!selected) return sourceHostId;
    return (
      selected.hostDesc ||
      [selected.subDomain, selected.domain].filter(Boolean).join(".") ||
      selected.hostId
    );
  }, [hosts, sourceHostId]);

  const handleExport = async () => {
    if (!sourceHostId) {
      setError("Source host is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const cmd = {
        host: "lightapi.net",
        service: "user",
        action: "exportGlobalSnapshot",
        version: "0.1.0",
        data: {
          sourceHostId,
          exportScope,
          entityTypes: entityTypes.length > 0 ? entityTypes : undefined,
        },
      };
      const json = await fetchClient("/portal/query", {
        method: "POST",
        body: cmd,
      });
      const text = JSON.stringify(json, null, 2);
      setResult(text);
      if (taskContextState) {
        saveStoredTaskContext(
          taskContextState.taskId,
          buildSnapshotTaskContext({ snapshotExportReady: true }),
        );
      }
    } catch (err: any) {
      setError(err?.message || "Global export failed.");
      setResult("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadJson(
      `${exportScope}-snapshot-${sourceHostId}-${new Date().toISOString().slice(0, 10)}.json`,
      result,
    );
  };

  const getSnapshotStorageKey = (hostId: string) =>
    `${SNAPSHOT_STORAGE_KEY_PREFIX}${hostId}`;

  const removeLegacySnapshotEntries = (hostId: string) => {
    const legacySnapshotStorageKeyPrefix = `${SNAPSHOT_STORAGE_KEY_PREFIX}${hostId}:`;
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(legacySnapshotStorageKeyPrefix)) {
        sessionStorage.removeItem(key);
      }
    }
  };

  const handleSendToConvert = () => {
    if (!result) return;
    const snapshotStorageKey = getSnapshotStorageKey(sourceHostId);
    removeLegacySnapshotEntries(sourceHostId);
    sessionStorage.setItem(snapshotStorageKey, result);
    const nextTaskContext = buildSnapshotTaskContext({ snapshotExportReady: true });
    if (taskContextState) {
      saveStoredTaskContext(taskContextState.taskId, nextTaskContext);
    }
    const convertStep = taskContextState
      ? taskRegistry
        .find((task) => task.id === taskContextState.taskId)
        ?.steps.find((step) => step.id === "convert")
      : undefined;
    const convertRoute = taskContextState && convertStep
      ? buildTaskStepRoute(taskContextState.taskId, convertStep, searchParams, nextTaskContext)
      : "/app/migration/convert";
    navigate(convertRoute, {
      state: { snapshotStorageKey, sourceHostId },
    });
  };

  const handleSourceHostChange = (event: SelectChangeEvent<string>) => {
    setSourceHostId(event.target.value);
  };

  const handleExportScopeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setExportScope(event.target.value as ExportScope);
  };

  const handleEntityTypesChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setEntityTypes(typeof value === "string" ? value.split(",") : value);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Global Snapshot Export
          </Typography>
          <Typography color="text.secondary">
            Export host-owned rows, shared global baseline data, or both as a portable snapshot JSON file.
          </Typography>
        </Box>

        <TaskActionPanel
          title="Snapshot Workflow"
          context={taskActionContext}
          taskIds={["portal-snapshot-migration"]}
          maxActions={1}
        />

        <Paper sx={{ p: 3 }}>
          <Stack spacing={3}>
            {loadingHosts && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Loading hosts...</Typography>
              </Box>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            <FormControl fullWidth>
              <InputLabel id="source-host-label">Source Host</InputLabel>
              <Select
                labelId="source-host-label"
                value={sourceHostId}
                label="Source Host"
                onChange={handleSourceHostChange}
              >
                {hosts.map((host) => (
                  <MenuItem key={host.hostId} value={host.hostId}>
                    {host.hostDesc ||
                      [host.subDomain, host.domain].filter(Boolean).join(".") ||
                      host.hostId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <Typography variant="subtitle2" component="div" sx={{ mb: 1 }}>
                Export Scope
              </Typography>
              <RadioGroup
                row
                value={exportScope}
                onChange={handleExportScopeChange}
              >
                <FormControlLabel
                  value="host"
                  control={<Radio />}
                  label="Host entities"
                />
                <FormControlLabel
                  value="global"
                  control={<Radio />}
                  label="Global entities"
                />
                <FormControlLabel
                  value="both"
                  control={<Radio />}
                  label="Both entities"
                />
              </RadioGroup>
              <Typography variant="body2" color="text.secondary">
                {EXPORT_SCOPE_DESCRIPTIONS[exportScope]}
              </Typography>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="entity-types-label">Entity Types</InputLabel>
              <Select
                labelId="entity-types-label"
                multiple
                value={entityTypes}
                onChange={handleEntityTypesChange}
                input={<OutlinedInput label="Entity Types" />}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {ENTITY_OPTIONS.map((entityType) => (
                  <MenuItem key={entityType} value={entityType}>
                    {entityType}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Button
                variant="contained"
                onClick={handleExport}
                disabled={submitting || !sourceHostId}
              >
                {submitting ? "Exporting..." : "Export Snapshot"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleDownload}
                disabled={!result}
              >
                Download Result
              </Button>
              <Button
                variant="outlined"
                startIcon={<TransformIcon />}
                onClick={handleSendToConvert}
                disabled={!result}
              >
                Send To Conversion
              </Button>
            </Box>

            {result && (
              <Alert severity="success">
                {EXPORT_SCOPE_LABELS[exportScope]} snapshot export completed for{" "}
                <strong>{selectedHostLabel}</strong>.
              </Alert>
            )}
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Snapshot JSON</Typography>
            <TextField
              value={result}
              multiline
              minRows={18}
              fullWidth
              placeholder="The exported snapshot JSON will appear here."
              InputProps={{ readOnly: true }}
            />
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
