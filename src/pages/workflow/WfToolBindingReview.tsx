import {useCallback, useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Alert, Box, Button, CircularProgress, Stack, TextField, Typography} from '@mui/material';
import {useUserState} from '../../contexts/UserContext';
import {workflowAdminClient} from './workflowAdminClient';
import {portalError, workflowPortalClient} from './workflowPortalClient';
import WorkflowOperationRecovery, {operationState, type OperationState} from './WorkflowOperationRecovery';

type Revision = {bindingId: string; toolId: string; toolName: string; wfDefId: string;
  workflowVersion: string; revisionStatus: string; bindingDigest: string; requestedBy: string;
  requestedTs: string; owner?: {userId?: string; positionId?: string};
  binding: Record<string, any>; dependencies: any[]; endpointTargets: any[]; writeTasks: any[]};
type View = {revision: Revision; activeRevision?: Revision; carryOverDeniedReason?: string;
  decisions: Array<{decisionId: string; bindingId: string; action: string; actor: string;
    comment?: string; decidedTs: string}>};

export function bindingDiff(current: Revision, active?: Revision) {
  if (!active) return [];
  const fields = ['workflowVersion', 'definitionDigest', 'schemaDigest', 'invocationMode',
    'inputSchema', 'outputSchema',
    'syncWaitMs', 'totalDeadlineMs', 'executionClass', 'cancellationPolicy', 'idempotencyPolicy',
    'delegationPolicy', 'runtimeBounds', 'admissionLimits', 'callerPolicy', 'toolAnnotations'];
  return [...fields.map(field => ({field, before: active.binding[field], after: current.binding[field]})),
    {field: 'dependencies', before: active.dependencies, after: current.dependencies},
    {field: 'endpointTargets', before: active.endpointTargets, after: current.endpointTargets},
    {field: 'writeTasks', before: active.writeTasks, after: current.writeTasks}]
    .filter(item => JSON.stringify(item.before) !== JSON.stringify(item.after));
}

