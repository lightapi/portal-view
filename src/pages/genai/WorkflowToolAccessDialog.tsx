import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControlLabel, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { environmentOptions, type EnvironmentOption } from '../../utils/environmentOptions';

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
    workflowNamespace?: string; workflowName?: string; currentWorkflowVersion?: string;
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
    const [availableEnvironments, setAvailableEnvironments] = useState<EnvironmentOption[]>([]);
    const [environments, setEnvironments] = useState<string[]>([]);
    const [environmentsLoading, setEnvironmentsLoading] = useState(false);
    const [environmentsError, setEnvironmentsError] = useState('');
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
                hostId: tool.hostId, toolId: tool.toolId, active: true,
            })).catch(() => ({ grants: [] })),
        ]);
        setWorkflows(workflowResult.wfDefinitions || workflowResult.workflows || []);
        setGrants((grantResult.grants || []).filter((grant: Grant & { toolId?: string }) => grant.toolId === tool.toolId));
    }, [open, tool]);

    useEffect(() => { load().catch(error => setMessage(String(error))); }, [load]);

    useEffect(() => {
        if (!open || !tool) {
            setAvailableEnvironments([]);
            setEnvironments([]);
            setEnvironmentsError('');
            setEnvironmentsLoading(false);
            return;
        }

        let active = true;
        setAvailableEnvironments([]);
        setEnvironments([]);
        setEnvironmentsError('');
        setEnvironmentsLoading(true);
        void fetchClient(`/r/data?name=environment&host=${encodeURIComponent(tool.hostId)}`)
            .then(value => {
                if (active) setAvailableEnvironments(environmentOptions(value));
            })
            .catch(() => {
                if (active) setEnvironmentsError('Unable to load environments.');
            })
            .finally(() => {
                if (active) setEnvironmentsLoading(false);
            });
        return () => { active = false; };
    }, [open, tool]);

    const selectedWorkflow = useMemo(
        () => workflows.find(workflow => workflow.wfDefId === wfDefId),
        [wfDefId, workflows],
    );
    const selectedScopeVersion = pinVersion ? (workflowVersion || selectedWorkflow?.version || '') : undefined;
    const duplicateGrant = useMemo(
        () => grants.some(item => item.wfDefId === wfDefId
            && (item.workflowVersion || undefined) === selectedScopeVersion),
        [grants, selectedScopeVersion, wfDefId],
    );

    const grant = async () => {
        if (!tool || !wfDefId || !tool.lightapiDigest) return;
        setBusy(true); setMessage('');
        const cmd = {
            host: 'lightapi.net', service: 'genai', action: 'grantWorkflowTool', version: '0.1.0',
            data: {
                hostId: tool.hostId, grantId: crypto.randomUUID(), toolId: tool.toolId, wfDefId,
                workflowVersion: selectedScopeVersion,
                toolVersion: tool.version || '1.0.0', lightapiDigest: tool.lightapiDigest,
                allowedEnvironments: environments,
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
                <Autocomplete
                    multiple
                    disableCloseOnSelect
                    options={availableEnvironments}
                    value={availableEnvironments.filter(option => environments.includes(option.id))}
                    loading={environmentsLoading}
                    getOptionLabel={option => option.label}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    onChange={(_event, values) => setEnvironments(values.map(option => option.id))}
                    renderInput={params => <TextField
                        {...params}
                        label="Allowed Environments"
                        error={Boolean(environmentsError)}
                        helperText={environmentsError || 'Select one or more environments.'}
                        slotProps={{
                            input: {
                                ...params.InputProps,
                                endAdornment: <>{environmentsLoading ? <CircularProgress color="inherit" size={20} /> : null}{params.InputProps.endAdornment}</>,
                            },
                        }}
                    />}
                />
                {duplicateGrant ? <Alert severity="info">This Tool is already granted to the selected workflow scope.</Alert> : null}
                <Button variant="contained" onClick={grant} disabled={busy || duplicateGrant || !wfDefId || environments.length === 0 || tool?.lightapiValidationStatus !== 'VALID'}>Grant Access</Button>
                {message ? <Alert severity={message.includes('granted') || message.includes('revoked') ? 'success' : 'warning'}>{message}</Alert> : null}
                <Box>
                    <Typography variant="subtitle1">Existing workflow grants</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Select another workflow above to add another grant for this Tool.
                    </Typography>
                    {grants.length === 0 ? <Typography color="text.secondary">No workflow grants.</Typography> : null}
                    <Stack spacing={1}>
                        {grants.map(item => {
                            const workflow = workflows.find(option => option.wfDefId === item.wfDefId);
                            const workflowTitle = [
                                item.workflowNamespace || workflow?.namespace,
                                item.workflowName || workflow?.name,
                            ].filter(Boolean).join(' · ') || item.wfDefId;
                            return <Stack key={item.grantId} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography>{workflowTitle}</Typography>
                                    <Typography variant="caption" color="text.secondary">{item.wfDefId}</Typography>
                                </Box>
                                <Chip size="small" variant="outlined" label={item.workflowVersion ? `Version ${item.workflowVersion}` : 'All versions'} />
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
