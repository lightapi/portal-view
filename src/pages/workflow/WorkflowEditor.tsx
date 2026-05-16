import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { autocompletion, snippetCompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { yaml } from '@codemirror/lang-yaml';
import { foldGutter } from '@codemirror/language';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { hoverTooltip } from '@codemirror/view';
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

type ValidationProblem = {
    severity: 'error' | 'warning';
    message: string;
    from?: number;
    to?: number;
    line?: number;
    column?: number;
};

type DefinitionAnalysis = {
    parsed: unknown;
    error: string;
    steps: string[];
    toolRefs: string[];
    problems: ValidationProblem[];
};

type YamlDiagnostic = {
    message?: string;
    pos?: [number, number] | null;
};

type WorkflowHelp = {
    detail: string;
    info: string;
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

const taskTypeHelp: Record<string, WorkflowHelp> = {
    ask: { detail: 'Human task', info: 'Pause for human input, approval, or missing values.' },
    assert: { detail: 'Validation', info: 'Validate context, API results, or business rules.' },
    http: { detail: 'HTTP call', info: 'Invoke an HTTP endpoint directly or through a cataloged description.' },
    openapi: { detail: 'OpenAPI call', info: 'Invoke an API operation from a LightAPI or OpenAPI description.' },
    jsonrpc: { detail: 'JSON-RPC call', info: 'Invoke a JSON-RPC method directly or through an OpenRPC description.' },
    openrpc: { detail: 'OpenRPC call', info: 'Invoke a JSON-RPC method from an OpenRPC description.' },
    grpc: { detail: 'gRPC call', info: 'Invoke a cataloged gRPC method.' },
    mcp: { detail: 'MCP tool', info: 'Invoke a gateway-visible MCP tool, resource, or prompt.' },
    rule: { detail: 'Rule check', info: 'Delegate a complex check to Light-Rule.' },
    agent: { detail: 'Agent task', info: 'Delegate a bounded task to an agent worker.' },
    switch: { detail: 'Branch', info: 'Branch based on workflow context or task output.' },
    condition: { detail: 'Guard', info: 'Evaluate a conditional branch or step guard.' },
    set: { detail: 'Context update', info: 'Move values into workflow context.' },
    export: { detail: 'Output mapping', info: 'Map task results into workflow context or output.' },
    wait: { detail: 'Durable wait', info: 'Represent a durable wait, timeout, or externally completed task.' },
};

const rootKeyHelp: Record<string, WorkflowHelp> = {
    steps: { detail: 'Step list', info: 'Ordered Light-Fabric workflow steps.' },
    tasks: { detail: 'Task list', info: 'Alternative task collection for workflow definitions.' },
    states: { detail: 'State list', info: 'Serverless Workflow style state collection.' },
    do: { detail: 'Do block', info: 'Serverless Workflow style ordered task block.' },
    input: { detail: 'Input schema', info: 'Expected workflow input shape or defaults.' },
    output: { detail: 'Output mapping', info: 'Workflow output shape or expression mapping.' },
    metadata: { detail: 'Metadata', info: 'Authoring and runtime metadata for the workflow definition.' },
    timeout: { detail: 'Timeout', info: 'Workflow-level timeout policy.' },
    version: { detail: 'Spec version', info: 'Workflow specification or model version.' },
};

const taskTypeKeys = Object.keys(taskTypeHelp);
const workflowContainerKeys = new Set(['steps', 'tasks', 'states', 'do']);
const knownPropertyKeys = new Set([
    ...taskTypeKeys,
    ...Object.keys(rootKeyHelp),
    'arguments',
    'as',
    'description',
    'else',
    'equals',
    'export',
    'from',
    'id',
    'input',
    'label',
    'mode',
    'name',
    'next',
    'options',
    'output',
    'path',
    'prompt',
    'then',
    'to',
    'tool',
    'value',
    'when',
]);

const rootCompletions: Completion[] = Object.entries(rootKeyHelp).map(([label, help]) => ({
    label,
    type: 'property',
    detail: help.detail,
    info: help.info,
    apply: `${label}: `,
}));

const taskCompletions: Completion[] = [
    snippetCompletion('- ${stepId}:\n    ask:\n      prompt: ${prompt}\n      mode: text\n', {
        label: 'ask step',
        detail: 'Human task',
        type: 'keyword',
        info: taskTypeHelp.ask.info,
    }),
    snippetCompletion('- ${stepId}:\n    assert:\n      path: ${path}\n      equals: ${value}\n', {
        label: 'assert step',
        detail: 'Validation',
        type: 'keyword',
        info: taskTypeHelp.assert.info,
    }),
    snippetCompletion('- ${stepId}:\n    mcp:\n      tool: ${toolName}\n      arguments: {}\n', {
        label: 'mcp step',
        detail: 'Gateway tool',
        type: 'keyword',
        info: taskTypeHelp.mcp.info,
    }),
    snippetCompletion('- ${stepId}:\n    agent:\n      name: ${agentName}\n      input: {}\n', {
        label: 'agent step',
        detail: 'Agent task',
        type: 'keyword',
        info: taskTypeHelp.agent.info,
    }),
    ...Object.entries(taskTypeHelp).map(([label, help]) => ({
        label,
        type: 'property',
        detail: help.detail,
        info: help.info,
        apply: `${label}: `,
    })),
];

const workflowCompletions = (context: CompletionContext) => {
    const word = context.matchBefore(/[A-Za-z0-9_-]*/);
    if (!word || (word.from === word.to && !context.explicit)) {
        return null;
    }
    return {
        from: word.from,
        options: [...rootCompletions, ...taskCompletions],
        validFor: /^[A-Za-z0-9_-]*$/,
    };
};

const workflowHover = hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const offset = pos - line.from;
    const matches = Array.from(line.text.matchAll(/[A-Za-z0-9_-]+/g));
    const match = matches.find(item => {
        const start = item.index ?? 0;
        const end = start + item[0].length;
        return offset >= start && offset <= end;
    });
    if (!match) return null;
    const key = match[0];
    const help = taskTypeHelp[key] || rootKeyHelp[key];
    if (!help) return null;
    const start = line.from + (match.index ?? 0);
    const end = start + key.length;
    return {
        pos: start,
        end,
        above: true,
        create() {
            const dom = document.createElement('div');
            dom.style.maxWidth = '280px';
            dom.style.padding = '8px 10px';
            const title = document.createElement('strong');
            title.textContent = `${key} - ${help.detail}`;
            const body = document.createElement('div');
            body.textContent = help.info;
            dom.append(title, body);
            return { dom };
        },
    };
});

