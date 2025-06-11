import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useApiDelete } from '../../hooks/useApiDelete';

export default function GlobalFileDelete(props) {
  console.log(props.location.state.data);
  const host = props.location.state.data.file.host;
  const module = props.location.state.data.file.module;
  const project = props.location.state.data.file.project;
  const projver = props.location.state.data.file.projver;
  const env = props.location.state.data.file.env;
  const filename = props.location.state.data.file.filename;

  const url = '/config-server/files/global?host=' + host + "&module=" + module + "&project=" + project + "&projver=" + projver + "&env=" + env + "&filename=" + filename;
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
