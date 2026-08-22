import fetchClient from '../../utils/fetchClient';

const API = { host: 'lightapi.net', service: 'genai', version: '0.1.0' } as const;

const IDEMPOTENT_KNOWLEDGE_COMMANDS = new Set([
    'createKnowledgeBase',
    'createKnowledgeIngestionPolicy',
    'createKnowledgeRetrievalProfile',
    'createKnowledgeEmbeddingProfile',
    'createKnowledgeSource',
    'testKnowledgeSource',
    'requestKnowledgeSourceSync',
    'requestKnowledgeSourceAclReconciliation',
    'receiveKnowledgeSourceProviderNotification',
    'requestKnowledgeBaseReindex',
    'requestKnowledgeBaseCompaction',
    'promoteKnowledgeBaseIndexGeneration',
    'requestKnowledgeBasePurge',
    'testKnowledgeRetrieval',
    'requestKnowledgeBaseEmbeddingMigration',
    'pauseKnowledgeBaseEmbeddingMigration',
    'resumeKnowledgeBaseEmbeddingMigration',
    'cancelKnowledgeBaseEmbeddingMigration',
    'rollbackKnowledgeBaseIndexGeneration',
    'retireKnowledgeBaseIndexGeneration',
    'requestKnowledgeBaseBackupCheckpoint',
    'verifyKnowledgeBasePhysicalRestore',
]);

function request(action: string, data: Record<string, unknown>) {
    return { ...API, action, data };
}

export async function knowledgeQuery<T>(action: string, data: Record<string, unknown>,
    options: { signal?: AbortSignal } = {}): Promise<T> {
    const cmd = encodeURIComponent(JSON.stringify(request(action, data)));
    return fetchClient(`/portal/query?cmd=${cmd}`, { signal: options.signal }) as Promise<T>;
}

export async function knowledgeCommand(action: string, data: Record<string, unknown>) {
    const idempotent = IDEMPOTENT_KNOWLEDGE_COMMANDS.has(action);
    const idempotencyKey = idempotent
        ? (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
        : undefined;
    return fetchClient('/portal/command', {
        method: 'POST',
        ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
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
    desiredEmbeddingProfileId?: string;
    desiredEmbeddingProfileRevision?: number;
    retentionPolicy?: Record<string, unknown>;
    version: number;
    activeGenerationId?: string;
    pointerVersion?: number;
    projectionState?: string;
    effectiveState?: string;
    hasActiveSync?: boolean;
    activeJobCount?: number;
    latestJobState?: string;
    updateTs?: string;
};
