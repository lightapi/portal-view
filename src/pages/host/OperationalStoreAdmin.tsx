import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiPost } from '../../api/apiPost';
import HelpLink from '../../components/HelpLink';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';
import { useUserState } from '../../contexts/UserContext';
import { hasAnyRole } from '../../utils/ownershipScope';
import {
  type OperationalStoreCredentialSource,
  type OperationalStoreRegistrationRequestV2,
  type OperationalStoreRegistrationV2,
  type OperationalStoreTlsMode,
  validateOperationalStoreRegistrationRequestV2,
} from './operationalStoreRegistrationContract';

type Registration = OperationalStoreRegistrationV2 & { updateUser?: string; updateTs?: string };
type LegacyBinding = {
  bindingId: string;
  contractVersion?: 1;
  environment?: string;
  lifecycleState: string;
  expectedDatabase?: string;
  aggregateVersion: number;
  active: boolean;
  published: boolean;
};
type Binding = Registration | LegacyBinding;
type HostInfo = { domain?: string; subDomain?: string };
type RegistrationAction =
  | 'registerOperationalStoreBinding'
  | 'updateOperationalStoreBinding'
  | 'deactivateOperationalStoreBinding'
  | 'unregisterOperationalStoreBinding';
type RegistrationCommand = (
  action: RegistrationAction,
  data: Record<string, unknown>,
  confirmation?: string,
) => Promise<void>;
type RegistrationFormState = {
  serverHost: string;
  port: string;
  expectedDatabase: string;
  tlsMode: OperationalStoreTlsMode;
  credentialSource: OperationalStoreCredentialSource;
  credentialReference: string;
  minimumSchemaGeneration: string;
  credentialGeneration: string;
};

const HELP_PATH = '/help/portal-view/pages/operational-storage';
const DEFAULT_FORM: RegistrationFormState = {
  serverHost: '',
  port: '5432',
  expectedDatabase: '',
  tlsMode: 'VERIFY_FULL',
  credentialSource: 'MOUNTED_FILE',
  credentialReference: '/run/secrets/operational-database-url',
  minimumSchemaGeneration: '2',
  credentialGeneration: '1',
};

const queryUrl = (action: string, data: Record<string, unknown>) => {
  const cmd = { host: 'lightapi.net', service: 'host', action, version: '0.1.0', data };
  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
};

function buildOperationalStoreRegistrationRequest(
  hostId: string,
  form: RegistrationFormState,
  aggregateVersion?: number,
): OperationalStoreRegistrationRequestV2 {
  return {
    targetHostId: hostId,
    engine: 'POSTGRESQL',
    serverHost: form.serverHost.trim(),
    port: Number(form.port),
    expectedDatabase: form.expectedDatabase.trim(),
    tlsMode: form.tlsMode,
    credentialSource: form.credentialSource,
    credentialReference: form.credentialReference.trim(),
    minimumSchemaGeneration: Number(form.minimumSchemaGeneration),
    credentialGeneration: Number(form.credentialGeneration),
    ...(aggregateVersion === undefined ? {} : { aggregateVersion }),
  };
}

function formFromRegistration(registration: Registration): RegistrationFormState {
  return {
    serverHost: registration.serverHost,
    port: String(registration.port),
    expectedDatabase: registration.expectedDatabase,
    tlsMode: registration.tlsMode,
    credentialSource: registration.credentialSource,
    credentialReference: registration.credentialReference,
    minimumSchemaGeneration: String(registration.minimumSchemaGeneration),
    credentialGeneration: String(registration.credentialGeneration),
  };
}

function isRegistration(binding: Binding): binding is Registration {
  return binding.contractVersion === 2;
}

function lifecycleColor(state: Registration['lifecycleState']) {
  if (state === 'REGISTERED') return 'success';
  if (state === 'DEACTIVATED') return 'warning';
  return 'default';
}

