import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import fetchClient from "../../utils/fetchClient";
import downloadJson from "../../utils/downloadJson";
import { useUserState } from "../../contexts/UserContext";

type HostType = {
  hostId: string;
  domain?: string;
  subDomain?: string;
  hostDesc?: string;
};

type LocationState = {
  sourceHostId?: string;
  snapshotStorageKey?: string;
};

export default function GlobalSnapshotConvert() {
  const location = useLocation();
  const routeState = (location.state || {}) as LocationState;
  const { host: userHost } = useUserState() as { host?: string };

  const [hosts, setHosts] = useState<HostType[]>([]);
  const [targetHostId, setTargetHostId] = useState(userHost || "");
  const [snapshotText, setSnapshotText] = useState("");
  const [result, setResult] = useState("");
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [debugSteps, setDebugSteps] = useState<string[]>([]);

  const pushDebugStep = (message: string) => {
    const stamped = `${new Date().toISOString()}  ${message}`;
    if (import.meta.env.DEV) {
      console.debug("[GlobalSnapshotConvert]", stamped);
    }
    setDebugSteps((current) => [...current, stamped]);
  };

  useEffect(() => {
    if (!routeState.snapshotStorageKey) return;

    const storedSnapshot = sessionStorage.getItem(routeState.snapshotStorageKey);
    if (!storedSnapshot) {
      setError("Snapshot data from the export page is no longer available. Please export again.");
      return;
    }

    setSnapshotText(storedSnapshot);
    sessionStorage.removeItem(routeState.snapshotStorageKey);
  }, [routeState.snapshotStorageKey]);

  useEffect(() => {
    const loadHosts = async () => {
      setLoadingHosts(true);
      setError("");
      pushDebugStep("Loading available target hosts.");
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
        pushDebugStep(`Loaded ${(json.hosts || []).length} hosts.`);
      } catch (err: any) {
        pushDebugStep(`Failed to load hosts: ${err?.message || err}`);
        setError(err?.message || "Failed to load hosts.");
      } finally {
        setLoadingHosts(false);
      }
    };

    loadHosts();
  }, []);

  const selectedHostLabel = useMemo(() => {
    const selected = hosts.find((host) => host.hostId === targetHostId);
    if (!selected) return targetHostId;
    return (
      selected.hostDesc ||
      [selected.subDomain, selected.domain].filter(Boolean).join(".") ||
      selected.hostId
    );
  }, [hosts, targetHostId]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    pushDebugStep(`Loading snapshot file ${file.name} (${file.size} bytes).`);
    try {
      const text = await file.text();
      setError("");
      setSnapshotText(text);
      setResult("");
      pushDebugStep(`Snapshot file loaded into editor (${text.length} characters).`);
    } catch (readError) {
      pushDebugStep(
        `Failed to load snapshot file ${file.name}: ${
          readError instanceof Error ? readError.message : String(readError)
        }.`,
      );
      setError("Unable to read the selected snapshot file. Please try again or choose a different file.");
      setResult("");
    } finally {
      event.target.value = "";
    }
  };

  const handleTargetHostChange = (event: SelectChangeEvent<string>) => {
    setTargetHostId(event.target.value);
  };

  const handleSnapshotTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError("");
    setSnapshotText(event.target.value);
  };

  const handleConvert = async () => {
    setDebugSteps([]);
    if (!targetHostId) {
      pushDebugStep("Conversion blocked: target host is missing.");
      setError("Target host is required.");
      return;
    }
    if (!snapshotText.trim()) {
      pushDebugStep("Conversion blocked: snapshot JSON is empty.");
      setError("Snapshot JSON is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    pushDebugStep(`Starting conversion for targetHostId=${targetHostId}.`);
    pushDebugStep(`Snapshot payload size=${snapshotText.length} characters.`);
    try {
      const cmd = {
        host: "lightapi.net",
        service: "user",
        action: "convertSnapshotToEvents",
        version: "0.1.0",
        data: {
          snapshot: snapshotText,
          targetHostId,
        },
      };
      pushDebugStep("Dispatching POST /portal/query for convertSnapshotToEvents.");
      const json = await fetchClient("/portal/query", {
        method: "POST",
        body: cmd,
      });
      pushDebugStep("Received successful response from convertSnapshotToEvents.");
      const text = JSON.stringify(json, null, 2);
      setResult(text);
      pushDebugStep(`Rendered converted event list (${text.length} characters).`);
    } catch (err: any) {
      pushDebugStep(`Conversion failed before UI render: ${err?.message || JSON.stringify(err) || err}`);
      setError(err?.message || "Snapshot conversion failed.");
      setResult("");
    } finally {
      pushDebugStep("Conversion request finished.");
      setSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadJson(
      `global-events-${targetHostId}-${new Date().toISOString().slice(0, 10)}.json`,
      result,
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Snapshot Conversion
          </Typography>
          <Typography color="text.secondary">
            Convert a global snapshot JSON into an ordered event list that can be imported with the
            existing CLI or portal event import flow.
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

            {routeState.sourceHostId && !error && (
              <Alert severity="info">
                Snapshot loaded from the export page for source host <strong>{routeState.sourceHostId}</strong>.
              </Alert>
            )}

            <FormControl fullWidth>
              <InputLabel id="target-host-label">Target Host</InputLabel>
              <Select
                labelId="target-host-label"
                value={targetHostId}
                label="Target Host"
                onChange={handleTargetHostChange}
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

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                Load Snapshot File
                <input hidden type="file" accept=".json,application/json" onChange={handleFileChange} />
              </Button>
              <Button
                variant="contained"
                onClick={handleConvert}
                disabled={submitting || !targetHostId || !snapshotText.trim()}
              >
                {submitting ? "Converting..." : "Convert To Events"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleDownload}
                disabled={!result}
              >
                Download Result
              </Button>
            </Box>

            {result && (
              <Alert severity="success">
                Conversion completed for target host <strong>{selectedHostLabel}</strong>.
              </Alert>
            )}

            {submitting && (
              <Alert severity="info">
                Conversion request is in progress. If this stays stuck, check the debug timeline below and
                compare it with the backend logs.
              </Alert>
            )}
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Snapshot JSON Input</Typography>
            <TextField
              value={snapshotText}
              onChange={handleSnapshotTextChange}
              multiline
              minRows={14}
              fullWidth
              placeholder="Paste the exported snapshot JSON here or load it from a file."
            />
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Debug Timeline</Typography>
            <TextField
              value={debugSteps.join("\n")}
              multiline
              minRows={8}
              fullWidth
              placeholder="Client-side conversion debug steps will appear here."
              InputProps={{ readOnly: true }}
            />
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Converted Event List</Typography>
            <TextField
              value={result}
              multiline
              minRows={18}
              fullWidth
              placeholder="The converted event list JSON will appear here."
              InputProps={{ readOnly: true }}
            />
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
