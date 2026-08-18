import { useCallback, useEffect, useState } from 'react';
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography,
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

type Grant = {
    grantId: string; wfDefId: string; toolVersion: string;
    lightapiDigest: string; allowedEnvironments: string[]; aggregateVersion: number;
    workflowNamespace?: string; workflowName?: string; currentWorkflowVersion?: string;
};

function queryUrl(action: string, data: Record<string, unknown>) {
    return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify({
        host: 'lightapi.net', service: 'genai',
        action, version: '0.1.0', data,
    }));
}

export default function WorkflowToolAccessDialog({
    open, tool, onClose,
}: { open: boolean; tool: WorkflowAccessTool | null; onClose: () => void }) {
    const [grants, setGrants] = useState<Grant[]>([]);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!open || !tool) return;
        const grantResult = await fetchClient(queryUrl('getWorkflowToolGrant', {
            hostId: tool.hostId, toolId: tool.toolId, active: true,
        })).catch(() => ({ grants: [] }));
        setGrants((grantResult.grants || []).filter((grant: Grant & { toolId?: string }) => grant.toolId === tool.toolId));
    }, [open, tool]);

    useEffect(() => { load().catch(error => setMessage(String(error))); }, [load]);

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
                <Alert severity="info">New access is requested from the Workflow Editor and approved through the GenAI Admin worklist. This view is read-only except for revocation.</Alert>
                {message ? <Alert severity={message.includes('granted') || message.includes('revoked') ? 'success' : 'warning'}>{message}</Alert> : null}
                <Box>
                    <Typography variant="subtitle1">Existing workflow grants</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Approved definition-wide grants for this Tool.
                    </Typography>
                    {grants.length === 0 ? <Typography color="text.secondary">No workflow grants.</Typography> : null}
                    <Stack spacing={1}>
                        {grants.map(item => {
                            const workflowTitle = [
                                item.workflowNamespace,
                                item.workflowName,
                            ].filter(Boolean).join(' · ') || item.wfDefId;
                            return <Stack key={item.grantId} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography>{workflowTitle}</Typography>
                                    <Typography variant="caption" color="text.secondary">{item.wfDefId}</Typography>
                                </Box>
                                <Chip size="small" variant="outlined" label="Definition-wide" />
                                {item.allowedEnvironments.map(environment => <Chip size="small" key={environment} label={environment} />)}
                                <Button color="error" onClick={() => revoke(item)} disabled={busy}>Revoke</Button>
                            </Stack>;
                        })}
                    </Stack>
                </Box>
            </Stack>
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>;
}
