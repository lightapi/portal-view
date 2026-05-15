import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { githubLight } from '@uiw/codemirror-theme-github';
import YAML from 'yaml';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    List,
    ListItemButton,
    ListItemText,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import IosShareIcon from '@mui/icons-material/IosShare';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import VerifiedIcon from '@mui/icons-material/Verified';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { useUserState } from '../../contexts/UserContext';

type WorkflowEditorState = {
    data?: Partial<WfDefinitionType>;
    source?: string;
};

type WfDefinitionType = {
    hostId: string;
    wfDefId?: string;
    namespace: string;
    name: string;
    version: string;
    definition: string;
    ownerPositionId?: string;
    aggregateVersion?: number;
    active?: boolean;
};

type UserState = {
    host?: string;
};

const emptyDefinition = `steps:
  - ask-input:
      ask:
        prompt: Provide workflow input.
        mode: text
      export:
        as:
          answer: \${ .result }
`;

function collectStepLabels(value: unknown): string[] {
    const labels: string[] = [];
    const visit = (node: unknown) => {
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        if (!node || typeof node !== 'object') {
            return;
        }
        const record = node as Record<string, unknown>;
        for (const [key, child] of Object.entries(record)) {
            if (Array.isArray(child) || (child && typeof child === 'object')) {
                if (!['ask', 'assert', 'http', 'openapi', 'jsonrpc', 'openrpc', 'grpc', 'mcp', 'rule', 'agent', 'switch', 'condition', 'set', 'export', 'wait', 'steps', 'tasks'].includes(key)) {
                    labels.push(key);
                }
                visit(child);
            }
        }
    };
    visit(value);
    return Array.from(new Set(labels)).slice(0, 80);
}

