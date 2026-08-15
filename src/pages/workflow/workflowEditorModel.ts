import YAML, { isMap, isSeq, isScalar } from 'yaml';

export type WorkflowDefinitionMetadata = {
    dsl?: string;
    namespace?: string;
    name?: string;
    version?: string;
    title?: string;
    summary?: string;
};

export const DEFAULT_WORKFLOW_DEFINITION = `document:
  dsl: "1.0.3"
  namespace: default
  name: new-workflow
  version: "1.0.0"
evaluate:
  language: cel
do: []
`;

export const WORKFLOW_EXPRESSION_LANGUAGES = ['cel', 'jq', 'js'] as const;
// The workflow-MCP execution path validates inline schema documents with the
// JSON Schema validator. Do not advertise model constants that are not
// executable schema formats in this editor.
export const WORKFLOW_SCHEMA_FORMATS = ['json'] as const;
export const WORKFLOW_CONTAINER_KEYS = ['do', 'steps', 'tasks', 'states'] as const;
export const WORKFLOW_TASK_TYPE_KEYS = new Set([
    'ask', 'assert', 'http', 'openapi', 'jsonrpc', 'openrpc', 'grpc', 'mcp',
    'rule', 'agent', 'workflow', 'fork', 'switch', 'condition', 'set', 'export', 'wait',
]);
export type WorkflowSchemaSection = 'input' | 'output';

export type WorkflowInlineSchema = {
    enabled: boolean;
    format: string;
    document: unknown;
};

export type WorkflowForkBranch = {
    name: string;
};

function toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown) {
    return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function formatYaml(value: unknown) {
    return `${YAML.stringify(value).trimEnd()}\n`;
}

function workflowContainerKey(root: Record<string, unknown>): string | undefined {
    return WORKFLOW_CONTAINER_KEYS
        .find(key => Object.prototype.hasOwnProperty.call(root, key));
}

export function workflowArrayStepId(item: unknown, index: number, containerKey: string): string {
    const itemRecord = toRecord(item);
    if (typeof itemRecord.name === 'string' && itemRecord.name.trim()) return itemRecord.name;
    if (typeof itemRecord.id === 'string' && itemRecord.id.trim()) return itemRecord.id;
    const keys = Object.keys(itemRecord);
    if (keys.length === 1 && !WORKFLOW_TASK_TYPE_KEYS.has(keys[0])) return keys[0];
    return `${containerKey}-${index + 1}`;
}

function findWorkflowStep(root: Record<string, unknown>, stepId: string): Record<string, unknown> | null {
    const containerKey = workflowContainerKey(root);
    if (!containerKey) return null;
    const container = root[containerKey];

    if (Array.isArray(container)) {
        for (let index = 0; index < container.length; index += 1) {
            const item = container[index];
            const itemRecord = toRecord(item);
            const candidateId = workflowArrayStepId(item, index, containerKey);
            if (candidateId !== stepId) continue;
            if (Object.prototype.hasOwnProperty.call(itemRecord, candidateId)) {
                return toRecord(itemRecord[candidateId]);
            }
            return itemRecord;
        }
        return null;
    }

    const containerRecord = toRecord(container);
    return Object.prototype.hasOwnProperty.call(containerRecord, stepId)
        ? toRecord(containerRecord[stepId])
        : null;
}

function forkBranches(root: Record<string, unknown>, stepId: string): Array<Record<string, unknown>> | null {
    const step = findWorkflowStep(root, stepId);
    if (!step || !Object.prototype.hasOwnProperty.call(step, 'fork')) return null;
    const branches = toRecord(step.fork).branches;
    if (!Array.isArray(branches)) throw new Error(`Fork step "${stepId}" must contain a branches list.`);
    branches.forEach((branch, index) => {
        branches[index] = toRecord(branch);
    });
    return branches as Array<Record<string, unknown>>;
}

function validForkBranchName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Branch name is required.');
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
        throw new Error('Branch names may contain only letters, numbers, underscores, and hyphens.');
    }
    return trimmed;
}

function branchName(branch: Record<string, unknown>): string {
    return Object.keys(branch)[0] || '';
}

export function getWorkflowForkBranches(definition: string, stepId: string): WorkflowForkBranch[] | null {
    if (!stepId) return null;
    try {
        const branches = forkBranches(toRecord(YAML.parse(definition)), stepId);
        return branches?.map(branch => ({ name: branchName(branch) })) ?? null;
    } catch {
        return null;
    }
}

export function renameWorkflowForkBranch(
    definition: string,
    stepId: string,
    currentName: string,
    requestedName: string,
): string {
    const nextName = validForkBranchName(requestedName);
    if (nextName === currentName) return definition;
    const root = toRecord(YAML.parse(definition));
    const branches = forkBranches(root, stepId);
    if (!branches) throw new Error(`Step "${stepId}" is not a fork.`);
    if (branches.some(branch => branchName(branch) === nextName)) {
        throw new Error(`Branch "${nextName}" already exists.`);
    }
    const index = branches.findIndex(branch => branchName(branch) === currentName);
    if (index < 0) throw new Error(`Branch "${currentName}" was not found.`);
    const task = branches[index][currentName];
    branches[index] = { [nextName]: task };
    return formatYaml(root);
}

