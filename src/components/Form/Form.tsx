import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useEffect, useRef, useState } from "react";
import { SchemaForm, utils } from "react-schema-form";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import forms from "../../data/Forms";
import { useUserState } from "../../contexts/UserContext";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import HelpLink from "../HelpLink";
import fetchClient, { BASE_URL } from "../../utils/fetchClient";
import { allPageRegistry } from "../../tasks/pageRegistry";
import { taskRegistry } from "../../tasks/taskRegistry";
import {
  buildTaskReturnRoute,
  contextFromObject,
  contextFromSearchParams,
  mergeTaskContext,
  pageDefinitionForRoute,
  saveStoredTaskContext,
  taskContextFromSearch,
} from "../../tasks/taskUtils";
import { compactToolMetadataForSubmit, enrichToolMetadataFields } from "../../utils/toolMetadata";
import { createIdempotencyKey } from "../../utils/createIdempotency";
import {
  entityCreationFeedback,
  isTerminalEntityCreationError,
} from "../../utils/entityCreationError";

const withBaseUrlForDynaSelect = (items: any[] | null) => {
  if (!items) return items;
  const isLocalEnv = import.meta.env.DEV;

  return items.map((item) => {
    if (item?.type !== "dynaselect") {
      return item;
    }
    const actionUrl = item?.action?.url;
    if (actionUrl === undefined || actionUrl === null || actionUrl === "") {
      return item;
    }

    if (isLocalEnv) {
      return item;
    }

    return {
      ...item,
      action: {
        ...item.action,
        url: `${BASE_URL}${actionUrl}`,
      },
    };
  });
};

function normalizeFormModel(formId: string | undefined, source: any) {
  const next = { ...(source ?? {}) };

  if (formId === "createAgentDefinition" || formId === "updateAgentDefinition") {
    if (!next.agentDefId && next.apiVersionId) {
      next.agentDefId = next.apiVersionId;
    }
    if (!next.apiVersionId && next.agentDefId) {
      next.apiVersionId = next.agentDefId;
    }
  }

  if (formId === "createTool" || formId === "updateTool") {
    return enrichToolMetadataFields(next);
  }

  return next;
}

function cloneDefaultValue(value: any) {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return { ...value };
  return value;
}

function formItemKey(item: any): string | string[] | undefined {
  if (typeof item === "string" || Array.isArray(item)) return item;
  return item?.key;
}

function pathParts(path: string | string[]) {
  return Array.isArray(path) ? path.map(String) : String(path).split(".");
}

function valueAtPath(source: any, path: string | string[]) {
  return pathParts(path).reduce((current, part) => current?.[part], source);
}

function setValueAtPath(target: any, path: string | string[], value: any) {
  const parts = pathParts(path);
  let current = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }
    current[part] = current[part] && typeof current[part] === "object" ? { ...current[part] } : {};
    current = current[part];
  });
}

function deleteValueAtPath(target: any, path: string | string[]) {
  const parts = pathParts(path);
  let current = target;
  parts.forEach((part, index) => {
    if (!current || typeof current !== "object") return;
    if (index === parts.length - 1) {
      delete current[part];
      return;
    }
    const child = current[part];
    if (!child || typeof child !== "object") {
      current = undefined;
      return;
    }
    current[part] = Array.isArray(child) ? [...child] : { ...child };
    current = current[part];
  });
}

function applyInitialDefaults(formData: any, source: any) {
  const next = { ...(source ?? {}) };
  const schemaProperties = formData?.schema?.properties ?? {};
  const formItems = Array.isArray(formData?.form) ? formData.form : [];

  formItems.forEach((item: any) => {
    const key = formItemKey(item);
    if (!key) return;

    const keyName = Array.isArray(key) ? key.join(".") : key;
    const defaultValue = item?.default ?? item?.schema?.default ?? schemaProperties[keyName]?.default;
    if (defaultValue === undefined || valueAtPath(next, key) != null) return;

    setValueAtPath(next, key, cloneDefaultValue(defaultValue));
  });

  return next;
}

