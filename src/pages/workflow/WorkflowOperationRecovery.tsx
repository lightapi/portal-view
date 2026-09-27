import {useEffect, useState} from 'react';
import {Alert, Button, Stack} from '@mui/material';
import {useUserState} from '../../contexts/UserContext';
import {portalError, workflowPortalClient} from './workflowPortalClient';

export type OperationState = {
  code?: string; message?: string; operationId?: string;
  requestedBy?: string; requestedTs?: string;
};

export function operationState(value: any): OperationState {
  const details = value?.metadata?.details ?? value?.details ?? value?.error?.metadata?.details
    ?? value?.error?.details ?? {};
  return {code: value?.code ?? value?.error?.code, message: value?.message ?? value?.error?.message,
    operationId: value?.operationId ?? details.operationId,
    requestedBy: value?.requestedBy ?? details.requestedBy,
    requestedTs: value?.requestedTs ?? details.requestedTs};
}

export default function WorkflowOperationRecovery({hostId, operation, onRecovered, onRefresh, onNew, newLabel}: {
  hostId: string; operation: OperationState; onRecovered: (receipt: any) => void;
  onRefresh: () => void | Promise<void>; onNew?: () => void | Promise<void>; newLabel?: string;
}) {
  const {userId} = useUserState();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [retryOutcome, setRetryOutcome] = useState<OperationState | null>(null);
  useEffect(() => { setRetryOutcome(null); setLocalError(''); }, [operation.operationId]);
  const current = retryOutcome ?? operation;
  const isOther = Boolean(current.requestedBy && current.requestedBy !== userId);
  const expired = current.code === 'WORKFLOW_OPERATION_EXPIRED';
  const unresolved = ['WORKFLOW_OPERATION_PENDING', 'WORKFLOW_OPERATION_UNCONFIRMED',
    'WORKFLOW_OPERATION_EXPIRED'].includes(current.code ?? '');
  const terminal = Boolean(retryOutcome && !unresolved);
  if (!unresolved && !terminal) return null;
  const retry = async () => {
    if (!operation.operationId || isOther || expired) return;
    setBusy(true); setLocalError('');
    try { onRecovered(await workflowPortalClient.retryOperation(hostId, operation.operationId)); }
    catch (error) {
      const failure = portalError(error);
      const outcome = operationState(failure);
      // Transport and authentication failures say nothing about the stored operation.
      // Only an explicit D21 or terminal operation response changes its state.
      if (outcome.code?.startsWith('WORKFLOW_OPERATION_'))
        setRetryOutcome({...current, ...outcome, operationId: outcome.operationId ?? operation.operationId});
      setLocalError(failure.message);
    }
    finally { setBusy(false); }
  };
  return <Stack spacing={1}>
    <Alert severity={expired || terminal ? 'warning' : 'info'}>
      {terminal ? `Operation ${current.operationId ?? operation.operationId ?? ''} cannot be retried (${current.code}). Start a new operation after reviewing status.`
        : expired ? 'Expired; remote outcome unconfirmed'
        : isOther ? `Pending, requested by ${current.requestedBy} at ${current.requestedTs ?? 'unknown time'}`
          : `Unconfirmed — Retry${current.operationId ? ` · ${current.operationId}` : ''}`}
    </Alert>
    {localError && <Alert severity="error">{localError}</Alert>}
    <Stack direction="row" spacing={1}>
      {!isOther && !expired && !terminal && operation.operationId && <Button disabled={busy} onClick={() => void retry()}>Retry</Button>}
      <Button disabled={busy} onClick={() => void onRefresh()}>Refresh status</Button>
      {(expired || terminal) && onNew && newLabel && <Button disabled={busy} onClick={() => void onNew()}>{newLabel}</Button>}
    </Stack>
  </Stack>;
}
