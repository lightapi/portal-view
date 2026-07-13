import { Alert, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { OperatorActionResponse, ReplayBarrier, ReplayStatus } from './types';

export function ReplayQuarantinePanel({ replay, currentUserId, busy, error, onFollowUp, onRequestRelease, onApproveRelease }:
  { replay: ReplayStatus; currentUserId?: string | null; busy: boolean; error?: string | null; onFollowUp: (failureId: string) => void;
    onRequestRelease: (barrier: ReplayBarrier, reason: string) => Promise<OperatorActionResponse>;
    onApproveRelease: (actionRequestId: string, reason: string) => Promise<void> }) {
  const quarantines = replay.barriers.filter((barrier) => barrier.state === 'QUARANTINED' && !barrier.releasedTs);
  const [reason, setReason] = useState('');
  const [danger, setDanger] = useState(false);
  const [actionId, setActionId] = useState('');
  const [requestedBy, setRequestedBy] = useState<string | null>(null);
  if (!quarantines.length) return null;
  return <Paper variant="outlined" sx={{ p: 2, borderColor: 'error.main' }}><Stack spacing={1.5}>
    <Typography variant="h6" color="error">Quarantined projection scope</Typography>
    <Alert severity="error">Repair did not complete. Live work is quarantined; this is not a successful replay.</Alert>
    {quarantines.map((barrier) => <Stack key={barrier.barrierId} spacing={.5}>
      <Typography variant="body2">{barrier.scopeType}: <code>{barrier.scopeKey}</code></Typography>
      <Typography variant="body2">Owner failure: <code>{barrier.quarantineFailureId || 'unavailable'}</code> · epoch {barrier.barrierEpoch}</Typography>
      <Typography variant="body2">Age: {barrier.installedTs ? Math.max(0, Math.floor((Date.now() - new Date(barrier.installedTs).getTime()) / 60000)) + ' minutes' : 'unknown'}</Typography>
      {barrier.quarantineFailureId ? <Button sx={{ alignSelf: 'flex-start' }} onClick={() => onFollowUp(barrier.quarantineFailureId!)}>Select owner for follow-up plan</Button> : null}
    </Stack>)}
    <Typography variant="body2">Deferred work: {replay.deferred.count} transaction(s), {new Intl.NumberFormat().format(replay.deferred.encryptedBytes)} encrypted bytes · capacity: {replay.deferred.capacityState || 'UNKNOWN'}. Capacity is enforced by the server; no client override is available.</Typography>
    <Alert severity="warning">RELEASE_WITH_GAP resumes traffic without repairing the projection, leaves the failure OPEN, and does not advance projection metadata. It requires separate break-glass approval.</Alert>
    <TextField label="Emergency release reason" value={reason} onChange={(event) => setReason(event.target.value)} multiline minRows={2} />
    <FormControlLabel control={<Checkbox checked={danger} onChange={(event) => setDanger(event.target.checked)} />}
      label="I understand this releases traffic with a known projection gap and is not a repair." />
    {actionId ? <Alert severity="info">Break-glass action {actionId} awaits approval by a different authorized operator.</Alert> : null}
    <TextField label="Break-glass action request ID" value={actionId}
      onChange={(event) => { setActionId(event.target.value.trim()); setRequestedBy(null); }}
      helperText="A second operator can enter the handed-off action ID after reviewing the incident evidence." />
    {error ? <Alert severity="error">{error}</Alert> : null}
    <Stack direction="row" spacing={1}>
      <Button color="error" variant="outlined" disabled={busy || !danger || !reason.trim() || !!actionId}
        onClick={async () => { try { const result = await onRequestRelease(quarantines[0], reason.trim()); setActionId(result.actionRequestId || ''); setRequestedBy(currentUserId || null); } catch { /* parent displays a sanitized error */ } }}>Request RELEASE_WITH_GAP</Button>
      <Button color="error" variant="contained" disabled={busy || !danger || !reason.trim() || !actionId || requestedBy === currentUserId}
        onClick={() => onApproveRelease(actionId, reason.trim())}>Approve break-glass release</Button>
    </Stack>
  </Stack></Paper>;
}
