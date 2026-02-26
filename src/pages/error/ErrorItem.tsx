// This is the component to display the entire blog for readers.
import { CircularProgress } from "@mui/material";
import React, { useEffect, useState } from "react";
import fetchClient from "../../utils/fetchClient";
import MarkdownEditor from "@uiw/react-markdown-editor";
import useStyles from "./styles";

export default function ErrorItem(props) {
  const classes = useStyles();
  console.log(props.match.params.host);
  console.log(props.match.params.errorCode);
  const host = props.match.params.host;
  const errorCode = props.match.params.errorCode;
  const [errorItem, setErrorItem] = useState();
  const [loading, setLoading] = useState(true);

  const cmd = {
    host: "lightapi.net",
    service: "error",
    action: "getErrorByCode",
    version: "0.1.0",
    data: { host, errorCode },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));

  const queryErrorFn = async (url) => {
    try {
      setLoading(true);
      const data = await fetchClient(url);
      setErrorItem(data);
      setLoading(false);
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    queryErrorFn(url);
  }, []);

  let wait;
  if (loading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    console.log("errorItem = ", errorItem);
    wait = (
      <div>
        <h1 className={classes.title}>{errorItem.errorCode}</h1>
        <div>Status Code: {errorItem.statusCode}</div>
        <div>Error Message: {errorItem.message}</div>
        <div>Error Desc: {errorItem.description}</div>
        <div>Error Components: {errorItem.components}</div>
        <div>Error Severity: {errorItem.severity}</div>
        <div>Error Owner: {errorItem.owner}</div>
        <div>Contact Email: {errorItem.email}</div>
        <div>Contact Number: {errorItem.phone}</div>
        <Content resolution={errorItem.resolution} />
      </div>
    );
  }

  return <div>{wait}</div>;
}

const Content = ({ resolution }) => {
  console.log("resolution = ", resolution);
  return (
    <div className={classes.content}>
      <MarkdownEditor.Markdown source={resolution} height="200px" />
    </div>
  );
};
