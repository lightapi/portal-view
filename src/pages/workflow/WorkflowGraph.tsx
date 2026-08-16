import { memo, useCallback, useEffect, useMemo } from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import {
    Background,
    ConnectionLineType,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Panel,
    Position,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type Node,
    type NodeMouseHandler,
    type NodeProps,
    type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    WORKFLOW_CONTAINER_KEYS,
    WORKFLOW_TASK_TYPE_KEYS,
    workflowArrayStepId,
} from './workflowEditorModel';

type WorkflowGraphStep = {
    id: string;
    taskType: string;
    title: string;
    detail: string;
    references: string[];
    raw: Record<string, unknown>;
    selectionId?: string;
    role?: 'step' | 'forkBranch' | 'forkJoin';
};

type WorkflowGraphNodeData = Record<string, unknown> & {
    step: WorkflowGraphStep;
    status?: string;
    selected?: boolean;
};

type WorkflowGraphEdgeData = Record<string, unknown> & {
    explicit: boolean;
    label: string;
    kind: 'explicit' | 'order' | 'fork' | 'join';
    semanticSourceId?: string;
};

type WorkflowGraphNode = Node<WorkflowGraphNodeData, 'workflowStep'>;
type WorkflowGraphEdge = Edge<WorkflowGraphEdgeData>;

type WorkflowGraphModel = {
    nodes: WorkflowGraphNode[];
    edges: WorkflowGraphEdge[];
    warnings: string[];
};

type WorkflowGraphProps = {
    parsedDefinition: unknown;
    statusByStep: Record<string, string>;
    selectedStepId?: string;
    onSelectStep?: (stepId: string) => void;
    onConnectSteps?: (sourceStepId: string, targetStepId: string) => void;
    onDisconnectSteps?: (sourceStepId: string, targetStepId: string) => void;
};

const taskTypeKeys = WORKFLOW_TASK_TYPE_KEYS;

const transitionKeys = new Set(['next', 'then', 'to', 'transition']);
const referenceKeys = new Set([
    'tool', 'toolName', 'tool_name', 'endpointId', 'capabilityRef', 'ruleId', 'agentDefId', 'wfDefId',
]);

const typeColors: Record<string, string> = {
    ask: '#0f766e',
    assert: '#b45309',
    mcp: '#4338ca',
    openapi: '#0369a1',
    rule: '#be123c',
    agent: '#7c3aed',
    workflow: '#047857',
    fork: '#0e7490',
    join: '#64748b',
    switch: '#a16207',
    wait: '#475569',
};

function toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown) {
    return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function isObjectLike(value: unknown) {
    return value && typeof value === 'object';
}

function compactText(values: unknown[]) {
    return values.map(textValue).filter(Boolean).join(' · ');
}

function detectTaskType(value: unknown): string {
    const record = toRecord(value);
    if (typeof record.type === 'string') return record.type;
    if (typeof record.call === 'string') return record.call;
    for (const key of Object.keys(record)) {
        if (taskTypeKeys.has(key)) return key;
    }
    for (const child of Object.values(record)) {
        if (isObjectLike(child)) {
            const nested = detectTaskType(child);
            if (nested !== 'task') return nested;
        }
    }
    return 'task';
}

function collectReferences(value: unknown): string[] {
    const refs = new Set<string>();
    const visit = (node: unknown) => {
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        const record = toRecord(node);
        Object.entries(record).forEach(([key, child]) => {
            if (referenceKeys.has(key) && textValue(child)) {
                refs.add(`${key}: ${textValue(child)}`);
            }
            if (isObjectLike(child)) visit(child);
        });
    };
    visit(value);
    return Array.from(refs).slice(0, 4);
}

function normalizeStep(id: string, body: unknown, fallbackType = 'task'): WorkflowGraphStep {
    const raw = toRecord(body);
    const taskType = detectTaskType(raw) || fallbackType;
    return {
        id,
        taskType,
        title: id,
        detail: compactText([taskType, raw.description, raw.label]),
        references: collectReferences(raw),
        raw,
    };
}

function collectArraySteps(items: unknown[], containerKey: string): WorkflowGraphStep[] {
    return items.map((item, index) => {
        const record = toRecord(item);
        const id = workflowArrayStepId(item, index, containerKey);
        const body = Object.prototype.hasOwnProperty.call(record, id) ? record[id] : record;
        return normalizeStep(id, body, textValue(record.type || containerKey));
    });
}

function collectRecordSteps(record: Record<string, unknown>, containerKey: string): WorkflowGraphStep[] {
    return Object.entries(record)
        .filter(([, value]) => isObjectLike(value))
        .map(([key, value]) => normalizeStep(key, value, containerKey));
}

function collectSteps(parsedDefinition: unknown): WorkflowGraphStep[] {
    const root = toRecord(parsedDefinition);
    for (const key of WORKFLOW_CONTAINER_KEYS) {
        const value = root[key];
        if (value === undefined) continue;
        if (Array.isArray(value)) return collectArraySteps(value, key);
        if (isObjectLike(value)) return collectRecordSteps(toRecord(value), key);
    }
    return [];
}

function isPotentialTarget(value: string) {
    return value.length > 0 && !value.includes('${') && /^[A-Za-z0-9_.:/@-]+$/.test(value);
}

function collectTransitions(value: unknown): Array<{ key: string; target: string }> {
    const transitions: Array<{ key: string; target: string }> = [];
    const visit = (node: unknown, activeKey = '') => {
        if (Array.isArray(node)) {
            node.forEach(item => visit(item, activeKey));
            return;
        }
        const record = toRecord(node);
        Object.entries(record).forEach(([key, child]) => {
            const label = transitionKeys.has(key) || key === 'else' ? key : activeKey;
            if ((transitionKeys.has(key) || key === 'else') && typeof child === 'string' && isPotentialTarget(child)) {
                transitions.push({ key, target: child });
                return;
            }
            if (key === 'transition' && isObjectLike(child)) {
                const target = textValue(toRecord(child).next || toRecord(child).nextState || toRecord(child).to);
                if (isPotentialTarget(target)) transitions.push({ key, target });
            }
            if (isObjectLike(child)) visit(child, label);
        });
    };
    visit(value);
    return transitions;
}

function edgeColor(explicit: boolean) {
    return explicit ? '#2563eb' : '#94a3b8';
}

function forkBranches(step: WorkflowGraphStep) {
    const fork = toRecord(step.raw.fork);
    if (!Array.isArray(fork.branches)) return [];
    return fork.branches.flatMap(entry => {
        const branch = toRecord(entry);
        const name = Object.keys(branch)[0];
        if (!name) return [];
        const id = `${step.id}::${name}`;
        return [{
            ...normalizeStep(id, branch[name]),
            title: name,
            selectionId: step.id,
            role: 'forkBranch' as const,
        }];
    });
}

function forkCompetes(step: WorkflowGraphStep) {
    return toRecord(step.raw.fork).compete === true;
}

function normalizedStatus(status = '') {
    return status.trim().toUpperCase();
}

function forkJoinStatus(branches: WorkflowGraphStep[], statusByStep: Record<string, string>, compete: boolean) {
    const statuses = branches.map(branch => normalizedStatus(statusByStep[branch.id])).filter(Boolean);
    if (!statuses.length) return undefined;
    const completed = (status: string) => ['C', 'COMPLETED', 'DONE', 'SUCCESS', 'SUCCEEDED'].includes(status);
    const failed = (status: string) => ['F', 'FAILED', 'ERROR', 'ERR', 'REJECTED'].includes(status);
    if (compete && statuses.some(completed)) return 'C';
    if (!compete && statuses.length === branches.length && statuses.every(completed)) return 'C';
    if (statuses.length === branches.length && statuses.every(status => completed(status) || failed(status))) return 'F';
    return 'A';
}

// Exported for focused graph-model regression tests; this is not a React component.
// eslint-disable-next-line react-refresh/only-export-components
export function workflowForkJoinNodeId(forkStepId: string) {
    return `__workflow_graph_join__:${forkStepId}`;
}

function parentTransitions(step: WorkflowGraphStep) {
    if (step.taskType !== 'fork') return collectTransitions(step.raw);
    const fork = { ...toRecord(step.raw.fork), branches: [] };
    return collectTransitions({ ...step.raw, fork });
}

// Exported for focused graph-model regression tests; this is not a React component.
// eslint-disable-next-line react-refresh/only-export-components
export function buildGraphModel(parsedDefinition: unknown, statusByStep: Record<string, string>, selectedStepId?: string): WorkflowGraphModel {
    const steps = collectSteps(parsedDefinition);
    const stepIds = new Set(steps.map(step => step.id));
    const warnings: string[] = [];
    const edges: WorkflowGraphEdge[] = [];
    const expandedForks = new Map(steps
        .filter(step => step.taskType === 'fork')
        .map(step => [step.id, forkBranches(step)]));
    const maxBranchCount = Math.max(1, ...Array.from(expandedForks.values()).map(branches => branches.length));
    const centerY = (maxBranchCount - 1) * 85;
    const expanded = Array.from(expandedForks.values()).some(branches => branches.length > 0);
    const nodes: WorkflowGraphNode[] = [];
    const visualExitByStep = new Map<string, string>();
    let stage = 0;

    steps.forEach((step, index) => {
        const branches = expandedForks.get(step.id) || [];
        const x = expanded ? stage * 340 : (index % 2) * 360;
        const y = expanded ? centerY : Math.floor(index / 2) * 170;
        nodes.push({
            id: step.id,
            type: 'workflowStep',
            position: { x, y },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            data: {
                step: { ...step, role: 'step' },
                status: statusByStep[step.id],
                selected: selectedStepId === step.id,
            },
        });

        if (!branches.length) {
            visualExitByStep.set(step.id, step.id);
            stage += 1;
            return;
        }

        const branchX = (stage + 1) * 340;
        branches.forEach((branch, branchIndex) => {
            nodes.push({
                id: branch.id,
                type: 'workflowStep',
                position: { x: branchX, y: centerY + (branchIndex - (branches.length - 1) / 2) * 170 },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
                connectable: false,
                deletable: false,
                data: { step: branch, status: statusByStep[branch.id] },
            });
            edges.push({
                id: `${step.id}-fork-${branch.id}`,
                source: step.id,
                target: branch.id,
                label: 'branch',
                type: 'smoothstep',
                deletable: false,
                markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(false) },
                style: { stroke: edgeColor(false), strokeWidth: 2 },
                data: { explicit: false, label: 'branch', kind: 'fork' },
            });
        });

        const compete = forkCompetes(step);
        const joinId = workflowForkJoinNodeId(step.id);
        const joinStep: WorkflowGraphStep = {
            id: joinId,
            taskType: 'join',
            title: compete ? 'Join first' : 'Join all',
            detail: compete ? 'Continue after the competing branch completes' : 'Continue after every branch completes',
            references: [],
            raw: {},
            selectionId: step.id,
            role: 'forkJoin',
        };
        nodes.push({
            id: joinId,
            type: 'workflowStep',
            position: { x: (stage + 2) * 340, y: centerY },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            connectable: false,
            deletable: false,
            data: { step: joinStep, status: forkJoinStatus(branches, statusByStep, compete) },
        });
        branches.forEach(branch => {
            edges.push({
                id: `${branch.id}-join-${joinId}`,
                source: branch.id,
                target: joinId,
                label: compete ? 'compete' : 'join',
                type: 'smoothstep',
                deletable: false,
                markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(false) },
                style: { stroke: edgeColor(false), strokeWidth: 2 },
                data: { explicit: false, label: compete ? 'compete' : 'join', kind: 'join' },
            });
        });
        visualExitByStep.set(step.id, joinId);
        stage += 3;
    });

    steps.forEach((step, index) => {
        const transitions = parentTransitions(step);
        const explicitTargets = new Set<string>();
        const visualSource = visualExitByStep.get(step.id) || step.id;
        transitions.forEach(transition => {
            if (!stepIds.has(transition.target)) {
                warnings.push(`Transition from ${step.id} references missing step ${transition.target}.`);
                return;
            }
            const edgeId = `${visualSource}-${transition.key}-${transition.target}`;
            if (edges.some(edge => edge.id === edgeId)) return;
            explicitTargets.add(transition.target);
            edges.push({
                id: edgeId,
                source: visualSource,
                target: transition.target,
                label: transition.key,
                type: 'smoothstep',
                animated: Boolean(statusByStep[step.id] && !['C', 'COMPLETED', 'DONE'].includes(statusByStep[step.id].toUpperCase())),
                deletable: true,
                markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(true) },
                style: { stroke: edgeColor(true), strokeWidth: 2 },
                data: { explicit: true, label: transition.key, kind: 'explicit', semanticSourceId: step.id },
            });
        });

        const nextStep = steps[index + 1];
        if (!transitions.length && nextStep && !explicitTargets.has(nextStep.id)) {
            edges.push({
                id: `${visualSource}-implicit-${nextStep.id}`,
                source: visualSource,
                target: nextStep.id,
                label: 'order',
                type: 'smoothstep',
                deletable: false,
                markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(false) },
                style: { stroke: edgeColor(false), strokeDasharray: '6 4' },
                data: { explicit: false, label: 'order', kind: 'order' },
            });
        }
    });

    return { nodes, edges, warnings };
}

