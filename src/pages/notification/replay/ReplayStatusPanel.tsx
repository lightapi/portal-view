import { Alert, Box, Chip, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { ReplayStatus } from './types';
import { replayProgress, selectedAndAdded } from './workflow.mjs';
import { ReplayAttemptTimeline } from './ReplayAttemptTimeline';

const bytes = (value: number) => new Intl.NumberFormat().format(value);
export function ReplayStatusPanel({ replay }: { replay: ReplayStatus }) {
  const groups = selectedAndAdded(replay.items);
  const progress = replayProgress(replay.items);
  const roots = (replay.planMetadata?.isolationScope as { rootInstanceIds?: string[] } | undefined)?.rootInstanceIds ?? [];
  return <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
      <Typography variant="h6">Replay {replay.replayRequestId}</Typography><Chip label={replay.status} size="small" />
      {replay.stale ? <Chip color="error" label="STALE PLAN" size="small" /> : null}
    </Stack>
    {replay.stale ? <Alert severity="error">The immutable plan is stale or expired. It cannot be approved or executed; create a new plan.</Alert> : null}
    {replay.failureCode ? <Alert severity="error">{replay.failureCode}: {replay.failureMessage || 'Replay failed.'}</Alert> : null}
    <Box><LinearProgress variant="determinate" value={progress.percent} /><Typography variant="caption">{progress.complete} of {progress.total} transactions succeeded</Typography></Box>
    <Typography variant="body2">Hash: <code>{replay.planHash}</code></Typography>
    <Typography variant="body2">Expires: {new Date(replay.expiresAt).toLocaleString()} · {replay.eventCount} events · {bytes(replay.encryptedPayloadBytes)} encrypted bytes · isolation: {replay.isolationMode || 'planned'} · roots: {roots.length || 'none'}</Typography>
    <Table size="small"><TableHead><TableRow><TableCell>Kind</TableCell><TableCell>Failure</TableCell><TableCell>Reason</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
      <TableBody>{[...groups.selected, ...groups.added].map((item) => <TableRow key={item.failureId}>
        <TableCell><Chip size="small" color={item.addedDependency ? 'warning' : 'primary'} label={item.addedDependency ? 'Dependency added' : 'Selected'} /></TableCell>
        <TableCell><code>{item.failureId}</code></TableCell><TableCell>{item.dependencyReason}</TableCell><TableCell>{item.status}</TableCell>
      </TableRow>)}</TableBody></Table>
    <ReplayAttemptTimeline attempts={replay.attempts} />
  </Stack></Paper>;
}