function applyLockedFields(formData: any, fields: unknown) {
  if (!Array.isArray(fields) || fields.length === 0) return formData;
  const locked = new Set(fields.filter((field): field is string => typeof field === "string"));
  const properties = formData?.schema?.properties ?? {};
  return {
    ...formData,
    schema: {
      ...formData.schema,
      properties: Object.fromEntries(Object.entries(properties).map(([key, property]) => [
        key,
        locked.has(key) ? { ...(property as object), readonly: true } : property,
      ])),
    },
    form: Array.isArray(formData?.form)
      ? formData.form.map((item: any) => {
        const key = formItemKey(item);
        const keyName = Array.isArray(key) ? key.join(".") : key;
        return item && typeof item === "object" && key && keyName && locked.has(keyName)
          ? key
          : item;
      })
      : formData?.form,
  };
}

export type PrefillConfig = {
  /** Portal query service, e.g. "service" or "genai". */
  service: string;
  /**
   * Read action. Must be an identity-only read: `getFresh*` actions require an
   * `aggregateVersion` we do not have (their request schemas mark it required and their
   * handlers unbox it into an int), so they are not usable here.
   */
  action: string;
  /**
   * Context keys that must all resolve before the form can be trusted. They identify exactly
   * one record, are substituted into `params`, and are matched against the returned row.
   */
  identity: string[];
  /** Query payload; string values may reference an identity key as "{key}". */
  params: Record<string, unknown>;
  /** Field holding the rows, e.g. "agentDefinitions". Empty string means a bare array. */
  collection?: string;
  /** Response fields the form must not carry (denormalized read-only projections). */
  omit?: string[];
};

export type PrefillState = {
  /**
   * idle       - this form declares no prefill, or a caller already supplied the record.
   * loading    - the read is in flight.
   * ready      - a record matching the requested identity is loaded.
   * error      - the read failed, returned nothing, or returned a mismatched/invalid record.
   * unavailable- the identity keys do not resolve, so no single record can be addressed.
   */
  status: "idle" | "loading" | "ready" | "error" | "unavailable";
  data: Record<string, unknown> | null;
};

function prefillConfigFor(formData: any): PrefillConfig | null {
  const config = formData?.prefill;
  if (!config || typeof config !== "object") return null;
  if (typeof config.service !== "string" || typeof config.action !== "string") return null;
  if (!Array.isArray(config.identity) || config.identity.length === 0) return null;
  if (!config.params || typeof config.params !== "object") return null;
  return config as PrefillConfig;
}

/**
 * Identity for a prefill read. Returns null when any key is missing: without complete identity
 * the request cannot address one record, and the form must not present itself as editable.
 */
function prefillIdentity(config: PrefillConfig, searchParams: URLSearchParams, host: unknown) {
  const identity: Record<string, string> = {};
  for (const key of config.identity) {
    const value = searchParams.get(key) || (key === "hostId" && typeof host === "string" ? host : "");
    if (!value) return null;
    identity[key] = value;
  }
  return identity;
}

function prefillParams(config: PrefillConfig, identity: Record<string, string>) {
  const substitute = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    return value.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) => identity[key] ?? match);
  };
  return Object.fromEntries(
    Object.entries(config.params).map(([key, value]) => [key, substitute(value)]),
  );
}

function prefillRows(payload: unknown, config: PrefillConfig): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const source = payload as Record<string, unknown>;
  const collection = config.collection ? source[config.collection] : null;
  return Array.isArray(collection) ? collection : [];
}

/**
 * The row for exactly the requested identity. Every identity field must be present on the row
 * and must match, so neither a filtered query that ignored an unknown filter nor a projection
 * that omits an identity column can hand back a record we then treat as the requested one.
 */
function matchPrefillRow(rows: unknown[], identity: Record<string, string>) {
  const matches = rows.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const record = row as Record<string, unknown>;
    return Object.entries(identity).every(([key, value]) => {
      const actual = record[key];
      if (actual === undefined || actual === null) return false;
      return String(actual) === value;
    });
  });
  return matches.length === 1 ? matches[0] as Record<string, unknown> : null;
}

/**
 * A record is usable as an update base point only with a concurrency version: submitting
 * without one either loses the optimistic-concurrency check or is rejected downstream. The
 * portal read models project aggregate_version as a numeric column, so anything else means we
 * are not looking at the record we think we are.
 */
