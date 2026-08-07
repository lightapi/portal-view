import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, Divider, FormControlLabel, MenuItem,
  Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useUserState } from '../../contexts/UserContext';
import {
  executeInstanceClone, fetchCloneTargetOptions, fetchFreshSource, getInstanceCloneStatus, planInstanceClone,
  revealInstanceCloneValue,
} from './clone/cloneApi';
import {
  cloneErrorText, cloneFormFingerprint, includeOriginalOption, isAbortError, isTerminalCloneStatus, mergePlannedSelections, nextPollingDelay, propertySelectionKey,
  isTransportError, propertySelectionLabel, plannedSelectedEntityIds, selectedEntityOptions, shouldPollClone,
} from './clone/cloneState.js';
import type {
  CloneExecution, CloneOption, ClonePlan, CloneStatus, CloneStatusResult, CloneTargetOptions, PropertyAction,
  PropertySelection, SourceInstance,
} from './clone/types';

type CloneForm = {
  targetInstanceName: string;
  targetEnvTag: string;
  targetEnvironment: string;
  targetServiceId: string;
  targetProductVersionId: string;
  description: string;
  zone: string;
  region: string;
  lob: string;
  resourceName: string;
  businessName: string;
  topicClassification: string;
  includeFiles: boolean;
  fileSelections: string[];
  confirmCertificates: boolean;
  includeApis: boolean;
  apiSelections: string[];
  includeApps: boolean;
  appSelections: string[];
  includeDeployments: boolean;
  deploymentSelections: string[];
  createSnapshot: boolean;
  propertySelections: PropertySelection[];
  revealedValues: Record<string, string>;
};

const emptyForm: CloneForm = {
  targetInstanceName: '', targetEnvTag: '', targetEnvironment: '', targetServiceId: '',
  targetProductVersionId: '', description: '', zone: '', region: '', lob: '', resourceName: '',
  businessName: '', topicClassification: '', includeFiles: false, fileSelections: [],
  confirmCertificates: false, includeApis: true, apiSelections: [], includeApps: true, appSelections: [],
  includeDeployments: false, deploymentSelections: [],
  createSnapshot: false, propertySelections: [], revealedValues: {},
};

const emptyTargetOptions: CloneTargetOptions = {
  productVersionId: [], envTag: [], environment: [], zone: [], region: [], lob: [],
};

