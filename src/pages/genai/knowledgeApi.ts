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

const KNOWLEDGE_ERROR_FALLBACK = 'Knowledge Base operation failed without an error message.';
const MAXIMUM_ERROR_MESSAGE_LENGTH = 1000;

function errorText(value: unknown, depth = 0): string | undefined {
    if (depth > 3 || value == null) return undefined;
    if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim();
        return text || undefined;
    }
    if (value instanceof Error) return errorText(value.message, depth + 1);
    if (typeof value !== 'object') return undefined;

    const record = value as Record<string, unknown>;
    const nestedError = errorText(record.error, depth + 1);
    if (nestedError) return nestedError;

    const code = errorText(record.code, depth + 1);
    const detail = errorText(record.description, depth + 1)
        ?? errorText(record.message, depth + 1)
        ?? errorText(record.detail, depth + 1)
        ?? errorText(record.data, depth + 1);
    if (code && detail && detail !== code && !detail.includes(code)) return `${code}: ${detail}`;
    return detail ?? code;
}

export function knowledgeError(error: unknown) {
    const detail = errorText(error);
    if (!detail) return KNOWLEDGE_ERROR_FALLBACK;
    return detail.length <= MAXIMUM_ERROR_MESSAGE_LENGTH
        ? detail
        : `${detail.slice(0, MAXIMUM_ERROR_MESSAGE_LENGTH - 1)}…`;
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
