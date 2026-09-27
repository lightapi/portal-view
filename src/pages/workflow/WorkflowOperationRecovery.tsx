import {useEffect, useState} from 'react';
import {Alert, Button, Stack} from '@mui/material';
import {useUserState} from '../../contexts/UserContext';
import {portalError, workflowPortalClient} from './workflowPortalClient';

export type OperationState = {
  code?: string; message?: string; operationId?: string;
  requestedBy?: string; requestedTs?: string;
  operationState?: 'failed';
};

const operationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function recoveryField(value: unknown, valid: (value: string) => boolean): string | undefined {
  return typeof value === 'string' && valid(value) ? value : undefined;
}

function recoveryTimestamp(value: string): boolean {
  if (!timestampPattern.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1
    && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function operationState(value: any): OperationState {
  const details = value?.metadata?.details ?? value?.details ?? value?.error?.metadata?.details
    ?? value?.error?.details ?? {};
  return {code: value?.code ?? value?.error?.code, message: value?.message ?? value?.error?.message,
    operationState: value?.operationState === 'failed' || value?.metadata?.operationState === 'failed'
      ? 'failed' : undefined,
    operationId: recoveryField(value?.operationId, item => operationIdPattern.test(item))
      ?? recoveryField(details.operationId, item => operationIdPattern.test(item)),
    requestedBy: recoveryField(value?.requestedBy, item => item.trim().length > 0)
      ?? recoveryField(details.requestedBy, item => item.trim().length > 0),
    requestedTs: recoveryField(value?.requestedTs, recoveryTimestamp)
      ?? recoveryField(details.requestedTs, recoveryTimestamp)};
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
  const forbidden = current.code === 'WORKFLOW_OPERATION_RETRY_FORBIDDEN';
  const isOther = Boolean(current.requestedBy && current.requestedBy !== userId);
  const expired = current.code === 'WORKFLOW_OPERATION_EXPIRED';
  const notFound = current.code === 'WORKFLOW_OPERATION_NOT_FOUND';
  const terminal = !forbidden && (current.operationState === 'failed' || notFound);
  const recoverable = Boolean(current.code?.startsWith('WORKFLOW_OPERATION_'))
    && !expired && !forbidden && !terminal;
  if (!recoverable && !expired && !terminal && !forbidden) return null;
  const retry = async () => {
    if (!operation.operationId || isOther || expired || forbidden) return;
    setBusy(true); setLocalError('');
    try { onRecovered(await workflowPortalClient.retryOperation(hostId, operation.operationId)); }
    catch (error) {
      const failure = portalError(error);
      const outcome = operationState(failure);
      // Only proven state transitions replace the displayed operation state.
      // Ledger/database errors and unknown codes leave the original Retry available.
      if (outcome.operationState === 'failed' || [
        'WORKFLOW_OPERATION_PENDING', 'WORKFLOW_OPERATION_UNCONFIRMED',
        'WORKFLOW_OPERATION_EXPIRED', 'WORKFLOW_OPERATION_RETRY_FORBIDDEN',
        'WORKFLOW_OPERATION_NOT_FOUND',
      ].includes(outcome.code ?? ''))
        setRetryOutcome({...current, ...outcome, operationId: outcome.operationId ?? operation.operationId});
      setLocalError(failure.message);
    }
    finally { setBusy(false); }
  };
  return <Stack spacing={1}>
    <Alert severity={expired || terminal || forbidden ? 'warning' : 'info'}>
      {forbidden ? 'Only the original requester may Retry this operation. Refresh status for current information.'
        : terminal ? `Operation ${current.operationId ?? operation.operationId ?? ''} cannot be retried (${current.code}). Start a new operation after reviewing status.`
        : expired ? 'Expired; remote outcome unconfirmed'
        : isOther ? `Pending, requested by ${current.requestedBy} at ${current.requestedTs ?? 'unknown time'}`
          : `Unconfirmed — Retry${current.operationId ? ` · ${current.operationId}` : ''}`}
    </Alert>
    {localError && <Alert severity="error">{localError}</Alert>}
    <Stack direction="row" spacing={1}>
      {!isOther && !expired && !terminal && !forbidden && operation.operationId && <Button disabled={busy} onClick={() => void retry()}>Retry</Button>}
      <Button disabled={busy} onClick={() => void onRefresh()}>Refresh status</Button>
      {(expired || terminal) && onNew && newLabel && <Button disabled={busy} onClick={() => void onNew()}>{newLabel}</Button>}
    </Stack>
  </Stack>;
}