export default function InstanceClone() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as { host?: string };
  const routedSource = (location.state as { data?: SourceInstance } | null)?.data;
  const [source, setSource] = useState<SourceInstance | null>(routedSource ?? null);
  const [sourceLoading, setSourceLoading] = useState(Boolean(routedSource));
  const [form, setForm] = useState<CloneForm>(emptyForm);
  const [plan, setPlan] = useState<ClonePlan | null>(null);
  const [planFingerprint, setPlanFingerprint] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [revealing, setRevealing] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [execution, setExecution] = useState<CloneExecution | null>(null);
  const [statusResult, setStatusResult] = useState<CloneStatusResult | null>(null);
  const [status, setStatus] = useState<CloneStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stillProcessing, setStillProcessing] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [connectivityTick, setConnectivityTick] = useState(0);
  const [targetOptions, setTargetOptions] = useState<CloneTargetOptions>(emptyTargetOptions);
  const [targetOptionsLoading, setTargetOptionsLoading] = useState(false);
  const pollInFlight = useRef(false);
  const pollAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!routedSource) return;
    const controller = new AbortController();
    setSourceLoading(true);
    fetchFreshSource(routedSource, controller.signal)
      .then((fresh) => {
        // getFreshInstance echoes only its request keys when the supplied aggregate
        // version is already current. Preserve the authorized admin-row values in
        // that case, while allowing a genuinely fresher database row to override them.
        const authorized = { ...routedSource, ...fresh, hostId: routedSource.hostId, instanceId: routedSource.instanceId };
        setError(null);
        setSource(authorized);
        setForm((current) => ({
          ...current,
          targetInstanceName: authorized.instanceName ?? '',
          targetEnvTag: authorized.envTag ?? '',
          targetEnvironment: authorized.environment ?? '',
          targetServiceId: authorized.serviceId ?? '',
          targetProductVersionId: authorized.productVersionId ?? '',
          description: authorized.instanceDesc ?? '',
          zone: authorized.zone ?? '',
          region: authorized.region ?? '',
          lob: authorized.lob ?? '',
          resourceName: authorized.resourceName ?? '',
          businessName: authorized.businessName ?? '',
          topicClassification: authorized.topicClassification ?? '',
        }));
      })
      .catch((requestError) => { if (!isAbortError(requestError)) setError(cloneErrorText(requestError)); })
      .finally(() => setSourceLoading(false));
    return () => controller.abort();
  }, [routedSource]);

  useEffect(() => {
    if (!source?.hostId) return;
    const controller = new AbortController();
    setTargetOptionsLoading(true);
    fetchCloneTargetOptions(source.hostId, controller.signal)
      .then(setTargetOptions)
      .catch((requestError) => { if (!isAbortError(requestError)) setError(cloneErrorText(requestError)); })
      .finally(() => setTargetOptionsLoading(false));
    return () => controller.abort();
  }, [source?.hostId]);

  useEffect(() => {
    const refresh = () => setConnectivityTick((value) => value + 1);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh); window.addEventListener('offline', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh);
    };
  }, []);

  useEffect(() => () => pollAbort.current?.abort(), []);

  const currentFingerprint = useMemo(() => cloneFormFingerprint(form), [form]);
  const canExecute = Boolean(plan && planFingerprint === currentFingerprint && !executing && !status);
  const fileOptions = useMemo(() => selectedEntityOptions(plan?.rows, 'ConfigInstanceFile'), [plan]);
  const apiOptions = useMemo(() => selectedEntityOptions(plan?.rows, 'InstanceApi'), [plan]);
  const appOptions = useMemo(() => selectedEntityOptions(plan?.rows, 'InstanceApp'), [plan]);
  const deploymentOptions = useMemo(() => selectedEntityOptions(plan?.rows, 'DeploymentInstance'), [plan]);

  const updateForm = useCallback(<K extends keyof CloneForm>(key: K, value: CloneForm[K]) => {
    setForm((current) => ({ ...current, [key]: value, revealedValues: {} }));
    setError(null);
  }, []);

  const requestData = useCallback((value: CloneForm) => ({
    hostId: source?.hostId ?? host,
    ...(plan?.cloneRequestId ? { cloneRequestId: plan.cloneRequestId } : {}),
    sourceInstanceId: source?.instanceId,
    targetInstanceName: value.targetInstanceName,
    targetEnvTag: value.targetEnvTag,
    targetEnvironment: value.targetEnvironment,
    targetServiceId: value.targetServiceId,
    targetProductVersionId: value.targetProductVersionId,
    ...(plan?.resolvedTarget.ownerUserId ? { targetOwnerUserId: plan.resolvedTarget.ownerUserId } : {}),
    ...(plan?.resolvedTarget.ownerPositionId ? { targetOwnerPositionId: plan.resolvedTarget.ownerPositionId } : {}),
    description: value.description || undefined, zone: value.zone || undefined, region: value.region || undefined,
    lob: value.lob || undefined, resourceName: value.resourceName || undefined,
    businessName: value.businessName || undefined, topicClassification: value.topicClassification || undefined,
    includeFiles: value.includeFiles,
    fileSelections: value.includeFiles ? value.fileSelections : [],
    confirmedCertificateSelections: value.includeFiles && value.confirmCertificates ? value.fileSelections : [],
    includeApis: value.includeApis,
    ...(plan ? { apiSelections: value.includeApis ? value.apiSelections : [] } : {}),
    includeApps: value.includeApps,
    ...(plan ? { appSelections: value.includeApps ? value.appSelections : [] } : {}),
    includeDeployments: value.includeDeployments,
    deploymentSelections: value.includeDeployments ? value.deploymentSelections : [],
    createSnapshot: value.createSnapshot,
    propertySelections: value.propertySelections,
  }), [host, plan, source]);

  const handlePlan = useCallback(async () => {
    if (!source || !form.targetInstanceName.trim() || !form.targetEnvTag.trim() || !form.targetEnvironment.trim()) {
      setError('Target instance name, env tag, and environment are required.'); return;
    }
    setPlanning(true); setError(null); setForm((current) => ({ ...current, revealedValues: {} }));
    try {
      const result = await planInstanceClone(requestData(form));
      const nextForm: CloneForm = {
        ...form,
        targetInstanceName: result.resolvedTarget.instanceName,
        targetEnvTag: result.resolvedTarget.envTag,
        targetEnvironment: result.resolvedTarget.environment,
        targetServiceId: result.resolvedTarget.serviceId,
        targetProductVersionId: result.resolvedTarget.productVersionId,
        apiSelections: plannedSelectedEntityIds(result.rows, 'InstanceApi'),
        appSelections: plannedSelectedEntityIds(result.rows, 'InstanceApp'),
        propertySelections: mergePlannedSelections(form.propertySelections, result.propertySelections),
        revealedValues: {},
      };
      setForm(nextForm); setPlan(result); setPlanFingerprint(cloneFormFingerprint(nextForm));
    } catch (requestError) {
      setPlan(null); setPlanFingerprint(null); setError(cloneErrorText(requestError));
    } finally { setPlanning(false); }
  }, [form, requestData, source]);

  const changeProperty = useCallback((index: number, patch: Partial<PropertySelection>) => {
    setForm((current) => ({
      ...current,
      propertySelections: current.propertySelections.map((selection, row) => row === index ? { ...selection, ...patch } : selection),
      revealedValues: {},
    }));
  }, []);

  const reveal = useCallback(async (selection: PropertySelection) => {
    if (!plan || !source) return;
    const key = propertySelectionKey(selection); setRevealing(key); setError(null);
    try {
      const result = await revealInstanceCloneValue({
        hostId: source.hostId, cloneRequestId: plan.cloneRequestId, sourceInstanceId: source.instanceId,
        sourceGraphDigest: plan.sourceGraphDigest, selector: selection,
      });
      setForm((current) => ({ ...current, revealedValues: { [key]: result.value } }));
    } catch (requestError) { setError(cloneErrorText(requestError)); }
    finally { setRevealing(null); }
  }, [plan, source]);

  const hideRevealedValues = useCallback(() => {
    setForm((current) => ({ ...current, revealedValues: {} }));
  }, []);

  const execute = useCallback(async () => {
    if (!plan || !source || planFingerprint !== currentFingerprint) return;
    setExecuting(true); setError(null);
    try {
      const result = await executeInstanceClone({
        ...requestData(form), cloneRequestId: plan.cloneRequestId, targetInstanceId: plan.targetInstanceId,
        planHash: plan.planHash, sourceGraphDigest: plan.sourceGraphDigest,
        catalogSchemaDigest: plan.catalogSchemaDigest,
      });
      setExecution(result); setStatus(result.status); setStatusResult(result); setPollAttempt(0); setStillProcessing(false);
    } catch (requestError) {
      if (!isTransportError(requestError)) {
        setError(cloneErrorText(requestError));
        setStatus(null); setStatusResult(null); setStillProcessing(false);
      } else {
        setStatus('ACCEPTED');
        setStatusResult({
          cloneRequestId: plan.cloneRequestId, targetInstanceId: plan.targetInstanceId, status: 'ACCEPTED',
          eventCount: plan.eventCount, payloadBytes: plan.payloadBytes,
        });
        setStillProcessing(true);
      }
    }
    finally { setExecuting(false); }
  }, [currentFingerprint, form, plan, planFingerprint, requestData, source]);

  const refreshStatus = useCallback(async () => {
    const cloneRequestId = execution?.cloneRequestId ?? statusResult?.cloneRequestId;
    const hostId = source?.hostId ?? host;
    if (!cloneRequestId || !hostId || pollInFlight.current) return;
    pollInFlight.current = true;
    const controller = new AbortController(); pollAbort.current = controller;
    try {
      const result = await getInstanceCloneStatus(hostId, cloneRequestId, controller.signal);
      setStatusResult(result); setStatus(result.status); setStillProcessing(false);
      if (result.status === 'ACCEPTED') setPollAttempt((value) => value + 1);
    } catch (requestError) {
      if (isTransportError(requestError)) {
        setStillProcessing(true);
      } else {
        setError(cloneErrorText(requestError)); setStatus(null); setStatusResult(null); setStillProcessing(false);
      }
    } finally {
      if (pollAbort.current === controller) pollAbort.current = null;
      pollInFlight.current = false;
    }
  }, [execution?.cloneRequestId, host, source?.hostId, statusResult?.cloneRequestId]);

  useEffect(() => {
    const visible = document.visibilityState !== 'hidden';
    const online = navigator.onLine;
    if (!shouldPollClone({ status, visible, online, inFlight: pollInFlight.current }) || stillProcessing) return;
    const serverDelay = (execution?.retryAfterSeconds ?? 0) * 1000;
    const timer = window.setTimeout(refreshStatus, Math.max(nextPollingDelay(pollAttempt), serverDelay));
    return () => window.clearTimeout(timer);
  }, [connectivityTick, execution?.retryAfterSeconds, pollAttempt, refreshStatus, status, stillProcessing]);

  if (!routedSource) {
    return <Alert severity="warning">Choose Clone from Instance Admin so the source can be reauthorized.</Alert>;
  }

  const finished = status ? isTerminalCloneStatus(status) : false;
  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/instance/InstanceAdmin')}>Back</Button>
        <Typography variant="h5">Clone Instance</Typography>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {sourceLoading && <CircularProgress size={24} />}
      {source && <Alert severity="info" sx={{ mb: 2 }}>Source: {source.instanceName ?? source.instanceId} ({source.instanceId})</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Target</Typography>
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={2}>
          <CloneTextField required label="Instance Name" value={form.targetInstanceName} onChange={(value) => updateForm('targetInstanceName', value)} />
          <CloneSelect label="Env Tag" required value={form.targetEnvTag} original={source.envTag} options={targetOptions.envTag} loading={targetOptionsLoading} onChange={(value) => updateForm('targetEnvTag', value)} />
          <CloneSelect label="Environment" required value={form.targetEnvironment} original={source.environment} options={targetOptions.environment} loading={targetOptionsLoading} onChange={(value) => updateForm('targetEnvironment', value)} />
          <CloneTextField label="Service ID" value={form.targetServiceId} onChange={(value) => updateForm('targetServiceId', value)} />
          <CloneSelect label="Product Version ID" value={form.targetProductVersionId} original={source.productVersionId} options={targetOptions.productVersionId} loading={targetOptionsLoading} onChange={(value) => updateForm('targetProductVersionId', value)} />
          <CloneTextField label="Description" value={form.description} onChange={(value) => updateForm('description', value)} />
          <CloneSelect label="Network Zone" value={form.zone} original={source.zone} options={targetOptions.zone} loading={targetOptionsLoading} onChange={(value) => updateForm('zone', value)} />
          <CloneSelect label="Region" value={form.region} original={source.region} options={targetOptions.region} loading={targetOptionsLoading} onChange={(value) => updateForm('region', value)} />
          <CloneSelect label="LOB" value={form.lob} original={source.lob} options={targetOptions.lob} loading={targetOptionsLoading} onChange={(value) => updateForm('lob', value)} />
          <CloneTextField label="Resource Name" value={form.resourceName} onChange={(value) => updateForm('resourceName', value)} />
          <CloneTextField label="Business Name" value={form.businessName} onChange={(value) => updateForm('businessName', value)} />
          <CloneTextField label="Topic Classification" value={form.topicClassification} onChange={(value) => updateForm('topicClassification', value)} />
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} mt={2}>
          <FormControlLabel control={<Checkbox checked={form.includeFiles} onChange={(e) => updateForm('includeFiles', e.target.checked)} />} label="Include selected files" />
          <FormControlLabel control={<Checkbox checked={form.includeDeployments} onChange={(e) => setForm((current) => ({ ...current, includeDeployments: e.target.checked, deploymentSelections: [], propertySelections: [], revealedValues: {} }))} />} label="Include selected deployments" />
          <FormControlLabel control={<Checkbox checked={form.createSnapshot} onChange={(e) => updateForm('createSnapshot', e.target.checked)} />} label="Create current snapshot" />
        </Stack>
      </Paper>

      {plan && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} mb={1}>
            <Box>
              <Typography variant="h6">Property overrides</Typography>
              <Typography variant="body2" color="text.secondary">Values stay masked. COPY is server-side and does not reveal the value.</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              {Object.keys(form.revealedValues).length > 0 && <Button size="small" onClick={hideRevealedValues} disabled={revealing !== null}>Hide values</Button>}
            </Stack>
          </Stack>
          <Table size="small">
            <TableHead><TableRow><TableCell>Scope / Config / Property</TableCell><TableCell>Value</TableCell><TableCell>Action</TableCell><TableCell>Replacement / Reveal</TableCell></TableRow></TableHead>
            <TableBody>
              {form.propertySelections.map((selection, index) => {
                const key = propertySelectionKey(selection); const revealed = form.revealedValues[key];
                return <TableRow key={key}>
                  <TableCell title={`Property ID: ${selection.propertyId}`}>{propertySelectionLabel(selection, plan.propertyMetadata)}</TableCell>
                  <TableCell>{revealed ?? '********'}</TableCell>
                  <TableCell>
                    <Select size="small" value={selection.action} onChange={(e) => changeProperty(index, { action: e.target.value as PropertyAction, replacementValue: null })}>
                      <MenuItem value="COPY">COPY</MenuItem><MenuItem value="REPLACE">REPLACE</MenuItem><MenuItem value="OMIT">OMIT</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {selection.action === 'REPLACE' && <TextField size="small" type="password" value={selection.replacementValue ?? ''} onChange={(e) => changeProperty(index, { replacementValue: e.target.value })} />}
                      <Button size="small" startIcon={revealing === key ? <CircularProgress size={14} /> : <VisibilityIcon />} onClick={() => reveal(selection)} disabled={revealing !== null}>Reveal</Button>
                    </Stack>
                  </TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>

          <SelectionList title="Instance APIs" options={apiOptions} selected={form.apiSelections} onChange={(ids) => setForm((current) => ({ ...current, includeApis: ids.length > 0, apiSelections: ids, propertySelections: [], revealedValues: {} }))} />
          <SelectionList title="Instance apps" options={appOptions} selected={form.appSelections} onChange={(ids) => setForm((current) => ({ ...current, includeApps: ids.length > 0, appSelections: ids, propertySelections: [], revealedValues: {} }))} />
          {form.includeFiles && <SelectionList title="Files" options={fileOptions} selected={form.fileSelections} onChange={(ids) => updateForm('fileSelections', ids)} />}
          {form.includeFiles && form.fileSelections.length > 0 && (
            <FormControlLabel control={<Checkbox checked={form.confirmCertificates} onChange={(e) => updateForm('confirmCertificates', e.target.checked)} />}
              label="I confirm that selected files may include certificates and should be copied." />
          )}
          {form.includeDeployments && <SelectionList title="Deployment definitions" options={deploymentOptions} selected={form.deploymentSelections} onChange={(ids) => setForm((current) => ({ ...current, deploymentSelections: ids, propertySelections: [], revealedValues: {} }))} />}
          <Divider sx={{ my: 2 }} />
          <Typography>Events: {plan.eventCount} / {plan.maxEvents}; serialized bytes: {plan.payloadBytes} / {plan.maxPayloadBytes}</Typography>
          <Typography variant="body2">Target identity: {Object.entries(plan.snapshotLookup).map(([key, value]) => `${key}=${value}`).join(', ')}</Typography>
          {plan.warnings.map((warning) => <Alert key={warning} severity="warning" sx={{ mt: 1 }}>{warning}</Alert>)}
          {planFingerprint !== currentFingerprint && <Alert severity="warning" sx={{ mt: 1 }}>The form changed after planning. Plan again before cloning.</Alert>}
        </Paper>
      )}

      <Stack direction="row" spacing={2} mb={2}>
        <Button variant="outlined" onClick={handlePlan} disabled={planning || executing || Boolean(status)}>{planning ? <CircularProgress size={20} /> : 'Plan Clone'}</Button>
        <Button variant="contained" startIcon={<ContentCopyIcon />} onClick={execute} disabled={!canExecute}>{executing ? <CircularProgress size={20} /> : 'Clone'}</Button>
      </Stack>

      {status && <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Status: {status}</Typography>
        {status === 'ACCEPTED' && !stillProcessing && <Typography>Committed and waiting for projection.</Typography>}
        {stillProcessing && <Alert severity="info">Still processing. Automatic polling paused after a transient status failure.</Alert>}
        {stillProcessing && <Button startIcon={<RefreshIcon />} onClick={refreshStatus}>Refresh status</Button>}
        {status === 'FAILED_DLQ' && <Alert severity="error">Clone projection failed. Code: {statusResult?.errorCode ?? 'FAILED_DLQ'}. Contact support with the clone request ID; copied values are not shown.</Alert>}
        {finished && status !== 'FAILED_DLQ' && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={2}>
          <Button onClick={() => navigate('/app/instance/InstanceAdmin')}>Open Instance</Button>
          <Button onClick={() => navigate('/app/config/configInstance', { state: { data: { instanceId: statusResult?.targetInstanceId } } })}>Open Configuration</Button>
          <Button onClick={() => navigate('/app/form/createClient', { state: { data: { hostId: source?.hostId, instanceId: statusResult?.targetInstanceId } } })}>Create OAuth Client</Button>
        </Stack>}
      </Paper>}
    </Box>
  );
}

