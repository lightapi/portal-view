import CircularProgress from '@mui/material/CircularProgress';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useController } from '../../contexts/ControllerContext';
import ChaosFormSettings from './chaos/ChaosFormSettings';
import ExceptionForm from './chaos/ExceptionForm';
import KillAppForm from './chaos/KillAppForm';
import LatencyForm from './chaos/LatencyForm';
import MemoryForm from './chaos/MemoryForm';
import { Box, Typography } from '@mui/material';

export default function ChaosMonkey() {
  const { state } = useLocation();
  const { runtimeInstanceId } = state?.data || {};
  const { callTool } = useController();

  const chaosFormTypes = ['initAssault', 'configAssault'];
  const chaosFormTypeDisplays = ['Initiate Assault', 'Configure Assault'];

  const chaosAssaultTypes = ['killApp', 'exception', 'memory', 'latency'];
  const chaosAssaultTypeDisplays = [
    'KillApp Assault Handler',
    'Exception Assault Handler',
    'Memory Assault Handler',
    'Latency Assault Handler',
  ];

  const [chaosFormType, setChaosMonkeyFormType] = useState('configAssault');
  const [chaosAssaultType, setChaosMonkeyAssaultType] = useState('killApp');

  const [chaosMonkeyGetData, setChaosMonkeyGetData] = useState<any>(null);

  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const handleAssaultChange = (newVal: string) => {
    setChaosMonkeyAssaultType(newVal);
  };

  const handleFormTypeChange = (newVal: string) => {
    setChaosMonkeyFormType(newVal);
  };

  useEffect(() => {
    if (!runtimeInstanceId) {
      setError('No runtime instance ID provided');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await callTool('get_chaos_monkey', { runtimeInstanceId });
        setChaosMonkeyGetData(result);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [runtimeInstanceId, callTool]);

  let activeForm;
  if (!loading && chaosMonkeyGetData) {
    const commonProps = {
      runtimeInstanceId,
      formType: chaosFormType,
      config: {}, // Placeholder, will be set below
    };

    if (chaosAssaultType === 'killApp') {
      activeForm = (
        <KillAppForm
          {...commonProps}
          config={chaosMonkeyGetData['com.networknt.chaos.KillappAssaultHandler'] || {}}
        />
      );
    } else if (chaosAssaultType === 'exception') {
      activeForm = (
        <ExceptionForm
          {...commonProps}
          config={chaosMonkeyGetData['com.networknt.chaos.ExceptionAssaultHandler'] || {}}
        />
      );
    } else if (chaosAssaultType === 'memory') {
      activeForm = (
        <MemoryForm
          {...commonProps}
          config={chaosMonkeyGetData['com.networknt.chaos.MemoryAssaultHandler'] || {}}
        />
      );
    } else if (chaosAssaultType === 'latency') {
      activeForm = (
        <LatencyForm
          {...commonProps}
          config={chaosMonkeyGetData['com.networknt.chaos.LatencyAssaultHandler'] || {}}
        />
      );
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  } else if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">Error loading Chaos Monkey config:</Typography>
        <pre>{error?.message || JSON.stringify(error, null, 2)}</pre>
      </Box>
    );
  } else {
    return (
      <Paper style={{ padding: 16, margin: 16 }}>
        <Typography variant="h5" gutterBottom>Chaos Monkey Configuration</Typography>
        <Typography variant="subtitle2" color="textSecondary" gutterBottom>Instance: {runtimeInstanceId}</Typography>
        <Grid
          container
          alignItems="center"
          justifyContent="center"
          spacing={2}
          direction="row"
          sx={{ mt: 1 }}
        >
          <CssBaseline />
          <Grid size={6}>
            <ChaosFormSettings
              label="Assault Type"
              options={chaosAssaultTypes}
              optionDisplays={chaosAssaultTypeDisplays}
              value={chaosAssaultType}
              onChange={handleAssaultChange}
            />
          </Grid>
          <Grid size={6}>
            <ChaosFormSettings
              label="Form Type"
              options={chaosFormTypes}
              optionDisplays={chaosFormTypeDisplays}
              value={chaosFormType}
              onChange={handleFormTypeChange}
            />
          </Grid>
          <Grid size={12}>
            {activeForm}
          </Grid>
        </Grid>
      </Paper>
    );
  }
}
