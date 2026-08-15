import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControlLabel, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';

export type WorkflowAccessTool = {
    hostId: string;
    toolId: string;
    name: string;
    version?: string;
    capabilityRef?: string;
    lightapiDigest?: string;
    lightapiValidationStatus?: string;
};

type WorkflowOption = { wfDefId: string; name?: string; namespace?: string; version?: string };
type Grant = {
    grantId: string; wfDefId: string; workflowVersion?: string; toolVersion: string;
    lightapiDigest: string; allowedEnvironments: string[]; aggregateVersion: number;
};

function queryUrl(action: string, data: Record<string, unknown>) {
    return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify({
        host: 'lightapi.net', service: action === 'getWfDefinition' ? 'workflow' : 'genai',
        action, version: '0.1.0', data,
    }));
}

export default function WorkflowToolAccessDialog({
    open, tool, onClose,
}: { open: boolean; tool: WorkflowAccessTool | null; onClose: () => void }) {
    const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
    const [grants, setGrants] = useState<Grant[]>([]);
    const [wfDefId, setWfDefId] = useState('');
    const [pinVersion, setPinVersion] = useState(false);
    const [workflowVersion, setWorkflowVersion] = useState('');
    const [environments, setEnvironments] = useState('local');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!open || !tool) return;
        const [workflowResult, grantResult] = await Promise.all([
            fetchClient(queryUrl('getWfDefinition', {
                hostId: tool.hostId, active: true, offset: 0, limit: 500,
                filters: '[]', sorting: '[]', globalFilter: '',
            })),
            fetchClient(queryUrl('getWorkflowToolGrant', {
                hostId: tool.hostId, wfDefId: wfDefId || '00000000-0000-0000-0000-000000000000', active: true,
            })).catch(() => ({ grants: [] })),
        ]);
        setWorkflows(workflowResult.wfDefinitions || workflowResult.workflows || []);
        setGrants((grantResult.grants || []).filter((grant: Grant & { toolId?: string }) => grant.toolId === tool.toolId));
    }, [open, tool, wfDefId]);

    useEffect(() => { load().catch(error => setMessage(String(error))); }, [load]);

    const selectedWorkflow = useMemo(
        () => workflows.find(workflow => workflow.wfDefId === wfDefId),
        [wfDefId, workflows],
    );
    const selectedScopeVersion = pinVersion ? (workflowVersion || selectedWorkflow?.version || '') : undefined;
    const duplicateGrant = useMemo(
        () => grants.some(item => (item.workflowVersion || undefined) === selectedScopeVersion),
        [grants, selectedScopeVersion],
    );

    const grant = async () => {
        if (!tool || !wfDefId || !tool.lightapiDigest) return;
        setBusy(true); setMessage('');
        const allowedEnvironments = environments.split(',').map(value => value.trim()).filter(Boolean);
        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'grantWorkflowTool', version: '0.1.0',
            data: {
                hostId: tool.hostId, grantId: crypto.randomUUID(), toolId: tool.toolId, wfDefId,
                workflowVersion: selectedScopeVersion,
                toolVersion: tool.version || '1.0.0', lightapiDigest: tool.lightapiDigest,
                allowedEnvironments,
            },
        };
        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) throw new Error(result.error.message || 'Grant failed');
            setMessage('Workflow access granted.');
            await load();
        } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
    };

    const revoke = async (grantRow: Grant) => {
        if (!tool) return;
        setBusy(true); setMessage('');
        try {
            const result = await apiPost({
                url: '/portal/command', headers: {}, body: {
                    host: 'lightapi.net', service: 'genai', action: 'revokeWorkflowTool', version: '0.1.0',
                    data: { hostId: tool.hostId, grantId: grantRow.grantId, aggregateVersion: grantRow.aggregateVersion },
                },
            });
            if (result.error) throw new Error(result.error.message || 'Revoke failed');
            setMessage('Workflow access revoked.');
            await load();
        } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
    };

    return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>Workflow Access · {tool?.name}</DialogTitle>
        <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
                {tool?.lightapiValidationStatus !== 'VALID' ? <Alert severity="error">Validate this Tool's LightAPI document before granting workflow access.</Alert> : null}
                <Box>
                    <Typography variant="caption">Capability</Typography>
                    <Typography>{tool?.capabilityRef}</Typography>
                    <Typography variant="caption">Pinned Tool {tool?.version} · {tool?.lightapiDigest}</Typography>
                </Box>
                <TextField select label="Workflow" value={wfDefId} onChange={event => setWfDefId(event.target.value)}>
                    <MenuItem value="">Select workflow</MenuItem>
                    {workflows.map(workflow => <MenuItem key={workflow.wfDefId} value={workflow.wfDefId}>
                        {[workflow.namespace, workflow.name, workflow.version].filter(Boolean).join(' · ') || workflow.wfDefId}
                    </MenuItem>)}
                </TextField>
                <FormControlLabel control={<Switch checked={pinVersion} onChange={event => setPinVersion(event.target.checked)} />} label="Grant one workflow version only" />
                {pinVersion ? <TextField label="Workflow Version" value={workflowVersion} onChange={event => setWorkflowVersion(event.target.value)} placeholder={selectedWorkflow?.version} /> : null}
                <TextField label="Allowed Environments" value={environments} onChange={event => setEnvironments(event.target.value)} helperText="Comma-separated, for example: local,test" />
                {duplicateGrant ? <Alert severity="info">This Tool is already granted to the selected workflow scope.</Alert> : null}
                <Button variant="contained" onClick={grant} disabled={busy || duplicateGrant || !wfDefId || !environments.trim() || tool?.lightapiValidationStatus !== 'VALID'}>Grant Access</Button>
                {message ? <Alert severity={message.includes('granted') || message.includes('revoked') ? 'success' : 'warning'}>{message}</Alert> : null}
                {grants.map(item => <Stack key={item.grantId} direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ flex: 1 }}>{item.workflowVersion || 'All workflow versions'}</Typography>
                    {item.allowedEnvironments.map(environment => <Chip size="small" key={environment} label={environment} />)}
                    <Button color="error" onClick={() => revoke(item)} disabled={busy}>Revoke</Button>
                </Stack>)}
            </Stack>
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>;
}