function extractToolRefs(definition: string): string[] {
    const refs = new Set<string>();
    const pattern = /(?:^|[\s{,])"?(?:tool|toolName|tool_name|mcpTool|mcp_tool)"?\s*[:=]\s*["']?([^"'\s,}\]]+)/gim;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(definition)) !== null) {
        if (match[1]) refs.add(match[1]);
    }
    return Array.from(refs).sort();
}

function parseDefinition(definition: string) {
    if (!definition.trim()) {
        return { parsed: null, error: 'Definition is required.', steps: [], toolRefs: [] };
    }
    try {
        const parsed = YAML.parse(definition);
        return {
            parsed,
            error: '',
            steps: collectStepLabels(parsed),
            toolRefs: extractToolRefs(definition),
        };
    } catch (error) {
        return {
            parsed: null,
            error: error instanceof Error ? error.message : 'Unable to parse YAML.',
            steps: [],
            toolRefs: extractToolRefs(definition),
        };
    }
}

export default function WorkflowEditor() {
    const location = useLocation();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const { host } = useUserState() as UserState;
    const state = (location.state || {}) as WorkflowEditorState;
    const initial = state.data || {};
    const source = state.source || '/app/workflow/WfDefinition';

    const [hostId, setHostId] = useState(initial.hostId || host || '');
    const [wfDefId, setWfDefId] = useState(initial.wfDefId || '');
    const [namespace, setNamespace] = useState(initial.namespace || '');
    const [name, setName] = useState(initial.name || '');
    const [version, setVersion] = useState(initial.version || '1.0.0');
    const [definition, setDefinition] = useState(initial.definition || emptyDefinition);
    const [ownerPositionId, setOwnerPositionId] = useState(initial.ownerPositionId || '');
    const [aggregateVersion, setAggregateVersion] = useState(initial.aggregateVersion);
    const [active, setActive] = useState(initial.active ?? true);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const analysis = useMemo(() => parseDefinition(definition), [definition]);
    const isUpdate = Boolean(wfDefId && aggregateVersion);

    useEffect(() => {
        if (!initial.wfDefId || initial.definition) return;
        const cmd = {
            host: 'lightapi.net', service: 'workflow', action: 'getWfDefinition', version: '0.1.0',
            data: { hostId: initial.hostId || host, filters: JSON.stringify([{ id: 'wfDefId', value: initial.wfDefId }]), active: true, limit: 1, offset: 0 },
        };
        const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
        setIsLoading(true);
        fetchClient(url)
            .then(json => {
                const row = json.workflows?.[0];
                if (!row) return;
                setHostId(row.hostId || '');
                setWfDefId(row.wfDefId || '');
                setNamespace(row.namespace || '');
                setName(row.name || '');
                setVersion(row.version || '1.0.0');
                setDefinition(row.definition || '');
                setOwnerPositionId(row.ownerPositionId || '');
                setAggregateVersion(row.aggregateVersion);
                setActive(row.active ?? true);
            })
            .catch(error => {
                console.error('Failed to load workflow definition:', error);
                setMessage('Failed to load workflow definition.');
            })
            .finally(() => setIsLoading(false));
    }, [host, initial.hostId, initial.wfDefId, initial.definition]);

    const handleFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => setDefinition(String(e.target?.result || ''));
        reader.readAsText(file);
        event.target.value = '';
    }, []);

    const handleExport = useCallback(() => {
        const blob = new Blob([definition], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name || 'workflow'}.yaml`;
        link.click();
        URL.revokeObjectURL(url);
    }, [definition, name]);

    const handleSave = useCallback(async () => {
        setMessage('');
        if (!hostId || !namespace || !name || !version || !definition.trim()) {
            setMessage('Host, namespace, name, version, and definition are required.');
            return;
        }
        if (analysis.error) {
            setMessage(`Fix YAML before saving: ${analysis.error}`);
            return;
        }
        setIsSubmitting(true);
        const data: Record<string, unknown> = {
            hostId,
            namespace,
            name,
            version,
            definition,
            ownerPositionId: ownerPositionId || undefined,
        };
        if (isUpdate) {
            data.wfDefId = wfDefId;
            data.aggregateVersion = aggregateVersion;
            data.active = active;
        }
        const cmd = {
            host: 'lightapi.net',
            service: 'workflow',
            action: isUpdate ? 'updateWfDefinition' : 'createWfDefinition',
            version: '0.1.0',
            data,
        };

        try {
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                setMessage(result.error.description || 'Failed to save workflow definition.');
                return;
            }
            const response = result.data || {};
            setWfDefId(response.wfDefId || wfDefId);
            setAggregateVersion(response.newAggregateVersion || response.aggregateVersion || aggregateVersion);
            setMessage('Workflow definition saved.');
        } catch (error) {
            console.error('Failed to save workflow definition:', error);
            setMessage('Failed to save workflow definition due to a network error.');
        } finally {
            setIsSubmitting(false);
        }
    }, [active, aggregateVersion, analysis.error, definition, hostId, isUpdate, name, namespace, ownerPositionId, version, wfDefId]);

    const handleStart = useCallback(() => {
        if (!wfDefId) {
            setMessage('Save the workflow definition before starting it.');
            return;
        }
        navigate('/app/form/startWorkflow', {
            state: {
                data: { hostId, wfDefId, input: "{}" },
                source: location.pathname,
            }
        });
    }, [hostId, location.pathname, navigate, wfDefId]);

    return (
        <Box sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(source)}>
                    Back
                </Button>
                <Typography variant="h5" sx={{ flex: 1 }}>Workflow Editor</Typography>
                <input ref={fileInputRef} type="file" hidden accept=".yaml,.yml,.json" onChange={handleFile} />
                <Button startIcon={<FileUploadIcon />} onClick={() => fileInputRef.current?.click()}>
                    Import
                </Button>
                <Button startIcon={<IosShareIcon />} onClick={handleExport}>
                    Export
                </Button>
                <Button startIcon={<PlayArrowIcon />} onClick={handleStart} disabled={!wfDefId}>
                    Test
                </Button>
                <Button variant="contained" startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} onClick={handleSave} disabled={isSubmitting || isLoading}>
                    Save
                </Button>
            </Stack>

            {message && <Alert severity={message.includes('saved') ? 'success' : 'warning'} sx={{ mb: 2 }}>{message}</Alert>}
            {analysis.error ? (
                <Alert severity="error" sx={{ mb: 2 }}>{analysis.error}</Alert>
            ) : (
                <Alert icon={<VerifiedIcon />} severity="success" sx={{ mb: 2 }}>YAML parsed successfully.</Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr) 320px' }, gap: 2 }}>
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, minHeight: 420 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Steps</Typography>
                    <List dense>
                        {analysis.steps.length ? analysis.steps.map(step => (
                            <ListItemButton key={step}>
                                <ListItemText primary={step} />
                            </ListItemButton>
                        )) : (
                            <ListItemText primary="No named steps detected." />
                        )}
                    </List>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Tool References</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                        {analysis.toolRefs.length ? analysis.toolRefs.map(ref => <Chip key={ref} size="small" label={ref} />) : <Typography variant="body2">None</Typography>}
                    </Stack>
                </Box>

                <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
                        <TextField label="Host Id" value={hostId} onChange={e => setHostId(e.target.value)} size="small" />
                        <TextField label="Workflow Definition Id" value={wfDefId} size="small" slotProps={{ input: { readOnly: true } }} />
                        <TextField label="Namespace" value={namespace} onChange={e => setNamespace(e.target.value)} size="small" />
                        <TextField label="Name" value={name} onChange={e => setName(e.target.value)} size="small" />
                        <TextField label="Version" value={version} onChange={e => setVersion(e.target.value)} size="small" />
                        <TextField label="Owner Position Id" value={ownerPositionId} onChange={e => setOwnerPositionId(e.target.value)} size="small" />
                    </Box>
                    <CodeMirror
                        value={definition}
                        height="560px"
                        theme={githubLight}
                        extensions={[yaml()]}
                        onChange={setDefinition}
                    />
                </Box>

                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, minHeight: 420 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Definition</Typography>
                    <Stack spacing={1}>
                        <Typography variant="body2">Mode: {isUpdate ? 'Update' : 'Create'}</Typography>
                        <Typography variant="body2">Active: {active ? 'true' : 'false'}</Typography>
                        <Typography variant="body2">Aggregate Version: {aggregateVersion ?? 'new'}</Typography>
                        <Typography variant="body2">Top-level Type: {analysis.parsed === null ? 'none' : Array.isArray(analysis.parsed) ? 'array' : typeof analysis.parsed}</Typography>
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Starter Snippets</Typography>
                    <Stack spacing={1}>
                        <Button size="small" variant="outlined" onClick={() => setDefinition(value => `${value.trimEnd()}\n\n  - assert-output:\n      assert:\n        path: $.status\n        equals: ok\n`)}>
                            Assert
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => setDefinition(value => `${value.trimEnd()}\n\n  - call-tool:\n      mcp:\n        tool: tool_name\n        arguments: {}\n`)}>
                            MCP Tool
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => setDefinition(value => `${value.trimEnd()}\n\n  - wait-approval:\n      ask:\n        prompt: Approve this step?\n        mode: choice\n        options:\n          - label: Approve\n            value: approve\n          - label: Reject\n            value: reject\n`)}>
                            Ask
                        </Button>
                    </Stack>
                </Box>
            </Box>
        </Box>
    );
}
