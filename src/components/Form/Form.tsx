import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { makeStyles } from "@mui/styles";
import { useEffect, useState } from "react";
import { SchemaForm, utils } from "react-schema-form";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import forms from "../../data/Forms";
import { useUserState } from "../../contexts/UserContext";
import Typography from "@mui/material/Typography";
import fetchClient from "../../utils/fetchClient";

const BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || "";

const withBaseUrlForDynaSelect = (items: any[] | null) => {
  if (!items) return items;
  return items.map((item) => {
    if (item?.type !== "dynaselect") {
      return item;
    }
    const actionUrl = item?.action?.url;
    if (actionUrl === undefined || actionUrl === null || actionUrl === "") {
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

const useStyles = makeStyles((theme: any) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
  progress: {
    margin: theme.spacing(2),
  },
  button: {
    margin: theme.spacing(1),
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: theme.spacing(4),
  },
  errorMessage: {
    marginBottom: theme.spacing(2),
  },
}));

function Form() {
  const params = useParams();
  const formId = params.formId;
  const location = useLocation();
  const navigate = useNavigate();
  const [fetching, setFetching] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [skipAuth, setSkipAuth] = useState(false);
  const [schema, setSchema] = useState<any>(null);
  const [form, setForm] = useState<any[] | null>(null);
  const [actions, setActions] = useState<any[] | null>(null);
  const [model, setModel] = useState({});
  const classes = useStyles();
  const { isAuthenticated, host } = useUserState();

  useEffect(() => {
    console.log(formId);
    let formData = formId ? forms[formId] : {};
    if (!formData) formData = {};
    setSkipAuth(formData.skipAuth);
    setSchema(formData.schema);
    setForm(withBaseUrlForDynaSelect(formData.form));
    setActions(formData.actions);
    console.log("host = ", host);

    // must ensure that the model is an empty object to the cascade dropdown
    const initialModel = location.state
      ? location.state.data || {}
      : formData.model || {};
    console.log("model = ", initialModel);

    // Use existing hostId or fall back to current host
    const modelWithHostId = {
      ...initialModel,
      hostId: initialModel.hostId ?? host
    };
    setModel(modelWithHostId);
  }, [host, formId, location.state]);

  const onModelChange = (key: string | string[], val: any, type?: string) => {
    utils.selectOrSet(key, model, val, type);
    setModel({ ...model }); // here we must create a new object to force re-render.
  };

  function onButtonClick(action: any) {
    console.log("onButtonClick is called", action);
    let validationResult = utils.validateBySchema(schema, model);
    console.log(validationResult);
    if (!validationResult.valid) {
      setShowErrors(true);
      setValidationResult(validationResult);
    } else {
      console.log("model = ", model);
      // submit the form to the portal service.
      action.data = model;
      // use the path defined in the action, default to /portal/command.
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
      console.log(e);
      // convert it to json as the failure component can only deal with JSON.
      navigate(action.failure, { state: { data: e } });
    }
  };

  if (!isAuthenticated && !skipAuth) {
    return (
      <div className={classes.errorContainer}>
        <Typography variant="h6" color="error" className={classes.errorMessage}>
          Authentication Required
        </Typography>
        <Typography variant="body1" className={classes.errorMessage}>
          You need to be logged in to access this form.
        </Typography>
        <Button variant="contained" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  if (schema) {
    const buttons: any[] = [];
    if (actions) {
      (actions as any[]).map((item: any, index: number) => {
        buttons.push(
          <Button
            variant="contained"
            className={classes.button}
            color="primary"
            key={index}
            onClick={() => onButtonClick(item)}
          >
            {item.title}
          </Button>,
        );
        return buttons;
      });
    }

    let wait;
    if (fetching) {
      wait = (
        <div>
          <CircularProgress className={classes.progress} />
        </div>
      );
    } else {
      wait = <div></div>;
    }
    let title = <h2>{schema.title}</h2>;
    let error;
    if (showErrors) {
      error = (
        <div>
          <pre>{JSON.stringify(validationResult, undefined, 2)}</pre>
        </div>
      );
    } else {
      error = <div></div>;
    }
    return (
      <div>
        {wait}
        {title}
        <SchemaForm
          schema={schema}
          form={form}
          model={model}
          showErrors={showErrors}
          onModelChange={onModelChange}
        />
        {error}
        {buttons}
      </div>
    );
  } else {
    return <CircularProgress className={classes.progress} />;
  }
}

export default Form;
