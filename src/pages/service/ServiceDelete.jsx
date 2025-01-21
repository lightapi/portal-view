import CircularProgress from "@mui/material/CircularProgress";
import React from "react";
import { useApiPost } from "../../hooks/useApiPost";
import { useUserState } from "../../contexts/UserContext";

export default function ServiceDelete(props) {
  console.log(props.location.state.data);
  const serviceId = props.location.state.data.serviceId;
  const { host } = useUserState();
  const body = {
    host: "lightapi.net",
    service: "service",
    action: "deleteService",
    version: "0.1.0",
    data: { serviceId, host },
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
