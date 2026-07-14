import { Alert, Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { replayApi } from './api';
import { ReplayApprovalPanel } from './ReplayApprovalPanel';
import { ReplayCandidateTable } from './ReplayCandidateTable';
import { ReplayPlanDialog, type ReplayPlanInput } from './ReplayPlanDialog';
import { ReplayQuarantinePanel } from './ReplayQuarantinePanel';
import { ReplayStatusPanel } from './ReplayStatusPanel';
import { ReplayWaiverPanel } from './ReplayWaiverPanel';
import type { OperatorActionResponse, ReplayBarrier, ReplayCandidate, ReplayFailure, ReplayStatus } from './types';
import { terminalReplayStatuses } from './workflow.mjs';

const PAGE_SIZE = 25;
const storageKey = (hostId: string) => `event-replay:last-request:${hostId}`;

export function EventReplayAdmin({ hostId, currentUserId, notificationTransactionIds }:
  { hostId: string; currentUserId?: string | null; notificationTransactionIds: string[] }) {
  const [projectionName, setProjectionName] = useState('portal-query');
  const [consumerGroup, setConsumerGroup] = useState('user-query-group');
  const [candidates, setCandidates] = useState<ReplayCandidate[]>([]);
  const [details, setDetails] = useState<Record<string, ReplayFailure>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); const [planOpen, setPlanOpen] = useState(false);
  const [replay, setReplay] = useState<ReplayStatus | null>(null);

  const rememberReplay = useCallback((requestId: string | null) => {
    if (requestId) localStorage.setItem(storageKey(hostId), requestId); else localStorage.removeItem(storageKey(hostId));
    const url = new URL(window.location.href);
    if (requestId) url.searchParams.set('replayRequestId', requestId); else url.searchParams.delete('replayRequestId');
    window.history.replaceState(window.history.state, '', url);
  }, [hostId]);

  const loadReplay = useCallback(async (requestId: string) => {
    try { const next = await replayApi.getReplay(hostId, requestId); setReplay(next); setError(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to load replay status.'); }
  }, [hostId]);

  const loadCandidates = useCallback(async () => {
    if (!projectionName.trim() || !consumerGroup.trim()) return;
    setLoading(true); setError(null);
    try {
      const response = await replayApi.listCandidates(hostId, projectionName.trim(), consumerGroup.trim(), page, PAGE_SIZE);
      setCandidates(response.items); setTotal(response.total);
      const loaded = await Promise.allSettled(response.items.map((item) => replayApi.getFailure(hostId, item.failureId)));
      const next: Record<string, ReplayFailure> = {};
      loaded.forEach((result) => { if (result.status === 'fulfilled') next[result.value.failureId] = result.value; });
      setDetails(next);
      setSelected((current) => new Set(Array.from(current).filter((id) => response.items.some((item) => item.failureId === id))));
    } catch (failure) { setCandidates([]); setDetails({}); setTotal(0); setError(failure instanceof Error ? failure.message : 'Unable to load replay candidates.'); }
    finally { setLoading(false); }
  }, [consumerGroup, hostId, page, projectionName]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);
  useEffect(() => {
    const requestId = new URLSearchParams(window.location.search).get('replayRequestId') || localStorage.getItem(storageKey(hostId));
    if (requestId) loadReplay(requestId);
  }, [hostId, loadReplay]);
  useEffect(() => {
    if (!replay || terminalReplayStatuses.has(replay.status)) return;
    const timer = window.setInterval(() => loadReplay(replay.replayRequestId), 3000);
    return () => window.clearInterval(timer);
  }, [loadReplay, replay]);

  const run = async (operation: () => Promise<unknown>, refresh = true) => {
    setBusy(true); setError(null);
    try { await operation(); if (refresh && replay) await loadReplay(replay.replayRequestId); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The replay operation failed.'); }
    finally { setBusy(false); }
  };
  const createPlan = (input: ReplayPlanInput) => run(async () => {
    const plan = await replayApi.createPlan(hostId, projectionName, consumerGroup, Array.from(selected), input.strategy, input.validationMode, input.reason);
    rememberReplay(plan.replayRequestId); setReplay(await replayApi.getReplay(hostId, plan.replayRequestId)); setPlanOpen(false);
  }, false);
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return <Paper variant="outlined" sx={{ p: 2, mb: 2 }}><Stack spacing={2}>
    <Typography variant="h5">Event Replay Administration</Typography>
    <Alert severity="info">Host-scoped metadata only. Payloads, source keys, headers, and ciphertext are never requested or rendered. Server permissions authorize every action.</Alert>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
      <TextField size="small" label="Projection" value={projectionName} onChange={(event) => { setProjectionName(event.target.value); setPage(0); }} />
      <TextField size="small" label="Consumer group" value={consumerGroup} onChange={(event) => { setConsumerGroup(event.target.value); setPage(0); }} />
      <Button onClick={loadCandidates} disabled={loading}>Refresh failures</Button>
      <Button variant="contained" onClick={() => setPlanOpen(true)} disabled={loading || !selected.size || !!replay}>Plan selected</Button>
      {replay ? <Button onClick={() => { setReplay(null); rememberReplay(null); }}>Close replay</Button> : null}
    </Stack>
    {error ? <Alert severity="error">{error}</Alert> : null}
    <ReplayCandidateTable candidates={candidates} details={details} selected={selected}
      notificationTransactionIds={notificationTransactionIds} onToggle={(failureId) => setSelected((current) => {
        const next = new Set(current); if (next.has(failureId)) next.delete(failureId); else next.add(failureId); return next;
      })} />
    <Stack direction="row" spacing={1} alignItems="center">
      <Button disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button>
      <Typography variant="body2">Page {page + 1}; {total} open transaction(s)</Typography>
      <Button disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => setPage((value) => value + 1)}>Next</Button>
    </Stack>
    <ReplayPlanDialog open={planOpen} selectionCount={selected.size} busy={busy} error={error} onClose={() => setPlanOpen(false)} onCreate={createPlan} />
    {replay ? <><Divider /><ReplayStatusPanel replay={replay} />
      <ReplayApprovalPanel replay={replay} currentUserId={currentUserId} busy={busy} error={error}
        onApprove={(reason) => run(() => replayApi.approve(hostId, replay.replayRequestId, replay.planHash, reason))}
        onExecute={(reason) => run(() => replayApi.execute(hostId, replay.replayRequestId, replay.planHash, reason))}
        onCancel={(reason) => run(() => replayApi.cancel(hostId, replay.replayRequestId, replay.planHash, reason))} />
      <ReplayQuarantinePanel replay={replay} currentUserId={currentUserId} busy={busy} error={error}
        onFollowUp={(failureId) => { setReplay(null); rememberReplay(null); setSelected(new Set([failureId])); }}
        onRequestRelease={async (barrier: ReplayBarrier, reason: string): Promise<OperatorActionResponse> => {
          setBusy(true); setError(null); try { return await replayApi.requestBarrierRelease(hostId, barrier.barrierId, barrier.barrierEpoch, barrier.quarantineFailureId!, reason); }
          catch (failure) { const message = failure instanceof Error ? failure.message : 'Break-glass request failed.'; setError(message); throw failure; }
          finally { setBusy(false); }
        }}
        onApproveRelease={async (actionId, reason) => { await run(() => replayApi.approveBarrierRelease(hostId, actionId, reason)); }} />
    </> : <ReplayWaiverPanel failureIds={selectedIds} currentUserId={currentUserId} busy={busy} error={error}
      onRequest={async (reason) => { let response: OperatorActionResponse | null = null; await run(async () => { response = await replayApi.requestWaiver(hostId, selectedIds, reason); }, false); if (!response) throw new Error('Waiver request failed.'); return response; }}
      onApprove={async (id, targets, downstream, reason) => { await run(() => replayApi.approveWaiver(hostId, id, targets, downstream, reason), false); setSelected(new Set()); await loadCandidates(); }} />}
  </Stack></Paper>;
}
