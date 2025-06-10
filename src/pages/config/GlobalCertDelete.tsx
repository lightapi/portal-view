import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useApiDelete } from '../../hooks/useApiDelete';

export default function GlobalCertDelete(props) {
  console.log(props.location.state.data);
  const host = props.location.state.data.cert.host;
  const module = props.location.state.data.cert.module;
  const project = props.location.state.data.cert.project;
  const projver = props.location.state.data.cert.projver;
  const env = props.location.state.data.cert.env;
  const filename = props.location.state.data.cert.filename;

  const url = '/config-server/certs/global?host=' + host + "&module=" + module + "&project=" + project + "&projver=" + projver + "&env=" + env + "&filename=" + filename;
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
