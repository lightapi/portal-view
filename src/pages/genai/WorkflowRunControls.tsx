import { useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, Stack, TextField } from '@mui/material';
import { createWorkflowToolClient } from './workflowToolClient';
import { validWorkflowInstanceId } from './workflowRunId';

const operations = {
    status: 'workflow_get_status', result: 'workflow_get_result', cancel: 'workflow_cancel',
} as const;
export default function WorkflowRunControls() {
    const [expanded, setExpanded] = useState(false);
    const [id, setId] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [cancelAttempted, setCancelAttempted] = useState(false);
    const [result, setResult] = useState<unknown>();
    const [error, setError] = useState('');
    async function run(operation: keyof typeof operations) {
        if (busy || !validWorkflowInstanceId(id) ||
            (operation === 'cancel' && (!confirmed || cancelAttempted))) return;
        setBusy(true); setError(''); setResult(undefined);
        try {
            const client = createWorkflowToolClient();
            // Discovery is read-only. The Gateway must expose this operation to
            // the current session; the backend still verifies run ownership.
            await client.findTool(operations[operation]);
            if (operation === 'cancel') { setCancelAttempted(true); setConfirmed(false); }
            setResult(await client.invoke(operations[operation], { workflowInstanceId: id }, ''));
        } catch (value) {
            setError(value instanceof Error ? value.message : 'Workflow operation failed.');
        } finally { setBusy(false); }
    }
    return <Stack spacing={2}>
        <Button onClick={() => setExpanded(value => !value)} disabled={busy}>Manage existing workflow run</Button>
        {expanded && <>
            <Alert severity="info">Uses the signed-in Gateway session. Enter the workflowInstanceId returned by invocation, not the feature ID. Status and result reads do not start work.</Alert>
            <TextField label="Workflow instance ID" value={id} disabled={busy || cancelAttempted}
                onChange={event => { setId(event.target.value.trim()); setConfirmed(false); setResult(undefined); setError(''); }} />
            <Stack direction="row" spacing={1}>
                <Button disabled={busy || !validWorkflowInstanceId(id)} onClick={() => void run('status')}>Read run status</Button>
                <Button disabled={busy || !validWorkflowInstanceId(id)} onClick={() => void run('result')}>Read run result</Button>
            </Stack>
            <FormControlLabel control={<Checkbox checked={confirmed} disabled={busy || cancelAttempted}
                onChange={event => setConfirmed(event.target.checked)} />}
                label="Request cancellation of this exact workflow instance." />
            <Button color="error" disabled={busy || !validWorkflowInstanceId(id) || !confirmed || cancelAttempted}
                onClick={() => void run('cancel')}>Request run cancellation</Button>
            {cancelAttempted && <Alert severity="warning">Cancellation was attempted once. Read status to reconcile it. An accepted request or closed dialog does not prove that workers stopped, cleanup completed, or the VM was released.</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            {result !== undefined && <TextField label="Workflow operation result" multiline minRows={3} maxRows={12}
                value={JSON.stringify(result, null, 2)} slotProps={{ input: { readOnly: true } }} />}
        </>}
    </Stack>;
}