function RegistrationCard({ registration, canManage, busy, command }: {
  registration: Registration;
  canManage: boolean;
  busy: string | null;
  command: RegistrationCommand;
}) {
  const active = registration.active && registration.lifecycleState !== 'UNREGISTERED';
  return (
    <Card data-testid={`registration-${registration.lifecycleState.toLowerCase()}`}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          <Typography variant="h6">Registration</Typography>
          <Chip label={registration.lifecycleState} color={lifecycleColor(registration.lifecycleState)} />
          <Chip label={registration.published ? 'Published' : 'Not published'} variant="outlined" />
        </Stack>
        <Stack spacing={0.8} divider={<Divider flexItem />}>
          <Typography><b>Database server:</b> {registration.serverHost}:{registration.port}</Typography>
          <Typography><b>Database identity:</b> {registration.expectedDatabase}</Typography>
          <Typography><b>TLS mode:</b> {registration.tlsMode}</Typography>
          <Typography><b>Credential reference:</b> {registration.credentialReference} ({registration.credentialSource})</Typography>
          <Typography><b>Schema generation:</b> {registration.minimumSchemaGeneration}</Typography>
          <Typography><b>Credential generation:</b> {registration.credentialGeneration}</Typography>
          <Typography><b>Registration version:</b> {registration.aggregateVersion}</Typography>
          <Typography variant="caption" sx={{ wordBreak: 'break-all' }}><b>Binding digest:</b> {registration.bindingDigest}</Typography>
          {registration.updateTs && <Typography variant="caption"><b>Updated:</b> {registration.updateTs}</Typography>}
        </Stack>
        {canManage && active && (
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 2 }}>
            {registration.lifecycleState === 'REGISTERED' && (
              <Button disabled={busy !== null} onClick={() => void command(
                'deactivateOperationalStoreBinding',
                { aggregateVersion: registration.aggregateVersion },
                'Deactivate this registration and revoke runtime publication? The database will not be changed.',
              )}>Deactivate</Button>
            )}
            <Button color="error" disabled={busy !== null} onClick={() => void command(
              'unregisterOperationalStoreBinding',
              { aggregateVersion: registration.aggregateVersion },
              'Unregister operational storage? The database and credentials will not be changed.',
            )}>Unregister</Button>
            {busy && <CircularProgress size={24} />}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function LegacyBindingCard({ binding }: { binding: LegacyBinding }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6">Historical provisioning binding</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Contract version 1 record for {binding.environment ?? 'an earlier environment'}.
          It remains read-only for audit and replay compatibility.
        </Typography>
        <Typography sx={{ mt: 1 }}><b>Lifecycle:</b> {binding.lifecycleState}</Typography>
        {binding.expectedDatabase && <Typography><b>Database identity:</b> {binding.expectedDatabase}</Typography>}
      </CardContent>
    </Card>
  );
}

export default function OperationalStoreAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const state = location.state as { hostId?: string; domain?: string; subDomain?: string } | null;
  const hostId = state?.hostId ?? params.get('hostId') ?? '';
  const initialHostLabel = [state?.subDomain, state?.domain].filter(Boolean).join('.') || hostId;
  const { roles } = useUserState() as { roles?: string | null };
  const canManage = hasAnyRole(roles, ['admin', 'host-admin']);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [form, setForm] = useState<RegistrationFormState>(DEFAULT_FORM);
  const [hostLabel, setHostLabel] = useState(initialHostLabel);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const registerIdempotencyKey = useRef<string | null>(null);

  const currentRegistration = useMemo(() => bindings.find(binding =>
    isRegistration(binding) && binding.active && binding.lifecycleState !== 'UNREGISTERED') as Registration | undefined,
  [bindings]);
  const reactivating = currentRegistration?.lifecycleState === 'DEACTIVATED';

  const load = useCallback(async () => {
    if (!hostId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [bindingResult, hostResult] = await Promise.all([
        fetchClient(queryUrl('getOperationalStoreBindings', { targetHostId: hostId, includeInactive: true })),
        fetchClient(queryUrl('getHostById', { hostId })).catch(() => null),
      ]) as [{ bindings: Binding[] }, HostInfo | null];
      setBindings(bindingResult.bindings ?? []);
      if (hostResult?.domain) {
        setHostLabel([hostResult.subDomain, hostResult.domain].filter(Boolean).join('.'));
      }
    } catch (reason) {
      setError(loadErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setForm(currentRegistration ? formFromRegistration(currentRegistration) : DEFAULT_FORM);
    setFormErrors([]);
  }, [currentRegistration]);

  const command = useCallback(async (
    action: RegistrationAction,
    data: Record<string, unknown>,
    confirmation?: string,
    idempotencyKey?: string,
  ) => {
    if (confirmation && !window.confirm(confirmation)) return false;
    setBusy(action);
    setError(null);
    try {
      const cmd = {
        host: 'lightapi.net', service: 'host', action, version: '0.2.0',
        data: { targetHostId: hostId, ...data },
      };
      const result = await apiPost({
        url: '/portal/command',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
        body: cmd,
      });
      if (result.error) {
        setError(loadErrorMessage(result.error));
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(null);
    }
  }, [hostId, load]);

  const submitRegistration = useCallback(async () => {
    const update = currentRegistration !== undefined;
    const request = buildOperationalStoreRegistrationRequest(
      hostId, form, currentRegistration?.aggregateVersion,
    );
    const violations = validateOperationalStoreRegistrationRequestV2(request, update);
    setFormErrors(violations);
    if (violations.length > 0) return;
    const idempotencyKey = update ? undefined
      : (registerIdempotencyKey.current ??= globalThis.crypto.randomUUID());
    const succeeded = await command(
      update ? 'updateOperationalStoreBinding' : 'registerOperationalStoreBinding',
      Object.fromEntries(Object.entries(request).filter(([key]) => key !== 'targetHostId')),
      reactivating
        ? 'Reactivate this registration and republish runtime configuration? The database will not be changed.'
        : undefined,
      idempotencyKey,
    );
    if (succeeded && !update) registerIdempotencyKey.current = null;
  }, [command, currentRegistration, form, hostId, reactivating]);

  const setField = <K extends keyof RegistrationFormState>(key: K, value: RegistrationFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  if (!hostId) return <Alert severity="error">A Host ID is required.</Alert>;
  if (loading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;

  const registrations = bindings.filter(isRegistration);
  const legacyBindings = bindings.filter(binding => !isRegistration(binding));

  return (
    <Box sx={{ p: 2, maxWidth: 1050 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Operational Storage</Typography>
          <Typography color="text.secondary">Host: {hostLabel}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} onClick={() => void load()}>Refresh</Button>
          <HelpLink helpPath={HELP_PATH} tooltip="Help: Operational Storage" />
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/host/HostAdmin')}>Hosts</Button>
        </Stack>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>
        Register an existing database for this Host. Portal stores and publishes connection metadata;
        it does not create, alter, validate, or delete the database.
      </Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              {reactivating ? 'Reactivate registration'
                : currentRegistration ? 'Update registration' : 'Register storage'}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              The selected Host is the scope. Credential references must point to a deployment secret;
              do not enter a password or password-bearing database URL.
            </Typography>
            <Stack spacing={2}>
              <TextField label="Engine" value="POSTGRESQL" disabled />
              <TextField required label="Database server" value={form.serverHost}
                onChange={event => setField('serverHost', event.target.value)} />
              <TextField required label="Port" type="number" value={form.port}
                onChange={event => setField('port', event.target.value)} inputProps={{ min: 1, max: 65535 }} />
              <TextField required label="Database name" value={form.expectedDatabase}
                onChange={event => setField('expectedDatabase', event.target.value)} />
              <FormControl required>
                <InputLabel>TLS mode</InputLabel>
                <Select label="TLS mode" value={form.tlsMode}
                  onChange={event => setField('tlsMode', event.target.value as OperationalStoreTlsMode)}>
                  {['DISABLE', 'PREFER', 'REQUIRE', 'VERIFY_CA', 'VERIFY_FULL'].map(mode =>
                    <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Credential source" value="Mounted file" disabled />
              <TextField required label="Credential reference" value={form.credentialReference}
                onChange={event => setField('credentialReference', event.target.value)}
                helperText="Absolute path visible to every runtime service using this registration." />
              <TextField required label="Minimum schema generation" type="number"
                value={form.minimumSchemaGeneration}
                onChange={event => setField('minimumSchemaGeneration', event.target.value)} inputProps={{ min: 1 }} />
              <TextField required label="Credential generation" type="number"
                value={form.credentialGeneration}
                onChange={event => setField('credentialGeneration', event.target.value)} inputProps={{ min: 1 }} />
              {formErrors.length > 0 && (
                <Alert severity="error">
                  {formErrors.map(message => <Typography key={message}>{message}</Typography>)}
                </Alert>
              )}
              <Box>
                <Button variant="contained" disabled={!canManage || busy !== null}
                  onClick={() => void submitRegistration()}>
                  {reactivating ? 'Reactivate registration'
                    : currentRegistration ? 'Update registration' : 'Register storage'}
                </Button>
                {busy && <CircularProgress size={24} sx={{ ml: 2, verticalAlign: 'middle' }} />}
              </Box>
              {!canManage && (
                <Alert severity="warning">host-admin permission is required to manage operational storage.</Alert>
              )}
            </Stack>
          </CardContent>
        </Card>

        {registrations.map(registration => (
          <RegistrationCard key={registration.bindingId} registration={registration}
            canManage={canManage} busy={busy} command={command} />
        ))}
        {registrations.length === 0 && (
          <Alert severity="info">No operational storage is registered for this Host.</Alert>
        )}
        {legacyBindings.map(binding => <LegacyBindingCard key={binding.bindingId} binding={binding} />)}
      </Stack>
    </Box>
  );
}
