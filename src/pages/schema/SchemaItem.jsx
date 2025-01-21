import CircularProgress from "@mui/material/CircularProgress";
import React, { useEffect, useState } from "react";
import Cookies from "universal-cookie";
import useStyles from "./styles";

export default function SchemaItem(props) {
  const classes = useStyles();
  console.log(props.match.params.host);
  console.log(props.match.params.id);
  const host = props.match.params.host;
  const id = props.match.params.id;
  const [schema, setSchema] = useState();
  const [loading, setLoading] = useState(true);

  const cmd = {
    host: "lightapi.net",
    service: "schema",
    action: "getJsonSchemaById",
    version: "0.1.0",
    data: { host, id },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));

  const querySchemaFn = async (url, headers) => {
    try {
      setLoading(true);
      const response = await fetch(url, { headers, credentials: "include" });
      //console.log(response);
      if (!response.ok) {
        const error = await response.json();
      } else {
        const data = await response.json();
        setSchema(data);
      }
      setLoading(false);
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    const cookies = new Cookies();
    const headers = { "X-CSRF-TOKEN": cookies.get("csrf") };
    querySchemaFn(url, headers);
  }, []);

  let wait;
  if (loading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    console.log("schema = ", schema);
    wait = (
      <div>
        <h1 className={classes.title}>{schema.id}</h1>
        <div>Status: {schema.status}</div>
        <div>Version: {schema.version}</div>
        <div>Name: {schema.name}</div>
        <div>Description: {schema.description}</div>
        <div>Owner: {schema.owner}</div>
        <div>Email: {schema.email}</div>
        <div>Categories: {schema.categories}</div>
        <div>Tags: {schema.tags}</div>
        <div>Schema: {schema.schema}</div>
        <div>Example: {schema.example}</div>
      </div>
    );
  }

  return <div>{wait}</div>;
}
