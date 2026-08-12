import { Box, Checkbox, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { ReplayCandidate, ReplayFailure } from './types';
import { isNotificationMatch } from './workflow.mjs';

const date = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
const bytes = (value?: number) => value == null ? '—' : new Intl.NumberFormat().format(value);
const unique = (values: Array<string | null | undefined>) => Array.from(new Set(values.filter((value): value is string => !!value)));

function Values({ values }: { values: string[] }) {
  return values.length ? <Box sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{values.join('\n')}</Box> : <>—</>;
}

function FailureDetails({ detail, errorCode }: { detail?: ReplayFailure; errorCode?: string | null }) {
  const summary = [errorCode, detail?.errorType].filter(Boolean).join(' · ') || '—';
  if (!detail?.errorMessage) return <>{summary}</>;
  return (
    <Box component="details" sx={{ maxWidth: 520 }}>
      <Box component="summary" sx={{ color: 'error.main', cursor: 'pointer', fontWeight: 600 }}>
        {summary}
      </Box>
      <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.72rem', m: 0, mt: 1,
        maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {detail.errorMessage}
      </Box>
    </Box>
  );
}

export function ReplayCandidateTable({ candidates, details, selected, notificationIdentities, onToggle }:
  { candidates: ReplayCandidate[]; details: Record<string, ReplayFailure>; selected: Set<string>;
    notificationIdentities: Array<{ transactionId: string; userId: string | null }>;
    onToggle: (failureId: string) => void }) {
  const notificationTransactionIds = notificationIdentities.map((identity) => identity.transactionId);
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Complete failed projection transactions">
        <TableHead><TableRow>
          <TableCell padding="checkbox" /><TableCell>Failure transaction</TableCell><TableCell>Scope / revisions</TableCell>
          <TableCell>Event types</TableCell><TableCell>Aggregate IDs</TableCell><TableCell>Users</TableCell>
          <TableCell>Events</TableCell><TableCell>Processor</TableCell><TableCell>Last failure</TableCell>
          <TableCell>Error</TableCell><TableCell>Stored bytes</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {candidates.map((candidate) => {
            const detail = details[candidate.failureId];
            const match = isNotificationMatch(detail, notificationTransactionIds);
            const revisions = detail?.events.filter((event) => event.rootInstanceId).map((event) =>
              `${event.rootInstanceId?.slice(0, 8)}… r${event.graphRevision ?? '?'}`) ?? [];
            const processors = Array.from(new Set(detail?.events.map((event) => event.sourceProcessor).filter(Boolean) ?? []));
            const eventTypes = unique(detail?.events.map((event) => event.eventType) ?? []);
            const aggregateIds = unique(detail?.events.map((event) => event.aggregateId) ?? []);
            const users = unique([...(detail?.userIds ?? []), ...notificationIdentities
              .filter((identity) => identity.transactionId === detail?.originalTransactionId)
              .map((identity) => identity.userId)]);
            return <TableRow key={candidate.failureId} selected={selected.has(candidate.failureId) || match} hover>
              <TableCell padding="checkbox"><Checkbox checked={selected.has(candidate.failureId)}
                disabled={!candidate.payloadAvailable || candidate.status !== 'OPEN'}
                onChange={() => onToggle(candidate.failureId)} inputProps={{ 'aria-label': `Select failure ${candidate.failureId}` }} /></TableCell>
              <TableCell>
                <Typography variant="body2" fontFamily="monospace">{candidate.failureId}</Typography>
                {match ? <Chip size="small" color="info" label="Matches visible notification" sx={{ mt: .5 }} /> : null}
                {!candidate.payloadAvailable ? <Chip size="small" color="error" label="Payload unavailable" sx={{ mt: .5, ml: .5 }} /> : null}
              </TableCell>
              <TableCell>{revisions.length ? revisions.join(', ') : candidate.replayPolicy}</TableCell>
              <TableCell><Values values={eventTypes} /></TableCell>
              <TableCell><Values values={aggregateIds} /></TableCell>
              <TableCell><Values values={users} /></TableCell>
              <TableCell>{candidate.eventCount}</TableCell><TableCell>{processors.join(', ') || 'Loading…'}</TableCell>
              <TableCell>{date(candidate.lastFailedTs)}</TableCell>
              <TableCell><FailureDetails detail={detail} errorCode={candidate.errorCode} /></TableCell>
              <TableCell>{bytes(candidate.encryptedPayloadBytes)}</TableCell>
            </TableRow>;
          })}
          {!candidates.length ? <TableRow><TableCell colSpan={11}>
            No open canonical replay candidates found. A legacy DLQ notification shown below is not replayable until it is captured or backfilled as a complete failure transaction.
          </TableCell></TableRow> : null}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
