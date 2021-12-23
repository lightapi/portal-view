import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useUserState } from '../../context/UserContext';
import { useApiPost } from '../../hooks/useApiPost';

export default function ClientDelete(props) {
  console.log(props.location.state.data);
  const clientId = props.location.state.data.clientId;
  const { host } = useUserState();
  const body = {
    host: 'lightapi.net',
    service: 'market',
    action: 'deleteClient',
    version: '0.1.0',
    data: { clientId, host },
  };
  const url = '/portal/command';
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
