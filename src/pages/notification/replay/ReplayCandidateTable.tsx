import { Checkbox, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import type { ReplayCandidate, ReplayFailure } from './types';
import { isNotificationMatch } from './workflow.mjs';

const date = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
const bytes = (value?: number) => value == null ? '—' : new Intl.NumberFormat().format(value);

export function ReplayCandidateTable({ candidates, details, selected, notificationTransactionIds, onToggle }:
  { candidates: ReplayCandidate[]; details: Record<string, ReplayFailure>; selected: Set<string>;
    notificationTransactionIds: string[]; onToggle: (failureId: string) => void }) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Complete failed projection transactions">
        <TableHead><TableRow>
          <TableCell padding="checkbox" /><TableCell>Failure transaction</TableCell><TableCell>Scope / revisions</TableCell>
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
              <TableCell>{candidate.eventCount}</TableCell><TableCell>{processors.join(', ') || 'Loading…'}</TableCell>
              <TableCell>{date(candidate.lastFailedTs)}</TableCell>
              <TableCell><Tooltip title={detail?.errorMessage || candidate.errorCode || ''}><span>{candidate.errorCode || '—'}</span></Tooltip></TableCell>
              <TableCell>{bytes(candidate.encryptedPayloadBytes)}</TableCell>
            </TableRow>;
          })}
          {!candidates.length ? <TableRow><TableCell colSpan={8}>No open complete failure transactions found.</TableCell></TableRow> : null}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
