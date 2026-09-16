import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { createWorkflowToolClient, workflowArguments, type GatewayWorkflowTool } from './workflowToolClient';
import WorkflowRunControls from './WorkflowRunControls';

type Tool = { name: string; hostId: string; toolId: string };
export default function WorkflowToolInvokeDialog({ open, tool, onClose }: {
    open: boolean; tool: Tool | null; onClose: () => void;
}) {
    const client = useRef<ReturnType<typeof createWorkflowToolClient> | null>(null);
    const [published, setPublished] = useState<GatewayWorkflowTool | null>(null);
    const [args, setArgs] = useState('{}');
    const [grant, setGrant] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<unknown>();
    useEffect(() => {
        if (!open || !tool) return;
        let active = true;
        const current = createWorkflowToolClient();
        client.current = current;
        setPublished(null); setArgs('{}'); setGrant(''); setConfirmed(false);
        setSubmitted(false); setResult(undefined); setError(''); setBusy(true);
        void current.findTool(tool.name).then(value => { if (active) setPublished(value); })
            .catch(value => { if (active) setError(value instanceof Error ? value.message : 'Unable to load Gateway Tool.'); })
            .finally(() => { if (active) setBusy(false); });
        return () => { active = false; client.current = null; };
    }, [open, tool]);

    async function invoke() {
        if (!tool || !published || !client.current || !confirmed || busy || submitted) return;
        let input: Record<string, unknown>;
        try { input = workflowArguments(args); }
        catch (value) { setError(value instanceof Error ? value.message : 'Invalid JSON arguments.'); return; }
        setBusy(true); setError(''); setSubmitted(true);
        try { setResult(await client.current.invoke(published.name, input, grant)); }
        catch (value) { setError(value instanceof Error ? value.message : 'Submission failed.'); }
        finally { setBusy(false); }
    }

    return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
        <DialogTitle>Invoke Workflow Tool · {tool?.name}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">Uses the current Portal Gateway and signed-in session. Only Tools visible in its live catalog can be invoked here. Catalog identity is matched by Tool name.</Alert>
            <Typography variant="body2">Host: {tool?.hostId} · Catalog Tool: {tool?.toolId}</Typography>
            {published && <>
                <Typography>{published.description}</Typography>
                <TextField label="Published input schema" multiline minRows={3} maxRows={10}
                    value={JSON.stringify(published.inputSchema, null, 2)} slotProps={{ input: { readOnly: true } }} />
                <TextField label="Arguments (JSON object)" multiline minRows={6} value={args}
                    disabled={busy || submitted} onChange={event => { setArgs(event.target.value); setConfirmed(false); }} />
                <TextField label="Workflow grant reference (optional UUID)" value={grant} disabled={busy || submitted}
                    helperText="Use an existing authorized grant reference when required. Never enter a token or password."
                    onChange={event => { setGrant(event.target.value); setConfirmed(false); }} />
                <FormControlLabel control={<Checkbox checked={confirmed} disabled={busy || submitted}
                    onChange={event => setConfirmed(event.target.checked)} />}
                    label="I reviewed these arguments and authorize this workflow invocation and its declared effects." />
            </>}
            {error && <Alert severity="error">{error}</Alert>}
            {submitted && <Alert severity="warning">Submission was attempted once. A network error does not prove that it was rejected. Keep the exact arguments and reconcile the workflow before starting another run. Closing this dialog does not cancel work or release its VM.</Alert>}
            {result !== undefined && <TextField label="Gateway result" multiline minRows={5} maxRows={15}
                value={JSON.stringify(result, null, 2)} slotProps={{ input: { readOnly: true } }} />}
            <WorkflowRunControls key={tool?.toolId ?? 'closed'} />
        </Stack></DialogContent>
        <DialogActions><Button disabled={busy} onClick={onClose}>Close</Button>
            <Button variant="contained" disabled={busy || !published || !confirmed || submitted} onClick={() => void invoke()}>
                {busy ? 'Loading' : 'Invoke Workflow'}
            </Button></DialogActions>
    </Dialog>;
}
