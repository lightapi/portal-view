import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tabs,
    Tooltip,
    Typography,
} from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SchemaIcon from '@mui/icons-material/Schema';
import VerifiedIcon from '@mui/icons-material/Verified';
import fetchClient from '../../utils/fetchClient';
import { useUserState } from '../../contexts/UserContext';
import { buildGenAiTaskContext, buildGenAiTaskRoute, GenAiTaskLayout } from './genAiTaskUtils';
import type { SkillWorkflowType } from './SkillWorkflow';

type SkillWorkspaceState = {
    data?: Partial<SkillType>;
    source?: string;
};

type SkillType = {
    hostId: string;
    skillId: string;
    parentSkillId?: string;
    name?: string;
    description?: string;
    contentMarkdown?: string;
    version?: string;
    tagIds?: string[];
    categoryIds?: string[];
    tags?: string[];
    categories?: string[];
    tagNames?: string[];
    categoryNames?: string[];
    aggregateVersion?: number;
    active?: boolean;
};

type SkillToolType = {
    hostId: string;
    skillId: string;
    toolId: string;
    toolName?: string;
    accessLevel?: string;
    config?: string;
    aggregateVersion?: number;
    active?: boolean;
};

type UserState = {
    host?: string;
};

function parseList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed.map(item => String(item)).filter(Boolean);
        } catch {
            return trimmed.split(',').map(item => item.trim()).filter(Boolean);
        }
    }
    return [];
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan}>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
            </TableCell>
        </TableRow>
    );
}

