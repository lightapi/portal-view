import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';
import { useUserState } from '../../contexts/UserContext';
import { hasAnyRole } from '../../utils/ownershipScope';

type Binding = {
  bindingId: string;
  environment: string;
  profileId: string;
  deploymentProfile: string;
  lifecycleState: string;
  desiredGeneration: number;
  observedGeneration: number;
  expectedDatabase: string;
  bindingDigest: string;
  credentialGeneration: number;
  retentionHold: boolean;
  retentionReason?: string;
  failureCode?: string;
  providerResourceRef?: string;
  published: boolean;
  aggregateVersion: number;
  jobState?: string;
  operationKind?: string;
  attemptCount?: number;
  updateTs?: string;
};

type Profile = { profileId: string; profileVersion: number; deploymentProfile: string; provider: string; active: boolean };
type BindingCommand = (action: string, data: Record<string, unknown>, confirmation?: string) => Promise<void>;

const queryUrl = (action: string, data: Record<string, unknown>) => {
  const cmd = { host: 'lightapi.net', service: 'host', action, version: '0.1.0', data };
  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
};

function BindingCard({ binding, canManage, busy, command }: {
  binding: Binding;
  canManage: boolean;
  busy: string | null;
  command: BindingCommand;
}) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          <Typography variant="h6">{binding.environment}</Typography>
          <Chip label={binding.lifecycleState}
            color={binding.lifecycleState === 'READY' ? 'success' : binding.lifecycleState === 'FAILED' ? 'error' : 'warning'} />
          <Chip label={binding.published ? 'Published' : 'Not published'} variant="outlined" />
          {binding.retentionHold && <Chip label="Retention hold" color="secondary" />}
        </Stack>
        <Stack spacing={0.8} divider={<Divider flexItem />}>
          <Typography><b>Profile:</b> {binding.profileId} / {binding.deploymentProfile}</Typography>
          <Typography><b>Generation:</b> desired {binding.desiredGeneration}, observed {binding.observedGeneration}</Typography>
          <Typography><b>Database identity:</b> {binding.expectedDatabase}</Typography>
          <Typography><b>Credential generation:</b> {binding.credentialGeneration}</Typography>
          <Typography><b>Provisioning job:</b> {binding.jobState ?? 'none'} {binding.operationKind ? `(${binding.operationKind})` : ''}</Typography>
          <Typography><b>Attempts:</b> {binding.attemptCount ?? 0}</Typography>
          {binding.failureCode && <Typography color="error"><b>Failure:</b> {binding.failureCode}</Typography>}
          {binding.providerResourceRef && <Typography><b>Provider resource:</b> {binding.providerResourceRef}</Typography>}
          {binding.retentionReason && <Typography><b>Hold reason:</b> {binding.retentionReason}</Typography>}
          <Typography variant="caption" sx={{ wordBreak: 'break-all' }}><b>Binding digest:</b> {binding.bindingDigest}</Typography>
        </Stack>
        {canManage && binding.lifecycleState !== 'DECOMMISSIONED' && (
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 2 }}>
            {binding.lifecycleState === 'FAILED' && <Button variant="contained" disabled={busy !== null}
              onClick={() => void command('retryOperationalStoreBinding', { bindingId: binding.bindingId })}>Retry</Button>}
            {binding.lifecycleState === 'READY' && <Button disabled={busy !== null}
              onClick={() => void command('rotateOperationalStoreCredential', { bindingId: binding.bindingId })}>Rotate credential</Button>}
            {['READY', 'FAILED'].includes(binding.lifecycleState) && <Button disabled={busy !== null}
              onClick={() => void command('deactivateOperationalStoreBinding', { bindingId: binding.bindingId }, 'Deactivate runtime access? Operational data will be retained.')}>Deactivate</Button>}
            {!binding.retentionHold && ['READY', 'FAILED', 'DEACTIVATED', 'DECOMMISSION_REQUESTED'].includes(binding.lifecycleState) && <Button disabled={busy !== null}
              onClick={() => { const reason = window.prompt('Retention-hold reason'); if (reason) void command('applyOperationalStoreRetentionHold', { bindingId: binding.bindingId, retentionReason: reason }); }}>Apply hold</Button>}
            {binding.lifecycleState === 'RETENTION_HOLD' && <Button disabled={busy !== null}
              onClick={() => void command('releaseOperationalStoreRetentionHold', { bindingId: binding.bindingId })}>Release hold</Button>}
            {['DEACTIVATED', 'FAILED'].includes(binding.lifecycleState) && !binding.retentionHold && <Button color="error" disabled={busy !== null}
              onClick={() => void command('decommissionOperationalStoreBinding', { bindingId: binding.bindingId }, 'Request decommission? This is separate from deleting the Host. The development provider fences the store and preserves its volume by default.')}>Decommission</Button>}
            {busy && <CircularProgress size={24} />}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default function OperationalStoreAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const state = location.state as { hostId?: string; subDomain?: string } | null;
  const hostId = state?.hostId ?? params.get('hostId') ?? '';
  const hostLabel = state?.subDomain ?? hostId;
  const { roles } = useUserState() as { roles?: string | null };
  const canManage = hasAnyRole(roles, ['admin', 'host-admin']);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [environment, setEnvironment] = useState('dev');
  const [profileId, setProfileId] = useState('dev-dedicated-postgres-v1');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hostId) return;
    setLoading(true); setError(null);
    try {
      const [bindingResult, profileResult] = await Promise.all([
        fetchClient(queryUrl('getOperationalStoreBindings', { targetHostId: hostId, includeInactive: true })),
        fetchClient(queryUrl('getOperationalStoreProfiles', { active: true })),
      ]) as [{ bindings: Binding[] }, { profiles: Profile[] }];
      setBindings(bindingResult.bindings ?? []);
      setProfiles((profileResult.profiles ?? []).filter(profile => profile.active && profile.deploymentProfile !== 'DEV_POOLED'));
    } catch (reason) { setError(loadErrorMessage(reason)); }
    finally { setLoading(false); }
  }, [hostId]);

  useEffect(() => { void load(); }, [load]);

  const activeEnvironments = useMemo(() => new Set(bindings
    .filter(binding => binding.lifecycleState !== 'DECOMMISSIONED')
    .map(binding => binding.environment)), [bindings]);
  const environmentAlreadyBound = activeEnvironments.has(environment);

  const command = useCallback(async (action: string, data: Record<string, unknown>, confirmation?: string) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(action); setError(null);
    const cmd = { host: 'lightapi.net', service: 'host', action, version: '0.1.0', data: { targetHostId: hostId, ...data } };
    const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
    if (result.error) setError(loadErrorMessage(result.error));
    else window.setTimeout(() => void load(), 500);
    setBusy(null);
  }, [hostId, load]);

  if (!hostId) return <Alert severity="error">A Host ID is required.</Alert>;
  if (loading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 2, maxWidth: 1050 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Operational Storage</Typography>
          <Typography color="text.secondary">Host: {hostLabel}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} onClick={() => void load()}>Refresh</Button>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/host/HostAdmin')}>Hosts</Button>
        </Stack>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>
        Host identity and storage provisioning are separate. This Host remains valid if provisioning is pending or fails; only a READY binding is published to runtimes.
      </Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Request storage for an environment</Typography>
            <Stack spacing={2}>
              <TextField label="Environment" value={environment} onChange={event => setEnvironment(event.target.value)}
                error={environmentAlreadyBound}
                helperText={environmentAlreadyBound
                  ? 'This Host already has an active binding for the environment.'
                  : 'Lowercase Host/environment identifier; provisioning runs asynchronously.'} />
              <FormControl>
                <InputLabel>Storage profile</InputLabel>
                <Select label="Storage profile" value={profileId} onChange={event => setProfileId(event.target.value)}>
                  {profiles.map(profile => <MenuItem key={`${profile.profileId}:${profile.profileVersion}`} value={profile.profileId}>
                    {profile.profileId} ({profile.deploymentProfile})
                  </MenuItem>)}
                </Select>
              </FormControl>
              <Box><Button variant="contained" disabled={!canManage || busy !== null || environmentAlreadyBound || profiles.length === 0}
                onClick={() => void command('requestOperationalStoreBinding', { environment, profileId })}>Request provisioning</Button></Box>
              {!canManage && <Alert severity="warning">host-admin permission is required to request or change storage.</Alert>}
            </Stack>
          </CardContent>
        </Card>
        {bindings.length === 0
          ? <Alert severity="info">No storage binding has been requested for this Host.</Alert>
          : bindings.map(binding => <BindingCard key={binding.bindingId} binding={binding}
            canManage={canManage} busy={busy} command={command} />)}
      </Stack>
    </Box>
  );
}
