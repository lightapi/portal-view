import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import type { TaskResolvedContext } from '../../tasks/types';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

const genAiContextKeys = [
    'apiVersionId',
    'agentDefId',
    'skillId',
    'parentSkillId',
    'wfDefId',
    'workflowRole',
    'toolId',
    'paramId',
    'memId',
    'sessionId',
    'sessionHistoryId',
    'dependsOnSkillId',
    'domain',
    'processId',
    'userId',
] as const;

type GenAiContextSource = Partial<Record<(typeof genAiContextKeys)[number] | 'hostId', unknown>>;

function collectGenAiContext(source: GenAiContextSource = {}): TaskResolvedContext {
    const context: TaskResolvedContext = {};

    if (typeof source.hostId === 'string' && source.hostId.trim()) {
        context.hostId = source.hostId;
    }

    for (const key of genAiContextKeys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) {
            context[key] = value;
        }
    }

    return context;
}

export function buildGenAiTaskContext(
    host: string | undefined,
    searchParams: URLSearchParams,
    entity: GenAiContextSource = {},
) {
    const searchContext = contextFromSearchParams(searchParams);
    const agentApiVersionContext = !searchContext.agentDefId && searchContext.apiVersionId
        ? { agentDefId: searchContext.apiVersionId }
        : {};
    return mergeTaskContext(
        searchContext,
        agentApiVersionContext,
        host ? { hostId: host } : {},
        collectGenAiContext(entity),
    );
}

export function buildGenAiTaskRoute(
    route: string,
    searchParams: URLSearchParams,
    context: TaskResolvedContext,
) {
    return buildTaskAwareRoute(route, searchParams, context);
}

export function GenAiTaskLayout({
    context,
    children,
}: {
    context: TaskResolvedContext;
    children: ReactNode;
}) {
    return (
        <Box>
            <TaskActionPanel
                title="GenAI Tasks"
                context={context}
                taskIds={['register-ai-agent', 'manage-genai-assets']}
                maxActions={3}
            />
            <Box mt={2}>
                {children}
            </Box>
        </Box>
    );
}
