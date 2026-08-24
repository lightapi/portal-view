import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox,
  Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import {publicationScope, type PublishableTool} from './gatewayToolPublicationScope';
import {gatewayToolQueryUrl, gatewayToolRpc} from './gatewayToolPublicationRpc';

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
  accessPolicies?: AccessPolicy[];
  accessReadiness?: Array<{toolId: string; endpointKey: string; state: string}>;
  propertyComparisons?: Array<{property: string; action: string; currentValue: unknown; proposedValue: unknown}>;
};

type AccessPolicy = {
  toolId: string;
  accessMode: 'PROTECTED' | 'PUBLIC';
  ruleIds: string[];
  responseRuleIds: string[];
  permissions: {
    roles: string[];
    groups: string[];
    positions: string[];
    users: string[];
    attributes: Array<{attributeId: string; attributeValue: string}>;
  };
  rowFilters: Array<{
    filterId?: string;
    principalType: string;
    principalId: string;
    principalValue?: string;
    colName: string;
    operator: string;
    colValue: string;
  }>;
  columnFilters: Array<{
    filterId?: string;
    principalType: string;
    principalId: string;
    principalValue?: string;
    columns: string[];
  }>;
  responseTarget?: string;
  publicReason?: string;
};

const emptyPolicy = (toolId: string): AccessPolicy => ({
  toolId, accessMode: 'PROTECTED', ruleIds: [], responseRuleIds: [],
  permissions: {roles: [], groups: [], positions: [], users: [], attributes: []},
  rowFilters: [], columnFilters: [], responseTarget: '',
});
const normalizePolicy = (policy: AccessPolicy): AccessPolicy => ({
  ...emptyPolicy(policy.toolId), ...policy,
  ruleIds: policy.ruleIds ?? [],
  responseRuleIds: policy.responseRuleIds ?? [],
  permissions: {...emptyPolicy(policy.toolId).permissions, ...(policy.permissions ?? {})},
  rowFilters: policy.rowFilters ?? [],
  columnFilters: policy.columnFilters ?? [],
});

