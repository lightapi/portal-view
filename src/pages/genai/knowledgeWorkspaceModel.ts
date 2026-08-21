export const KNOWLEDGE_TAB_KEYS = [
    'overview', 'sources', 'documents', 'syncRuns', 'indexGenerations',
    'incremental', 'agentBindings', 'accessPolicy', 'playground', 'quality',
    'settings',
] as const;

export type KnowledgeTabKey = typeof KNOWLEDGE_TAB_KEYS[number];
export type PaginationEntry = { hasMore?: boolean; nextCursor?: string | null };
export type PaginationState = Record<string, PaginationEntry>;

const indexes = Object.fromEntries(
    KNOWLEDGE_TAB_KEYS.map((key, index) => [key, index]),
) as Record<KnowledgeTabKey, number>;

type Invalidation = { immediate: number[]; terminal: number[] };

function tabs(immediate: KnowledgeTabKey[], terminal: KnowledgeTabKey[]): Invalidation {
    return {
        immediate: immediate.map(key => indexes[key]),
        terminal: terminal.map(key => indexes[key]),
    };
}

export const KNOWLEDGE_COMMAND_INVALIDATION: Record<string, Invalidation> = {
    createKnowledgeSource: tabs(['overview', 'sources'], ['documents', 'indexGenerations']),
    requestKnowledgeSourceSync: tabs(['overview', 'syncRuns', 'incremental'], ['documents', 'indexGenerations']),
    requestKnowledgeBaseReindex: tabs(['overview', 'syncRuns', 'indexGenerations'], ['documents', 'indexGenerations', 'quality']),
    requestKnowledgeBaseCompaction: tabs(['overview', 'incremental', 'indexGenerations'], ['indexGenerations', 'quality']),
    bindAgentKnowledgeBase: tabs(['overview', 'agentBindings', 'accessPolicy'], []),
    updateKnowledgeBase: tabs(['overview', 'settings'], ['indexGenerations']),
    deactivateKnowledgeBase: tabs(['overview', 'settings', 'accessPolicy'], []),
    requestKnowledgeBaseEmbeddingMigration: tabs(['overview', 'indexGenerations', 'quality'], ['indexGenerations', 'quality']),
    pauseKnowledgeBaseEmbeddingMigration: tabs(['overview', 'indexGenerations', 'quality'], []),
    resumeKnowledgeBaseEmbeddingMigration: tabs(['overview', 'indexGenerations', 'quality'], ['indexGenerations', 'quality']),
    cancelKnowledgeBaseEmbeddingMigration: tabs(['overview', 'indexGenerations', 'quality'], []),
    promoteKnowledgeBaseIndexGeneration: tabs(['overview', 'indexGenerations', 'quality'], ['overview', 'indexGenerations', 'quality']),
    rollbackKnowledgeBaseIndexGeneration: tabs(['overview', 'indexGenerations', 'quality'], ['overview', 'indexGenerations', 'quality']),
};

export const KNOWLEDGE_COLLECTION_ACTIONS: Record<string, string> = {
    knowledgeDocuments: 'getKnowledgeDocuments',
    knowledgeSyncRuns: 'getKnowledgeSyncRuns',
    knowledgeIndexGenerations: 'getKnowledgeIndexGenerations',
    knowledgeUploads: 'getKnowledgeUploads',
    knowledgeIncrementalChanges: 'getKnowledgeIncrementalChanges',
    knowledgePassageAnchors: 'getKnowledgePassageAnchors',
    knowledgeCompactionRuns: 'getKnowledgeCompactionRuns',
    knowledgeAntiEntropyRuns: 'getKnowledgeAntiEntropyRuns',
    knowledgeAclFreshness: 'getKnowledgeAclFreshness',
    knowledgeAclReconciliations: 'getKnowledgeAclReconciliations',
    knowledgeAclTransitions: 'getKnowledgeAclTransitions',
    knowledgeConnectorObjects: 'getKnowledgeConnectorObjects',
    knowledgeBaseEmbeddingMigrations: 'getKnowledgeBaseEmbeddingMigrations',
    knowledgeMigrationEvaluations: 'getKnowledgeMigrationEvaluations',
    knowledgeGenerationRetention: 'getKnowledgeGenerationRetention',
    knowledgeBackupCheckpoints: 'getKnowledgeBackupCheckpoints',
    knowledgePurgeEvidence: 'getKnowledgePurgeEvidence',
};

export function availableContinuations(pagination: PaginationState) {
    return Object.entries(pagination).filter(([, page]) =>
        page.hasMore === true && Boolean(page.nextCursor));
}

export function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === 'AbortError'
        || error instanceof Error && error.name === 'AbortError';
}
