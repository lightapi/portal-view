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
    LinearProgress,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import IosShareIcon from '@mui/icons-material/IosShare';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
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

type CatalogKind = 'tools' | 'endpoints' | 'rules' | 'agents' | 'workflows';

type CatalogReference = {
    kind: CatalogKind;
    id: string;
    value: string;
    label: string;
    secondary?: string;
    description?: string;
};

type CatalogState = Record<CatalogKind, CatalogReference[]>;

type StepTemplate = {
    id: string;
    label: string;
    detail: string;
    defaultStepId: string;
    build: (stepId: string) => string;
};

type ServerValidationResult = {
    ok: boolean;
    unavailable?: boolean;
    problems: ValidationProblem[];
    blockingProblem?: ValidationProblem;
};

type RuntimeDiagnosticState = {
    status: 'ok' | 'warning' | 'error';
    message: string;
    gatewayTools: string[];
    missingTools: string[];
    gatewayError?: string;
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
    workflow: { detail: 'Child workflow', info: 'Start or call another workflow definition.' },
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
    'endpointId',
    'ruleId',
    'agentDefId',
    'wfDefId',
]);

const catalogKindOptions: Array<{ value: CatalogKind; label: string }> = [
    { value: 'tools', label: 'Tools' },
    { value: 'endpoints', label: 'Endpoints' },
    { value: 'rules', label: 'Rules' },
    { value: 'agents', label: 'Agents' },
    { value: 'workflows', label: 'Workflows' },
];

const emptyCatalog: CatalogState = {
    tools: [],
    endpoints: [],
    rules: [],
    agents: [],
    workflows: [],
};

const stepTemplates: StepTemplate[] = [
    {
        id: 'ask',
        label: 'Ask',
        detail: taskTypeHelp.ask.detail,
        defaultStepId: 'ask-input',
        build: stepId => `  - ${stepId}:\n      ask:\n        prompt: Provide workflow input.\n        mode: text\n`,
    },
    {
        id: 'assert',
        label: 'Assert',
        detail: taskTypeHelp.assert.detail,
        defaultStepId: 'assert-output',
        build: stepId => `  - ${stepId}:\n      assert:\n        path: $.status\n        equals: ok\n`,
    },
    {
        id: 'mcp',
        label: 'MCP Tool',
        detail: taskTypeHelp.mcp.detail,
        defaultStepId: 'call-tool',
        build: stepId => `  - ${stepId}:\n      mcp:\n        tool: tool_name\n        arguments: {}\n`,
    },
    {
        id: 'openapi',
        label: 'Endpoint',
        detail: taskTypeHelp.openapi.detail,
        defaultStepId: 'call-endpoint',
        build: stepId => `  - ${stepId}:\n      openapi:\n        endpointId: endpoint_id\n        arguments: {}\n`,
    },
    {
        id: 'rule',
        label: 'Rule',
        detail: taskTypeHelp.rule.detail,
        defaultStepId: 'check-rule',
        build: stepId => `  - ${stepId}:\n      rule:\n        ruleId: rule_id\n        input: {}\n`,
    },
    {
        id: 'agent',
        label: 'Agent',
        detail: taskTypeHelp.agent.detail,
        defaultStepId: 'delegate-agent',
        build: stepId => `  - ${stepId}:\n      agent:\n        agentDefId: agent_def_id\n        input: {}\n`,
    },
    {
        id: 'workflow',
        label: 'Workflow',
        detail: taskTypeHelp.workflow.detail,
        defaultStepId: 'call-workflow',
        build: stepId => `  - ${stepId}:\n      workflow:\n        wfDefId: workflow_definition_id\n        input: {}\n`,
    },
    {
        id: 'switch',
        label: 'Switch',
        detail: taskTypeHelp.switch.detail,
        defaultStepId: 'branch',
        build: stepId => `  - ${stepId}:\n      switch:\n        - when: \${ .status == "ok" }\n          then: next-step\n        - else: fallback-step\n`,
    },
    {
        id: 'wait',
        label: 'Wait',
        detail: taskTypeHelp.wait.detail,
        defaultStepId: 'wait-for-event',
        build: stepId => `  - ${stepId}:\n      wait:\n        duration: PT5M\n`,
    },
];

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
    return message === 'Workflow definition saved.' || message.startsWith('Workflow definition is valid') ? 'success' : 'warning';
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

function toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asRecords(value: unknown, key: string): Array<Record<string, unknown>> {
    const items = toRecord(value)[key];
    return Array.isArray(items) ? items.map(toRecord).filter(item => Object.keys(item).length > 0) : [];
}

