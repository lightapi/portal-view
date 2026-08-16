export type WorkflowEventFailure = {
    quarantineId: string;
    failureCode: string;
    failureDetail: string;
    replayState: string;
    createdTs?: string;
};

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function text(value: unknown) {
    return typeof value === 'string'
        ? value
        : value === null || value === undefined
            ? ''
            : String(value);
}

export function workflowEventFailureRows(value: unknown): WorkflowEventFailure[] {
    const rows = record(value).workflowEventFailures;
    if (!Array.isArray(rows)) return [];
    return rows.map(item => record(item)).map(row => ({
        quarantineId: text(row.quarantineId),
        failureCode: text(row.failureCode),
        failureDetail: text(row.failureDetail),
        replayState: text(row.replayState),
        createdTs: text(row.createdTs),
    })).filter(row => row.quarantineId && row.failureDetail);
}

const SETTLED_WORKFLOW_STATUSES = new Set([
    'C', 'COMPLETED', 'COMPLETE', 'DONE', 'SUCCESS', 'SUCCEEDED',
    'F', 'FAILED', 'FAILURE', 'ERROR', 'ERR', 'REJECTED',
    'W', 'WAITING',
]);

export function workflowRuntimeSettled(
    processStatuses: string[],
    eventFailures: WorkflowEventFailure[],
) {
    return eventFailures.some(failure => failure.replayState.trim().toUpperCase() === 'BLOCKED')
        || processStatuses.some(status => SETTLED_WORKFLOW_STATUSES.has(status.trim().toUpperCase()));
}

type WorkflowOutputProcess = { statusCode: string; resultCode?: string };
type WorkflowOutputTask = { statusCode: string; resultCode?: string; taskOutput?: unknown };

function completed(status: string) {
    return ['C', 'COMPLETED', 'COMPLETE', 'DONE', 'SUCCESS', 'SUCCEEDED']
        .includes(status.trim().toUpperCase());
}

function displayOutput(value: unknown) {
    if (value === null || value === undefined || value === '') return '';
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function workflowFinalOutput(
    processes: WorkflowOutputProcess[],
    tasks: WorkflowOutputTask[],
) {
    const process = [...processes].reverse()
        .find(item => completed(item.statusCode) && item.resultCode);
    if (process?.resultCode) return process.resultCode;

    const task = [...tasks].reverse().find(item => completed(item.statusCode)
        && ((item.taskOutput !== null && item.taskOutput !== undefined) || item.resultCode));
    return task ? displayOutput(task.taskOutput ?? task.resultCode) : '';
}
