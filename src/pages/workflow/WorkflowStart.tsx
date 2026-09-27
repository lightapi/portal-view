import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {useUserState} from '../../contexts/UserContext';
import {workflowPortalClient} from './workflowPortalClient';
import {validateWorkflowStartReceipt, type WorkflowStartReceipt} from './workflowStart';

export default function WorkflowStart() {
    const location = useLocation();
    const navigate = useNavigate();
    const {host} = useUserState();
    const routeData = (location.state as any)?.data || {};
    const workflowDefinitionId = routeData.wfDefId
        || routeData.workflowDefinitionId
        || new URLSearchParams(location.search).get('wfDefId')
        || '';
    const initialInput = useMemo(() => {
        const value = routeData.input ?? '{}';
        return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }, [routeData.input]);
    const [inputText, setInputText] = useState(initialInput);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [receipt, setReceipt] = useState<WorkflowStartReceipt | null>(null);
    const attempt = useRef<{ signature: string; key: string } | null>(null);
    const source = (location.state as any)?.source;

    const start = async () => {
        setError('');
        setReceipt(null);
        let input: unknown;
        try {
            input = JSON.parse(inputText);
        } catch {
            setError('Workflow input must be valid JSON.');
            return;
        }
        if (!workflowDefinitionId || !host) {
            setError('A workflow definition ID is required. Open this page from a saved workflow.');
            return;
        }
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            setError('Workflow input must be a JSON object.');
            return;
        }
        const signature = JSON.stringify([workflowDefinitionId, input]);
        const idempotencyKey = attempt.current?.signature === signature
            ? attempt.current.key
            : crypto.randomUUID();
        attempt.current = { signature, key: idempotencyKey };
        setBusy(true);
        try {
            const result = validateWorkflowStartReceipt(await workflowPortalClient.start(host, workflowDefinitionId,
                input as Record<string, unknown>, idempotencyKey), workflowDefinitionId);
            setReceipt(result);
            attempt.current = null;
        } catch (cause: any) {
            setError(cause?.message || 'Workflow start failed. Retry uses the same idempotency key for this input.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
            <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(source || '/app/workflow/WfDefinition')}>
                        Back
                    </Button>
                    <Typography variant="h5">Start Workflow</Typography>
                </Stack>
                <TextField
                    label="Workflow Definition ID"
                    value={workflowDefinitionId}
                    disabled
                    fullWidth
                />
                <TextField
                    label="Workflow Input (JSON)"
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    multiline
                    minRows={8}
                    fullWidth
                    disabled={busy || Boolean(receipt)}
                />
                {error && <Alert severity="error">{error}</Alert>}
                {receipt && (
                    <Alert severity="success">
                        Workflow accepted. Process ID: {receipt.processId}. Invocation ID: {receipt.workflowInstanceId}.
                    </Alert>
                )}
                <Stack direction="row" spacing={1}>
                    {!receipt && (
                        <Button
                            variant="contained"
                            startIcon={<PlayArrowIcon />}
                            onClick={() => void start()}
                            disabled={busy || !workflowDefinitionId}
                        >
                            {busy ? 'Starting…' : 'Start Workflow'}
                        </Button>
                    )}
                    {receipt && (
                        <Button
                            variant="contained"
                            onClick={() => navigate(`/app/workflow/ProcessInfo?wfInstanceId=${encodeURIComponent(receipt.workflowInstanceId)}`)}
                        >
                            View Process Info
                        </Button>
                    )}
                </Stack>
            </Stack>
        </Box>
    );
}
