import { CircularProgress, Box } from '@mui/material';
import React from 'react';
import { useUserState } from '../../contexts/UserContext';
import { useApiGet } from '../../hooks/useApiGet';
import StatusContainer from './StatusContainer';

// This is the status entry point for users to update his/her status after logging in.

export default function Status(props: any) {
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
  const subjects = data || {};

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <StatusContainer {...props} subjects={subjects} isReadonly={false} />
    </Box>
  );
}
