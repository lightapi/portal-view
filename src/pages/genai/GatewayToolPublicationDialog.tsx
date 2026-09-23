import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, Checkbox,
  Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import {
  externallyManagedToolIds,
  publicationScope,
  shouldShowOwnershipPlaceholder,
  toolsMissingAccessPolicy,
  type AccessReadiness,
  type PublishableTool,
} from './gatewayToolPublicationScope';
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
  accessReadiness?: AccessReadiness[];
  propertyComparisons?: Array<{property: string; action: string; currentValue: unknown; proposedValue: unknown}>;
  noOp?: boolean;
};

type PublicationMode = 'ADD_OR_UPDATE' | 'REPLACE_API_SCOPE' | 'REMOVE_API_SCOPE' | 'REMOVE_WORKFLOW_TOOLS';
const isRemovalMode = (mode: PublicationMode | null) => mode === 'REMOVE_API_SCOPE' || mode === 'REMOVE_WORKFLOW_TOOLS';

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

type AccessLookupType = 'rule' | 'role' | 'group' | 'position' | 'attribute';
type AccessOption = {id: string; label: string};
const ACCESS_LOOKUPS: Record<AccessLookupType, {service: string; action: string; responseKey: string; idKey: string; labels: string[]}> = {
  rule: {service: 'rule', action: 'getRule', responseKey: 'rules', idKey: 'ruleId', labels: ['ruleName', 'ruleDesc']},
  role: {service: 'role', action: 'getRole', responseKey: 'roles', idKey: 'roleId', labels: ['roleName', 'roleDesc']},
  group: {service: 'group', action: 'getGroup', responseKey: 'groups', idKey: 'groupId', labels: ['groupName', 'groupDesc']},
  position: {service: 'position', action: 'getPosition', responseKey: 'positions', idKey: 'positionId', labels: ['positionName', 'positionDesc']},
  attribute: {service: 'attribute', action: 'getAttribute', responseKey: 'attributes', idKey: 'attributeId', labels: ['attributeName', 'attributeDesc']},
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
  const [accessReadiness, setAccessReadiness] = useState<AccessReadiness[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{severity: 'success' | 'error' | 'info'; text: string} | null>(null);
  const [operationMode, setOperationMode] = useState<PublicationMode | null>(null);
  const [accessOptions, setAccessOptions] = useState<Record<AccessLookupType, AccessOption[]>>({rule: [], role: [], group: [], position: [], attribute: []});
  const [accessOptionsError, setAccessOptionsError] = useState('');
  const scope = useMemo(() => publicationScope(tools), [tools]);
  const workflowToolsSelected = tools.length > 0 && tools.every(tool =>
    !tool.endpointId && tool.executionPlacement?.toLowerCase() === 'workflow');
  const selectedInstance = instances.find(instance => instance.instanceId === instanceId);

  useEffect(() => {
    if (!open || !hostId) return;
    let cancelled = false;
    const load = async () => {
      setAccessOptionsError('');
      const entries = await Promise.all(Object.entries(ACCESS_LOOKUPS).map(async ([type, config]) => {
        const cmd = {host: 'lightapi.net', service: config.service, action: config.action, version: '0.1.0', data: {
          hostId, offset: 0, limit: 1000, sorting: JSON.stringify([]), filters: JSON.stringify([]), globalFilter: '', active: true,
        }};
        try {
          const result = await fetchClient(`/portal/query?cmd=${encodeURIComponent(JSON.stringify(cmd))}`);
          const rows = Array.isArray(result?.[config.responseKey]) ? result[config.responseKey] : [];
          return [type, rows.map((row: Record<string, unknown>) => {
            const id = String(row[config.idKey] ?? '');
            const label = config.labels.map(key => row[key]).find(value => typeof value === 'string' && value.trim());
            return id ? {id, label: typeof label === 'string' ? `${id} - ${label}` : id} : null;
          }).filter(Boolean)] as const;
        } catch {
          return [type, []] as const;
        }
      }));
      if (!cancelled) {
        setAccessOptions(Object.fromEntries(entries) as Record<AccessLookupType, AccessOption[]>);
        if (entries.every(([, options]) => options.length === 0)) setAccessOptionsError('Could not load access rule and principal options. Check access administration permissions.');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [hostId, open]);

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
    setPolicies(Object.fromEntries(tools
      .filter(tool => !tool.endpointId)
      .map(tool => [tool.toolId, emptyPolicy(tool.toolId)])));
    setAccessReadiness([]);
    setMessage(null);
    setOperationMode(null);
    void loadInstances();
  }, [loadInstances, open, tools]);

  const preview = async (requestedMode: PublicationMode = scope.mode as PublicationMode) => {
    if (!instanceId) return;
    const removing = isRemovalMode(requestedMode);
    setLoading(true);
    setOperationMode(requestedMode);
    setCandidate(null);
    setMessage(null);
    try {
      const value = await fetchClient(gatewayToolQueryUrl('genai', 'getGatewayToolPublicationCandidate', {
        hostId, instanceId, mode: requestedMode,
        toolIds: requestedMode === 'REMOVE_API_SCOPE' ? [] : tools.map(tool => tool.toolId),
        accessPolicies: removing ? [] : tools.flatMap(tool => policies[tool.toolId] ? [policies[tool.toolId]] : []),
        ...(scope.apiVersionId ? {apiVersionId: scope.apiVersionId} : {}),
      }));
      if (removing) {
        const removalCandidate = value as Candidate;
        setAccessReadiness([]);
        setPolicies({});
        setCandidate(removalCandidate.noOp ? null : removalCandidate);
        setConfirmed(false);
        setMessage({
          severity: 'info',
          text: removalCandidate.noOp
            ? requestedMode === 'REMOVE_API_SCOPE'
              ? 'This API version is already unpublished from the selected Gateway; no change was staged.'
              : 'The selected workflow Tools are already unpublished from the selected Gateway; no change was staged.'
            : 'Review the exact Tool and access-control removals below. The live Gateway changes only after snapshot activation.',
        });
        return;
      }
      const previewed = (value as Candidate).accessPolicies ?? [];
      const readiness = (value as Candidate).accessReadiness ?? [];
      const previewById = Object.fromEntries(previewed.map(policy => [policy.toolId, normalizePolicy(policy)]));
      const inherited = externallyManagedToolIds(readiness);
      const missingToolIds = toolsMissingAccessPolicy(
        tools.map(tool => tool.toolId),
        Object.keys(previewById),
        Object.keys(policies),
        readiness,
      );
      setAccessReadiness(readiness);
      setPolicies(previous => {
        const next = {...previous, ...previewById};
        inherited.forEach(toolId => delete next[toolId]);
        missingToolIds.forEach(toolId => { next[toolId] = emptyPolicy(toolId); });
        return next;
      });
      setCandidate(missingToolIds.length ? null : value as Candidate);
      setConfirmed(false);
      setMessage({
        severity: 'info',
        text: missingToolIds.length
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
    if (!candidate || !instanceId || !operationMode) return;
    const removing = isRemovalMode(operationMode);
    setLoading(true);
    setMessage(null);
    const result = await apiPost({
      url: '/portal/command', headers: {}, body: gatewayToolRpc('genai', 'publishGatewayTools', {
        hostId, instanceId, mode: operationMode,
        toolIds: operationMode === 'REMOVE_API_SCOPE' ? [] : tools.map(tool => tool.toolId),
        accessPolicies: removing ? [] : tools.flatMap(tool => policies[tool.toolId] ? [policies[tool.toolId]] : []),
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
    <DialogTitle>{operationMode === 'REMOVE_API_SCOPE'
      ? 'Unpublish API Tools from a Gateway'
      : operationMode === 'REMOVE_WORKFLOW_TOOLS'
        ? 'Unpublish selected workflow Tools from a Gateway'
        : 'Publish selected Tools to a Gateway'}</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{pt: 1}}>
        <Alert severity="info">
          Publication writes the instance-level <code>mcp-router.tools</code> desired state. It does not move the current snapshot or change the live Gateway.
        </Alert>
        <TextField select label="Gateway instance" value={instanceId}
          onChange={event => {
            setInstanceId(event.target.value); setCandidate(null); setPolicies({});
            setAccessReadiness([]); setConfirmed(false); setMessage(null);
            setOperationMode(null);
          }}
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
          {operationMode === 'REMOVE_API_SCOPE'
            ? 'API-scope unpublish: every Tool bound to this API version is removed from the target; unrelated API and workflow Tools are preserved.'
            : operationMode === 'REMOVE_WORKFLOW_TOOLS'
              ? 'Selected workflow Tools and their exact endpoint access rules are removed from the target; unrelated Tools and access rules are preserved.'
            : scope.mode === 'REPLACE_API_SCOPE'
            ? 'API-scope publication: the selected API version endpoints replace that API version on the target; unrelated API and workflow Tools are preserved.'
            : 'Add/update publication: selected Tools are merged into the target; unrelated Tools are preserved.'}
        </Typography>
        {!isRemovalMode(operationMode) && <><Typography variant="h6">Access Control</Typography>
        <Alert severity="warning">
          Protected Tools without a request rule remain hidden and fail closed. Public access uses the compiler-owned allow-public-access rule and still follows MCP route authentication.
        </Alert>
        {accessOptionsError && <Alert severity="warning">{accessOptionsError}</Alert>}
        {tools.map(tool => {
          const readiness = accessReadiness.find(item => item.toolId === tool.toolId);
          if (shouldShowOwnershipPlaceholder(readiness, Boolean(policies[tool.toolId]))) return <Box key={tool.toolId}
              sx={{border: 1, borderColor: 'divider', borderRadius: 1, p: 2}}>
            <Typography variant="subtitle1">{tool.name}</Typography>
            <Typography color="text.secondary">Preview changes to resolve the current access-control owner.</Typography>
          </Box>;
          if (readiness?.state === 'PRESERVED_API' || readiness?.state === 'PRESERVED_EXTERNAL') return <Box key={tool.toolId}
              sx={{border: 1, borderColor: 'divider', borderRadius: 1, p: 2}}>
            <Stack spacing={1}>
              <Typography variant="subtitle1">{tool.name}</Typography>
              <Alert severity="info">
                Access control for <code>{readiness.endpointKey}</code> is inherited from the existing API publication.
                Change it in API Admin and republish the API. Publishing this Tool preserves those rules.
              </Alert>
            </Stack>
          </Box>;
          const policy = policies[tool.toolId] ?? emptyPolicy(tool.toolId);
          const update = (next: AccessPolicy) => {
            setPolicies(previous => ({...previous, [tool.toolId]: next}));
            setCandidate(null); setConfirmed(false);
            setAccessReadiness([]);
            setMessage({severity: 'info', text: 'Access settings changed. Preview changes again, then review and confirm the publication.'});
          };
          return <Box key={tool.toolId} sx={{border: 1, borderColor: 'divider', borderRadius: 1, p: 2}}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">{tool.name}</Typography>
              <Accordion disableGutters>
                <AccordionSummary expandIcon={<span>▾</span>}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2">Access overview</Typography>
                    <Chip size="small" label={policy.accessMode === 'PROTECTED' ? 'Protected' : 'Public'} />
                    <Chip size="small" variant="outlined" label={`${policy.ruleIds.length} request rules`} />
                    <Chip size="small" variant="outlined" label={`${Object.values(policy.permissions).flat().length} permissions`} />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.5}>
                    <PolicyOverviewSection title="Request rules" value={policy.ruleIds} />
                    <PolicyOverviewSection title="Response filter rules" value={policy.responseRuleIds} />
                    <PolicyOverviewSection title="Permissions" value={[
                      ...policy.permissions.roles.map(value => `Role: ${value}`),
                      ...policy.permissions.groups.map(value => `Group: ${value}`),
                      ...policy.permissions.positions.map(value => `Position: ${value}`),
                      ...policy.permissions.users.map(value => `User: ${value}`),
                      ...policy.permissions.attributes.map(value => `Attribute: ${value.attributeId}=${value.attributeValue}`),
                    ]} />
                    <PolicyOverviewSection title="Row filters" value={policy.rowFilters.map(value => JSON.stringify(value))} />
                    <PolicyOverviewSection title="Column filters" value={policy.columnFilters.map(value => JSON.stringify(value))} />
                    {policy.accessMode === 'PUBLIC' && <PolicyOverviewSection title="Public access approval" value={policy.publicReason ? [policy.publicReason] : []} />}
                  </Stack>
                </AccordionDetails>
              </Accordion>
              <TextField select label="Access mode" value={policy.accessMode}
                onChange={event => update({...policy, accessMode: event.target.value as AccessPolicy['accessMode'],
                  ruleIds: [],
                  permissions: event.target.value === 'PUBLIC'
                    ? {roles: [], groups: [], positions: [], users: [], attributes: []} : policy.permissions,
                })}>
                <MenuItem value="PROTECTED">Protected</MenuItem>
                <MenuItem value="PUBLIC">Public</MenuItem>
              </TextField>
              <Typography variant="caption" color="text.secondary">
                {policy.accessMode === 'PROTECTED'
                  ? 'Protected: the Gateway requires a matching request rule and its configured permissions. With no request rule, the Tool is hidden and denied.'
                  : 'Public: the Gateway allows any caller that has passed MCP route authentication. Use only with an approval reason; route authentication still applies.'}
              </Typography>
              {policy.accessMode === 'PROTECTED' ? <>
                <AccessMultiSelect label="Request rules" options={accessOptions.rule} value={policy.ruleIds}
                  onChange={ruleIds => update({...policy, ruleIds})}
                  helperText="Search and select active request rules. An empty selection deliberately leaves the Tool unconfigured and denied."
                  />
                {(['roles', 'groups', 'positions'] as const).map(dimension => <AccessMultiSelect
                  key={dimension} label={`Allowed ${dimension}`} options={accessOptions[dimension.slice(0, -1) as AccessLookupType]}
                  value={policy.permissions[dimension]} onChange={values => update({...policy, permissions: {...policy.permissions, [dimension]: values}})} />)}
                <TextField label="Allowed users" value={policy.permissions.users.join(', ')}
                  helperText="Enter user IDs separated by commas or spaces."
                  onChange={event => update({...policy, permissions: {...policy.permissions, users: splitValues(event.target.value)}})} />
                <AccessMultiSelect label="Allowed attributes" options={accessOptions.attribute}
                  value={policy.permissions.attributes.map(attribute => attribute.attributeId)}
                  onChange={attributeIds => update({...policy, permissions: {...policy.permissions,
                    attributes: attributeIds.map(attributeId => policy.permissions.attributes.find(item => item.attributeId === attributeId)
                      ?? {attributeId, attributeValue: ''})}})}
                  helperText="Select attributes, then enter a value for each below." />
                {policy.permissions.attributes.map(attribute => <TextField key={attribute.attributeId}
                  label={`${attribute.attributeId} value`} value={attribute.attributeValue}
                  onChange={event => update({...policy, permissions: {...policy.permissions, attributes:
                    policy.permissions.attributes.map(item => item.attributeId === attribute.attributeId
                      ? {...item, attributeValue: event.target.value} : item)}})} />)}
              </> : <TextField required label="Public access approval reason" value={policy.publicReason ?? ''}
                onChange={event => update({...policy, publicReason: event.target.value})} />}
              <AccessMultiSelect label="Response filter rules" options={accessOptions.rule} value={policy.responseRuleIds}
                onChange={responseRuleIds => update({...policy, responseRuleIds})}
                helperText="Search and select response filter rules. Required when row or column filters are configured."
              />
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
        })}</>}
        {message && <Alert severity={message.severity}>{message.text}</Alert>}
        {summary && <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
          <Chip color="success" label={`${summary.added} added`} />
          <Chip color="info" label={`${summary.updated} updated`} />
          <Chip color="warning" label={`${summary.removed} removed`} />
          <Chip label={`${summary.unchanged} unchanged`} />
          <Chip variant="outlined" label={`${summary.total} total after publication`} />
        </Stack>}
        {accessReadiness.map(item => <Alert key={item.toolId}
          severity={item.state === 'PUBLISHABLE' || item.state === 'PRESERVED_API'
            || item.state === 'PRESERVED_EXTERNAL' ? 'success' : 'warning'}>
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
          label={operationMode === 'REMOVE_API_SCOPE'
            ? 'I reviewed the complete removals and approve staging this API-scope unpublish.'
            : operationMode === 'REMOVE_WORKFLOW_TOOLS'
              ? 'I reviewed the selected workflow Tool and access-rule removals and approve staging them.'
            : 'I reviewed the complete current and proposed property values and approve these overwrites.'} />}
        {message?.severity === 'success' && <Button variant="outlined" onClick={() => {
          onClose();
          navigate('/app/config/configSnapshot', {state: {data: {instanceId}}});
        }}>Open config snapshots</Button>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={loading}>Close</Button>
      {scope.apiVersionId && <Button color="error" variant="outlined"
        onClick={() => void preview('REMOVE_API_SCOPE')} disabled={loading || !instanceId || !tools.length}>
        {loading && operationMode === 'REMOVE_API_SCOPE' ? <CircularProgress size={20} /> : 'Preview API unpublish'}
      </Button>}
      {workflowToolsSelected && <Button color="error" variant="outlined"
        onClick={() => void preview('REMOVE_WORKFLOW_TOOLS')} disabled={loading || !instanceId}>
        {loading && operationMode === 'REMOVE_WORKFLOW_TOOLS' ? <CircularProgress size={20} /> : 'Preview workflow Tool unpublish'}
      </Button>}
      <Button variant="outlined" onClick={() => void preview(scope.mode as PublicationMode)} disabled={loading || !instanceId || !tools.length}>
        {loading && !candidate ? <CircularProgress size={20} /> : 'Preview changes'}
      </Button>
      <Button variant="contained" onClick={() => void publish()} disabled={loading || !candidate || !confirmed
        || Object.values(policies).some(policy => policy.accessMode === 'PUBLIC' && !policy.publicReason?.trim())}>
        {loading && candidate ? <CircularProgress size={20} />
          : isRemovalMode(operationMode) ? 'Stage unpublish' : 'Stage publication'}
      </Button>
    </DialogActions>
  </Dialog>;
}

function PolicyOverviewSection({title, value}: {title: string; value: string[]}) {
  return <Box>
    <Typography variant="subtitle2">{title}</Typography>
    <Typography variant="body2" color={value.length ? 'text.primary' : 'text.secondary'} sx={{whiteSpace: 'pre-wrap'}}>
      {value.length ? value.join('\n') : 'None'}
    </Typography>
  </Box>;
}

function AccessMultiSelect({label, options, value, onChange, helperText}: {
  label: string;
  options: AccessOption[];
  value: string[];
  onChange: (value: string[]) => void;
  helperText?: string;
}) {
  const selected = value.map(id => options.find(option => option.id === id) ?? {id, label: id});
  return <Autocomplete
    multiple
    options={options}
    value={selected}
    onChange={(_event, next) => onChange(next.map(option => option.id))}
    getOptionLabel={option => option.label}
    isOptionEqualToValue={(option, selectedOption) => option.id === selectedOption.id}
    renderInput={params => <TextField {...params} label={label} helperText={helperText} placeholder={`Select ${label.toLowerCase()}`} />}
  />;
}
