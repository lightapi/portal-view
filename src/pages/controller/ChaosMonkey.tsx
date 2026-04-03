import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useController } from '../../contexts/ControllerContext';

type AssaultConfig = Record<string, any>;

type ChaosConfigResponse = {
  supported?: boolean;
  message?: string;
  exception?: AssaultConfig;
  killapp?: AssaultConfig;
  latency?: AssaultConfig;
  memory?: AssaultConfig;
};

type ChaosNode = {
  runtimeInstanceId?: string;
  apiName?: string;
  address?: string;
  ipAddress?: string;
  port?: number;
  portNumber?: number;
};

function cloneConfig<T extends AssaultConfig>(value: T | undefined): T {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function readNumber(value: any, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function renderBaseFields(
  draft: AssaultConfig,
  setDraft: React.Dispatch<React.SetStateAction<AssaultConfig>>,
) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(draft.enabled)}
            onChange={(event) =>
              setDraft((current) => ({ ...current, enabled: event.target.checked }))
            }
          />
        }
        label="Enabled"
      />
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(draft.bypass)}
            onChange={(event) =>
              setDraft((current) => ({ ...current, bypass: event.target.checked }))
            }
          />
        }
        label="Bypass"
      />
      <TextField
        label="Level"
        type="number"
        value={readNumber(draft.level, 10)}
        onChange={(event) =>
          setDraft((current) => ({ ...current, level: Number(event.target.value) }))
        }
        sx={{ maxWidth: 220 }}
      />
    </Stack>
  );
}

export default function ChaosMonkey() {
  const navigate = useNavigate();
  const location = useLocation();
  const { callTool } = useController();
  const stateData = (location.state as any)?.data || {};
  const node: ChaosNode = stateData.node || stateData;
  const runtimeInstanceId = node.runtimeInstanceId;

  const [tabIndex, setTabIndex] = useState(0);
  const [config, setConfig] = useState<ChaosConfigResponse>({});
  const [draft, setDraft] = useState<AssaultConfig>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const chaosSupported = config.supported !== false;

  const fetchConfig = async () => {
    if (!runtimeInstanceId) {
      setLoading(false);
      setError('No runtime instance ID found. Please navigate from the Control Pane.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await callTool('get_chaos_monkey_config', { runtimeInstanceId });
      setConfig(result ?? {});
    } catch (err: any) {
      setError(err?.message ?? JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [runtimeInstanceId]);

  const tabs = useMemo(
    () => [
      { key: 'overview', label: 'Overview' },
      { key: 'latency', label: 'Latency' },
      { key: 'exception', label: 'Exception' },
      { key: 'memory', label: 'Memory' },
      { key: 'killapp', label: 'Kill App' },
    ],
    [],
  );

  const activeTab = tabs[tabIndex]?.key ?? 'overview';

  useEffect(() => {
    if (activeTab === 'overview') {
      setDraft({});
      return;
    }
    setDraft(cloneConfig(config[activeTab as keyof ChaosConfigResponse]));
  }, [activeTab, config]);

  const handleReset = () => {
    if (activeTab === 'overview') {
      return;
    }
    setDraft(cloneConfig(config[activeTab as keyof ChaosConfigResponse]));
    setSuccess(null);
    setError(null);
  };

  const handleApply = async () => {
    if (!runtimeInstanceId || activeTab === 'overview' || !chaosSupported) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await callTool('configure_chaos_monkey', {
        runtimeInstanceId,
        assaultType: activeTab,
        config: draft,
      });
      setSuccess('Chaos monkey configuration updated');
      await fetchConfig();
    } catch (err: any) {
      setError(err?.message ?? JSON.stringify(err));
    } finally {
      setSubmitting(false);
    }
  };

  const serviceLabel = node.apiName || 'Chaos Monkey';
  const addressLabel = node.address || node.ipAddress || 'unknown';
  const portLabel = node.port || node.portNumber || 'unknown';

  const renderOverview = () => {
    const sections = [
      { label: 'Latency', value: config.latency },
      { label: 'Exception', value: config.exception },
      { label: 'Memory', value: config.memory },
      { label: 'Kill App', value: config.killapp },
    ];
    return (
      <Stack spacing={2}>
        {sections.map((section) => (
          <Paper key={section.label} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">{section.label}</Typography>
            <Box component="pre" sx={{ mb: 0, mt: 1, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(section.value ?? {}, null, 2)}
            </Box>
          </Paper>
        ))}
      </Stack>
    );
  };

  const renderTabForm = () => {
    if (activeTab === 'overview') {
      return renderOverview();
    }

    if (!chaosSupported) {
      return (
        <Alert severity="warning">
          {config.message ?? 'Chaos monkey is not available on this service.'}
        </Alert>
      );
    }

    return (
      <Stack spacing={2}>
        {renderBaseFields(draft, setDraft)}

        {activeTab === 'latency' && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Latency Range Start"
              type="number"
              value={readNumber(draft.latencyRangeStart, 1000)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  latencyRangeStart: Number(event.target.value),
                }))
              }
            />
            <TextField
              label="Latency Range End"
              type="number"
              value={readNumber(draft.latencyRangeEnd, 3000)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  latencyRangeEnd: Number(event.target.value),
                }))
              }
            />
          </Stack>
        )}

        {activeTab === 'memory' && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
            <TextField
              label="Hold Filled Memory (ms)"
              type="number"
              value={readNumber(draft.memoryMillisecondsHoldFilledMemory, 90000)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  memoryMillisecondsHoldFilledMemory: Number(event.target.value),
                }))
              }
            />
            <TextField
              label="Wait Next Increase (ms)"
              type="number"
              value={readNumber(draft.memoryMillisecondsWaitNextIncrease, 1000)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  memoryMillisecondsWaitNextIncrease: Number(event.target.value),
                }))
              }
            />
            <TextField
              label="Fill Increment Fraction"
              type="number"
              inputProps={{ step: '0.01' }}
              value={draft.memoryFillIncrementFraction ?? 0.15}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  memoryFillIncrementFraction: Number(event.target.value),
                }))
              }
            />
            <TextField
              label="Fill Target Fraction"
              type="number"
              inputProps={{ step: '0.01' }}
              value={draft.memoryFillTargetFraction ?? 0.25}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  memoryFillTargetFraction: Number(event.target.value),
                }))
              }
            />
          </Stack>
        )}

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={handleReset} disabled={submitting}>
            Reset
          </Button>
          <Button variant="contained" onClick={handleApply} disabled={submitting || !chaosSupported}>
            {submitting ? <CircularProgress size={20} /> : 'Apply'}
          </Button>
        </Stack>
      </Stack>
    );
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h5">{serviceLabel}</Typography>
              <Typography variant="body2" color="text.secondary">
                Runtime Instance: {runtimeInstanceId}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Endpoint: {addressLabel}:{portLabel}
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Back
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined">
          <Tabs value={tabIndex} onChange={(_, value) => setTabIndex(value)}>
            {tabs.map((tab) => (
              <Tab key={tab.key} label={tab.label} />
            ))}
          </Tabs>
          <Divider />
          <Box sx={{ p: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={2}>
                {error && <Alert severity="error">{error}</Alert>}
                {success && <Alert severity="success">{success}</Alert>}
                {!chaosSupported && activeTab === 'overview' && (
                  <Alert severity="warning">
                    {config.message ?? 'Chaos monkey is not available on this service.'}
                  </Alert>
                )}
                {renderTabForm()}
              </Stack>
            )}
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}
