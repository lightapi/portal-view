import { Alert, Button, Chip, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { SchemaForm, utils } from 'react-schema-form';
import { useEffect, useMemo, useState } from 'react';
import type { RepairDecision, ReplayFailure, ReplayRepair } from './types';
import { repairFormFor } from './repairForms';
import { canPlanRepair, canReviewRepair } from './workflow.mjs';

type CreateInput = {
  repairSchemaVersion: string;
  changeShape: 'SINGLE_EVENT_FIELDS' | 'PER_EVENT_FIELDS';
  changes: Record<string, unknown>;
  reason: string;
};

const timestamp = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';

export function ReplayRepairPanel({ failure, repair, currentUserId, busy, error, linkedReplayRequestId,
  onCreate, onDecision, onPlan, onClose }: {
  failure: ReplayFailure;
  repair: ReplayRepair | null;
  currentUserId?: string | null;
  busy: boolean;
  error?: string | null;
  linkedReplayRequestId?: string | null;
  onCreate: (input: CreateInput) => void;
  onDecision: (decision: RepairDecision, reason: string) => void;
  onPlan: () => void;
  onClose: () => void;
}) {
  const selection = useMemo(() => repairFormFor(failure), [failure]);
  const [models, setModels] = useState<Record<string, Record<string, unknown>>>({});
  const [reason, setReason] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const initial: Record<string, Record<string, unknown>> = {};
    selection?.eventIds.forEach((eventId) => { initial[eventId] = {}; });
    setModels(initial); setReason(''); setDecisionReason(''); setValidationError(null);
  }, [failure.failureId, selection]);

  useEffect(() => {
    if (!repair) return;
    // Corrected values are needed only long enough to submit the immutable
    // proposal. The metadata view must not retain them in browser state.
    setModels({}); setReason(''); setValidationError(null);
  }, [repair]);

  const change = (eventId: string, key: string | string[], value: unknown, type?: string) => {
    setModels((current) => {
      const model = { ...(current[eventId] || {}) };
      utils.selectOrSet(key, model, value, type);
      return { ...current, [eventId]: model };
    });
  };

  const submit = () => {
    if (!selection) return;
    for (const eventId of selection.eventIds) {
      const result = utils.validateBySchema(selection.definition.schema, models[eventId] || {});
      if (!result.valid) {
        setValidationError('Complete every required repair field before creating the immutable proposal.');
        return;
      }
    }
    setValidationError(null);
    const changes = selection.changeShape === 'SINGLE_EVENT_FIELDS'
      ? models[selection.eventIds[0]]
      : Object.fromEntries(selection.eventIds.map((eventId) => [eventId, models[eventId]]));
    onCreate({ repairSchemaVersion: selection.definition.repairSchemaVersion,
      changeShape: selection.changeShape, changes, reason: reason.trim() });
  };

  if (!repair) return <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
      <Typography variant="h6">Repair complete failure transaction</Typography>
      <Button onClick={onClose} disabled={busy}>Close</Button>
    </Stack>
    <Alert severity="warning">This creates an immutable amendment for complete failure transaction {failure.failureId} with {failure.eventCount} member(s). Original events are never changed. Only the fields below can be supplied; envelope, identity, ordering, keys, headers, and raw JSON are unavailable.</Alert>
    {!selection ? <Alert severity="info">No single unambiguous repair form is registered for the event types and schema versions in this transaction. Fix the processor and use Replay original instead.</Alert> : <>
      <Typography variant="body2">Schema: <code>{selection.definition.repairSchemaVersion}</code> · shape: {selection.changeShape}</Typography>
      <Typography variant="body2">{selection.eventIds.length} member(s) of type <code>{selection.definition.eventType}</code> are editable here; the other {failure.eventCount - selection.eventIds.length} transaction member(s) are preserved byte-identical.</Typography>
      {selection.eventIds.map((eventId, index) => <Stack spacing={1} key={eventId}>
        {selection.changeShape === 'PER_EVENT_FIELDS' ? <Typography variant="subtitle2">Transaction member {index + 1}: <code>{eventId}</code></Typography> : null}
        <SchemaForm schema={selection.definition.schema} form={selection.definition.form}
          model={models[eventId] || {}} showErrors={!!validationError}
          onModelChange={(key: string | string[], value: unknown, type?: string) => change(eventId, key, value, type)} />
      </Stack>)}
      <TextField label="Repair reason" value={reason} onChange={(event) => setReason(event.target.value)}
        multiline minRows={2} inputProps={{ maxLength: 2048 }} />
      {validationError ? <Alert severity="error">{validationError}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Button variant="contained" onClick={submit} disabled={busy || !reason.trim()}>Create repair proposal</Button>
    </>}
  </Stack></Paper>;

  const reviewable = canReviewRepair(repair.status, repair.requesterUserId, currentUserId);
  return <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} justifyContent="space-between">
      <Stack direction="row" spacing={1} alignItems="center"><Typography variant="h6">Repair {repair.repairId}</Typography><Chip size="small" label={repair.status} /></Stack>
      <Button onClick={onClose} disabled={busy}>Close</Button>
    </Stack>
    <Alert severity="info">Metadata only. Corrected payload values are intentionally not returned to this browser.</Alert>
    <Typography variant="body2">Failure: <code>{repair.failureId}</code> · schema: <code>{repair.repairSchemaVersion}</code></Typography>
    <Typography variant="body2">Changed fields: {repair.changedFieldNames.join(', ') || '—'}</Typography>
    <Typography variant="body2">Original transaction fingerprint: <code>{repair.originalTransactionFingerprint}</code></Typography>
    <Typography variant="body2">Corrected transaction fingerprint: <code>{repair.correctedTransactionFingerprint}</code></Typography>
    {repair.events.map((event) => <Typography variant="caption" key={event.eventId}>
      Member {event.ordinal + 1} · {event.changedFieldNames.join(', ')} · original digest <code>{event.originalPayloadDigest}</code> · corrected digest <code>{event.correctedPayloadDigest}</code>
    </Typography>)}
    <Typography variant="body2">Requested by {repair.requesterUserId} at {timestamp(repair.requestedTs)} · reason: {repair.reason}</Typography>
    <Typography variant="body2">Reviewed by {repair.reviewerUserId || '—'} at {timestamp(repair.decisionTs)} · approved by {repair.approverUserId || '—'}</Typography>
    <Typography variant="body2">Linked replay plan: {linkedReplayRequestId ? <><code>{linkedReplayRequestId}</code>{repair.linkedReplayStatus ? ` · ${repair.linkedReplayStatus}` : ''}</> : 'not created'}</Typography>
    {repair.status === 'AWAITING_APPROVAL' && repair.requesterUserId === currentUserId
      ? <Alert severity="warning">A different authorized user must approve or reject this repair. Repair approval does not approve the later replay plan.</Alert> : null}
    {['CANCELLED', 'REJECTED'].includes(repair.status) ? <Alert severity="error">This repair cannot be planned. Create a new proposal from the current failure metadata.</Alert> : null}
    {repair.status === 'APPLIED' ? <Alert severity="success">The approved correction was applied by replay. The failure and related views are being refreshed.</Alert> : null}
    {error ? <Alert severity="error">{error}</Alert> : null}
    {repair.status === 'AWAITING_APPROVAL' ? <><Divider />
      <TextField label="Review reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} multiline minRows={2} inputProps={{ maxLength: 2048 }} />
      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={busy || !decisionReason.trim() || !reviewable}
          onClick={() => onDecision('APPROVE', decisionReason.trim())}>Approve repair</Button>
        <Button color="error" variant="outlined" disabled={busy || !decisionReason.trim() || !reviewable}
          onClick={() => onDecision('REJECT', decisionReason.trim())}>Reject repair</Button>
      </Stack></> : null}
    {canPlanRepair(repair.status) ? <>
      <Alert severity="warning">Create a repair-bound replay plan next. That immutable plan requires its own approval by a different authorized user before execution.</Alert>
      <Button variant="contained" onClick={onPlan} disabled={busy || !!linkedReplayRequestId}>Plan approved repair</Button>
    </> : null}
  </Stack></Paper>;
}
