import fetchClient from '../../utils/fetchClient';

const API = { host: 'lightapi.net', service: 'genai', version: '0.1.0' } as const;

function request(action: string, data: Record<string, unknown>) {
    return { ...API, action, data };
}

export async function knowledgeQuery<T>(action: string, data: Record<string, unknown>): Promise<T> {
    const cmd = encodeURIComponent(JSON.stringify(request(action, data)));
    return fetchClient(`/portal/query?cmd=${cmd}`) as Promise<T>;
}

export async function knowledgeCommand(action: string, data: Record<string, unknown>) {
    return fetchClient('/portal/command', {
        method: 'POST',
        body: request(action, data),
    });
}

export function knowledgeError(error: unknown) {
    if (error instanceof Error && error.message) return error.message;
    if (error && typeof error === 'object') {
        const value = error as Record<string, any>;
        return String(value.message ?? value.description ?? value.code ?? 'Knowledge Base operation failed');
    }
    return 'Knowledge Base operation failed';
}

export type KnowledgeBaseRow = {
    knowledgeBaseId: string;
    hostId?: string;
    name: string;
    description?: string;
    environment: string;
    status: string;
    version: number;
    activeGenerationId?: string;
    pointerVersion?: number;
    projectionState?: string;
    updateTs?: string;
};

