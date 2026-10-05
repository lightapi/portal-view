import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography, TextField,
} from '@mui/material';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';

export type WorkflowAccessTool = {
    hostId: string;
    toolId: string;
    name: string;
    version?: string;
    capabilityRef?: string;
    apiMethod?: string;
    lightapiDigest?: string;
    lightapiValidationStatus?: string;
};

type Grant = {
    grantId: string; wfDefId: string; toolVersion: string;
    lightapiDigest: string; allowedEnvironments: string[]; aggregateVersion: number;
    workflowNamespace?: string; workflowName?: string; currentWorkflowVersion?: string;
    grantSyncStatus?: string; grantSyncErrorCode?: string; grantSyncErrorMessage?: string;
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
    const [broad, setBroad] = useState<{enabled?: boolean; effectiveEnabled?: boolean; renewalNeeded?: boolean; aggregateVersion?: number;
        toolVersion?: string; lightapiDigest?: string; allowedEnvironments?: string[]; allowedMethods?: string[];
        syncStatus?: string; syncError?: string}>({});
    const [policyLoaded, setPolicyLoaded] = useState(false);
    const loadSequence = useRef(0);
    const [environments, setEnvironments] = useState('');
    const [methods, setMethods] = useState('');
    const [grants, setGrants] = useState<Grant[]>([]);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const trackedDefinitions = useRef(new Set<string>());
    const [syncStatuses, setSyncStatuses] = useState<Array<{wfDefId: string; status?: string;
        code?: string; message?: string}>>([]);

    const load = useCallback(async () => {
        if (!open || !tool) return;
        const sequence = ++loadSequence.current;
        setPolicyLoaded(false); setEnvironments(''); setMethods(''); setBroad({});
        const [policy, registry] = await Promise.all([
            fetchClient(queryUrl('getToolWorkflowAccess', {hostId: tool.hostId, toolId: tool.toolId})),
            fetchClient('/r/data?name=environment&host=' + encodeURIComponent(tool.hostId)),
        ]);
        if (sequence !== loadSequence.current) return;
        const hostEnvironments: string[] = Array.isArray(registry)
            ? registry.map((item: {id: string}) => item.id).filter(Boolean) : [];
        const reviewedEnvironments = Array.isArray(policy.allowedEnvironments)
            ? policy.allowedEnvironments.filter((id: string) => hostEnvironments.includes(id))
            : hostEnvironments.slice(0, 1);
        setBroad(policy); setPolicyLoaded(true);
        setEnvironments(reviewedEnvironments.join(', '));
        setMethods((tool.apiMethod || '').trim().toUpperCase());
        const grantResult = await fetchClient(queryUrl('getWorkflowToolGrant', {
            hostId: tool.hostId, toolId: tool.toolId, active: true,
        }));
        if (sequence !== loadSequence.current) return;
        const rows: Grant[] = (grantResult.grants || []).filter((grant: Grant & { toolId?: string }) => grant.toolId === tool.toolId);
        rows.forEach(row => trackedDefinitions.current.add(row.wfDefId));
        const sync = await Promise.all([...trackedDefinitions.current].map(async wfDefId => {
            try {
                const status = await fetchClient(queryUrl('getWorkflowToolGrant', {
                    hostId: tool.hostId, wfDefId, active: true,
                }));
                return [wfDefId, status] as const;
            } catch {
                return [wfDefId, {grantSyncStatus: 'unavailable'}] as const;
            }
        }));
        if (sequence !== loadSequence.current) return;
        const byDefinition = Object.fromEntries(sync);
        setSyncStatuses(sync.map(([wfDefId, status]) => ({wfDefId, status: status.grantSyncStatus,
            code: status.grantSyncErrorCode, message: status.grantSyncErrorMessage})));
        setGrants(rows.map(row => ({...row,
            grantSyncStatus: byDefinition[row.wfDefId]?.grantSyncStatus,
            grantSyncErrorCode: byDefinition[row.wfDefId]?.grantSyncErrorCode,
            grantSyncErrorMessage: byDefinition[row.wfDefId]?.grantSyncErrorMessage,
        })));
    }, [open, tool]);

    useEffect(() => { load().catch(error => setMessage(String(error?.message ?? error))); }, [load]);
    useEffect(() => { trackedDefinitions.current.clear(); setSyncStatuses([]); }, [tool?.toolId]);

    const setAccess = async (enabled: boolean, retry = false) => {
        if (!tool) return;
        setBusy(true); setMessage('');
        try {
            const result = await apiPost({url: '/portal/command', headers: {}, body: {
                host: 'lightapi.net', service: 'genai', action: retry ? 'publishToolWorkflowAccess' : 'setToolWorkflowAccess', version: '0.1.0',
                data: retry ? {hostId: tool.hostId, toolId: tool.toolId} : {
                    hostId: tool.hostId, toolId: tool.toolId, capabilityRef: tool.capabilityRef,
                    toolVersion: tool.version, lightapiDigest: tool.lightapiDigest, enabled,
                    aggregateVersion: broad.aggregateVersion ?? 0,
                    allowedEnvironments: environments.split(',').map(value => value.trim()).filter(Boolean),
                    allowedMethods: methods.split(',').map(value => value.trim().toUpperCase()).filter(Boolean),
                },
            }});
            if (result.error) throw new Error(result.error.message || 'Workflow Access change failed');
            await load();
            if (result.aborted) {
                setMessage('Command outcome unconfirmed. Check operational publication and refresh before starting a workflow.');
                return;
            }
            setMessage('Policy saved. Check publication status below before starting a workflow.');
        } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
    };

    const revoke = async (grantRow: Grant) => {
        if (!tool) return;
        trackedDefinitions.current.add(grantRow.wfDefId);
        setBusy(true); setMessage('');
        try {
            const result = await apiPost({
                url: '/portal/command', headers: {}, body: {
                    host: 'lightapi.net', service: 'genai', action: 'revokeWorkflowTool', version: '0.1.0',
                    data: { hostId: tool.hostId, grantId: grantRow.grantId, aggregateVersion: grantRow.aggregateVersion },
                },
            });
            if (result.error) throw new Error(result.error.message || 'Revoke failed');
            await load();
            setMessage(result.aborted
                ? 'Command outcome unconfirmed. Check grant synchronization and refresh before starting a workflow.'
                : 'Workflow access revoked.');
        } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
    };

    const publicationPending = broad.syncStatus === 'pending' || broad.syncStatus === 'error';
    const broadLabel = !policyLoaded ? 'Loading Workflow Access' : !broad.enabled && publicationPending ? 'Disable pending publication'
        : broad.renewalNeeded ? 'Renewal needed — Tool pins changed'
        : broad.enabled && publicationPending ? 'Enable pending publication'
        : broad.enabled ? 'Enabled for this exact Tool version' : 'Broad access disabled';

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
                <Alert severity="info">A GenAI Admin can enable this reviewed Tool version for all workflows in this Host, including future workflows. No workflow-specific approval is needed while matching broad access is published. Gateway still enforces each caller’s API permissions. New access is requested from the Workflow Editor when broad access is absent.</Alert>
                <Box>
                    <Typography variant="subtitle1">All workflows in this Host</Typography>
                    <Chip label={broadLabel} color={broad.enabled && broad.effectiveEnabled === true && !broad.renewalNeeded && broad.syncStatus === 'synced' ? 'success' : 'default'} />
                    {!broad.enabled && publicationPending ? <Alert severity="warning">The previous operational policy may still authorize fresh starts until the disable has a matching publication receipt.</Alert> : null}
                    {broad.toolVersion ? <Typography variant="body2">Reviewed {broad.toolVersion} · {broad.lightapiDigest}</Typography> : null}
                    {broad.enabled && broad.effectiveEnabled === false ? <Alert severity="warning">Broad access is currently unavailable. Check exact pins, lifecycle restrictions and operational publication below.</Alert> : null}
                    <Typography variant="body2">Only the reviewed environments and registered HTTP method are allowed. Tool/API lifecycle and supported routing restrictions still apply.</Typography>
                    <Stack direction="row" spacing={1} sx={{my: 1}}>
                        <TextField label="Reviewed environments (comma separated)" value={environments} onChange={event => setEnvironments(event.target.value)} disabled={busy} />
                        <TextField label="Registered HTTP method" value={methods} onChange={event => setMethods(event.target.value)} disabled={busy} />
                    </Stack>
                    <Button disabled={busy || tool?.lightapiValidationStatus !== 'VALID' || !environments.trim() || !methods.trim()} onClick={() => setAccess(true)}>{broad.renewalNeeded ? 'Renew reviewed version' : 'Enable reviewed version'}</Button>
                    <Button color="error" disabled={busy || !broad.enabled} onClick={() => setAccess(false)}>Disable broad access</Button>
                    <Typography variant="body2">Disabling blocks new starts that rely only on broad access after publication. Explicit workflow grants and already accepted runs remain authorized under their pins; caller-token expiry and execution fences still apply.</Typography>
                    {broad.syncStatus ? <Alert severity={broad.syncStatus === 'synced' ? 'success' : 'warning'}>Operational publication: {broad.syncStatus}. {broad.syncError}
                        {broad.syncStatus !== 'synced' ? <Button disabled={busy} onClick={() => setAccess(Boolean(broad.enabled), true)}>Retry publication</Button> : null}
                    </Alert> : null}
                </Box>
                {syncStatuses.map(item => item.status === 'unavailable'
                    ? <Alert key={item.wfDefId} severity="warning">{item.wfDefId}: Sync status unavailable. Refresh to retry.</Alert>
                    : item.status === 'pending'
                    ? <Alert key={item.wfDefId} severity="warning">{item.wfDefId}: Sync pending</Alert>
                    : item.status === 'error' ? <Alert key={item.wfDefId} severity="error">
                        {item.wfDefId}: {item.code}: {item.message}
                        {['WORKFLOW_SYNC_REVISION_AHEAD', 'WORKFLOW_SYNC_REVISION_CONFLICT'].includes(item.code ?? '')
                            ? ' — requires investigation.' : ''}
                    </Alert> : null)}
                {message ? <Alert severity={message.includes('granted') || message.includes('revoked') ? 'success' : 'warning'}>{message}</Alert> : null}
                <Box>
                    <Typography variant="subtitle1">Existing workflow grants</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        These grants authorize only the named workflow definition. Disabling broad access leaves them intact; revoking one leaves independent broad access intact.
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
