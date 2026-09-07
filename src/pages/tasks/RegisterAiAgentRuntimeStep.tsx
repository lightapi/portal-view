import { fetchAllQueryRows } from "../../utils/fetchAllQueryRows";
import AddBoxIcon from "@mui/icons-material/AddBox";
import LinkIcon from "@mui/icons-material/Link";
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
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserState } from "../../contexts/UserContext";
import {
  buildTaskContextRoute,
  buildTaskReturnRoute,
  mergeTaskContext,
  saveStoredTaskContext,
  taskContextFromSearch,
} from "../../tasks/taskUtils";
import { AGENT_API_TYPE_CODES, isAgentApiType } from "../../utils/apiType";
import fetchClient from "../../utils/fetchClient";

const TASK_ID = "register-ai-agent";

type RuntimeChoice = "definition-only" | "existing" | "new" | "";

type RuntimeOption = {
  hostId?: string;
  instanceId: string;
  instanceName?: string;
  productId?: string;
  productVersionId?: string;
  productVersion?: string;
  serviceId?: string;
  environment?: string;
  envTag?: string;
};

type InstanceApiLink = {
  apiVersionId?: string;
  apiType?: string;
  instanceApiId?: string;
  instanceId?: string;
  productId?: string;
};

type ProductVersion = {
  productVersionId?: string;
  productId?: string;
  current?: boolean;
};

function runtimeLabel(runtime: RuntimeOption) {
  const environment = runtime.envTag || runtime.environment;
  return `${runtime.instanceName || runtime.instanceId}${environment ? ` (${environment})` : ""}`;
}

function queryUrl(service: string, action: string, data: Record<string, unknown>) {
  const cmd = { host: "lightapi.net", service, action, version: "0.1.0", data };
  return "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const value = error as { description?: string; message?: string };
    return value.description || value.message || fallback;
  }
  return fallback;
}