function CloneTextField({ label, value, required, onChange }: {
  label: string; value: string; required?: boolean; onChange: (value: string) => void;
}) {
  return <TextField required={required} label={label} value={value} onChange={(event) => onChange(event.target.value)} />;
}

function CloneSelect({ label, value, original, options, loading, required, onChange }: {
  label: string; value: string; original?: string; options: CloneOption[]; loading: boolean; required?: boolean; onChange: (value: string) => void;
}) {
  const available = includeOriginalOption(options, original);
  const selected = available.find((option) => option.id === value) ?? null;
  return <Autocomplete options={available} value={selected} loading={loading} getOptionLabel={(option) => option.label}
    isOptionEqualToValue={(option, candidate) => option.id === candidate.id}
    onChange={(_event, option) => onChange(option?.id ?? '')}
    renderInput={(params) => <TextField {...params} required={required} label={label} />} />;
}

function SelectionList({ title, options, selected, onChange }: { title: string; options: CloneOption[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return <Box mt={2}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>{title}</Typography>
      <Button size="small" onClick={() => onChange(options.map((option) => option.id))} disabled={options.length === 0 || selected.length === options.length}>Select all</Button>
      <Button size="small" onClick={() => onChange([])} disabled={selected.length === 0}>Clear all</Button>
    </Stack>
    {options.length === 0 ? <Typography variant="body2">None available.</Typography> : options.map((option) => (
      <FormControlLabel key={option.id} control={<Checkbox checked={selected.includes(option.id)} onChange={(event) => onChange(event.target.checked ? [...selected, option.id] : selected.filter((value) => value !== option.id))} />} label={option.label} />
    ))}
  </Box>;
}
