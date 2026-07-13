import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

export type ReplayPlanInput = { strategy: string; validationMode: string; reason: string };

export function ReplayPlanDialog({ open, selectionCount, busy, error, onClose, onCreate }:
  { open: boolean; selectionCount: number; busy: boolean; error?: string | null; onClose: () => void;
    onCreate: (input: ReplayPlanInput) => void }) {
  const [strategy, setStrategy] = useState('DEPENDENCY_CLOSURE');
  const [validationMode, setValidationMode] = useState('VALIDATE_ONLY');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { if (!open) { setReason(''); setConfirmed(false); } }, [open]);
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>Create immutable replay plan</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ mt: .5 }}>
      <Alert severity="info">Planning may add dependency transactions. Creation does not execute them; the exact plan hash must be approved separately.</Alert>
      <Typography>{selectionCount} complete failure transaction(s) selected.</Typography>
      <TextField select label="Selection strategy" value={strategy} onChange={(event) => setStrategy(event.target.value)}>
        <MenuItem value="DEPENDENCY_CLOSURE">Dependency closure (recommended)</MenuItem><MenuItem value="EXACT">Exact selection</MenuItem>
      </TextField>
      <TextField select label="Validation mode" value={validationMode} onChange={(event) => setValidationMode(event.target.value)}>
        <MenuItem value="VALIDATE_ONLY">Validate only</MenuItem><MenuItem value="ROLLBACK_DRY_RUN">Rollback dry run</MenuItem><MenuItem value="EXECUTE">Execute after approval</MenuItem>
      </TextField>
      <TextField label="Operational reason" value={reason} onChange={(event) => setReason(event.target.value)} multiline minRows={3} inputProps={{ maxLength: 2048 }} />
      <FormControlLabel control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />}
        label="I confirm this selection contains complete transactions and understand dependency closure can increase the blast radius." />
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" disabled={busy || !confirmed || !reason.trim()}
      onClick={() => onCreate({ strategy, validationMode, reason: reason.trim() })}>Create plan</Button></DialogActions>
  </Dialog>;
}