export default function RegisterAiAgentRuntimeStep() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { host, userId } = useUserState();
  const taskContext = useMemo(() => taskContextFromSearch(searchParams), [searchParams]);
  const context = taskContext?.context ?? {};
  const apiVersionId = context.apiVersionId || context.agentDefId || "";
  const [choice, setChoice] = useState<RuntimeChoice>(() => (
    context.deploymentMode === "definition-only"
      ? "definition-only"
      : context.instanceId
        ? "existing"
        : ""
  ));
  const [runtimes, setRuntimes] = useState<RuntimeOption[]>([]);
  const [selectedRuntime, setSelectedRuntime] = useState<RuntimeOption | null>(null);
  const [existingLink, setExistingLink] = useState<InstanceApiLink | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (choice !== "existing" || !host || !apiVersionId) return;

    let active = true;
    setIsLoading(true);
    setError(null);

    const common = {
      hostId: host,
      offset: 0,
      limit: 1000,
      active: true,
      sorting: "[]",
      globalFilter: "",
    };

    Promise.all([
      fetchAllQueryRows("instance", "getInstance", {
        ...common,
        filters: JSON.stringify([{ id: "productId", value: "agt" }]),
        sorting: JSON.stringify([{ id: "instanceId", desc: false }]),
      }, "instances"),
      // Keep the canonical type filter on every page; productId remains agt.
      ...AGENT_API_TYPE_CODES.map((apiType) => fetchAllQueryRows("instance", "getInstanceApi", {
        ...common,
        filters: JSON.stringify([{ id: "apiType", value: apiType }]),
        sorting: JSON.stringify([{ id: "instanceApiId", desc: false }]),
      }, "instanceApis")),
    ])
      .then(([instanceData, ...linkResults]) => {
        if (!active) return;
        const linksById = new Map<string, InstanceApiLink>();
        for (const linkData of linkResults) {
          for (const link of linkData as unknown as InstanceApiLink[]) {
            const id = link.instanceApiId ?? `${link.instanceId}:${link.apiVersionId}`;
            if (!linksById.has(id)) linksById.set(id, link);
          }
        }
        const links = Array.from(linksById.values());
        const currentLink = links.find((link) => link.apiVersionId === apiVersionId
          && isAgentApiType(link.apiType)
          && link.productId === "agt") ?? null;
        const boundInstanceIds = new Set(links
          .filter((link) => isAgentApiType(link.apiType) && link.apiVersionId !== apiVersionId)
          .map((link) => link.instanceId)
          .filter(Boolean));
        const compatible = (instanceData as unknown as RuntimeOption[])
          .filter((runtime) => runtime.productId === "agt")
          .filter((runtime) => !context.serviceId || runtime.serviceId === context.serviceId)
          .filter((runtime) => !boundInstanceIds.has(runtime.instanceId))
          .sort((left, right) => runtimeLabel(left).localeCompare(runtimeLabel(right)));

        setExistingLink(currentLink);
        setRuntimes(compatible);
        const preferredId = currentLink?.instanceId || context.instanceId;
        setSelectedRuntime(compatible.find((runtime) => runtime.instanceId === preferredId) ?? null);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught, "Unable to load compatible Agent runtimes."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiVersionId, choice, context.instanceId, context.serviceId, host]);

  const finish = (next: Record<string, string>, clear: string[] = []) => {
    const compactNext = Object.fromEntries(Object.entries(next).filter(([, value]) => value));
    const nextContext = mergeTaskContext(context, compactNext);
    clear.forEach((key) => delete nextContext[key as keyof typeof nextContext]);
    const taskId = taskContext?.taskId || TASK_ID;
    saveStoredTaskContext(taskId, nextContext);
    navigate(buildTaskReturnRoute(taskId, taskContext?.returnTo, searchParams, nextContext));
  };

  const handleDefinitionOnly = () => {
    finish(
      { deploymentMode: "definition-only" },
      ["instanceApiId", "instanceId", "runtimeInstanceId", "productId", "productVersionId", "environment"],
    );
  };

  const handleCreateRuntime = async () => {
    if (!host || !apiVersionId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const productData = await fetchClient(queryUrl("product", "getProductVersion", {
        hostId: host,
        offset: 0,
        limit: 10,
        active: true,
        filters: JSON.stringify([
          { id: "productId", value: "agt" },
          { id: "current", value: true },
        ]),
        sorting: "[]",
        globalFilter: "",
      }));
      const productVersion = ((productData?.products ?? []) as ProductVersion[])
        .find((product) => product.productId === "agt" && product.current);
      if (!productVersion?.productVersionId) {
        throw new Error("No active current agt product version is available for this host.");
      }

      const taskId = taskContext?.taskId || TASK_ID;
      const nextContext = mergeTaskContext(context, {
        hostId: host,
        apiVersionId,
        agentDefId: apiVersionId,
        productId: "agt",
        productVersionId: productVersion.productVersionId,
        deploymentMode: "native",
      });
      let route = buildTaskContextRoute(
        taskId,
        "/app/form/createInstance",
        nextContext,
        "/app/tasks/register-ai-agent/runtime",
      );
      const [path, query = ""] = route.split("?");
      const params = new URLSearchParams(query);
      params.set("taskStep", "runtime");
      route = `${path}?${params.toString()}`;
      navigate(route, {
        state: {
          data: nextContext,
          lockedFields: ["productVersionId", "serviceId"],
        },
      });
    } catch (caught) {
      setError(errorMessage(caught, "Unable to prepare a new Agent runtime."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkRuntime = async () => {
    if (!host || !apiVersionId || !selectedRuntime) return;
    if (existingLink?.instanceApiId && existingLink.instanceId === selectedRuntime.instanceId) {
      finish({
        deploymentMode: "native",
        productId: "agt",
        instanceId: selectedRuntime.instanceId,
        runtimeInstanceId: selectedRuntime.instanceId,
        instanceApiId: existingLink.instanceApiId,
        productVersionId: selectedRuntime.productVersionId || "",
        serviceId: selectedRuntime.serviceId || context.serviceId || "",
        environment: selectedRuntime.environment || "",
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const command = {
        host: "lightapi.net",
        service: "instance",
        action: "createInstanceApi",
        version: "0.1.0",
        data: {
          hostId: host,
          updateUser: userId,
          instanceId: selectedRuntime.instanceId,
          apiVersionId,
        },
      };
      const result = await fetchClient("/portal/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: command,
      });
      let instanceApiId = result?.instanceApiId || result?.data?.instanceApiId;
      if (!instanceApiId) {
        const linkData = await fetchClient(queryUrl("instance", "getInstanceApi", {
          hostId: host,
          offset: 0,
          limit: 1,
          active: true,
          filters: JSON.stringify([
            { id: "instanceId", value: selectedRuntime.instanceId },
            { id: "apiVersionId", value: apiVersionId },
          ]),
          sorting: "[]",
          globalFilter: "",
        }));
        instanceApiId = linkData?.instanceApis?.[0]?.instanceApiId;
      }
      if (!instanceApiId) throw new Error("The runtime link was submitted but could not be verified.");

      finish({
        deploymentMode: "native",
        productId: "agt",
        instanceId: selectedRuntime.instanceId,
        runtimeInstanceId: selectedRuntime.instanceId,
        instanceApiId,
        productVersionId: selectedRuntime.productVersionId || "",
        serviceId: selectedRuntime.serviceId || context.serviceId || "",
        environment: selectedRuntime.environment || "",
      });
    } catch (caught) {
      setError(errorMessage(caught, "Unable to link the Agent API version to this runtime."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 960, mx: "auto" }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Choose Agent deployment</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Save the Agent profile for later or connect it to one compatible native light-agent runtime.
          </Typography>
        </Box>

        {!apiVersionId && (
          <Alert severity="warning">Create the Agent API version and profile before choosing a runtime.</Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2.5}>
              <FormControl disabled={!apiVersionId || isSubmitting}>
                <FormLabel id="runtime-choice-label">How would you like to continue?</FormLabel>
                <RadioGroup
                  aria-labelledby="runtime-choice-label"
                  value={choice}
                  onChange={(event) => {
                    setChoice(event.target.value as RuntimeChoice);
                    setSelectedRuntime(null);
                    setError(null);
                  }}
                >
                  <FormControlLabel value="definition-only" control={<Radio />} label="Save as Agent definition only" />
                  <FormControlLabel value="existing" control={<Radio />} label="Use existing Agent runtime" />
                  <FormControlLabel value="new" control={<Radio />} label="Create new Agent runtime" />
                </RadioGroup>
              </FormControl>

              {choice === "definition-only" && (
                <Stack spacing={2}>
                  <Alert severity="info">
                    The Agent remains available for authoring, but it will not be runnable until a runtime is linked and its policy snapshot is published.
                  </Alert>
                  <Box>
                    <Button variant="contained" onClick={handleDefinitionOnly}>Save Agent definition</Button>
                  </Box>
                </Stack>
              )}

              {choice === "existing" && (
                <Stack spacing={2}>
                  {existingLink && (
                    <Alert severity="success">This Agent API version already has an active compatible runtime link.</Alert>
                  )}
                  <Autocomplete
                    options={runtimes}
                    value={selectedRuntime}
                    onChange={(_, value) => setSelectedRuntime(value)}
                    getOptionLabel={runtimeLabel}
                    isOptionEqualToValue={(option, value) => option.instanceId === value.instanceId}
                    loading={isLoading}
                    disabled={!host || isSubmitting}
                    noOptionsText={isLoading ? "Loading Agent runtimes…" : "No compatible unbound agt runtimes found"}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Agent runtime"
                        placeholder="Search by runtime name"
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
                  <Box>
                    <Button
                      startIcon={<LinkIcon />}
                      variant="contained"
                      disabled={!selectedRuntime || isSubmitting}
                      onClick={handleLinkRuntime}
                    >
                      {isSubmitting ? "Linking…" : "Link Agent runtime"}
                    </Button>
                  </Box>
                </Stack>
              )}

              {choice === "new" && (
                <Stack spacing={2}>
                  <Alert severity="info">
                    Product is locked to the current agt release. After creating the runtime, you will return here to verify and create its Agent API link.
                  </Alert>
                  <Box>
                    <Button
                      startIcon={<AddBoxIcon />}
                      variant="contained"
                      disabled={isSubmitting}
                      onClick={handleCreateRuntime}
                    >
                      {isSubmitting ? "Preparing…" : "Continue to Create Agent Runtime"}
                    </Button>
                  </Box>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Alert severity="warning">
          Runtime linking does not make the Agent live by itself. Policy publication, Config Server snapshot activation, and runtime acknowledgement remain required.
        </Alert>
      </Stack>
    </Box>
  );
}