export default function SkillWorkspace() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { host } = useUserState() as UserState;
    const state = (location.state || {}) as SkillWorkspaceState;
    const source = state.source || '/app/genai/Skill';
    const initial = state.data || {};

    const [skill, setSkill] = useState<SkillType | null>(
        initial.skillId ? {
            hostId: initial.hostId || host || '',
            skillId: initial.skillId,
            parentSkillId: initial.parentSkillId,
            name: initial.name,
            description: initial.description,
            contentMarkdown: initial.contentMarkdown,
            version: initial.version,
            tagIds: parseList(initial.tagIds),
            categoryIds: parseList(initial.categoryIds),
            tags: parseList(initial.tags ?? initial.tagNames),
            categories: parseList(initial.categories ?? initial.categoryNames),
            aggregateVersion: initial.aggregateVersion,
            active: initial.active,
        } as SkillType : null,
    );
    const [skillTools, setSkillTools] = useState<SkillToolType[]>([]);
    const [skillWorkflows, setSkillWorkflows] = useState<SkillWorkflowType[]>([]);
    const [tab, setTab] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [validationKey, setValidationKey] = useState<string | null>(null);

    const hostId = skill?.hostId || initial.hostId || host || '';
    const skillId = skill?.skillId || initial.skillId || searchParams.get('skillId') || '';
    const context = useMemo(
        () => buildGenAiTaskContext(hostId, searchParams, skill || { hostId, skillId }),
        [hostId, searchParams, skill, skillId],
    );

    const fetchCatalog = useCallback(async () => {
        if (!hostId || !skillId) {
            setMessage('A skill id is required to open the workspace.');
            return;
        }
        setIsLoading(true);
        setMessage('');
        const filters = JSON.stringify([{ id: 'skillId', value: skillId }]);
        const skillCmd = {
            host: 'lightapi.net', service: 'genai', action: 'getSkill', version: '0.1.0',
            data: { hostId, filters, active: true, limit: 1, offset: 0 },
        };
        const toolCmd = {
            host: 'lightapi.net', service: 'genai', action: 'getSkillTool', version: '0.1.0',
            data: { hostId, filters, active: true, limit: 100, offset: 0 },
        };
        const workflowCmd = {
            host: 'lightapi.net', service: 'genai', action: 'getSkillWorkflow', version: '0.1.0',
            data: { hostId, filters, active: true, limit: 100, offset: 0 },
        };
        try {
            const [skillJson, toolJson, workflowJson] = await Promise.all([
                fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(skillCmd))),
                fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(toolCmd))),
                fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(workflowCmd))),
            ]);
            const freshSkill = skillJson.skills?.[0];
            if (freshSkill) {
                setSkill({
                    ...freshSkill,
                    tagIds: parseList(freshSkill.tagIds),
                    categoryIds: parseList(freshSkill.categoryIds),
                    tags: parseList(freshSkill.tags ?? freshSkill.tagNames),
                    categories: parseList(freshSkill.categories ?? freshSkill.categoryNames),
                });
            }
            setSkillTools(toolJson.skillTools || []);
            setSkillWorkflows(workflowJson.skillWorkflows || []);
        } catch (error) {
            console.error('Failed to load skill workspace:', error);
            setMessage('Failed to load the skill workspace.');
        } finally {
            setIsLoading(false);
        }
    }, [hostId, skillId]);

    useEffect(() => {
        fetchCatalog();
    }, [fetchCatalog]);

    const handleEditSkill = useCallback(() => {
        if (!skill) return;
        navigate(buildGenAiTaskRoute('/app/form/updateSkill', searchParams, context), {
            state: { data: skill, source: location.pathname },
        });
    }, [context, location.pathname, navigate, searchParams, skill]);

    const handleAddTool = useCallback(() => {
        navigate(buildGenAiTaskRoute('/app/form/createSkillTool', searchParams, context), {
            state: { data: { hostId, skillId, config: '{}', accessLevel: 'execute' }, source: location.pathname },
        });
    }, [context, hostId, location.pathname, navigate, searchParams, skillId]);

    const handleAddWorkflow = useCallback(() => {
        navigate(buildGenAiTaskRoute('/app/form/createSkillWorkflow', searchParams, context), {
            state: {
                data: { hostId, skillId, workflowRole: 'primary', startMode: 'manual', config: '{}' },
                source: location.pathname,
            },
        });
    }, [context, hostId, location.pathname, navigate, searchParams, skillId]);

    const handleOpenWorkflow = useCallback((workflow: SkillWorkflowType) => {
        navigate('/app/workflow/editor', {
            state: {
                data: { hostId: workflow.hostId, wfDefId: workflow.wfDefId },
                source: location.pathname,
            },
        });
    }, [location.pathname, navigate]);

    const handleStartWorkflow = useCallback((workflow: SkillWorkflowType) => {
        navigate('/app/form/startWorkflow', {
            state: {
                data: { hostId: workflow.hostId, wfDefId: workflow.wfDefId, input: '{}' },
                source: location.pathname,
            },
        });
    }, [location.pathname, navigate]);

    const handleValidateWorkflow = useCallback(async (workflow: SkillWorkflowType) => {
        const key = `${workflow.skillId}:${workflow.wfDefId}:${workflow.workflowRole}`;
        setValidationKey(key);
        setMessage('');
        const cmd = {
            host: 'lightapi.net',
            service: 'genai',
            action: 'validateSkillWorkflow',
            version: '0.1.0',
            data: {
                hostId: workflow.hostId,
                skillId: workflow.skillId,
                wfDefId: workflow.wfDefId,
            },
        };
        try {
            await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
            setMessage('Skill workflow validated.');
        } catch (error) {
            console.error('Failed to validate skill workflow:', error);
            setMessage('Skill workflow validation failed.');
        } finally {
            setValidationKey(null);
        }
    }, []);

    const primaryWorkflow = skillWorkflows.find(workflow => workflow.workflowRole === 'primary') || skillWorkflows[0];
    const tags = parseList(skill?.tags);
    const categories = parseList(skill?.categories);

    return (
        <GenAiTaskLayout context={context}>
            <Box sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(source)}>
                        Back
                    </Button>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h5" noWrap>{skill?.name || skillId || 'Skill Workspace'}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>{skillId}</Typography>
                    </Box>
                    <Button startIcon={<AddBoxIcon />} onClick={handleAddTool} disabled={!skillId}>
                        Tool
                    </Button>
                    <Button startIcon={<AddBoxIcon />} onClick={handleAddWorkflow} disabled={!skillId}>
                        Workflow
                    </Button>
                    <Button variant="contained" startIcon={<EditIcon />} onClick={handleEditSkill} disabled={!skill}>
                        Edit Skill
                    </Button>
                </Stack>

                {isLoading && (
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                        <CircularProgress size={18} />
                        <Typography variant="body2">Loading skill workspace...</Typography>
                    </Stack>
                )}
                {message && <Alert severity={message.includes('validated') ? 'success' : 'warning'} sx={{ mb: 2 }}>{message}</Alert>}

                <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tab label="Overview" />
                    <Tab label="Tools" />
                    <Tab label="Workflow" />
                    <Tab label="Preview" />
                    <Tab label="Test" />
                </Tabs>

                {tab === 0 && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>Skill</Typography>
                            <Stack spacing={1}>
                                <Typography variant="body2">Name: {skill?.name || '-'}</Typography>
                                <Typography variant="body2">Version: {skill?.version || '-'}</Typography>
                                <Typography variant="body2">Parent Skill: {skill?.parentSkillId || '-'}</Typography>
                                <Typography variant="body2">Active: {skill?.active === false ? 'false' : 'true'}</Typography>
                            </Stack>
                        </Box>
                        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>Routing</Typography>
                            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                                {categories.length ? categories.map(category => <Chip key={category} size="small" label={category} />) : <Typography variant="body2" color="text.secondary">No categories</Typography>}
                            </Stack>
                            <Stack direction="row" flexWrap="wrap" gap={1}>
                                {tags.length ? tags.map(tag => <Chip key={tag} size="small" variant="outlined" label={tag} />) : <Typography variant="body2" color="text.secondary">No tags</Typography>}
                            </Stack>
                        </Box>
                        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, gridColumn: { md: '1 / -1' } }}>
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>Description</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{skill?.description || '-'}</Typography>
                        </Box>
                    </Box>
                )}

                {tab === 1 && (
                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Tool</TableCell>
                                    <TableCell>Tool Id</TableCell>
                                    <TableCell>Access</TableCell>
                                    <TableCell>Config</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {skillTools.length ? skillTools.map(tool => (
                                    <TableRow key={tool.toolId}>
                                        <TableCell>{tool.toolName || '-'}</TableCell>
                                        <TableCell>{tool.toolId}</TableCell>
                                        <TableCell>{tool.accessLevel || '-'}</TableCell>
                                        <TableCell sx={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.config || '{}'}</TableCell>
                                    </TableRow>
                                )) : <EmptyRow colSpan={4} label="No tools linked to this skill." />}
                            </TableBody>
                        </Table>
                    </Box>
                )}

                {tab === 2 && (
                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Workflow</TableCell>
                                    <TableCell>Version</TableCell>
                                    <TableCell>Role</TableCell>
                                    <TableCell>Start Mode</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {skillWorkflows.length ? skillWorkflows.map(workflow => {
                                    const key = `${workflow.skillId}:${workflow.wfDefId}:${workflow.workflowRole}`;
                                    return (
                                        <TableRow key={key}>
                                            <TableCell>{workflow.workflowName || workflow.wfDefId}</TableCell>
                                            <TableCell>{workflow.workflowVersion || '-'}</TableCell>
                                            <TableCell>{workflow.workflowRole}</TableCell>
                                            <TableCell>{workflow.startMode || 'manual'}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Validate workflow tool links">
                                                    <IconButton onClick={() => handleValidateWorkflow(workflow)} disabled={validationKey === key}>
                                                        {validationKey === key ? <CircularProgress size={20} /> : <VerifiedIcon />}
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Open workflow editor">
                                                    <IconButton onClick={() => handleOpenWorkflow(workflow)}>
                                                        <SchemaIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Start workflow">
                                                    <IconButton color="primary" onClick={() => handleStartWorkflow(workflow)}>
                                                        <PlayArrowIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : <EmptyRow colSpan={5} label="No workflows linked to this skill." />}
                            </TableBody>
                        </Table>
                    </Box>
                )}

                {tab === 3 && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' }, gap: 2 }}>
                        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>Skill Content</Typography>
                            <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                                {skill?.contentMarkdown || ''}
                            </Typography>
                        </Box>
                        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 1 }}>Composition</Typography>
                            <Typography variant="body2">{skillTools.length} linked tool(s)</Typography>
                            <Typography variant="body2">{skillWorkflows.length} linked workflow(s)</Typography>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="body2">Primary Workflow: {primaryWorkflow?.workflowName || primaryWorkflow?.wfDefId || '-'}</Typography>
                        </Box>
                    </Box>
                )}

                {tab === 4 && (
                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>Runtime Test</Typography>
                        <Button
                            variant="contained"
                            startIcon={<PlayArrowIcon />}
                            onClick={() => primaryWorkflow && handleStartWorkflow(primaryWorkflow)}
                            disabled={!primaryWorkflow}
                        >
                            Start Primary Workflow
                        </Button>
                    </Box>
                )}
            </Box>
        </GenAiTaskLayout>
    );
}
