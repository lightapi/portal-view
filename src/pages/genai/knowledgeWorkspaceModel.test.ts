import { describe, expect, it } from 'vitest';
import {
    availableContinuations, KNOWLEDGE_COMMAND_INVALIDATION,
    KNOWLEDGE_TAB_KEYS,
} from './knowledgeWorkspaceModel';

describe('Knowledge workspace Phase 5 model', () => {
    it('matches the frozen command-to-invalidation contract without a full-load fallback', () => {
        expect(KNOWLEDGE_TAB_KEYS).toEqual([
            'overview', 'sources', 'documents', 'syncRuns', 'indexGenerations',
            'incremental', 'agentBindings', 'accessPolicy', 'playground', 'quality',
            'settings',
        ]);
        expect(KNOWLEDGE_COMMAND_INVALIDATION.requestKnowledgeSourceSync)
            .toEqual({ immediate: [0, 3, 5], terminal: [2, 4] });
        expect(KNOWLEDGE_COMMAND_INVALIDATION.promoteKnowledgeBaseIndexGeneration)
            .toEqual({ immediate: [0, 4, 9], terminal: [0, 4, 9] });
        expect(KNOWLEDGE_COMMAND_INVALIDATION).toEqual({
            createKnowledgeSource: { immediate: [0, 1], terminal: [2, 4] },
            requestKnowledgeSourceSync: { immediate: [0, 3, 5], terminal: [2, 4] },
            requestKnowledgeBaseReindex: { immediate: [0, 3, 4], terminal: [2, 4, 9] },
            requestKnowledgeBaseCompaction: { immediate: [0, 5, 4], terminal: [4, 9] },
            bindAgentKnowledgeBase: { immediate: [0, 6, 7], terminal: [] },
            updateKnowledgeBase: { immediate: [0, 10], terminal: [4] },
            deactivateKnowledgeBase: { immediate: [0, 10, 7], terminal: [] },
            requestKnowledgeBaseEmbeddingMigration: { immediate: [0, 4, 9], terminal: [4, 9] },
            pauseKnowledgeBaseEmbeddingMigration: { immediate: [0, 4, 9], terminal: [] },
            resumeKnowledgeBaseEmbeddingMigration: { immediate: [0, 4, 9], terminal: [4, 9] },
            cancelKnowledgeBaseEmbeddingMigration: { immediate: [0, 4, 9], terminal: [] },
            promoteKnowledgeBaseIndexGeneration: { immediate: [0, 4, 9], terminal: [0, 4, 9] },
            rollbackKnowledgeBaseIndexGeneration: { immediate: [0, 4, 9], terminal: [0, 4, 9] },
        });
        expect(Object.values(KNOWLEDGE_COMMAND_INVALIDATION)
            .every(value => value.immediate.length < KNOWLEDGE_TAB_KEYS.length
                && value.terminal.length < KNOWLEDGE_TAB_KEYS.length)).toBe(true);
    });

    it('offers only bounded pages with a server continuation', () => {
        expect(availableContinuations({
            first: { hasMore: true, nextCursor: 'signed' },
            second: { hasMore: false, nextCursor: null },
            third: { hasMore: true },
        })).toEqual([['first', { hasMore: true, nextCursor: 'signed' }]]);
    });
});
