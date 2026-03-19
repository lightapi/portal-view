import React, { useState } from 'react';
import { Box, TextField, Button, CssBaseline, Paper, Grid, FormControlLabel, FormGroup, Switch, Typography } from '@mui/material';
import fetchClient from '../../../utils/fetchClient';
import ChaosInfoPopper from './ChaosInfoPopper';

interface LatencyFormProps {
  formType: string;
  address: string;
  port: string | number;
  protocol: string;
  baseUrl: string;
  config: {
    enabled: boolean;
    bypass: boolean;
    level: number;
    latencyRangeStart: number;
    latencyRangeEnd: number;
    [key: string]: any;
  };
}

export default function LatencyForm(props: LatencyFormProps) {
  const { formType, address, port, protocol, config, baseUrl } = props;
  const assaultType = 'com.networknt.chaos.LatencyAssaultHandler';

  const [endpoint, setEndpoint] = useState('');
  const [requests, setRequests] = useState('');

  const [enabled, setEnabled] = useState(config.enabled);
  const [bypass, setBypass] = useState(config.bypass);
  const [level, setLevel] = useState(config.level);
  const [latencyRangeStart, setLatencyRangeStart] = useState(config.latencyRangeStart);
  const [latencyRangeEnd, setLatencyRangeEnd] = useState(config.latencyRangeEnd);

  const handleLatencySubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const headers = {
      Authorization: 'Basic ' + localStorage.getItem('user'),
    };
    let url = '';
    let body = '';
    if (formType === 'initAssault') {
      url = baseUrl + '/services/chaosmonkey/assault';
      body = JSON.stringify({
        protocol,
        address,
        assaultType,
        port,
        endpoint,
        requests,
      });
    } else if (formType === 'configAssault') {
      url = baseUrl + '/services/chaosmonkey';
      body = JSON.stringify({
        protocol,
        port,
        address,
        assaultType,
        assaultConfig: {
          enabled,
          bypass,
          level,
          latencyRangeStart,
          latencyRangeEnd,
        },
      });
    }

    if (url) {
      fetchClient(url, {
        method: 'POST',
        body,
        headers,
      }).then(() => {
        window.location.reload();
      }).catch((err) => {
        console.error(err);
      });
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
        onSubmit={handleLatencySubmit}
        sx={{ width: '100%', mt: 1 }}
      >
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center" justifyContent="center">
            <Grid size={12}>
              <Typography variant="h4" component="h1" align="left" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                Latency Assault {formTitle} Form
                <ChaosInfoPopper
                  formType={formType}
                  handlerName="Latency Assault Handler"
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
                    label="endpoint"
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    type="number"
                    onChange={(e) => setRequests(e.target.value)}
                    fullWidth
                    variant="outlined"
                    label="requests"
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
                <Grid size={4}>
                  <TextField
                    variant="filled"
                    label="protocol"
                    fullWidth
                    value={protocol}
                    disabled
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid size={4}>
                  <TextField
                    variant="filled"
                    label="address"
                    fullWidth
                    disabled
                    value={address}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid size={4}>
                  <TextField
                    variant="filled"
                    label="port"
                    fullWidth
                    disabled
                    value={port}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </>
            ) : (
              // Configuration Form
              <>
                <Grid size={12}>
                  <FormGroup row>
                    <FormControlLabel
                      control={
                        <Switch
                          onChange={(e) => setEnabled(e.target.checked)}
                          defaultChecked={config.enabled}
                          color="primary"
                        />
                      }
                      label="Enabled"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          onChange={(e) => setBypass(e.target.checked)}
                          defaultChecked={config.bypass}
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
                    fullWidth
                    required
                    onChange={(e) => setLevel(Number(e.target.value))}
                    defaultValue={config.level}
                    label="Level"
                  />
                </Grid>
                <Grid size={4}>
                  <TextField
                    type="number"
                    variant="outlined"
                    fullWidth
                    defaultValue={config.latencyRangeStart}
                    onChange={(e) => setLatencyRangeStart(Number(e.target.value))}
                    required
                    label="latencyRangeStart"
                  />
                </Grid>
                <Grid size={4}>
                  <TextField
                    type="number"
                    variant="outlined"
                    fullWidth
                    onChange={(e) => setLatencyRangeEnd(Number(e.target.value))}
                    defaultValue={config.latencyRangeEnd}
                    required
                    label="latencyRangeEnd"
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    variant="filled"
                    fullWidth
                    label="assaultType"
                    defaultValue={assaultType}
                    disabled
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid size={4}>
                  <TextField
                    variant="filled"
                    label="protocol"
                    fullWidth
                    disabled
                    value={protocol}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid size={4}>
                  <TextField
                    variant="filled"
                    label="address"
                    fullWidth
                    disabled
                    value={address}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid size={4}>
                  <TextField
                    variant="filled"
                    label="port"
                    disabled
                    fullWidth
                    value={port}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </>
            )}

            <Grid size={3}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                sx={{ mt: 3, mb: 2 }}
              >
                Go
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Box>
  );
}
