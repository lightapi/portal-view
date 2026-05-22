import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import type { TaskResolvedContext } from '../../tasks/types';
import { buildContextRoute, buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

const workflowContextKeys = [
    'wfDefId',
    'wfInstanceId',
    'wfTaskId',
    'taskId',
    'taskAsstId',
    'processId',
    'auditLogId',
    'assigneeId',
    'categoryId',
    'categoryCode',
    'correlationId',
    'sourceTypeId',
    'appId',
    'agentDefId',
] as const;

type WorkflowContextSource = Partial<Record<(typeof workflowContextKeys)[number] | 'hostId', unknown>>;

function collectWorkflowContext(source: WorkflowContextSource = {}): TaskResolvedContext {
    const context: TaskResolvedContext = {};

    if (typeof source.hostId === 'string' && source.hostId.trim()) {
        context.hostId = source.hostId;
    }

    for (const key of workflowContextKeys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) {
            context[key] = value;
        }
    }

    return context;
}

export function buildWorkflowTaskContext(
    host: string | undefined,
    searchParams: URLSearchParams,
    entity: WorkflowContextSource = {},
) {
    const searchContext = contextFromSearchParams(searchParams);
    return mergeTaskContext(
        searchContext,
        host ? { hostId: host } : {},
        collectWorkflowContext(entity),
    );
}

export function buildWorkflowTaskRoute(
    route: string,
    searchParams: URLSearchParams,
    context: TaskResolvedContext,
) {
    return searchParams.get('task')
        ? buildTaskAwareRoute(route, searchParams, context)
        : buildContextRoute(route, context);
}

export function WorkflowTaskLayout({
    context,
    children,
}: {
    context: TaskResolvedContext;
    children: ReactNode;
}) {
    return (
        <Box>
            <TaskActionPanel
                title="Workflow Tasks"
                context={context}
                taskIds={['manage-workflow']}
                maxActions={3}
            />
            <Box mt={2}>
                {children}
            </Box>
        </Box>
    );
}
