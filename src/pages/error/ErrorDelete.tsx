import CircularProgress from "@mui/material/CircularProgress";
import React from "react";
import { useUserState } from "../../contexts/UserContext";
import { useApiPost } from "../../hooks/useApiPost";

export default function ErrorDelete(props) {
  console.log(props.location.state.data);
  const errorCode = props.location.state.data.errorCode;
  const { host } = useUserState();
  const body = {
    host: "lightapi.net",
    service: "error",
    action: "deleteError",
    version: "0.1.0",
    data: { errorCode, host },
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