function statusColor(status = '') {
    const normalized = status.toUpperCase();
    if (['C', 'COMPLETED', 'DONE', 'SUCCESS', 'SUCCEEDED'].includes(normalized)) return 'success';
    if (['F', 'FAILED', 'ERROR', 'ERR', 'REJECTED'].includes(normalized)) return 'error';
    if (normalized) return 'warning';
    return 'default';
}

const WorkflowStepNode = memo(function WorkflowStepNode({ data, selected }: NodeProps<WorkflowGraphNode>) {
    const step = data.step;
    const color = typeColors[step.taskType] || '#334155';
    const isSelected = selected || Boolean(data.selected);

    return (
        <Box
            sx={{
                minWidth: 240,
                maxWidth: 280,
                border: 2,
                borderColor: isSelected ? 'primary.main' : 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                boxShadow: isSelected ? 4 : 1,
                overflow: 'hidden',
            }}
        >
            <Handle type="target" position={Position.Left} />
            <Box sx={{ height: 6, bgcolor: color }} />
            <Stack spacing={0.75} sx={{ p: 1.25 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                    <Chip size="small" label={step.taskType} sx={{ bgcolor: color, color: 'white' }} />
                    {data.status ? <Chip size="small" label={data.status} color={statusColor(data.status)} /> : null}
                </Stack>
                <Typography variant="subtitle2" noWrap title={step.title}>{step.title}</Typography>
                {step.detail && <Typography variant="caption" color="text.secondary" noWrap title={step.detail}>{step.detail}</Typography>}
                {step.references.length ? (
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {step.references.map(reference => <Chip key={reference} size="small" variant="outlined" label={reference} />)}
                    </Stack>
                ) : null}
            </Stack>
            <Handle type="source" position={Position.Right} />
        </Box>
    );
});

const nodeTypes: NodeTypes = { workflowStep: WorkflowStepNode };

function WorkflowGraphCanvas({
    parsedDefinition,
    statusByStep,
    selectedStepId,
    onSelectStep,
    onConnectSteps,
    onDisconnectSteps,
}: WorkflowGraphProps) {
    const model = useMemo(
        () => buildGraphModel(parsedDefinition, statusByStep, selectedStepId),
        [parsedDefinition, selectedStepId, statusByStep],
    );
    const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowGraphNode>(model.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowGraphEdge>(model.edges);

    useEffect(() => {
        setNodes(model.nodes);
        setEdges(model.edges);
    }, [model.edges, model.nodes, setEdges, setNodes]);

    const handleConnect = useCallback((connection: Connection) => {
        if (connection.source && connection.target && connection.source !== connection.target) {
            onConnectSteps?.(connection.source, connection.target);
        }
    }, [onConnectSteps]);

    const handleEdgesDelete = useCallback((deletedEdges: WorkflowGraphEdge[]) => {
        deletedEdges
            .filter(edge => edge.data?.explicit)
            .forEach(edge => onDisconnectSteps?.(edge.data?.semanticSourceId || edge.source, edge.target));
    }, [onDisconnectSteps]);

    const handleNodeClick = useCallback<NodeMouseHandler<WorkflowGraphNode>>((_, node) => {
        onSelectStep?.(node.data.step.selectionId || node.id);
    }, [onSelectStep]);

    if (!model.nodes.length) {
        return <Alert severity="info">No workflow graph nodes detected.</Alert>;
    }

    return (
        <Box sx={{ height: 520, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                onEdgesDelete={handleEdgesDelete}
                onNodeClick={handleNodeClick}
                connectionLineType={ConnectionLineType.SmoothStep}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                deleteKeyCode={['Backspace', 'Delete']}
                nodesDraggable
                nodesConnectable
                elementsSelectable
            >
                <Background />
                <Controls />
                <MiniMap pannable zoomable />
                <Panel position="top-left">
                    <Stack direction="row" spacing={1}>
                        <Chip size="small" label={`${model.nodes.length} graph nodes`} />
                        <Chip size="small" label={`${model.edges.filter(edge => edge.data?.explicit).length} explicit edges`} />
                        <Chip size="small" label={`${model.nodes.filter(node => node.data.step.role === 'forkBranch').length} fork branches`} />
                        <Chip size="small" label={`${model.edges.filter(edge => edge.data?.kind === 'order').length} order edges`} />
                    </Stack>
                </Panel>
                {model.warnings.length ? (
                    <Panel position="bottom-left">
                        <Alert severity="warning" sx={{ maxWidth: 420 }}>{model.warnings.slice(0, 2).join(' ')}</Alert>
                    </Panel>
                ) : null}
            </ReactFlow>
        </Box>
    );
}

export default function WorkflowGraph(props: WorkflowGraphProps) {
    return (
        <ReactFlowProvider>
            <WorkflowGraphCanvas {...props} />
        </ReactFlowProvider>
    );
}
