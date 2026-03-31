import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import { Box, Typography, Paper } from '@mui/material';
import { useController } from '../../contexts/ControllerContext';

export default function ServerInfo() {
  const { state } = useLocation();
  const { runtimeInstanceId } = state?.data || {};
  const { callTool } = useController();

  const [info, setInfo] = useState<any>();
  const [error, setError] = useState<any>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runtimeInstanceId) {
      setError('No runtime instance ID provided');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await callTool('get_service_info', { runtimeInstanceId });
        setInfo(result);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [runtimeInstanceId, callTool]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>Server Info</Typography>
      <Typography variant="subtitle1" color="textSecondary" gutterBottom>Instance ID: {runtimeInstanceId}</Typography>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5', overflowX: 'auto' }}>
        <pre>{info ? JSON.stringify(info, null, 2) : (error?.message || JSON.stringify(error))}</pre>
      </Paper>
    </Box>
  );
}
