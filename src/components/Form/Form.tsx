import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { useEffect, useState } from "react";
import { SchemaForm, utils } from "react-schema-form";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import forms from "../../data/Forms";
import { useUserState } from "../../contexts/UserContext";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import fetchClient, { BASE_URL } from "../../utils/fetchClient";

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
  const [model, setModel] = useState<any>({});
  const { isAuthenticated, host }: any = useUserState();

  useEffect(() => {
    let formData = formId ? forms[formId] : {};
    if (!formData) formData = {};
    setSkipAuth(formData.skipAuth);
    setSchema(formData.schema);
    setForm(withBaseUrlForDynaSelect(formData.form));
    setActions(formData.actions);

    const initialModel = location.state
      ? location.state.data || {}
      : formData.model || {};

    const modelWithHostId = {
      ...initialModel,
      hostId: initialModel.hostId ?? host
    };
    setModel(modelWithHostId);
  }, [host, formId, location.state]);

  const onModelChange = (key: string | string[], val: any, type?: string) => {
    utils.selectOrSet(key, model, val, type);
    setModel({ ...model });
  };

  function onButtonClick(action: any) {
    let result = utils.validateBySchema(schema, model);
    if (!result.valid) {
      setShowErrors(true);
      setValidationResult(result);
    } else {
      action.data = model;
      const url = action.path ? action.path : "/portal/command";
      const headers = {
        "Content-Type": "application/json",
      };
      submitForm(url, headers, action);
    }
  }

  const submitForm = async (url: string, headers: any, action: any) => {
    setFetching(true);
    try {
      const data = await fetchClient(url, {
        method: action.method ? action.method : "POST",
        body: action.rest ? action.data : action,
        headers: headers
      });
      setFetching(false);
      navigate(action.success, { state: { data } });
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
    return (
      <Box sx={{ p: 1 }}>
        {fetching && (
          <Box sx={{ m: 2 }}>
            <CircularProgress />
          </Box>
        )}
        <Typography variant="h4" component="h2" gutterBottom>
          {schema.title}
        </Typography>
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
