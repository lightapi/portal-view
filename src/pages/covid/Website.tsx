import { CircularProgress, Box, Typography } from '@mui/material';
import React from 'react';
import ComRender from '../../ComRender';
import { useApiGet } from '../../hooks/useApiGet';

interface WebsiteProps {
  userId: string;
  [key: string]: any;
}

export default function Website(props: WebsiteProps) {
  const cmd = {
    host: 'lightapi.net',
    service: 'covid',
    action: 'getWebsiteByUserId',
    version: '0.1.0',
    data: { userId: props.userId },
  };

  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};

  const { isLoading, data, error } = useApiGet({ url, headers });
  const site = data || {};

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
        <Typography variant="h6">Error loading website:</Typography>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </Box>
    );
  }

  return (
    <Box>
      <ComRender {...props} site={site} />
    </Box>
  );
}
