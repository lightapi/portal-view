import { CircularProgress, Box, Typography } from '@mui/material';
import React from 'react';
import { useApiGet } from '../../hooks/useApiGet';
import StatusContainer from './StatusContainer';

// This is for other users to view the current readonly status by userId regardless if he/she logs in

interface PeerStatusProps {
  userId: string;
  [key: string]: any;
}

export default function PeerStatus(props: PeerStatusProps) {
  const cmd = {
    host: 'lightapi.net',
    service: 'covid',
    action: 'getStatusByUserId',
    version: '0.1.0',
    data: { userId: props.userId },
  };

  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};

  const { isLoading, data, error } = useApiGet({ url, headers });
  const subjects = data || {};

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, color: 'error.main' }}>
        <Typography variant="h6">Error loading peer status:</Typography>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </Box>
    );
  }

  return (
    <Box>
      <StatusContainer {...props} subjects={subjects} isReadonly={true} />
    </Box>
  );
}
