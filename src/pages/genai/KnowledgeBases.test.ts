import { describe, expect, it } from 'vitest';
import { normalizeQualifiedEmbeddingAliases } from './knowledgeEmbeddingAliases';

describe('normalizeQualifiedEmbeddingAliases', () => {
    it('maps the qualified Alias view response and preserves its immutable space', () => {
        const aliases = normalizeQualifiedEmbeddingAliases([{
            alias_owner_host_id: '01964b05-552a-7c4b-9184-6857e7f3dc5f',
            public_alias_id: '019feebf-757f-752f-aa5a-59773b961aae',
            alias_name: 'kb-index',
            embedding_space: {
                spaceId: 'nvidia-nemotron-3-embed-1b-float-v1',
                revision: 1,
                dimension: 2048,
                normalization: 'l2',
                distanceMetric: 'cosine',
                documentInputTransformVersion: 'document-v1',
            },
            eligible_route_count: 1,
        }]);

        expect(aliases).toEqual([{
            aliasOwnerHostId: '01964b05-552a-7c4b-9184-6857e7f3dc5f',
            publicAliasId: '019feebf-757f-752f-aa5a-59773b961aae',
            aliasName: 'kb-index',
            embeddingSpace: {
                spaceId: 'nvidia-nemotron-3-embed-1b-float-v1',
                revision: 1,
                dimension: 2048,
                normalization: 'l2',
                distanceMetric: 'cosine',
                documentInputTransformVersion: 'document-v1',
            },
            eligibleRouteCount: 1,
        }]);
    });

    it('drops rows without a complete immutable embedding space', () => {
        expect(normalizeQualifiedEmbeddingAliases([{
            alias_owner_host_id: 'host',
            public_alias_id: 'alias',
            alias_name: 'kb-index',
            embedding_space: { spaceId: 'space', revision: 1 },
        }])).toEqual([]);
    });
});
