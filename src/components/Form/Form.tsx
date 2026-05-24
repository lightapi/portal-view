import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useEffect, useState } from "react";
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

  if (formId === "createApiVersion" || formId === "updateApiVersion") {
    const apiType = typeof next.apiType === "string" ? next.apiType.trim().toLowerCase() : "";
    if (apiType === "agent") next.apiType = "agt";
  }

  if (formId === "createAgentDefinition" || formId === "updateAgentDefinition") {
    if (!next.agentDefId && next.apiVersionId) {
      next.agentDefId = next.apiVersionId;
    }
    if (!next.apiVersionId && next.agentDefId) {
      next.apiVersionId = next.agentDefId;
    }
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

function submittedFormModel(formId: string | undefined, source: any) {
  const next = normalizeFormModel(formId, source);
  const formData = formId ? (forms as any)[formId] : undefined;
  const submitOmitFields = formData?.submitOmitFields;
  if (Array.isArray(submitOmitFields)) {
    for (const field of submitOmitFields) {
      delete next[field];
    }
  }
  return next;
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
  const { isAuthenticated, host }: any = useUserState();

  useEffect(() => {
    let formData = formId ? forms[formId] : {};
    if (!formData) formData = {};
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
    const initialModel = {
      ...(formData.model || {}),
      ...(location.state?.data || {}),
      ...searchModel,
      ...searchContext,
    };

    const modelWithHostId = {
      ...initialModel,
      hostId: initialModel.hostId ?? host
    };
    setModel(normalizeFormModel(formId, applyInitialDefaults(formData, modelWithHostId)));
  }, [host, formId, location.state, location.search]);

  const onModelChange = (key: string | string[], val: any, type?: string) => {
    utils.selectOrSet(key, model, val, type);
    const keyParts = Array.isArray(key) ? key : String(key).split(".");
    const isNestedArrayFieldChange = keyParts.some((part) => /^\d+$/.test(part));
    if (isNestedArrayFieldChange) return;
    setModel({ ...model });
  };

  function onButtonClick(action: any) {
    const normalizedModel = normalizeFormModel(formId, model);
    setModel(normalizedModel);
    let result = utils.validateBySchema(schema, normalizedModel);
    if (!result.valid) {
      setShowErrors(true);
      setValidationResult(result);
    } else {
      const modelToSubmit = submittedFormModel(formId, normalizedModel);
      action.data = modelToSubmit;
      const url = action.path ? action.path : "/portal/command";
      const headers = {
        "Content-Type": "application/json",
      };
      submitForm(url, headers, action, modelToSubmit);
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
        navigate(action.success, { state: { data } });
      }
    } catch (e) {
      setFetching(false);
      navigate(action.failure, { state: { data: e } });
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
        <SchemaForm
          schema={schema}
          form={form}
          model={model}
          showErrors={showErrors}
          onModelChange={onModelChange}
        />
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