function Detail({title, value}: {title: string; value: unknown}) {
  return <Box><Typography variant="subtitle1">{title}</Typography>
    <Box component="pre" sx={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', m: 0}}>
      {JSON.stringify(value, null, 2) ?? 'None'}</Box></Box>;
}

export default function WfToolBindingReview() {
  const {bindingId} = useParams();
  const {host} = useUserState();
  const navigate = useNavigate();
  const [view, setView] = useState<View | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [operation, setOperation] = useState<OperationState | null>(null);
  const [lastAction, setLastAction] = useState<'approve' | 'reject' | 'revoke'>('approve');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!host || !bindingId) return;
    setLoading(true); setError('');
    try { setView(await workflowAdminClient.getBinding(host, bindingId)); }
    catch (reason: any) { setError(reason?.message ?? 'Could not load binding revision.'); }
    finally { setLoading(false); }
  }, [host, bindingId]);
  useEffect(() => { void load(); }, [load]);
  const revision = view?.revision;
  const act = async (kind: 'approve' | 'reject' | 'revoke') => {
    if (!host || !revision || ((kind === 'reject' || kind === 'revoke') && !comment.trim())) return;
    setLastAction(kind);
    setLoading(true); setError(''); setOperation(null);
    try {
      if (kind === 'revoke') await workflowPortalClient.revokeBinding(host, revision.bindingId,
        revision.bindingDigest, comment.trim());
      else await workflowPortalClient.decideBinding(host, revision.bindingId, revision.bindingDigest,
        kind, comment.trim() || undefined);
      setComment('');
      let refreshWarning = '';
      try { await workflowPortalClient.refreshBindings(host, [revision.toolId]); }
      catch (reason) { refreshWarning = `Decision recorded; status refresh failed: ${portalError(reason).message}`; }
      await load();
      if (refreshWarning) setError(refreshWarning);
    } catch (reason) {
      const failure = portalError(reason);
      setError(failure.message);
      setOperation(operationState(failure));
      // The loaded digest remains fixed. A conflict requires an explicit Refresh.
    } finally { setLoading(false); }
  };
  return <Box sx={{p: 3}}><Stack spacing={2}>
    <Button onClick={() => navigate(-1)}>Back</Button>
    <Typography variant="h5">Tool binding revision review</Typography>
    {loading && <CircularProgress aria-label="Loading binding revision" />}
    {error && <Alert severity="error">{error}</Alert>}
    {view && revision && <>
      <Alert severity="info">Revision {revision.bindingId} · {revision.revisionStatus}</Alert>
      <Detail title="Requester" value={{requestedBy: revision.requestedBy, requestedTs: revision.requestedTs,
        owner: revision.owner}} />
      <Detail title="Target" value={{toolId: revision.toolId, toolName: revision.toolName,
        wfDefId: revision.wfDefId, workflowVersion: revision.workflowVersion,
        definitionDigest: revision.binding.definitionDigest}} />
      <Detail title="Input schema" value={revision.binding.inputSchema} />
      <Detail title="Output schema" value={revision.binding.outputSchema} />
      <Detail title="Execution" value={{invocationMode: revision.binding.invocationMode,
        executionClass: revision.binding.executionClass, cancellationPolicy: revision.binding.cancellationPolicy,
        idempotencyPolicy: revision.binding.idempotencyPolicy}} />
      <Detail title="Limits" value={{syncWaitMs: revision.binding.syncWaitMs,
        totalDeadlineMs: revision.binding.totalDeadlineMs, admissionLimits: revision.binding.admissionLimits,
        runtimeBounds: revision.binding.runtimeBounds}} />
      <Detail title="Reach" value={{dependencies: revision.dependencies,
        endpointTargets: revision.endpointTargets, writeTasks: revision.writeTasks,
        callerPolicy: revision.binding.callerPolicy}} />
      {view.carryOverDeniedReason && <Alert severity="warning">Carry-over denied: {view.carryOverDeniedReason}</Alert>}
      <Typography variant="h6">Changes from active revision</Typography>
      {view.activeRevision ? bindingDiff(revision, view.activeRevision).map(item =>
        <Detail key={item.field} title={item.field} value={{active: item.before, requested: item.after}} />)
        : <Typography>No earlier active revision to compare.</Typography>}
      <Typography variant="h6">Decision history</Typography>
      {!view.decisions.length && <Typography>No decisions yet.</Typography>}
      {view.decisions.map(item => <Detail key={item.decisionId} title={`${item.action} · ${item.actor} · ${item.decidedTs}`}
        value={{bindingId: item.bindingId, comment: item.comment}} />)}
      <TextField label="Decision comment" multiline minRows={2} value={comment}
        onChange={event => setComment(event.target.value)} inputProps={{maxLength: 4000}} />
      <Stack direction="row" spacing={1}>
        {revision.revisionStatus === 'pendingApproval' && <>
          <Button disabled={loading} onClick={() => void act('approve')}>Approve</Button>
          <Button disabled={loading || !comment.trim()} onClick={() => void act('reject')}>Reject</Button>
        </>}
        {revision.revisionStatus === 'approved' && <Button disabled={loading || !comment.trim()}
          onClick={() => void act('revoke')}>Revoke</Button>}
        <Button disabled={loading} onClick={() => void load()}>Refresh revision</Button>
      </Stack>
      {operation && host && <WorkflowOperationRecovery hostId={host} operation={operation}
        onRecovered={(receipt) => {
          const expectedStatus = lastAction === 'approve' ? 'approved'
            : lastAction === 'reject' ? 'rejected' : 'revoked';
          if (receipt?.bindingId !== revision.bindingId
            || receipt?.bindingDigest !== revision.bindingDigest
            || receipt?.revisionStatus !== expectedStatus) {
            setError('Retry receipt does not confirm the selected binding decision. Refresh revision and retry the original operation.');
            return;
          }
          setOperation(null);
          void workflowPortalClient.refreshBindings(host, [revision.toolId])
            .catch(reason => setError(`Decision recovered; status refresh failed: ${portalError(reason).message}`))
            .finally(() => void load());
        }} onRefresh={() => void load()}
        onNew={() => void act(lastAction)}
        newLabel={`${lastAction === 'revoke' ? 'Revoke' : lastAction === 'reject' ? 'Reject' : 'Approve'} as new operation`} />}
    </>}
  </Stack></Box>;
}