export function addWorkflowForkBranch(definition: string, stepId: string, requestedName: string): string {
    const name = validForkBranchName(requestedName);
    const root = toRecord(YAML.parse(definition));
    const branches = forkBranches(root, stepId);
    if (!branches) throw new Error(`Step "${stepId}" is not a fork.`);
    if (branches.some(branch => branchName(branch) === name)) {
        throw new Error(`Branch "${name}" already exists.`);
    }
    branches.push({
        [name]: {
            set: {
                value: '${ .value }',
            },
        },
    });
    return formatYaml(root);
}

export function removeWorkflowForkBranch(definition: string, stepId: string, name: string): string {
    const root = toRecord(YAML.parse(definition));
    const branches = forkBranches(root, stepId);
    if (!branches) throw new Error(`Step "${stepId}" is not a fork.`);
    if (branches.length <= 2) throw new Error('A fork must retain at least two branches.');
    const index = branches.findIndex(branch => branchName(branch) === name);
    if (index < 0) throw new Error(`Branch "${name}" was not found.`);
    branches.splice(index, 1);
    return formatYaml(root);
}

export function setWorkflowForkBranchTask(
    definition: string,
    stepId: string,
    name: string,
    snippet: string,
): string {
    const root = toRecord(YAML.parse(definition));
    const branches = forkBranches(root, stepId);
    if (!branches) throw new Error(`Step "${stepId}" is not a fork.`);
    const index = branches.findIndex(branch => branchName(branch) === name);
    if (index < 0) throw new Error(`Branch "${name}" was not found.`);
    const item = toRecord(parseStepSnippet(snippet));
    const insertedId = Object.keys(item)[0];
    if (!insertedId) throw new Error('The selected palette item is not a workflow task.');
    branches[index] = { [name]: item[insertedId] };
    return formatYaml(root);
}

export function extractWorkflowDefinitionMetadata(definition: string): WorkflowDefinitionMetadata {
    if (!definition.trim()) return {};
    try {
        const root = toRecord(YAML.parse(definition));
        const document = toRecord(root.document);
        return {
            dsl: textValue(document.dsl),
            namespace: textValue(document.namespace || root.namespace),
            name: textValue(document.name || root.name),
            version: textValue(document.version || root.version),
            title: textValue(document.title),
            summary: textValue(document.summary),
        };
    } catch {
        return {};
    }
}

export function extractWorkflowEvaluationLanguage(definition: string): string {
    try {
        return textValue(toRecord(toRecord(YAML.parse(definition)).evaluate).language) || 'jq';
    } catch {
        return '';
    }
}

export function updateWorkflowEvaluationLanguage(definition: string, language: string): string {
    try {
        const root = toRecord(YAML.parse(definition));
        root.evaluate = { ...toRecord(root.evaluate), language };
        return formatYaml(root);
    } catch {
        return definition;
    }
}

export function extractWorkflowInlineSchema(
    definition: string,
    section: WorkflowSchemaSection,
): WorkflowInlineSchema {
    try {
        const root = toRecord(YAML.parse(definition));
        const schema = toRecord(toRecord(root[section]).schema);
        return {
            enabled: Object.keys(schema).length > 0,
            format: textValue(schema.format) || 'json',
            document: schema.document ?? { type: 'object', additionalProperties: true },
        };
    } catch {
        return { enabled: false, format: 'json', document: { type: 'object', additionalProperties: true } };
    }
}

export function updateWorkflowInlineSchema(
    definition: string,
    section: WorkflowSchemaSection,
    schema: WorkflowInlineSchema,
): string {
    try {
        const root = toRecord(YAML.parse(definition));
        const sectionValue = toRecord(root[section]);
        if (!schema.enabled) {
            delete sectionValue.schema;
            if (Object.keys(sectionValue).length) root[section] = sectionValue;
            else delete root[section];
        } else {
            sectionValue.schema = { format: schema.format, document: schema.document };
            root[section] = sectionValue;
        }
        return formatYaml(root);
    } catch {
        return definition;
    }
}

export function collectWorkflowStepLabels(parsed: unknown): string[] {
    const root = toRecord(parsed);
    const containerKey = workflowContainerKey(root);
    if (!containerKey) return [];
    const container = root[containerKey];

    if (Array.isArray(container)) {
        return container.map((item, index) => workflowArrayStepId(item, index, containerKey));
    }
    return Object.entries(toRecord(container))
        .filter(([, value]) => value && typeof value === 'object')
        .map(([key]) => key);
}

export function updateWorkflowDocumentMetadata(
    definition: string,
    patch: WorkflowDefinitionMetadata,
): string {
    try {
        const parsed = YAML.parse(definition);
        const root = toRecord(parsed);
        const document = toRecord(root.document);
        const nextDocument: Record<string, unknown> = {
            dsl: '1.0.3',
            ...document,
            ...patch,
        };
        for (const optionalKey of ['title', 'summary']) {
            if (nextDocument[optionalKey] === '') delete nextDocument[optionalKey];
        }
        const nextRoot: Record<string, unknown> = { document: nextDocument };
        Object.entries(root).forEach(([key, value]) => {
            if (key !== 'document') nextRoot[key] = value;
        });
        return formatYaml(nextRoot);
    } catch {
        return definition;
    }
}

