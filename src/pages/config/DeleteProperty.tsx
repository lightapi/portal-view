import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useUserState } from '../../contexts/UserContext';
import { useApiDelete } from '../../hooks/useApiDelete';

export default function DeleteProperty(props) {
  console.log(props.location.state.data);
  const host = props.location.state.data.property.host;
  const module = props.location.state.data.property.module;
  const scope = props.location.state.data.property.scope;
  const key = props.location.state.data.property.key;

  const url = '/config-server/configs/property?host=' + host + "&module=" + module + "&scope=" + scope + "&key=" + key;
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
