import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import VerifiedIcon from '@mui/icons-material/Verified';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { useUserState } from '../../contexts/UserContext';
import { buildGenAiTaskContext, GenAiTaskLayout } from './genAiTaskUtils';
import type { AgentSkillType } from './AgentSkill';

type AgentAssignmentState = {
    data?: Partial<AgentDefinitionType>;
    source?: string;
};

type AgentDefinitionType = {
    hostId: string;
    agentDefId: string;
    agentName?: string;
};

type SkillType = {
    hostId: string;
    skillId: string;
    name?: string;
    description?: string;
};

type UserState = {
    host?: string;
};

function errorText(error: unknown) {
    if (error && typeof error === 'object') {
        const record = error as Record<string, unknown>;
        return String(record.description || record.message || record.code || 'Request failed.');
    }
    return String(error || 'Request failed.');
}

export default function AgentAssignment() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { host } = useUserState() as UserState;
    const state = (location.state || {}) as AgentAssignmentState;
    const source = state.source || '/app/genai/AgentDefinition';
    const initial = state.data || {};

    const [agent, setAgent] = useState<AgentDefinitionType | null>(
        initial.agentDefId ? {
            hostId: initial.hostId || host || '',
            agentDefId: initial.agentDefId,
            agentName: initial.agentName,
        } as AgentDefinitionType : null,
    );
    const [skills, setSkills] = useState<SkillType[]>([]);
    const [assigned, setAssigned] = useState<AgentSkillType[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<SkillType[]>([]);
    const [priority, setPriority] = useState(0);
    const [sequenceId, setSequenceId] = useState(0);
    const [config, setConfig] = useState('{}');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const hostId = agent?.hostId || initial.hostId || host || '';
    const agentDefId = agent?.agentDefId || initial.agentDefId || searchParams.get('agentDefId') || '';
    const context = useMemo(
        () => buildGenAiTaskContext(hostId, searchParams, agent || { hostId, agentDefId }),
        [agent, agentDefId, hostId, searchParams],
    );

    const query = useCallback((service: string, action: string, data: Record<string, unknown>) => {
        const cmd = { host: 'lightapi.net', service, action, version: '0.1.0', data };
        return fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
    }, []);

    const loadData = useCallback(async () => {
        if (!hostId || !agentDefId) {
            setMessage('Agent definition is required.');
            return;
        }
        setIsLoading(true);
        setMessage('');
        try {
            const agentFilters = JSON.stringify([{ id: 'agentDefId', value: agentDefId }]);
            const assignedFilters = JSON.stringify([{ id: 'agentDefId', value: agentDefId }]);
            const [agentJson, skillsJson, assignedJson] = await Promise.all([
                query('genai', 'getAgentDefinition', { hostId, filters: agentFilters, active: true, limit: 1, offset: 0 }),
                query('genai', 'getSkill', { hostId, active: true, limit: 500, offset: 0 }),
                query('genai', 'getAgentSkill', { hostId, filters: assignedFilters, active: true, limit: 500, offset: 0 }),
            ]);
            const freshAgent = agentJson.agentDefinitions?.[0] || agentJson.agents?.[0];
            if (freshAgent) setAgent(freshAgent);
            setSkills(skillsJson.skills || []);
            setAssigned(assignedJson.agentSkills || []);
        } catch (error) {
            console.error('Failed to load agent assignment data:', error);
            setMessage(errorText(error));
        } finally {
            setIsLoading(false);
        }
    }, [agentDefId, hostId, query]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const validateSkills = useCallback(async (skillIds: string[]) => {
        const failures: string[] = [];
        for (const skillId of skillIds) {
            try {
                await query('genai', 'validateAgentSkillAssignment', { hostId, agentDefId, skillId });
            } catch (error) {
                failures.push(`${skillId}: ${errorText(error)}`);
            }
        }
        if (failures.length) {
            setMessage(failures.join('\n'));
            return false;
        }
        setMessage('Assignment validated.');
        return true;
    }, [agentDefId, hostId, query]);

    const handleAssign = useCallback(async () => {
        if (!selectedSkills.length) {
            setMessage('Select at least one skill.');
            return;
        }
        const skillIds = selectedSkills.map(skill => skill.skillId);
        setIsSubmitting(true);
        try {
            const valid = await validateSkills(skillIds);
            if (!valid) return;
            const cmd = {
                host: 'lightapi.net',
                service: 'genai',
                action: 'assignAgentSkills',
                version: '0.1.0',
                data: {
                    hostId,
                    agentDefId,
                    skills: selectedSkills.map((skill, index) => ({
                        skillId: skill.skillId,
                        config,
                        priority,
                        sequenceId: sequenceId + index,
                    })),
                },
            };
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                setMessage(errorText(result.error));
                return;
            }
            setSelectedSkills([]);
            setMessage('Skills assigned.');
            await loadData();
        } catch (error) {
            console.error('Failed to assign skills:', error);
            setMessage(errorText(error));
        } finally {
            setIsSubmitting(false);
        }
    }, [agentDefId, config, hostId, loadData, priority, selectedSkills, sequenceId, validateSkills]);

    const handleDelete = useCallback(async (row: AgentSkillType) => {
        if (!window.confirm(`Delete skill ${row.skillName || row.skillId} from this agent?`)) return;
        const original = assigned;
        setAssigned(prev => prev.filter(item => item.skillId !== row.skillId));
        const cmd = {
            host: 'lightapi.net',
            service: 'genai',
            action: 'deleteAgentSkill',
            version: '0.1.0',
            data: row,
        };
        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                setMessage(errorText(result.error));
                setAssigned(original);
            }
        } catch (error) {
            setMessage(errorText(error));
            setAssigned(original);
        }
    }, [assigned]);

    const assignedIds = useMemo(() => new Set(assigned.map(row => row.skillId)), [assigned]);
    const assignableSkills = useMemo(() => skills.filter(skill => !assignedIds.has(skill.skillId)), [assignedIds, skills]);

    return (
        <GenAiTaskLayout context={context}>
            <Box sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(source)}>
                        Back
                    </Button>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h5" noWrap>{agent?.agentName || agentDefId || 'Agent Assignment'}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>{agentDefId}</Typography>
                    </Box>
                    <Button
                        startIcon={<VerifiedIcon />}
                        onClick={() => validateSkills(selectedSkills.map(skill => skill.skillId))}
                        disabled={!selectedSkills.length || isSubmitting}
                    >
                        Validate
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <PlaylistAddCheckIcon />}
                        onClick={handleAssign}
                        disabled={!selectedSkills.length || isSubmitting}
                    >
                        Assign
                    </Button>
                </Stack>

                {isLoading && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <CircularProgress size={18} />
                        <Typography variant="body2">Loading...</Typography>
                    </Stack>
                )}
                {message && <Alert severity={message.includes('validated') || message.includes('assigned') ? 'success' : 'warning'} sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{message}</Alert>}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 420px) minmax(0, 1fr)' }, gap: 2 }}>
                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                        <Stack spacing={2}>
                            <Autocomplete
                                multiple
                                options={assignableSkills}
                                value={selectedSkills}
                                getOptionLabel={(option) => option.name ? `${option.name} (${option.skillId})` : option.skillId}
                                isOptionEqualToValue={(option, value) => option.skillId === value.skillId}
                                onChange={(_, value) => setSelectedSkills(value)}
                                renderInput={(params) => <TextField {...params} label="Skills" size="small" />}
                            />
                            <TextField label="Config" value={config} onChange={e => setConfig(e.target.value)} size="small" multiline minRows={4} />
                            <TextField label="Priority" value={priority} onChange={e => setPriority(Number(e.target.value || 0))} size="small" type="number" />
                            <TextField label="Starting Sequence" value={sequenceId} onChange={e => setSequenceId(Number(e.target.value || 0))} size="small" type="number" />
                        </Stack>
                    </Box>

                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Skill</TableCell>
                                    <TableCell>Priority</TableCell>
                                    <TableCell>Sequence</TableCell>
                                    <TableCell>Active Tools</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {assigned.length ? assigned.map(row => (
                                    <TableRow key={row.skillId}>
                                        <TableCell>{row.skillName || row.skillId}</TableCell>
                                        <TableCell>{row.priority ?? 0}</TableCell>
                                        <TableCell>{row.sequenceId ?? 0}</TableCell>
                                        <TableCell>{row.activeToolCount ?? 0}</TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Delete assignment">
                                                <IconButton color="error" onClick={() => handleDelete(row)}>
                                                    <DeleteForeverIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <Typography variant="body2" color="text.secondary">No assigned skills.</Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Box>
                </Box>
            </Box>
        </GenAiTaskLayout>
    );
}