const splitValues = (value: string) => value.split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
const attributeValues = (value: string) => splitValues(value).map(item => {
  const separator = item.indexOf('=');
  if (separator <= 0 || separator === item.length - 1) throw new Error('Attributes must use attributeId=value.');
  return {attributeId: item.slice(0, separator), attributeValue: item.slice(separator + 1)};
});

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
  const [policies, setPolicies] = useState<Record<string, AccessPolicy>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{severity: 'success' | 'error' | 'info'; text: string} | null>(null);
  const scope = useMemo(() => publicationScope(tools), [tools]);
  const selectedInstance = instances.find(instance => instance.instanceId === instanceId);

  const loadInstances = useCallback(async () => {
    if (!open || !hostId) return;
    setLoading(true);
    try {
      const value = await fetchClient(gatewayToolQueryUrl('instance', 'getInstance', {
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
    setConfirmed(false);
    setPolicies({});
    setMessage(null);
    void loadInstances();
  }, [loadInstances, open, tools]);

  const preview = async () => {
    if (!instanceId) return;
    setLoading(true);
    setCandidate(null);
    setMessage(null);
    try {
      const value = await fetchClient(gatewayToolQueryUrl('genai', 'getGatewayToolPublicationCandidate', {
        hostId, instanceId, mode: scope.mode, toolIds: tools.map(tool => tool.toolId),
        accessPolicies: tools.flatMap(tool => policies[tool.toolId] ? [policies[tool.toolId]] : []),
        ...(scope.apiVersionId ? {apiVersionId: scope.apiVersionId} : {}),
      }));
      const previewed = (value as Candidate).accessPolicies ?? [];
      const previewById = Object.fromEntries(previewed.map(policy => [policy.toolId, normalizePolicy(policy)]));
      const missingPolicy = tools.some(tool => !previewById[tool.toolId] && !policies[tool.toolId]);
      setPolicies(previous => ({...previous, ...previewById, ...Object.fromEntries(
        tools.filter(tool => !previewById[tool.toolId] && !previous[tool.toolId])
          .map(tool => [tool.toolId, emptyPolicy(tool.toolId)]))}));
      setCandidate(missingPolicy ? null : value as Candidate);
      setConfirmed(false);
      setMessage({
        severity: missingPolicy ? 'info' : 'info',
        text: missingPolicy
          ? 'Access defaults were loaded for newly published Tools. Configure them and preview again.'
          : 'This preview stages desired configuration only. The live gateway changes after an Instance Admin creates and activates a config snapshot.',
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
      url: '/portal/command', headers: {}, body: gatewayToolRpc('genai', 'publishGatewayTools', {
        hostId, instanceId, mode: scope.mode, toolIds: tools.map(tool => tool.toolId),
        accessPolicies: tools.flatMap(tool => policies[tool.toolId] ? [policies[tool.toolId]] : []),
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
        <Typography variant="h6">Access Control</Typography>
        <Alert severity="warning">
          Protected Tools without a request rule remain hidden and fail closed. Public access uses the compiler-owned allow-public-access rule and still follows MCP route authentication.
        </Alert>
        {tools.map(tool => {
          const policy = policies[tool.toolId] ?? emptyPolicy(tool.toolId);
          const update = (next: AccessPolicy) => {
            setPolicies(previous => ({...previous, [tool.toolId]: next}));
            setCandidate(null); setConfirmed(false);
          };
          return <Box key={tool.toolId} sx={{border: 1, borderColor: 'divider', borderRadius: 1, p: 2}}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">{tool.name}</Typography>
              <TextField select label="Access mode" value={policy.accessMode}
                onChange={event => update({...policy, accessMode: event.target.value as AccessPolicy['accessMode'],
                  ruleIds: [],
                  permissions: event.target.value === 'PUBLIC'
                    ? {roles: [], groups: [], positions: [], users: [], attributes: []} : policy.permissions,
                })}>
                <MenuItem value="PROTECTED">Protected</MenuItem>
                <MenuItem value="PUBLIC">Public</MenuItem>
              </TextField>
              {policy.accessMode === 'PROTECTED' ? <>
                <TextField label="Request rule IDs" value={policy.ruleIds.join(', ')}
                  helperText="Comma or space separated. An empty selection deliberately leaves the Tool unconfigured and denied."
                  onChange={event => update({...policy, ruleIds: splitValues(event.target.value)})} />
                {(['roles', 'groups', 'positions', 'users'] as const).map(dimension =>
                  <TextField key={dimension} label={`Allowed ${dimension}`} value={policy.permissions[dimension].join(', ')}
                    onChange={event => update({...policy, permissions: {...policy.permissions,
                      [dimension]: splitValues(event.target.value)}})} />)}
                <TextField key={`attributes-${JSON.stringify(policy.permissions.attributes)}`}
                  label="Allowed attributes" defaultValue={policy.permissions.attributes
                    .map(attribute => `${attribute.attributeId}=${attribute.attributeValue}`).join(', ')}
                  helperText="Comma or space separated attributeId=value pairs."
                  onBlur={event => {
                    try {
                      update({...policy, permissions: {...policy.permissions,
                        attributes: attributeValues(event.target.value)}});
                    } catch (reason) {
                      setMessage({severity: 'error', text: errorMessage(reason)});
                    }
                  }} />
              </> : <TextField required label="Public access approval reason" value={policy.publicReason ?? ''}
                onChange={event => update({...policy, publicReason: event.target.value})} />}
              <TextField label="Response filter rule IDs" value={policy.responseRuleIds.join(', ')}
                helperText="Comma or space separated res-fil rules. Required when row or column filters are configured."
                onChange={event => update({...policy, responseRuleIds: splitValues(event.target.value)})} />
              <TextField key={`rows-${JSON.stringify(policy.rowFilters)}`}
                  label="Row filters" multiline minRows={3}
                  defaultValue={JSON.stringify(policy.rowFilters, null, 2)}
                  helperText='JSON array. Each item requires principalType, principalId, colName, operator, and colValue.'
                  onBlur={event => {
                    try {
                      const value = JSON.parse(event.target.value || '[]');
                      if (!Array.isArray(value)) throw new Error('Row filters must be a JSON array.');
                      update({...policy, rowFilters: value});
                    } catch (reason) {
                      setMessage({severity: 'error', text: errorMessage(reason)});
                    }
                  }} />
                <TextField key={`columns-${JSON.stringify(policy.columnFilters)}`}
                  label="Column filters" multiline minRows={3}
                  defaultValue={JSON.stringify(policy.columnFilters, null, 2)}
                  helperText='JSON array. Each item requires principalType, principalId, and columns.'
                  onBlur={event => {
                    try {
                      const value = JSON.parse(event.target.value || '[]');
                      if (!Array.isArray(value)) throw new Error('Column filters must be a JSON array.');
                      update({...policy, columnFilters: value});
                    } catch (reason) {
                      setMessage({severity: 'error', text: errorMessage(reason)});
                    }
                  }} />
              <TextField label="Nested structuredContent JSON Pointer" value={policy.responseTarget ?? ''}
                placeholder="/data/accounts" helperText="Optional; at most 16 segments and 1024 characters."
                onChange={event => update({...policy, responseTarget: event.target.value})} />
            </Stack>
          </Box>;
        })}
        {message && <Alert severity={message.severity}>{message.text}</Alert>}
        {summary && <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
          <Chip color="success" label={`${summary.added} added`} />
          <Chip color="info" label={`${summary.updated} updated`} />
          <Chip color="warning" label={`${summary.removed} removed`} />
          <Chip label={`${summary.unchanged} unchanged`} />
          <Chip variant="outlined" label={`${summary.total} total after publication`} />
        </Stack>}
        {candidate?.accessReadiness?.map(item => <Alert key={item.toolId} severity={item.state === 'PUBLISHABLE' ? 'success' : 'warning'}>
          {item.endpointKey}: {item.state}
        </Alert>)}
        {candidate?.propertyComparisons?.map(comparison => <Accordion key={comparison.property}>
          <AccordionSummary><Typography>{comparison.property} · {comparison.action}</Typography></AccordionSummary>
          <AccordionDetails><Stack spacing={1}>
            <Typography variant="caption">Current value</Typography>
            <Box component="pre" sx={{whiteSpace: 'pre-wrap', overflow: 'auto'}}>{JSON.stringify(comparison.currentValue, null, 2)}</Box>
            <Typography variant="caption">Proposed value</Typography>
            <Box component="pre" sx={{whiteSpace: 'pre-wrap', overflow: 'auto'}}>{JSON.stringify(comparison.proposedValue, null, 2)}</Box>
          </Stack></AccordionDetails>
        </Accordion>)}
        {candidate && <FormControlLabel control={<Checkbox checked={confirmed}
          onChange={event => setConfirmed(event.target.checked)} />}
          label="I reviewed the complete current and proposed property values and approve these overwrites." />}
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
      <Button variant="contained" onClick={() => void publish()} disabled={loading || !candidate || !confirmed
        || Object.values(policies).some(policy => policy.accessMode === 'PUBLIC' && !policy.publicReason?.trim())}>
        {loading && candidate ? <CircularProgress size={20} /> : 'Stage publication'}
      </Button>
    </DialogActions>
  </Dialog>;
}
