import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import {publicationScope, type PublishableTool} from './gatewayToolPublicationScope';

type GatewayInstance = {
  instanceId: string;
  instanceName?: string;
  environment?: string;
  envTag?: string;
  serviceId?: string;
  productId?: string;
};

type ChangeSummary = {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  total: number;
};

type Candidate = {
  candidateDigest: string;
  expectedPublicationVersion: number;
  publicationVersion: number;
  changeSummary: ChangeSummary;
};

const rpc = (action: string, data: Record<string, unknown>) => ({
  host: 'lightapi.net', service: 'genai', action, version: '0.1.0', data,
});

function queryUrl(action: string, data: Record<string, unknown>) {
  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(rpc(action, data)));
}

function errorMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === 'object') {
    const value = reason as Record<string, unknown>;
    return String(value.message ?? value.description ?? value.statusMessage ?? 'Publication failed');
  }
  return String(reason || 'Publication failed');
}

export default function GatewayToolPublicationDialog({
  open, hostId, preferredInstanceId, tools, onClose,
}: {
  open: boolean;
  hostId: string;
  preferredInstanceId?: string;
  tools: PublishableTool[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<GatewayInstance[]>([]);
  const [instanceId, setInstanceId] = useState('');
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{severity: 'success' | 'error' | 'info'; text: string} | null>(null);
  const scope = useMemo(() => publicationScope(tools), [tools]);
  const selectedInstance = instances.find(instance => instance.instanceId === instanceId);

  const loadInstances = useCallback(async () => {
    if (!open || !hostId) return;
    setLoading(true);
    try {
      const value = await fetchClient(queryUrl('getInstance', {
        hostId, offset: 0, limit: 1000, active: true,
        sorting: JSON.stringify([{id: 'instanceName', desc: false}]),
        filters: JSON.stringify([{id: 'productId', value: 'gtw'}]),
        globalFilter: '',
      }));
      const result = (Array.isArray(value?.instances) ? value.instances : [])
        .filter((instance: GatewayInstance) => String(instance.productId ?? '').toLowerCase() === 'gtw');
      setInstances(result);
      setInstanceId(previous => result.some((instance: GatewayInstance) => instance.instanceId === previous)
        ? previous
        : result.some((instance: GatewayInstance) => instance.instanceId === preferredInstanceId)
          ? String(preferredInstanceId)
          : String(result[0]?.instanceId ?? ''));
    } catch (reason) {
      setInstances([]);
      setMessage({severity: 'error', text: errorMessage(reason)});
    } finally {
      setLoading(false);
    }
  }, [hostId, open, preferredInstanceId]);

  useEffect(() => {
    if (!open) return;
    setCandidate(null);
    setMessage(null);
    void loadInstances();
  }, [loadInstances, open, tools]);

  const preview = async () => {
    if (!instanceId) return;
    setLoading(true);
    setCandidate(null);
    setMessage(null);
    try {
      const value = await fetchClient(queryUrl('getGatewayToolPublicationCandidate', {
        hostId, instanceId, mode: scope.mode, toolIds: tools.map(tool => tool.toolId),
        ...(scope.apiVersionId ? {apiVersionId: scope.apiVersionId} : {}),
      }));
      setCandidate(value as Candidate);
      setMessage({
        severity: 'info',
        text: 'This preview stages desired configuration only. The live gateway changes after an Instance Admin creates and activates a config snapshot.',
      });
    } catch (reason) {
      setMessage({severity: 'error', text: errorMessage(reason)});
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    if (!candidate || !instanceId) return;
    setLoading(true);
    setMessage(null);
    const result = await apiPost({
      url: '/portal/command', headers: {}, body: rpc('publishGatewayTools', {
        hostId, instanceId, mode: scope.mode, toolIds: tools.map(tool => tool.toolId),
        ...(scope.apiVersionId ? {apiVersionId: scope.apiVersionId} : {}),
        expectedCandidateDigest: candidate.candidateDigest,
        expectedPublicationVersion: candidate.expectedPublicationVersion,
      }),
    });
    if (result.error) {
      setMessage({severity: 'error', text: errorMessage(result.error)});
    } else {
      setCandidate(null);
      setMessage({
        severity: 'success',
        text: `Version ${candidate.publicationVersion} was staged for ${selectedInstance?.instanceName ?? instanceId}. Create and activate a config snapshot to deploy it.`,
      });
    }
    setLoading(false);
  };

  const summary = candidate?.changeSummary;
  return <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="md" fullWidth>
    <DialogTitle>Publish selected Tools to a Gateway</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{pt: 1}}>
        <Alert severity="info">
          Publication writes the instance-level <code>mcp-router.tools</code> desired state. It does not move the current snapshot or change the live Gateway.
        </Alert>
        <TextField select label="Gateway instance" value={instanceId}
          onChange={event => { setInstanceId(event.target.value); setCandidate(null); setMessage(null); }}
          disabled={loading || !instances.length}>
          {instances.map(instance => <MenuItem key={instance.instanceId} value={instance.instanceId}>
            {instance.instanceName ?? instance.serviceId ?? instance.instanceId}
            {instance.environment ? ` · ${instance.environment}` : ''}
            {instance.envTag ? ` · ${instance.envTag}` : ''}
          </MenuItem>)}
        </TextField>
        {!instances.length && !loading && <Alert severity="warning">No active light-gateway instance is available for this host.</Alert>}
        <Box>
          <Typography variant="subtitle2" gutterBottom>{tools.length} selected {tools.length === 1 ? 'Tool' : 'Tools'}</Typography>
          <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
            {tools.map(tool => <Chip key={tool.toolId} size="small"
              label={`${tool.name}${tool.apiName ? ` · ${tool.apiName} ${tool.apiVersion ?? ''}` : ''}`} />)}
          </Stack>
        </Box>
        <Typography color="text.secondary">
          {scope.mode === 'REPLACE_API_SCOPE'
            ? 'API-scope publication: the selected API version endpoints replace that API version on the target; unrelated API and workflow Tools are preserved.'
            : 'Add/update publication: selected Tools are merged into the target; unrelated Tools are preserved.'}
        </Typography>
        {message && <Alert severity={message.severity}>{message.text}</Alert>}
        {summary && <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
          <Chip color="success" label={`${summary.added} added`} />
          <Chip color="info" label={`${summary.updated} updated`} />
          <Chip color="warning" label={`${summary.removed} removed`} />
          <Chip label={`${summary.unchanged} unchanged`} />
          <Chip variant="outlined" label={`${summary.total} total after publication`} />
        </Stack>}
        {message?.severity === 'success' && <Button variant="outlined" onClick={() => {
          onClose();
          navigate('/app/config/configSnapshot', {state: {data: {instanceId}}});
        }}>Open config snapshots</Button>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={loading}>Close</Button>
      <Button variant="outlined" onClick={() => void preview()} disabled={loading || !instanceId || !tools.length}>
        {loading && !candidate ? <CircularProgress size={20} /> : 'Preview changes'}
      </Button>
      <Button variant="contained" onClick={() => void publish()} disabled={loading || !candidate}>
        {loading && candidate ? <CircularProgress size={20} /> : 'Stage publication'}
      </Button>
    </DialogActions>
  </Dialog>;
}
