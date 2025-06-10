import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useApiDelete } from '../../hooks/useApiDelete';

export default function GlobalValueDelete(props) {
  console.log(props.location.state.data);
  const host = props.location.state.data.global.host;
  const module = props.location.state.data.global.module;
  const project = props.location.state.data.global.project;
  const projver = props.location.state.data.global.projver;
  const env = props.location.state.data.global.env;
  const key = props.location.state.data.global.key;

  const url = '/config-server/configs/global?host=' + host + "&module=" + module + "&project=" + project + "&projver=" + projver + "&env=" + env + "&key=" + key;
  const headers = {};
  const { isLoading, data, error } = useApiDelete({ url, headers });
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
        <pre>{error ? error : "Record deleted"}</pre>
      </div>
    );
  }
  return <div>{wait}</div>;
}
