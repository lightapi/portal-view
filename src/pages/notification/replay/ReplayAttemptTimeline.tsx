import { Chip, Paper, Stack, Typography } from '@mui/material';
import type { ReplayAttempt } from './types';

export function ReplayAttemptTimeline({ attempts }: { attempts: ReplayAttempt[] }) {
  return <Stack spacing={1}>
    <Typography variant="subtitle2">Immutable attempt history</Typography>
    {!attempts.length ? <Typography color="text.secondary" variant="body2">No execution attempts recorded.</Typography> : null}
    {attempts.map((attempt) => <Paper variant="outlined" sx={{ p: 1 }} key={`${attempt.itemOrdinal}-${attempt.attemptNumber}`}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <Typography variant="body2">Item {attempt.itemOrdinal}, attempt {attempt.attemptNumber}</Typography>
        <Chip size="small" color={attempt.result === 'SUCCEEDED' ? 'success' : attempt.result === 'FAILED' ? 'error' : 'default'} label={attempt.result} />
        <Typography variant="caption">worker {attempt.workerId}; committed: {attempt.projectionCommitted ? 'yes' : 'no'}</Typography>
        {attempt.errorCode ? <Typography color="error" variant="caption">{attempt.errorCode}</Typography> : null}
      </Stack>
    </Paper>)}
  </Stack>;
}

