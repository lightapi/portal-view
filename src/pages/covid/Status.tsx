import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useUserState } from '../../contexts/UserContext';
import { useApiGet } from '../../hooks/useApiGet';
//import useStyles from "./styles";
import StatusContainer from './StatusContainer';

// This is the status entry point for users to update his/her status after logging in.

export default function Status(props) {
  //const classes = useStyles();
  const { email } = useUserState();
  const cmd = {
    host: 'lightapi.net',
    service: 'covid',
    action: 'getStatusByEmail',
    version: '0.1.0',
    data: { email },
  };
  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};
  const { isLoading, data } = useApiGet({ url, headers });
  let subjects = data || {};

  let wait;
  if (isLoading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    wait = (
      <StatusContainer {...props} subjects={subjects} isReadonly={false} />
    );
  }

  return <div className="App">{wait}</div>;
}
