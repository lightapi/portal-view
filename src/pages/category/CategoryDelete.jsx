import CircularProgress from "@mui/material/CircularProgress";
import React from "react";
import { useApiPost } from "../../hooks/useApiPost";

export default function CategoryDelete(props) {
  console.log(props.location.state.data);
  const host = props.location.state.data.host;
  const name = props.location.state.data.name;
  const body = {
    host: "lightapi.net",
    service: "category",
    action: "deleteCategory",
    version: "0.1.0",
    data: { host, name },
  };
  const url = "/portal/command";
  const headers = {};
  const { isLoading, data, error } = useApiPost({ url, headers, body });
  console.log(isLoading, data, error);
  let wait;
  if (isLoading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    wait = (
      <div>
        <pre>{data ? JSON.stringify(data, null, 2) : error}</pre>
      </div>
    );
  }
  return <div>{wait}</div>;
}
