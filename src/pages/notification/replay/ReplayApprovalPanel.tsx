import { Alert, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { ReplayStatus } from './types';
import { canApprove, canExecute } from './workflow.mjs';

export function ReplayApprovalPanel({ replay, currentUserId, busy, error, onApprove, onExecute, onCancel }:
  { replay: ReplayStatus; currentUserId?: string | null; busy: boolean; error?: string | null;
    onApprove: (reason: string) => void; onExecute: (reason: string) => void; onCancel: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const [confirmedHash, setConfirmedHash] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setConfirmed(false); setConfirmedHash(''); setReason(''); }, [replay.replayRequestId, replay.status]);
  const approvable = canApprove(replay.status, replay.stale, replay.requestedBy, currentUserId);
  const executable = canExecute(replay.status, replay.stale, replay.validationMode, replay.approvedBy, replay.planHash, confirmedHash);
  const cancellable = ['READY', 'AWAITING_APPROVAL', 'APPROVED'].includes(replay.status) && !replay.stale;
  return <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}>
    <Typography variant="h6">Approval and execution</Typography>
    <Alert severity="warning">Approval and execution are separate server-authorized actions. The requester cannot approve their own plan.</Alert>
    <TextField label="Action reason" value={reason} multiline minRows={2} onChange={(event) => setReason(event.target.value)} inputProps={{ maxLength: 2048 }} />
    <TextField label="Confirm exact plan hash before execution" value={confirmedHash} onChange={(event) => setConfirmedHash(event.target.value)}
      placeholder={replay.planHash} disabled={replay.status !== 'APPROVED'} />
    <FormControlLabel control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />}
      label="I reviewed the immutable plan, dependency-added transactions, isolation scope, and blast radius." />
    {replay.requestedBy === currentUserId && replay.status === 'AWAITING_APPROVAL'
      ? <Alert severity="info">A different authorized operator must approve this plan.</Alert> : null}
    {replay.validationMode === 'VALIDATE_ONLY' ? <Alert severity="info">VALIDATE_ONLY plans cannot execute.</Alert> : null}
    {error ? <Alert severity="error">{error}</Alert> : null}
    <Stack direction="row" spacing={1} flexWrap="wrap">
      <Button variant="contained" disabled={busy || !confirmed || !reason.trim() || !approvable} onClick={() => onApprove(reason.trim())}>Approve exact hash</Button>
      <Button color="warning" variant="contained" disabled={busy || !confirmed || !reason.trim() || !executable} onClick={() => onExecute(reason.trim())}>Execute approved plan</Button>
      <Button color="error" variant="outlined" disabled={busy || !reason.trim() || !cancellable} onClick={() => onCancel(reason.trim())}>Cancel plan</Button>
    </Stack>
  </Stack></Paper>;
}