function hasAggregateVersion(record: Record<string, unknown>) {
  const value = record.aggregateVersion;
  return typeof value === "number" && Number.isFinite(value);
}

function prefillModel(record: Record<string, unknown>, config: PrefillConfig) {
  const data = { ...record };
  for (const key of config.omit ?? []) delete data[key];
  return data;
}

function submittedFormModel(formId: string | undefined, source: any) {
  const next = formId === "createTool" || formId === "updateTool"
    ? compactToolMetadataForSubmit(normalizeFormModel(formId, source))
    : normalizeFormModel(formId, source);
  const formData = formId ? (forms as any)[formId] : undefined;
  const submitOmitFields = formData?.submitOmitFields;
  if (Array.isArray(submitOmitFields)) {
    for (const field of submitOmitFields) {
      deleteValueAtPath(next, field);
    }
  }
  return next;
}

function hasUnappliedStructuredDraft(container: HTMLElement | null) {
  if (!container) return false;

  const selectedTabs = container.querySelectorAll(
    'fieldset [role="tab"][aria-selected="true"]',
  );
  return Array.from(selectedTabs).some((tab) => tab.textContent?.trim().endsWith("*"));
}

function hasInvalidStructuredDraft(container: HTMLElement | null) {
  return !!container?.querySelector(
    'fieldset [role="tabpanel"] [aria-invalid="true"]',
  );
}

