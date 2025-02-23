import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { makeStyles } from "@mui/styles";
import { useEffect, useState } from "react";
import { SchemaForm, utils } from "react-schema-form";
import Cookies from "universal-cookie";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import forms from "../../data/Forms";
import { useUserState } from "../../contexts/UserContext";
import Typography from "@mui/material/Typography"; // Import Typography for better text rendering

const useStyles = makeStyles((theme) => ({
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
  const [schema, setSchema] = useState(null);
  const [form, setForm] = useState(null);
  const [actions, setActions] = useState(null);
  const [model, setModel] = useState({});
  const classes = useStyles();
  const { isAuthenticated, host } = useUserState();

  useEffect(() => {
    console.log(formId);
    let formData = forms[formId];
    setSkipAuth(formData.skipAuth);
    setSchema(formData.schema);
    setForm(formData.form);
    setActions(formData.actions);
    console.log("host = ", host);

    // must ensure that the model is an empty object to the cascade dropdown
    const initialModel = location.state
      ? location.state.data || {}
      : formData.model || {};

    const modelWithHostId = Object.assign({}, initialModel, { hostId: host });
    setModel(modelWithHostId);
  }, [host, formId, location.state]);

  const onModelChange = (key, val, type) => {
    utils.selectOrSet(key, model, val, type);
    setModel({ ...model }); // here we must create a new object to force re-render.
  };

  function onButtonClick(action) {
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

  const submitForm = async (url, headers, action) => {
    setFetching(true);
    try {
      const cookies = new Cookies();
      Object.assign(headers, { "X-CSRF-TOKEN": cookies.get("csrf") });
      const response = await fetch(url, {
        method: action.method ? action.method : "POST",
        body: action.rest
          ? JSON.stringify(action.data)
          : JSON.stringify(action),
        headers,
        credentials: "include",
      });
      // we have tried out best to response json from our APIs; however, some services return text instead like light-oauth2.
      const s = await response.text();
      console.log("submit error", s);
      const data = JSON.parse(s);
      setFetching(false);
      if (!response.ok) {
        // code is not OK.
        navigate(action.failure, { state: { data } });
      } else {
        navigate(action.success, { state: { data } });
      }
    } catch (e) {
      // network error here.
      console.log(e);
      // convert it to json as the failure component can only deal with JSON.
      const error = { error: e };
      navigate(action.failure, { state: { error } });
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
    var buttons = [];
    actions.map((item, index) => {
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
