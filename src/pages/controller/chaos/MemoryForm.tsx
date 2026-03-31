import React, { useState } from 'react';
import { Box, TextField, Button, CssBaseline, Paper, Grid, FormControlLabel, FormGroup, Switch, Typography, CircularProgress } from '@mui/material';
import { useController } from '../../../contexts/ControllerContext';
import ChaosInfoPopper from './ChaosInfoPopper';

interface MemoryFormProps {
  formType: string;
  runtimeInstanceId: string;
  config: {
    enabled: boolean;
    bypass: boolean;
    level: number;
    memoryFillIncrement?: number;
    memoryFillInitialDelay?: number;
    [key: string]: any;
  };
}

export default function MemoryForm(props: MemoryFormProps) {
  const { formType, runtimeInstanceId, config } = props;
  const assaultType = 'com.networknt.chaos.MemoryAssaultHandler';
  const { callTool } = useController();

  const [endpoint, setEndpoint] = useState('');
  const [requests, setRequests] = useState('');

  const [enabled, setEnabled] = useState(config.enabled ?? false);
  const [bypass, setBypass] = useState(config.bypass ?? false);
  const [level, setLevel] = useState(config.level ?? 5);
  const [memoryFillIncrement, setMemoryFillIncrement] = useState(config.memoryFillIncrement ?? 0.2);
  const [memoryFillInitialDelay, setMemoryFillInitialDelay] = useState(config.memoryFillInitialDelay ?? 1000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<any>(null);

  const handleMemorySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (formType === 'initAssault') {
        await callTool('run_chaos_monkey_assault', {
          runtimeInstanceId,
          assaultType,
        });
      } else if (formType === 'configAssault') {
        await callTool('configure_chaos_monkey', {
          runtimeInstanceId,
          assaultType,
          config: {
            enabled,
            bypass,
            level,
            memoryFillIncrement,
            memoryFillInitialDelay,
          },
        });
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!assaultType || !formType) return null;

  const formTitle = formType === 'initAssault' ? 'Trigger' : 'Configuration';

  return (
    <Box>
      <CssBaseline />
      <Box
        component="form"
        noValidate
        onSubmit={handleMemorySubmit}
        sx={{ width: '100%', mt: 1 }}
      >
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center" justifyContent="center">
            <Grid size={12}>
              <Typography variant="h4" component="h1" align="left" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                Memory Assault {formTitle} Form
                <ChaosInfoPopper
                  formType={formType}
                  handlerName="Memory Assault Handler"
                />
              </Typography>
            </Grid>

            {formType === 'initAssault' ? (
              <>
                <Grid size={6}>
                  <TextField
                    fullWidth
                    onChange={(e) => setEndpoint(e.target.value)}
                    variant="outlined"
                    label="endpoint (Optional)"
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    type="number"
                    onChange={(e) => setRequests(e.target.value)}
                    fullWidth
                    variant="outlined"
                    label="requests (Optional)"
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    variant="filled"
                    fullWidth
                    label="assaultType"
                    disabled
                    value={assaultType}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </>
            ) : (
              // Configuration Form
              <>
                <Grid size={8}>
                  <FormGroup row>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={enabled}
                          onChange={(e) => setEnabled(e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Enabled"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={bypass}
                          onChange={(e) => setBypass(e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Bypass"
                    />
                  </FormGroup>
                </Grid>
                <Grid size={4}>
                  <TextField
                    type="number"
                    variant="outlined"
                    onChange={(e) => setLevel(Number(e.target.value))}
                    fullWidth
                    value={level}
                    required
                    label="Level"
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    type="number"
                    variant="outlined"
                    onChange={(e) => setMemoryFillIncrement(Number(e.target.value))}
                    fullWidth
                    value={memoryFillIncrement}
                    required
                    label="Memory Fill Increment"
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    type="number"
                    variant="outlined"
                    onChange={(e) => setMemoryFillInitialDelay(Number(e.target.value))}
                    fullWidth
                    value={memoryFillInitialDelay}
                    required
                    label="Memory Fill Initial Delay"
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    variant="filled"
                    fullWidth
                    label="assaultType"
                    value={assaultType}
                    disabled
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </>
            )}

            {error && (
              <Grid size={12}>
                <Typography color="error">{error?.message || JSON.stringify(error)}</Typography>
              </Grid>
            )}

            <Grid size={3}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                disabled={submitting}
                sx={{ mt: 3, mb: 2 }}
              >
                {submitting ? <CircularProgress size={24} color="inherit" /> : 'Go'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Box>
  );
}