function Form() {
  const params = useParams();
  const formId = params.formId;
  const location = useLocation();
  const navigate = useNavigate();
  const [fetching, setFetching] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [skipAuth, setSkipAuth] = useState(false);
  const [schema, setSchema] = useState<any>(null);
  const [form, setForm] = useState<any[] | null>(null);
  const [actions, setActions] = useState<any[] | null>(null);
  const [helpPath, setHelpPath] = useState<string | null>(null);
  const [model, setModel] = useState<any>({});
  const [prefill, setPrefill] = useState<PrefillState>({ status: "idle", data: null });
  const [prefillAttempt, setPrefillAttempt] = useState(0);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const submissionPendingRef = useRef(false);
  const { isAuthenticated, host }: any = useUserState();

  // Load the record behind an update form when the caller handed us only identity. List pages
  // navigate here with the row already in location.state.data; task steps, deep links and
  // bookmarks have no row, and without this the form renders with just the context keys
  // populated - saving that would blank every other column.
  useEffect(() => {
    const formData = (formId ? forms[formId] : null) ?? {};
    // Keep the identical state object so React bails out: most forms declare no prefill and
    // must not pay a re-render for it on every navigation.
    const clearPrefill = () => setPrefill(
      (prev) => (prev.status === "idle" && prev.data === null ? prev : { status: "idle", data: null }),
    );

    const config = prefillConfigFor(formData);
    if (!config || location.state?.data) {
      clearPrefill();
      return;
    }

    const identity = prefillIdentity(config, new URLSearchParams(location.search), host);
    if (!identity) {
      // No single record is addressable. Submission stays blocked rather than offering an
      // update form populated only with whatever context keys happened to arrive.
      setPrefill({ status: "unavailable", data: null });
      return;
    }

    let active = true;
    setPrefill({ status: "loading", data: null });

    const cmd = {
      host: "lightapi.net",
      service: config.service,
      action: config.action,
      version: "0.1.0",
      data: prefillParams(config, identity),
    };

    fetchClient("/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd)))
      .then((payload) => {
        if (!active) return;
        const record = matchPrefillRow(prefillRows(payload, config), identity);
        if (!record || !hasAggregateVersion(record)) {
          setPrefill({ status: "error", data: null });
          return;
        }
        setPrefill({ status: "ready", data: prefillModel(record, config) });
      })
      .catch(() => {
        if (active) setPrefill({ status: "error", data: null });
      });

    return () => {
      active = false;
    };
  }, [formId, host, location.search, location.state, prefillAttempt]);

  useEffect(() => {
    let formData = formId ? forms[formId] : {};
    if (!formData) formData = {};
    formData = applyLockedFields(formData, location.state?.lockedFields);
    setSkipAuth(formData.skipAuth);
    setSchema(formData.schema);
    setForm(withBaseUrlForDynaSelect(formData.form));
    setActions(formData.actions);
    setHelpPath(formData.helpPath ?? null);

    const searchParams = new URLSearchParams(location.search);
    const schemaProperties = formData.schema?.properties ?? {};
    const searchModel = Array.from(searchParams.entries()).reduce<Record<string, string>>((acc, [key, value]) => {
      if (schemaProperties[key]) acc[key] = value;
      return acc;
    }, {});
    const searchContext = contextFromSearchParams(searchParams);
    // Precedence is unchanged for every pre-existing source; the fetched record slots in just
    // above the form's static model, so an explicit location.state.data hand-off from a list
    // page still wins and the identifying context keys stay authoritative.
    const initialModel = {
      ...(formData.model || {}),
      ...(prefill.data || {}),
      ...(location.state?.data || {}),
      ...searchModel,
      ...searchContext,
    };

    const modelWithHostId = schemaProperties.hostId
      ? {...initialModel, hostId: initialModel.hostId ?? host}
      : initialModel;
    setModel(normalizeFormModel(formId, applyInitialDefaults(formData, modelWithHostId)));
  }, [host, formId, location.state, location.search, prefill.data]);

  useEffect(() => {
    idempotencyKeyRef.current = null;
    submissionPendingRef.current = false;
  }, [formId]);

  const onModelChange = (key: string | string[], val: any, type?: string) => {
    utils.selectOrSet(key, model, val, type);
    const keyParts = Array.isArray(key) ? key : String(key).split(".");
    const isNestedArrayFieldChange = keyParts.some((part) => /^\d+$/.test(part));
    if (isNestedArrayFieldChange) return;
    setModel({ ...model });
  };

  function onButtonClick(action: any) {
    if (submissionPendingRef.current) return;
    if (
      hasUnappliedStructuredDraft(formContainerRef.current)
      || hasInvalidStructuredDraft(formContainerRef.current)
    ) {
      setShowErrors(true);
      setValidationResult({
        valid: false,
        error: "Apply or Reset structured data changes before submitting the form.",
      });
      return;
    }

    const normalizedModel = normalizeFormModel(formId, model);
    setModel(normalizedModel);
    const result = utils.validateBySchema(schema, normalizedModel);
    if (!result.valid) {
      setShowErrors(true);
      setValidationResult(result);
    } else {
      setShowErrors(false);
      setValidationResult(null);
      const modelToSubmit = submittedFormModel(formId, normalizedModel);
      const submittedAction = {...action, data: modelToSubmit};
      const url = action.path ? action.path : "/portal/command";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (action.idempotentCreate === true) {
        try {
          idempotencyKeyRef.current ??= createIdempotencyKey();
        } catch (error) {
          setShowErrors(true);
          setValidationResult({valid: false, error});
          return;
        }
        headers["Idempotency-Key"] = idempotencyKeyRef.current;
      }
      submissionPendingRef.current = true;
      submitForm(url, headers, submittedAction, modelToSubmit);
    }
  }

  const submitForm = async (url: string, headers: any, action: any, submittedModel: any) => {
    setFetching(true);
    try {
      const data = await fetchClient(url, {
        method: action.method ? action.method : "POST",
        body: action.rest ? action.data : action,
        headers: headers
      });
      setFetching(false);
      submissionPendingRef.current = false;
      if (action.idempotentCreate === true) idempotencyKeyRef.current = null;
      const searchParams = new URLSearchParams(location.search);
      const taskContext = taskContextFromSearch(searchParams);
      if (taskContext) {
        const nextContext = mergeTaskContext(
          taskContext.context,
          contextFromObject(submittedModel),
          contextFromObject(data),
        );
        saveStoredTaskContext(taskContext.taskId, nextContext);
        navigate(
          buildTaskReturnRoute(taskContext.taskId, taskContext.returnTo, searchParams, nextContext),
          { state: { data } },
        );
      } else {
        const source = typeof location.state?.source === "string" && location.state.source.startsWith("/app/")
          ? location.state.source
          : null;
        navigate(action.returnToSource === true && source ? source : action.success, { state: { data } });
      }
    } catch (e) {
      setFetching(false);
      submissionPendingRef.current = false;
      if (action.idempotentCreate === true) {
        const feedback = entityCreationFeedback(e);
        if (isTerminalEntityCreationError(feedback.code)) {
          idempotencyKeyRef.current = null;
        }
        setShowErrors(true);
        setValidationResult({valid: false, error: feedback});
      } else {
        navigate(action.failure, { state: { data: e } });
      }
    }
  };

  if (!isAuthenticated && !skipAuth) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4 }}>
        <Typography variant="h6" color="error" sx={{ mb: 2 }}>
          Authentication Required
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          You need to be logged in to access this form.
        </Typography>
        <Button variant="contained" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Box>
    );
  }

  // Never render the form while its record is in flight: the fields would be visibly empty and
  // anything the user typed would be overwritten the moment the record lands.
  if (schema && prefill.status === "loading") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 3 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">Loading current values…</Typography>
      </Box>
    );
  }

  // A form that declares a prefill is an update form: without its record there is no safe base
  // point to edit from, so it is never presented as editable. Showing the fields with a warning
  // would still let the record be overwritten with blanks.
  if (schema && (prefill.status === "error" || prefill.status === "unavailable")) {
    const unavailable = prefill.status === "unavailable";
    return (
      <Box sx={{ p: 3, maxWidth: 700 }}>
        <Alert severity={unavailable ? "info" : "warning"} sx={{ mb: 2 }}>
          {unavailable
            ? "This record could not be identified from the current context, so it cannot be edited here. Go back and choose the record you want to change."
            : "The current values for this record could not be loaded, so it cannot be edited safely. Saving now could overwrite existing data with blanks."}
        </Alert>
        <Stack direction="row" spacing={1}>
          {!unavailable && (
            <Button variant="contained" onClick={() => setPrefillAttempt((attempt) => attempt + 1)}>
              Retry
            </Button>
          )}
          <Button variant="outlined" onClick={() => navigate(-1)}>Go Back</Button>
        </Stack>
      </Box>
    );
  }

  if (schema) {
    const searchParams = new URLSearchParams(location.search);
    const taskContext = taskContextFromSearch(searchParams);
    const task = taskRegistry.find((item) => item.id === taskContext?.taskId);
    const page = pageDefinitionForRoute(allPageRegistry, location.pathname);
    const primaryHelpPath = helpPath ?? task?.helpPath ?? page?.helpPath;
    const taskHelpPath = task?.helpPath && task.helpPath !== primaryHelpPath
      ? task.helpPath
      : null;

    return (
      <Box sx={{ p: 1 }}>
        {fetching && (
          <Box sx={{ m: 2 }}>
            <CircularProgress />
          </Box>
        )}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Typography variant="h4" component="h2">
            {schema.title}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 1 }}>
            <HelpLink
              helpPath={primaryHelpPath}
              tooltip={`Help: ${schema.title}`}
            />
            <HelpLink
              helpPath={taskHelpPath}
              label="Task Help"
              tooltip={task ? `Related task help: ${task.title}` : undefined}
              fallback={false}
            />
          </Stack>
        </Stack>
        <Box ref={formContainerRef}>
          <SchemaForm
            schema={schema}
            form={form}
            model={model}
            showErrors={showErrors}
            onModelChange={onModelChange}
          />
        </Box>
        {showErrors && (
          <Box sx={{ mt: 2, mb: 2, bgcolor: '#f8f8f8', p: 1, borderRadius: 1 }}>
            <pre>{JSON.stringify(validationResult, undefined, 2)}</pre>
          </Box>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {actions && actions.map((item: any, index: number) => (
            <Button
              variant="contained"
              color="primary"
              key={index}
              disabled={fetching}
              onClick={() => onButtonClick(item)}
            >
              {item.title}
            </Button>
          ))}
        </Box>
      </Box>
    );
  } else {
    return <Box sx={{ m: 2 }}><CircularProgress /></Box>;
  }
}

export default Form;
