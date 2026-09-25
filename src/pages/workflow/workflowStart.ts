const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = /^sha256:[0-9a-f]{64}$/i;

export type WorkflowStartReceipt = {
    accepted: true;
    workflowInstanceId: string;
    processId: string;
    workflowDefinitionId: string;
    definitionDigest: string;
    state: 'ACCEPTED' | 'RUNNING' | 'WAITING';
    invocationStateVersion: number;
    acceptedAt: string;
    replayed: boolean;
};

export function validateWorkflowStartReceipt(result: unknown, definitionId: string): WorkflowStartReceipt {
    const value = result as WorkflowStartReceipt | null;
    if (value?.accepted !== true || !uuid.test(value.workflowInstanceId) || !uuid.test(value.processId)
        || value.workflowDefinitionId !== definitionId || !digest.test(value.definitionDigest)
        || !['ACCEPTED', 'RUNNING', 'WAITING'].includes(value.state)
        || !Number.isInteger(value.invocationStateVersion) || value.invocationStateVersion < 0
        || typeof value.acceptedAt !== 'string' || !Number.isFinite(Date.parse(value.acceptedAt))
        || typeof value.replayed !== 'boolean') {
        throw new Error('Gateway returned an invalid Workflow start receipt; acceptance is unconfirmed.');
    }
    return value as WorkflowStartReceipt;
}
