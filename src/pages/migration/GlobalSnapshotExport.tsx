import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
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

type HostType = {
  hostId: string;
  domain?: string;
  subDomain?: string;
  hostDesc?: string;
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
  const { host: userHost } = useUserState() as { host?: string };

  const [hosts, setHosts] = useState<HostType[]>([]);
  const [sourceHostId, setSourceHostId] = useState(userHost || "");
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<string>("");

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
          entityTypes: entityTypes.length > 0 ? entityTypes : undefined,
        },
      };
      const json = await fetchClient("/portal/query", {
        method: "POST",
        body: cmd,
      });
      const text = JSON.stringify(json, null, 2);
      setResult(text);
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
      `global-snapshot-${sourceHostId}-${new Date().toISOString().slice(0, 10)}.json`,
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
    navigate("/app/migration/convert", {
      state: { snapshotStorageKey, sourceHostId },
    });
  };

  const handleSourceHostChange = (event: SelectChangeEvent<string>) => {
    setSourceHostId(event.target.value);
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
            Export the current materialized state for a host as a portable snapshot JSON file.
          </Typography>
        </Box>

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
                Snapshot export completed for <strong>{selectedHostLabel}</strong>.
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
