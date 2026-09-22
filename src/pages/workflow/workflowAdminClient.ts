import { createWorkflowToolClient } from '../genai/workflowToolClient';

const client = createWorkflowToolClient();

export function parseWorkflowToolResult(result: any) {
    if (result?.isError) {
        const message = result?.content?.find?.((item: any) => item?.type === 'text')?.text;
        throw new Error(typeof message === 'string' ? message : 'Workflow operation failed.');
    }
    if (result?.structuredContent && typeof result.structuredContent === 'object') {
        return result.structuredContent;
    }
    const text = result?.content?.find?.((item: any) => item?.type === 'text')?.text;
    if (typeof text === 'string') return JSON.parse(text);
    throw new Error('Gateway returned no structured Workflow result.');
}

async function call(name: string, args: Record<string, unknown>) {
    await client.findTool(name);
    return parseWorkflowToolResult(await client.invoke(name, args, ''));
}

export const workflowAdminClient = {
    listProcesses: (args: Record<string, unknown>) => call('workflow_list_processes', args),
    getProcess: (processId: string) => call('workflow_get_process', { processId }),
    listFeatures: (args: Record<string, unknown>) => call('workflow_list_features', args),
    inboxSummary: () => call('workflow_get_human_task_inbox_summary', {}),
    listHumanTasks: (args: Record<string, unknown>) => call('workflow_list_human_tasks', args),
    getHumanTask: (taskAsstId: string) => call('workflow_get_human_task', { taskAsstId }),
    claimHumanTask: (taskAsstId: string, assignmentVersion: number, claimMinutes = 30) =>
        call('workflow_claim_human_task', { taskAsstId, assignmentVersion, claimMinutes }),
    releaseHumanTask: (taskAsstId: string, assignmentVersion: number) =>
        call('workflow_release_human_task', { taskAsstId, assignmentVersion }),
    completeHumanTask: (taskAsstId: string, assignmentVersion: number, decision: unknown, comment?: string) =>
        call('workflow_complete_human_task', {
            taskAsstId,
            assignmentVersion,
            decision,
            ...(comment ? { comment } : {}),
            idempotencyKey: crypto.randomUUID(),
        }),
    cancelInvocation: (workflowInstanceId: string) => call('workflow_cancel', { workflowInstanceId }),
    cancelFeature: (featureRunId: string, expectedVersion: number) =>
        call('workflow_cancel_feature', { featureRunId, expectedVersion }),
};
