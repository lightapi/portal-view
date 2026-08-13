import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddBoxIcon from "@mui/icons-material/AddBox";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserState } from "../../contexts/UserContext";
import fetchClient from "../../utils/fetchClient";
import {
  buildTaskAwareRoute,
  buildTaskReturnRoute,
  mergeTaskContext,
  saveStoredTaskContext,
  taskContextFromSearch,
} from "../../tasks/taskUtils";

const TASK_ID = "register-ai-agent";

type ApiOption = {
  hostId?: string;
  apiId: string;
  apiName?: string;
  apiDesc?: string;
};

type ApiChoice = "existing" | "new" | "";

function optionLabel(api: ApiOption) {
  return api.apiName ? `${api.apiName} (${api.apiId})` : api.apiId;
}

export default function RegisterAiAgentApiStep() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { host } = useUserState();
  const [choice, setChoice] = useState<ApiChoice>("");
  const [apis, setApis] = useState<ApiOption[]>([]);
  const [selectedApi, setSelectedApi] = useState<ApiOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taskContext = useMemo(() => taskContextFromSearch(searchParams), [searchParams]);

  useEffect(() => {
    if (choice !== "existing" || !host) return;

    let active = true;
    setIsLoading(true);
    setError(null);

    const cmd = {
      host: "lightapi.net",
      service: "service",
      action: "getApi",
      version: "0.1.0",
      data: {
        hostId: host,
        offset: 0,
        limit: 1000,
        active: true,
        filters: "[]",
        sorting: "[]",
        globalFilter: "",
      },
    };

    fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd)))
      .then((data) => {
        if (!active) return;
        const nextApis = Array.isArray(data?.services) ? data.services as ApiOption[] : [];
        setApis(nextApis
          .filter((api) => !!api.apiId)
          .sort((left, right) => optionLabel(left).localeCompare(optionLabel(right))));
      })
      .catch(() => {
        if (active) setError("Unable to load APIs. Please try again.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [choice, host]);

  const handleCreate = () => {
    navigate(buildTaskAwareRoute(
      "/app/form/createApi",
      searchParams,
      mergeTaskContext(taskContext?.context, { hostId: host ?? "" }),
    ));
  };

  const handleSelect = () => {
    if (!selectedApi) return;

    const nextContext = mergeTaskContext(taskContext?.context, {
      hostId: selectedApi.hostId || host || "",
      apiId: selectedApi.apiId,
    });
    const taskId = taskContext?.taskId || TASK_ID;
    saveStoredTaskContext(taskId, nextContext);
    navigate(buildTaskReturnRoute(
      taskId,
      taskContext?.returnTo,
      searchParams,
      nextContext,
    ));
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Choose an API</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Select an API already in the catalog or create a new API for this AI agent.
          </Typography>
        </Box>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2.5}>
              <FormControl>
                <FormLabel id="api-choice-label">How would you like to continue?</FormLabel>
                <RadioGroup
                  aria-labelledby="api-choice-label"
                  value={choice}
                  onChange={(event) => {
                    setChoice(event.target.value as ApiChoice);
                    setSelectedApi(null);
                  }}
                >
                  <FormControlLabel
                    value="existing"
                    control={<Radio />}
                    label="Select existing API"
                  />
                  <FormControlLabel
                    value="new"
                    control={<Radio />}
                    label="Create new API"
                  />
                </RadioGroup>
              </FormControl>

              {choice === "existing" && (
                <Stack spacing={2}>
                  <Typography variant="h6">Select from API catalog</Typography>
                  {!host && <Alert severity="warning">Host context is required to load APIs.</Alert>}
                  {error && <Alert severity="error">{error}</Alert>}
                  <Autocomplete
                    options={apis}
                    value={selectedApi}
                    onChange={(_, value) => setSelectedApi(value)}
                    getOptionLabel={optionLabel}
                    isOptionEqualToValue={(option, value) => option.apiId === value.apiId}
                    loading={isLoading}
                    disabled={!host}
                    noOptionsText={isLoading ? "Loading APIs…" : "No active APIs found"}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="API"
                        placeholder="Search by API name or ID"
                        slotProps={{
                          input: {
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          },
                        }}
                      />
                    )}
                  />
                  {selectedApi?.apiDesc && (
                    <Typography variant="body2" color="text.secondary">
                      {selectedApi.apiDesc}
                    </Typography>
                  )}
                  <Box>
                    <Button variant="contained" disabled={!selectedApi} onClick={handleSelect}>
                      Continue with selected API
                    </Button>
                  </Box>
                </Stack>
              )}

              {choice === "new" && (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    You will create the API catalog entry first, then return to this registration task.
                  </Typography>
                  <Box>
                    <Button startIcon={<AddBoxIcon />} variant="contained" onClick={handleCreate}>
                      Continue to Create API
                    </Button>
                  </Box>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