function parseStepSnippet(snippet: string): unknown | undefined {
    const parsed = toRecord(YAML.parse(`steps:\n${snippet.trimEnd()}\n`));
    const steps = parsed.steps;
    return Array.isArray(steps) ? steps[0] : undefined;
}

export type WorkflowStepInsertionPosition = 'before' | 'after';
export type WorkflowStepLocation = { stepId: string; from: number; to: number };

class WorkflowStepPlacementError extends Error {}

function nodeText(value: unknown): string {
    return isScalar(value) && value.value !== null && value.value !== undefined
        ? String(value.value)
        : '';
}

export function workflowStepLocations(definition: string): WorkflowStepLocation[] {
    try {
        const document = YAML.parseDocument(definition);
        if (document.errors.length || !isMap(document.contents)) return [];
        const root = document.contents;
        const containerKey = WORKFLOW_CONTAINER_KEYS.find(key => root.items.some(
            pair => nodeText(pair.key) === key,
        ));
        const containerPair = containerKey
            ? root.items.find(pair => nodeText(pair.key) === containerKey)
            : undefined;
        if (!containerKey || !containerPair) return [];

        const locations: WorkflowStepLocation[] = [];
        if (isSeq(containerPair.value)) {
            for (let index = 0; index < containerPair.value.items.length; index += 1) {
                const item = containerPair.value.items[index];
                if (!isMap(item) || !item.range || !item.items.length) continue;
                const rawItem = item.toJSON();
                const stepId = workflowArrayStepId(rawItem, index, containerKey);
                const lineStart = definition.lastIndexOf('\n', Math.max(0, item.range[0] - 1)) + 1;
                locations.push({ stepId, from: lineStart, to: item.range[2] });
            }
        } else if (isMap(containerPair.value)) {
            for (const pair of containerPair.value.items) {
                const stepId = nodeText(pair.key);
                const pairRange = pair.value?.range || pair.key?.range;
                const keyRange = pair.key?.range;
                if (!stepId || !pairRange || !keyRange) continue;
                const lineStart = definition.lastIndexOf('\n', Math.max(0, keyRange[0] - 1)) + 1;
                locations.push({ stepId, from: lineStart, to: pairRange[2] });
            }
        }
        return locations;
    } catch {
        return [];
    }
}

export function workflowStepIdAtOffset(locations: WorkflowStepLocation[], offset: number): string {
    const boundedOffset = Math.max(0, offset);
    return locations.find(location => boundedOffset >= location.from && boundedOffset < location.to)?.stepId || '';
}

export function insertWorkflowStepSnippet(
    definition: string,
    snippet: string,
    anchorStepId = '',
    position: WorkflowStepInsertionPosition = 'after',
): string {
    try {
        const parsed = YAML.parse(definition);
        const root = toRecord(parsed);
        const item = parseStepSnippet(snippet);
        if (!item) return definition;

        const containerKey = workflowContainerKey(root) || 'do';
        const container = root[containerKey];

        if (Array.isArray(container)) {
            const anchorIndex = anchorStepId
                ? container.findIndex((value, index) => workflowArrayStepId(value, index, containerKey) === anchorStepId)
                : -1;
            if (anchorStepId && anchorIndex < 0) {
                throw new WorkflowStepPlacementError(
                    `Selected step "${anchorStepId}" is no longer available. Select another step or append explicitly.`,
                );
            } else if (anchorIndex < 0) {
                container.push(item);
            } else {
                container.splice(anchorIndex + (position === 'after' ? 1 : 0), 0, item);
            }
        } else if (container && typeof container === 'object') {
            const itemRecord = toRecord(item);
            const containerRecord = toRecord(container);
            if (anchorStepId) {
                const entries = Object.entries(containerRecord);
                const anchorIndex = entries.findIndex(([key]) => key === anchorStepId);
                if (anchorIndex < 0) {
                    throw new WorkflowStepPlacementError(
                        `Selected step "${anchorStepId}" is no longer available. Select another step or append explicitly.`,
                    );
                }
                const insertionIndex = anchorIndex + (position === 'after' ? 1 : 0);
                root[containerKey] = Object.fromEntries([
                    ...entries.slice(0, insertionIndex),
                    ...Object.entries(itemRecord),
                    ...entries.slice(insertionIndex),
                ]);
            } else {
                Object.assign(containerRecord, itemRecord);
            }
        } else {
            if (anchorStepId) {
                throw new WorkflowStepPlacementError(
                    `Selected step "${anchorStepId}" is no longer available. Select another step or append explicitly.`,
                );
            }
            root[containerKey] = [item];
        }
        return formatYaml(root);
    } catch (error) {
        if (error instanceof WorkflowStepPlacementError) throw error;
        return definition;
    }
}

export function appendWorkflowStepSnippet(definition: string, snippet: string): string {
    return insertWorkflowStepSnippet(definition, snippet);
}
