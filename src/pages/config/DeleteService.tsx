import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useApiDelete } from '../../hooks/useApiDelete';

export default function DeleteService(props) {
  console.log(props.location.state.data);
  const host = props.location.state.data.service.host;
  const module = props.location.state.data.service.module;
  const project = props.location.state.data.service.project;
  const projver = props.location.state.data.service.projver;
  const service = props.location.state.data.service.service;
  const servver = props.location.state.data.service.servver;
  const env = props.location.state.data.service.env;

  const url = '/config-server/configs/service?host=' + host + "&module=" + module + "&project=" + project + "&projver=" + projver + "&service=" + service + "&servver=" + servver + "&env=" + env;
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
