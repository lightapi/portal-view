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
