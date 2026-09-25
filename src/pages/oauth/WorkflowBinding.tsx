import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useUserState } from '../../contexts/UserContext.jsx';
import fetchClient from '../../utils/fetchClient';
import { apiPost } from '../../api/apiPost.js';
import { loadErrorMessage } from '../../utils/loadErrorMessage';

type Binding = {
  bindingId: string;
  workflowInstanceId: string;
  workflowClientId: string;
  ownerUserId: string;
  state: string;
  created_ts: string;
};

/** The command is asynchronous; a row is complete only after query projection removes it. */
export default function WorkflowBinding() {
  const { host } = useUserState() as { host?: string };
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 25;

  const refresh = useCallback(async () => {
    if (!host) return;
    setLoading(true);
    try {
      const cmd = { host: 'lightapi.net', service: 'oauth', action: 'getWorkflowBinding', version: '0.1.0',
        data: { hostId: host, offset, limit } };
      const result = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
      const next: Binding[] = result.bindings || [];
      setBindings(next);
      setTotal(result.total || 0);
      setPending(previous => {
        const remaining = previous.filter(id => next.some(binding => binding.bindingId === id));
        if (remaining.length < previous.length) setMessage('Binding deletion completed.');
        return remaining;
      });
      setError(null);
    } catch (cause) {
      setError(loadErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [host, offset]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (pending.length === 0) return;
    const timer = window.setInterval(() => { void refresh(); }, 3000);
    return () => window.clearInterval(timer);
  }, [pending.length, refresh]);

  const deleteBinding = async (binding: Binding) => {
    if (!host || !window.confirm(`Delete binding ${binding.bindingId} for workflow ${binding.workflowInstanceId}?`)) return;
    setError(null);
    setMessage(null);
    try {
      const cmd = { host: 'lightapi.net', service: 'oauth', action: 'deleteWorkflowBinding', version: '0.1.0',
        data: { hostId: host, bindingId: binding.bindingId } };
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) throw new Error(loadErrorMessage(result.error));
      setPending(previous => [...previous, binding.bindingId]);
      setMessage('Deletion accepted. Waiting for projection; token exchange may still succeed until the row is removed.');
    } catch (cause) {
      setError(loadErrorMessage(cause));
    }
  };

  return <Box sx={{ p: 3 }}>
    <Typography variant="h5" gutterBottom>Workflow owner bindings</Typography>
    <Typography variant="body2" sx={{ mb: 2 }}>Deleting a binding stops future token exchanges once the event is projected. Existing tokens expire normally.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert>}
    <Button onClick={() => void refresh()} disabled={loading}>Refresh</Button>
    {loading && <CircularProgress size={18} sx={{ ml: 2 }} />}
    <Table size="small">
      <TableHead><TableRow><TableCell>Binding</TableCell><TableCell>Workflow instance</TableCell><TableCell>Client</TableCell><TableCell>Owner</TableCell><TableCell>State</TableCell><TableCell>Created</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
      <TableBody>{bindings.map(binding => <TableRow key={binding.bindingId}>
        <TableCell>{binding.bindingId}</TableCell><TableCell>{binding.workflowInstanceId}</TableCell>
        <TableCell>{binding.workflowClientId}</TableCell><TableCell>{binding.ownerUserId}</TableCell>
        <TableCell>{binding.state}</TableCell><TableCell>{binding.created_ts}</TableCell>
        <TableCell><Button color="error" disabled={pending.includes(binding.bindingId)} onClick={() => void deleteBinding(binding)}>
          {pending.includes(binding.bindingId) ? 'Pending' : 'Delete'}
        </Button></TableCell>
      </TableRow>)}</TableBody>
    </Table>
    <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center' }}>
      <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</Button>
      <Typography variant="body2">{total === 0 ? 0 : offset + 1}–{Math.min(offset + limit, total)} of {total}</Typography>
      <Button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>Next</Button>
    </Box>
  </Box>;
}