function positionToLineColumn(text: string, offset: number) {
    const safeOffset = Math.max(0, Math.min(text.length, offset));
    let line = 1;
    let column = 1;
    for (let index = 0; index < safeOffset; index += 1) {
        if (text[index] === '\n') {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }
    return { line, column };
}

function yamlProblem(definition: string, diagnostic: unknown, severity: ValidationProblem['severity']): ValidationProblem {
    const source = diagnostic as YamlDiagnostic;
    const from = Array.isArray(source.pos) ? source.pos[0] : undefined;
    const to = Array.isArray(source.pos) ? source.pos[1] : undefined;
    const location = typeof from === 'number' ? positionToLineColumn(definition, from) : {};
    return {
        severity,
        message: source.message || (severity === 'error' ? 'Invalid YAML.' : 'YAML warning.'),
        from,
        to,
        ...location,
    };
}

function validateWorkflowShape(parsed: unknown): ValidationProblem[] {
    if (parsed === null || parsed === undefined) {
        return [{ severity: 'error', message: 'Definition is required.' }];
    }
    if (Array.isArray(parsed) || typeof parsed !== 'object') {
        return [{ severity: 'error', message: 'Workflow definition must be a YAML mapping.' }];
    }
    const root = parsed as Record<string, unknown>;
    if (!Object.keys(root).some(key => workflowContainerKeys.has(key))) {
        return [{
            severity: 'warning',
            message: 'Definition should contain steps, tasks, states, or do so the workflow outline can be built.',
        }];
    }
    return [];
}

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
                if (!knownPropertyKeys.has(key)) {
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

function parseDefinition(definition: string): DefinitionAnalysis {
    const toolRefs = extractToolRefs(definition);
    if (!definition.trim()) {
        const problems: ValidationProblem[] = [{ severity: 'error', message: 'Definition is required.', from: 0, to: 0 }];
        return { parsed: null, error: problems[0].message, steps: [], toolRefs, problems };
    }
    try {
        const document = YAML.parseDocument(definition, { prettyErrors: false });
        const yamlProblems = [
            ...document.errors.map(error => yamlProblem(definition, error, 'error')),
            ...document.warnings.map(warning => yamlProblem(definition, warning, 'warning')),
        ];
        if (document.errors.length) {
            const firstError = yamlProblems.find(problem => problem.severity === 'error');
            return { parsed: null, error: firstError?.message || 'Unable to parse YAML.', steps: [], toolRefs, problems: yamlProblems };
        }
        const parsed = document.toJSON();
        const problems = [...yamlProblems, ...validateWorkflowShape(parsed)];
        const firstError = problems.find(problem => problem.severity === 'error');
        return {
            parsed,
            error: firstError?.message || '',
            steps: collectStepLabels(parsed),
            toolRefs,
            problems,
        };
    } catch (error) {
        const problems: ValidationProblem[] = [{
            severity: 'error',
            message: error instanceof Error ? error.message : 'Unable to parse YAML.',
            from: 0,
            to: Math.min(definition.length, 1),
        }];
        return {
            parsed: null,
            error: problems[0].message,
            steps: [],
            toolRefs,
            problems,
        };
    }
}

function toCodeMirrorDiagnostic(problem: ValidationProblem, docLength: number): Diagnostic {
    const from = Math.max(0, Math.min(docLength, problem.from ?? 0));
    const fallbackTo = docLength > from ? from + 1 : from;
    const to = Math.max(from, Math.min(docLength, problem.to ?? fallbackTo));
    return {
        from,
        to,
        severity: problem.severity,
        message: problem.message,
    };
}

function formatProblemLocation(problem: ValidationProblem) {
    const prefix = problem.severity === 'error' ? 'Error' : 'Warning';
    if (problem.line && problem.column) {
        return `${prefix} at line ${problem.line}, column ${problem.column}`;
    }
    return prefix;
}

function messageSeverity(message: string) {
    return message === 'Workflow definition saved.' || message === 'Workflow definition is valid.' ? 'success' : 'warning';
}

const workflowDefinitionLinter = linter(view => {
    const doc = view.state.doc.toString();
    return parseDefinition(doc).problems.map(problem => toCodeMirrorDiagnostic(problem, doc.length));
});

const workflowEditorExtensions = [
    yaml(),
    foldGutter(),
    lintGutter(),
    workflowDefinitionLinter,
    autocompletion({ override: [workflowCompletions] }),
    workflowHover,
];

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
    const blockingProblem = analysis.problems.find(problem => problem.severity === 'error');
    const warningCount = analysis.problems.filter(problem => problem.severity === 'warning').length;
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

    const handleValidate = useCallback(() => {
        if (blockingProblem) {
            setMessage(`Fix workflow definition: ${blockingProblem.message}`);
            return;
        }
        if (warningCount) {
            setMessage(`Workflow definition parsed with ${warningCount} warning${warningCount === 1 ? '' : 's'}.`);
            return;
        }
        setMessage('Workflow definition is valid.');
    }, [blockingProblem, warningCount]);

    const handleSave = useCallback(async () => {
        setMessage('');
        if (!hostId || !namespace || !name || !version || !definition.trim()) {
            setMessage('Host, namespace, name, version, and definition are required.');
            return;
        }
        if (blockingProblem) {
            setMessage(`Fix workflow definition before saving: ${blockingProblem.message}`);
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
    }, [active, aggregateVersion, blockingProblem, definition, hostId, isUpdate, name, namespace, ownerPositionId, version, wfDefId]);

    const handleStart = useCallback(() => {
        if (!wfDefId) {
            setMessage('Save the workflow definition before starting it.');
            return;
        }
        if (blockingProblem) {
            setMessage(`Fix workflow definition before testing: ${blockingProblem.message}`);
            return;
        }
        navigate('/app/form/startWorkflow', {
            state: {
                data: { hostId, wfDefId, input: "{}" },
                source: location.pathname,
            }
        });
    }, [blockingProblem, hostId, location.pathname, navigate, wfDefId]);

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
                <Button startIcon={<VerifiedIcon />} onClick={handleValidate}>
                    Validate
                </Button>
                <Button startIcon={<PlayArrowIcon />} onClick={handleStart} disabled={!wfDefId}>
                    Test
                </Button>
                <Button variant="contained" startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} onClick={handleSave} disabled={isSubmitting || isLoading}>
                    Save
                </Button>
            </Stack>

            {message && <Alert severity={messageSeverity(message)} sx={{ mb: 2 }}>{message}</Alert>}
            {analysis.problems.length ? (
                <Alert severity={blockingProblem ? 'error' : 'warning'} sx={{ mb: 2 }}>
                    {blockingProblem ? blockingProblem.message : `${warningCount} validation warning${warningCount === 1 ? '' : 's'} found.`}
                </Alert>
            ) : (
                <Alert icon={<VerifiedIcon />} severity="success" sx={{ mb: 2 }}>YAML parsed successfully.</Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr) 320px' }, gap: 2 }}>
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, minHeight: 420 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Problems</Typography>
                    <List dense>
                        {analysis.problems.length ? analysis.problems.map((problem, index) => (
                            <ListItemButton key={`${problem.severity}-${problem.message}-${index}`}>
                                <ListItemText
                                    primary={problem.message}
                                    secondary={formatProblemLocation(problem)}
                                    primaryTypographyProps={{ color: problem.severity === 'error' ? 'error.main' : 'warning.main' }}
                                />
                            </ListItemButton>
                        )) : (
                            <ListItemText primary="No problems detected." />
                        )}
                    </List>
                    <Divider sx={{ my: 2 }} />
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
                        extensions={workflowEditorExtensions}
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
