import { Alert, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { OperatorActionResponse } from './types';

export function ReplayWaiverPanel({ failureIds, currentUserId, busy, error, onRequest, onApprove }:
  { failureIds: string[]; currentUserId?: string | null; busy: boolean; error?: string | null;
    onRequest: (reason: string) => Promise<OperatorActionResponse>;
    onApprove: (id: string, failureIds: string[], downstreamIds: string[], reason: string) => Promise<void> }) {
  const [reason, setReason] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const [request, setRequest] = useState<OperatorActionResponse | null>(null);
  const [approvalId, setApprovalId] = useState(''); const [requestedBy, setRequestedBy] = useState<string | null>(null);
  const [downstreamEvidence, setDownstreamEvidence] = useState('');
  if (!failureIds.length) return null;
  return <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1}>
    <Typography variant="h6">Waive failures (separate workflow)</Typography>
    <Alert severity="warning">Waiver does not replay events or advance projection metadata. It cannot be combined with replay execution.</Alert>
    {failureIds.map((id) => <Typography key={id} variant="body2"><code>{id}</code></Typography>)}
    {request?.downstreamBlockedFailureIds?.length ? <Alert severity="error">Downstream impact: {request.downstreamBlockedFailureIds.join(', ')}</Alert> : null}
    <TextField label="Waiver action request ID" value={approvalId}
      onChange={(event) => { setApprovalId(event.target.value.trim()); setRequestedBy(null); }}
      helperText="A second operator can enter the handed-off ID after independently reviewing every listed failure." />
    <TextField label="Confirmed downstream failure IDs" value={downstreamEvidence}
      onChange={(event) => setDownstreamEvidence(event.target.value)}
      helperText="Comma-separated IDs from the approval evidence; leave empty only when the downstream list is empty." />
    <TextField label="Waiver reason" value={reason} onChange={(event) => setReason(event.target.value)} multiline minRows={2} />
    <FormControlLabel control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />}
      label="I reviewed every listed transaction and acknowledge downstream dependency impact." />
    {error ? <Alert severity="error">{error}</Alert> : null}
    <Stack direction="row" spacing={1}>
      <Button variant="outlined" disabled={busy || !confirmed || !reason.trim() || !!request} onClick={async () => {
        try { const next = await onRequest(reason.trim()); setRequest(next); setApprovalId(next.waiverRequestId || ''); setRequestedBy(currentUserId || null); setDownstreamEvidence((next.downstreamBlockedFailureIds || []).join(', ')); }
        catch { /* parent displays a sanitized error */ }
      }}>Request waiver</Button>
      <Button color="warning" variant="contained" disabled={busy || !confirmed || !reason.trim() || !approvalId || requestedBy === currentUserId}
        onClick={() => onApprove(approvalId, failureIds,
          downstreamEvidence.split(',').map((value) => value.trim()).filter(Boolean), reason.trim())}>Approve waiver</Button>
    </Stack>
  </Stack></Paper>;
}