function textValue(value: unknown) {
    return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function compactText(values: Array<unknown>) {
    return values.map(textValue).filter(Boolean).join(' · ');
}

function slug(value: string, fallback: string) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return normalized || fallback;
}

function yamlScalar(value: string) {
    return /^[A-Za-z0-9_.:/@-]+$/.test(value) ? value : JSON.stringify(value);
}

function appendStepSnippet(definition: string, snippet: string) {
    const trimmed = definition.trimEnd();
    const normalized = trimmed.replace(/^steps:\s*\[\]\s*$/m, 'steps:');
    if (!normalized) {
        return `steps:\n${snippet.trimEnd()}\n`;
    }
    if (/^steps:\s*(?:#.*)?$/m.test(normalized)) {
        return `${normalized}\n${snippet.trimEnd()}\n`;
    }
    return `${normalized}\n\nsteps:\n${snippet.trimEnd()}\n`;
}

function buildReferenceSnippet(reference: CatalogReference) {
    const stepId = slug(reference.label, reference.kind.slice(0, -1) || 'step');
    switch (reference.kind) {
        case 'tools':
            return `  - call-${stepId}:\n      mcp:\n        tool: ${yamlScalar(reference.value)}\n        arguments: {}\n`;
        case 'endpoints':
            return `  - call-${stepId}:\n      openapi:\n        endpointId: ${yamlScalar(reference.id)}\n        arguments: {}\n`;
        case 'rules':
            return `  - check-${stepId}:\n      rule:\n        ruleId: ${yamlScalar(reference.id)}\n        input: {}\n`;
        case 'agents':
            return `  - delegate-${stepId}:\n      agent:\n        agentDefId: ${yamlScalar(reference.id)}\n        input: {}\n`;
        case 'workflows':
            return `  - call-${stepId}:\n      workflow:\n        wfDefId: ${yamlScalar(reference.id)}\n        input: {}\n`;
        default:
            return '';
    }
}

function normalizeServerProblems(value: unknown): ValidationProblem[] {
    return Array.isArray(value)
        ? value.map(toRecord).map(problem => ({
            severity: problem.severity === 'error' ? 'error' : 'warning',
            message: textValue(problem.message) || 'Server validation problem.',
        }))
        : [];
}

function errorText(error: unknown) {
    const record = toRecord(error);
    return textValue(record.description || record.message || error) || 'Unexpected error.';
}

function extractRuntimeToolNames(value: unknown): string[] {
    const record = toRecord(value);
    const result = toRecord(record.result);
    const candidates = [
        record.gatewayTools,
        record.tools,
        result.gatewayTools,
        result.tools,
        toRecord(record.data).tools,
    ];
    const source = candidates.find(Array.isArray);
    if (!Array.isArray(source)) {
        return [];
    }
    return Array.from(new Set(source.map(item => {
        if (typeof item === 'string') return item;
        const tool = toRecord(item);
        return textValue(tool.name || tool.toolName || tool.tool_name);
    }).filter(Boolean))).sort();
}

async function queryPortal(service: string, action: string, hostId: string, data: Record<string, unknown> = {}) {
    const cmd = {
        host: 'lightapi.net',
        service,
        action,
        version: '0.1.0',
        data: {
            hostId,
            active: true,
            offset: 0,
            limit: 500,
            filters: JSON.stringify([]),
            sorting: JSON.stringify([]),
            globalFilter: '',
            ...data,
        },
    };
    return fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
}

function resultValue(result: PromiseSettledResult<unknown>) {
    return result.status === 'fulfilled' ? result.value : {};
}

function toolReferences(value: unknown): CatalogReference[] {
    return asRecords(value, 'tools').map(tool => {
        const name = textValue(tool.name || tool.toolName || tool.tool_name || tool.toolId);
        const id = textValue(tool.toolId || name);
        return {
            kind: 'tools' as const,
            id,
            value: name,
            label: name,
            secondary: compactText([tool.implementationType, tool.sensitivityTier, tool.sourceProtocol]),
            description: textValue(tool.description),
        };
    }).filter(ref => ref.id && ref.value);
}

function endpointReferences(value: unknown): CatalogReference[] {
    return asRecords(value, 'endpoints').map(endpoint => {
        const id = textValue(endpoint.endpointId);
        const method = textValue(endpoint.httpMethod || endpoint.apiMethod);
        const path = textValue(endpoint.endpointPath || endpoint.endpoint);
        return {
            kind: 'endpoints' as const,
            id,
            value: id,
            label: compactText([method, path]) || id,
            secondary: compactText([endpoint.routingDomain, endpoint.sensitivityTier]),
            description: textValue(endpoint.endpointDesc || endpoint.description),
        };
    }).filter(ref => ref.id);
}

function ruleReferences(value: unknown): CatalogReference[] {
    return asRecords(value, 'rules').map(rule => {
        const id = textValue(rule.ruleId);
        return {
            kind: 'rules' as const,
            id,
            value: id,
            label: textValue(rule.ruleName) || id,
            secondary: compactText([rule.ruleType, rule.version]),
            description: textValue(rule.ruleDesc),
        };
    }).filter(ref => ref.id);
}

function agentReferences(value: unknown): CatalogReference[] {
    const records = asRecords(value, 'agentDefinitions');
    const agents = records.length ? records : asRecords(value, 'agents');
    return agents.map(agent => {
        const id = textValue(agent.agentDefId);
        return {
            kind: 'agents' as const,
            id,
            value: id,
            label: textValue(agent.agentName || agent.apiName) || id,
            secondary: compactText([agent.modelProvider, agent.modelName]),
            description: compactText([agent.apiType, agent.serviceId]),
        };
    }).filter(ref => ref.id);
}

function workflowReferences(value: unknown): CatalogReference[] {
    return asRecords(value, 'workflows').map(workflow => {
        const id = textValue(workflow.wfDefId);
        return {
            kind: 'workflows' as const,
            id,
            value: id,
            label: textValue(workflow.name) || id,
            secondary: compactText([workflow.namespace, workflow.version]),
            description: textValue(workflow.definition).slice(0, 180),
        };
    }).filter(ref => ref.id);
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
    const [catalog, setCatalog] = useState<CatalogState>(emptyCatalog);
    const [isCatalogLoading, setIsCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState('');
    const [catalogLoaded, setCatalogLoaded] = useState(false);
    const [catalogKind, setCatalogKind] = useState<CatalogKind>('tools');
    const [referenceSearch, setReferenceSearch] = useState('');
    const [selectedReferenceId, setSelectedReferenceId] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState(stepTemplates[0].id);
    const [stepIdInput, setStepIdInput] = useState(stepTemplates[0].defaultStepId);
    const [serverProblems, setServerProblems] = useState<ValidationProblem[]>([]);
    const [isServerValidating, setIsServerValidating] = useState(false);
    const [runtimeDiagnosticsUrl, setRuntimeDiagnosticsUrl] = useState('/diagnostics/tools');
    const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<RuntimeDiagnosticState | null>(null);
    const [isRuntimeChecking, setIsRuntimeChecking] = useState(false);

    const analysis = useMemo(() => parseDefinition(definition), [definition]);
    const selectedTemplate = useMemo(
        () => stepTemplates.find(template => template.id === selectedTemplateId) || stepTemplates[0],
        [selectedTemplateId],
    );
    const catalogToolNames = useMemo(() => new Set(catalog.tools.flatMap(tool => [tool.value, tool.id])), [catalog.tools]);
    const catalogProblems = useMemo<ValidationProblem[]>(() => {
        if (!catalogLoaded || !catalog.tools.length) return [];
        return analysis.toolRefs
            .filter(ref => !catalogToolNames.has(ref))
            .map(ref => ({ severity: 'warning', message: `Tool reference "${ref}" is not in the active tool catalog.` }));
    }, [analysis.toolRefs, catalog.tools.length, catalogLoaded, catalogToolNames]);
    const allProblems = useMemo(
        () => [...analysis.problems, ...catalogProblems, ...serverProblems],
        [analysis.problems, catalogProblems, serverProblems],
    );
    const clientBlockingProblem = analysis.problems.find(problem => problem.severity === 'error');
    const blockingProblem = allProblems.find(problem => problem.severity === 'error');
    const warningCount = allProblems.filter(problem => problem.severity === 'warning').length;
    const selectedReferences = useMemo(() => catalog[catalogKind], [catalog, catalogKind]);
    const filteredReferences = useMemo(() => {
        const query = referenceSearch.trim().toLowerCase();
        if (!query) return selectedReferences;
        return selectedReferences.filter(reference =>
            [reference.label, reference.id, reference.secondary, reference.description]
                .some(value => textValue(value).toLowerCase().includes(query)),
        );
    }, [referenceSearch, selectedReferences]);
    const selectedReference = useMemo(
        () => selectedReferences.find(reference => reference.id === selectedReferenceId),
        [selectedReferenceId, selectedReferences],
    );
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

    useEffect(() => {
        setServerProblems([]);
        setRuntimeDiagnostics(null);
    }, [definition]);

    const loadCatalog = useCallback(async () => {
        if (!hostId) {
            setCatalog(emptyCatalog);
            setCatalogLoaded(false);
            setCatalogError('');
            return;
        }
        setIsCatalogLoading(true);
        setCatalogError('');
        const results = await Promise.allSettled([
            queryPortal('genai', 'getTool', hostId),
            queryPortal('service', 'getApiEndpoint', hostId),
            queryPortal('rule', 'getRule', hostId),
            queryPortal('genai', 'getAgentDefinition', hostId),
            queryPortal('workflow', 'getWfDefinition', hostId),
        ]);
        setCatalog({
            tools: toolReferences(resultValue(results[0])),
            endpoints: endpointReferences(resultValue(results[1])),
            rules: ruleReferences(resultValue(results[2])),
            agents: agentReferences(resultValue(results[3])),
            workflows: workflowReferences(resultValue(results[4])),
        });
        const failed = results.filter(result => result.status === 'rejected');
        setCatalogError(failed.length ? 'Some catalog references could not be loaded.' : '');
        setCatalogLoaded(true);
        setIsCatalogLoading(false);
    }, [hostId]);

    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);

    useEffect(() => {
        setSelectedReferenceId('');
    }, [catalogKind]);

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

    const runServerValidation = useCallback(async (): Promise<ServerValidationResult> => {
        if (!hostId || !definition.trim()) {
            return { ok: false, problems: [{ severity: 'error', message: 'Host and definition are required for server validation.' }] };
        }
        setIsServerValidating(true);
        const cmd = {
            host: 'lightapi.net',
            service: 'workflow',
            action: 'validateWfDefinition',
            version: '0.1.0',
            data: { hostId, definition },
        };
        try {
            const json = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
            const problems = normalizeServerProblems(toRecord(json).problems);
            setServerProblems(problems);
            const blocking = problems.find(problem => problem.severity === 'error');
            return { ok: !blocking, problems, blockingProblem: blocking };
        } catch (error) {
            const problem = { severity: 'warning' as const, message: `Server validation unavailable: ${errorText(error)}` };
            setServerProblems([problem]);
            return { ok: true, unavailable: true, problems: [problem] };
        } finally {
            setIsServerValidating(false);
        }
    }, [definition, hostId]);

    const handleValidate = useCallback(async () => {
        if (clientBlockingProblem) {
            setMessage(`Fix workflow definition: ${clientBlockingProblem.message}`);
            return;
        }
        const serverResult = await runServerValidation();
        if (!serverResult.ok) {
            setMessage(`Fix workflow definition: ${serverResult.blockingProblem?.message || 'Server validation failed.'}`);
            return;
        }
        const totalWarnings = analysis.problems.filter(problem => problem.severity === 'warning').length
            + catalogProblems.length
            + serverResult.problems.filter(problem => problem.severity === 'warning').length;
        if (totalWarnings) {
            setMessage(`Workflow definition parsed with ${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}.`);
            return;
        }
        setMessage(serverResult.unavailable ? 'Workflow definition is valid. Server validation was unavailable.' : 'Workflow definition is valid.');
    }, [analysis.problems, catalogProblems.length, clientBlockingProblem, runServerValidation]);

    const insertStep = useCallback((snippet: string) => {
        setDefinition(value => appendStepSnippet(value, snippet));
    }, []);

    const handleTemplateChange = useCallback((templateId: string) => {
        const template = stepTemplates.find(item => item.id === templateId) || stepTemplates[0];
        setSelectedTemplateId(template.id);
        setStepIdInput(template.defaultStepId);
    }, []);

    const handleInsertTemplate = useCallback(() => {
        insertStep(selectedTemplate.build(slug(stepIdInput, selectedTemplate.defaultStepId)));
    }, [insertStep, selectedTemplate, stepIdInput]);

    const handleInsertReference = useCallback(() => {
        if (!selectedReference) return;
        insertStep(buildReferenceSnippet(selectedReference));
    }, [insertStep, selectedReference]);

    const handleRuntimeDiagnostics = useCallback(async () => {
        setRuntimeDiagnostics(null);
        if (!analysis.toolRefs.length) {
            setRuntimeDiagnostics({ status: 'ok', message: 'No MCP tool references found.', gatewayTools: [], missingTools: [] });
            return;
        }
        const url = runtimeDiagnosticsUrl.trim();
        if (!url) {
            setRuntimeDiagnostics({ status: 'error', message: 'Runtime diagnostics URL is required.', gatewayTools: [], missingTools: analysis.toolRefs });
            return;
        }
        setIsRuntimeChecking(true);
        try {
            const isMcpEndpoint = /\/mcp(?:$|[/?#])/.test(url) && !url.includes('/diagnostics/');
            const json = await fetchClient(url, isMcpEndpoint ? {
                method: 'POST',
                body: { jsonrpc: '2.0', method: 'tools/list', params: {}, id: 'workflow-editor-tools-list' },
            } : undefined);
            const gatewayTools = extractRuntimeToolNames(json);
            const gatewayToolSet = new Set(gatewayTools);
            const missingTools = analysis.toolRefs.filter(ref => !gatewayToolSet.has(ref));
            const gatewayError = textValue(toRecord(json).gatewayError);
            setRuntimeDiagnostics({
                status: gatewayError ? 'error' : missingTools.length ? 'warning' : 'ok',
                message: gatewayError || (missingTools.length
                    ? `${missingTools.length} referenced tool${missingTools.length === 1 ? '' : 's'} missing from runtime tools/list.`
                    : 'Runtime tools/list covers all referenced MCP tools.'),
                gatewayTools,
                missingTools,
                gatewayError,
            });
        } catch (error) {
            setRuntimeDiagnostics({
                status: 'error',
                message: `Runtime diagnostics failed: ${errorText(error)}`,
                gatewayTools: [],
                missingTools: analysis.toolRefs,
            });
        } finally {
            setIsRuntimeChecking(false);
        }
    }, [analysis.toolRefs, runtimeDiagnosticsUrl]);

    const handleSave = useCallback(async () => {
        setMessage('');
        if (!hostId || !namespace || !name || !version || !definition.trim()) {
            setMessage('Host, namespace, name, version, and definition are required.');
            return;
        }
        if (clientBlockingProblem) {
            setMessage(`Fix workflow definition before saving: ${clientBlockingProblem.message}`);
            return;
        }
        const serverResult = await runServerValidation();
        if (!serverResult.ok) {
            setMessage(`Fix workflow definition before saving: ${serverResult.blockingProblem?.message || 'Server validation failed.'}`);
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
    }, [active, aggregateVersion, clientBlockingProblem, definition, hostId, isUpdate, name, namespace, ownerPositionId, runServerValidation, version, wfDefId]);

    const handleStart = useCallback(async () => {
        if (!wfDefId) {
            setMessage('Save the workflow definition before starting it.');
            return;
        }
        if (clientBlockingProblem) {
            setMessage(`Fix workflow definition before testing: ${clientBlockingProblem.message}`);
            return;
        }
        const serverResult = await runServerValidation();
        if (!serverResult.ok) {
            setMessage(`Fix workflow definition before testing: ${serverResult.blockingProblem?.message || 'Server validation failed.'}`);
            return;
        }
        navigate('/app/form/startWorkflow', {
            state: {
                data: { hostId, wfDefId, input: "{}" },
                source: location.pathname,
            }
        });
    }, [clientBlockingProblem, hostId, location.pathname, navigate, runServerValidation, wfDefId]);

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
                <Button startIcon={isServerValidating ? <CircularProgress size={18} color="inherit" /> : <VerifiedIcon />} onClick={handleValidate} disabled={isServerValidating}>
                    Validate
                </Button>
                <Button startIcon={<PlayArrowIcon />} onClick={handleStart} disabled={!wfDefId || isServerValidating}>
                    Test
                </Button>
                <Button variant="contained" startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} onClick={handleSave} disabled={isSubmitting || isLoading || isServerValidating}>
                    Save
                </Button>
            </Stack>

            {message && <Alert severity={messageSeverity(message)} sx={{ mb: 2 }}>{message}</Alert>}
            {allProblems.length ? (
                <Alert severity={blockingProblem ? 'error' : 'warning'} sx={{ mb: 2 }}>
                    {blockingProblem ? blockingProblem.message : `${warningCount} validation warning${warningCount === 1 ? '' : 's'} found.`}
                </Alert>
            ) : (
                <Alert icon={<VerifiedIcon />} severity="success" sx={{ mb: 2 }}>YAML parsed successfully.</Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr) 380px' }, gap: 2 }}>
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, minHeight: 420 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Problems</Typography>
                    <List dense>
                        {allProblems.length ? allProblems.map((problem, index) => (
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
                        {analysis.toolRefs.length ? analysis.toolRefs.map(ref => (
                            <Chip
                                key={ref}
                                size="small"
                                label={ref}
                                color={catalogLoaded && catalog.tools.length && !catalogToolNames.has(ref) ? 'warning' : 'default'}
                            />
                        )) : <Typography variant="body2">None</Typography>}
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
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Step Palette</Typography>
                    <Stack spacing={1}>
                        <TextField
                            select
                            label="Step Type"
                            value={selectedTemplateId}
                            onChange={event => handleTemplateChange(event.target.value)}
                            size="small"
                        >
                            {stepTemplates.map(template => (
                                <MenuItem key={template.id} value={template.id}>{template.label}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Step Id"
                            value={stepIdInput}
                            onChange={event => setStepIdInput(event.target.value)}
                            size="small"
                        />
                        <Typography variant="body2">{selectedTemplate.detail}</Typography>
                        <Button size="small" variant="outlined" startIcon={<PlaylistAddIcon />} onClick={handleInsertTemplate}>
                            Insert Step
                        </Button>
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ flex: 1 }}>References</Typography>
                        <Button size="small" startIcon={isCatalogLoading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />} onClick={loadCatalog} disabled={isCatalogLoading || !hostId}>
                            Refresh
                        </Button>
                    </Stack>
                    {isCatalogLoading && <LinearProgress sx={{ mb: 1 }} />}
                    {catalogError && <Alert severity="warning" sx={{ mb: 1 }}>{catalogError}</Alert>}
                    <Stack spacing={1}>
                        <TextField
                            select
                            label="Reference Type"
                            value={catalogKind}
                            onChange={event => setCatalogKind(event.target.value as CatalogKind)}
                            size="small"
                        >
                            {catalogKindOptions.map(option => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Search"
                            value={referenceSearch}
                            onChange={event => setReferenceSearch(event.target.value)}
                            size="small"
                        />
                        <TextField
                            select
                            label="Reference"
                            value={selectedReferenceId}
                            onChange={event => setSelectedReferenceId(event.target.value)}
                            size="small"
                            disabled={!filteredReferences.length && !selectedReference}
                        >
                            <MenuItem value="">None</MenuItem>
                            {selectedReference && !filteredReferences.some(reference => reference.id === selectedReference.id) && (
                                <MenuItem value={selectedReference.id}>{selectedReference.label}</MenuItem>
                            )}
                            {filteredReferences.slice(0, 100).map(reference => (
                                <MenuItem key={reference.id} value={reference.id}>{reference.label}</MenuItem>
                            ))}
                        </TextField>
                        {selectedReference && (
                            <Box>
                                <Typography variant="body2">{selectedReference.secondary || selectedReference.id}</Typography>
                                {selectedReference.description && <Typography variant="caption" color="text.secondary">{selectedReference.description}</Typography>}
                            </Box>
                        )}
                        <Button size="small" variant="outlined" startIcon={<PlaylistAddIcon />} onClick={handleInsertReference} disabled={!selectedReference}>
                            Insert Reference
                        </Button>
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Runtime Diagnostics</Typography>
                    <Stack spacing={1}>
                        <TextField
                            label="Diagnostics URL"
                            value={runtimeDiagnosticsUrl}
                            onChange={event => setRuntimeDiagnosticsUrl(event.target.value)}
                            size="small"
                        />
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={isRuntimeChecking ? <CircularProgress size={16} color="inherit" /> : <TravelExploreIcon />}
                            onClick={handleRuntimeDiagnostics}
                            disabled={isRuntimeChecking}
                        >
                            Check Tools
                        </Button>
                        {runtimeDiagnostics && (
                            <Alert severity={runtimeDiagnostics.status === 'ok' ? 'success' : runtimeDiagnostics.status}>{runtimeDiagnostics.message}</Alert>
                        )}
                        {runtimeDiagnostics?.missingTools.length ? (
                            <Stack direction="row" flexWrap="wrap" gap={1}>
                                {runtimeDiagnostics.missingTools.map(tool => <Chip key={tool} size="small" color="warning" label={tool} />)}
                            </Stack>
                        ) : null}
                        {runtimeDiagnostics?.gatewayTools.length ? (
                            <Typography variant="caption" color="text.secondary">{runtimeDiagnostics.gatewayTools.length} runtime tools visible.</Typography>
                        ) : null}
                    </Stack>
                </Box>
            </Box>
        </Box>
    );
}
