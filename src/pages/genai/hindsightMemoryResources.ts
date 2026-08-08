import type { HindsightResourceConfig } from './HindsightResourceTable';

type QueryableDisplayOptions = { content?: boolean; json?: boolean; dateTime?: boolean };

const queryable = (key: string, label: string, options: QueryableDisplayOptions = {}) =>
    ({ key, label, ...options, filterable: true, sortable: true });

export const HINDSIGHT_RESOURCES: Array<{ id: string; label: string; config: HindsightResourceConfig }> = [
    {
        id: 'documents', label: 'Documents', config: {
            label: 'Document', listAction: 'getAgentMemoryDocs', collectionKey: 'agentMemoryDocs',
            rowKeys: ['hostId', 'bankId', 'docId'], freshAction: 'getFreshAgentMemoryDoc',
            createForm: 'createAgentMemoryDoc', updateForm: 'updateAgentMemoryDoc', deleteAction: 'deleteAgentMemoryDoc',
            formFields: ['hostId', 'bankId', 'docId', 'originalText', 'contentHash', 'aggregateVersion'],
            columns: [
                queryable('docId', 'Document Id'), queryable('originalText', 'Original Text', { content: true }),
                queryable('contentHash', 'Content Hash'), queryable('aggregateVersion', 'Version'),
                queryable('updateTs', 'Updated', { dateTime: true }),
            ],
        },
    },
    {
        id: 'units', label: 'Units', config: {
            label: 'Memory Unit', listAction: 'getAgentMemoryUnits', collectionKey: 'agentMemoryUnits',
            rowKeys: ['hostId', 'bankId', 'unitId'], deleteAction: 'deleteAgentMemoryUnit', readOnly: true,
            columns: [
                queryable('unitId', 'Unit Id'), queryable('docId', 'Document Id'),
                queryable('content', 'Content', { content: true }), queryable('context', 'Context', { content: true }),
                queryable('factType', 'Fact Type'), { key: 'metadata', label: 'Metadata', json: true },
                { key: 'proofCount', label: 'Proof Count' }, { key: 'sourceMemoryIds', label: 'Source Memory Ids', json: true },
                queryable('aggregateVersion', 'Version'), queryable('updateTs', 'Updated', { dateTime: true }),
            ],
        },
    },
    {
        id: 'entities', label: 'Entities', config: {
            label: 'Entity', listAction: 'getAgentMemoryEntities', collectionKey: 'agentMemoryEntities',
            rowKeys: ['hostId', 'bankId', 'entityId'], freshAction: 'getFreshAgentMemoryEntity',
            createForm: 'createAgentMemoryEntity', updateForm: 'updateAgentMemoryEntity', deleteAction: 'deleteAgentMemoryEntity',
            formFields: ['hostId', 'bankId', 'entityId', 'userId', 'canonicalName', 'mentionCount', 'metadata', 'aggregateVersion'],
            columns: [
                queryable('entityId', 'Entity Id'), queryable('canonicalName', 'Canonical Name'),
                queryable('userId', 'User Id'), queryable('mentionCount', 'Mentions'),
                { key: 'metadata', label: 'Metadata', json: true }, queryable('aggregateVersion', 'Version'),
                queryable('updateTs', 'Updated', { dateTime: true }),
            ],
        },
    },
    {
        id: 'associations', label: 'Unit / Entity', config: {
            label: 'Unit / Entity Association', listAction: 'getAgentMemoryUnitEntities', collectionKey: 'agentMemoryUnitEntities',
            rowKeys: ['hostId', 'bankId', 'unitId', 'entityId'], createForm: 'linkAgentMemoryUnitEntity',
            deleteAction: 'unlinkAgentMemoryUnitEntity', association: true,
            columns: [queryable('unitId', 'Unit Id'), queryable('entityId', 'Entity Id')],
        },
    },
    {
        id: 'cooccurrences', label: 'Co-occurrence', config: {
            label: 'Entity Co-occurrence', listAction: 'getAgentMemoryEntityCooccurrences',
            collectionKey: 'agentMemoryEntityCooccurrences', rowKeys: ['hostId', 'bankId', 'entityId1', 'entityId2'], readOnly: true,
            readOnlyMessage: 'Co-occurrence data is a derived diagnostic projection and cannot be edited in Portal.',
            columns: [
                queryable('entityId1', 'Entity 1'), queryable('entityId2', 'Entity 2'),
                queryable('cooccurCount', 'Count'), queryable('lastCooccurred', 'Last Co-occurred', { dateTime: true }),
                queryable('updateTs', 'Updated', { dateTime: true }),
            ],
        },
    },
    {
        id: 'links', label: 'Links', config: {
            label: 'Memory Link', listAction: 'getAgentMemoryLinks', collectionKey: 'agentMemoryLinks',
            rowKeys: ['hostId', 'bankId', 'fromUnitId', 'toUnitId', 'linkType'], freshAction: 'getFreshAgentMemoryLink',
            createForm: 'createAgentMemoryLink', updateForm: 'updateAgentMemoryLink', deleteAction: 'deleteAgentMemoryLink',
            formFields: ['hostId', 'bankId', 'fromUnitId', 'toUnitId', 'linkType', 'weight', 'aggregateVersion'],
            columns: [
                queryable('fromUnitId', 'From Unit'), queryable('toUnitId', 'To Unit'),
                queryable('linkType', 'Link Type'), queryable('weight', 'Weight'),
                { key: 'aggregateVersion', label: 'Version' }, queryable('updateTs', 'Updated', { dateTime: true }),
            ],
        },
    },
    {
        id: 'directives', label: 'Directives', config: {
            label: 'Directive', listAction: 'getAgentMemoryDirectives', collectionKey: 'agentMemoryDirectives',
            rowKeys: ['hostId', 'bankId', 'directiveId'], freshAction: 'getFreshAgentMemoryDirective',
            createForm: 'createAgentMemoryDirective', updateForm: 'updateAgentMemoryDirective', deleteAction: 'deleteAgentMemoryDirective',
            formFields: ['hostId', 'bankId', 'directiveId', 'name', 'content', 'priority', 'aggregateVersion'],
            columns: [
                queryable('directiveId', 'Directive Id'), queryable('name', 'Name'),
                queryable('content', 'Content', { content: true }), queryable('priority', 'Priority'),
                { key: 'aggregateVersion', label: 'Version' }, queryable('updateTs', 'Updated', { dateTime: true }),
            ],
        },
    },
    {
        id: 'reflections', label: 'Reflections', config: {
            label: 'Reflection', listAction: 'getAgentMemoryReflections', collectionKey: 'agentMemoryReflections',
            rowKeys: ['hostId', 'bankId', 'reflectionId'], deleteAction: 'deleteAgentMemoryReflection', readOnly: true,
            columns: [
                queryable('reflectionId', 'Reflection Id'), queryable('content', 'Content', { content: true }),
                queryable('aggregateVersion', 'Version'), queryable('updateTs', 'Updated', { dateTime: true }),
            ],
        },
    },
    {
        id: 'sessions', label: 'Session History', config: {
            label: 'Session History', listAction: 'getAgentSessionHistories', collectionKey: 'agentSessionHistories',
            rowKeys: ['hostId', 'bankId', 'sessionId'], readOnly: true, sessionProjection: true,
            columns: [
                queryable('sessionId', 'Session Id'), queryable('durableSessionId', 'Durable Session Id'),
                queryable('projectionSequence', 'Projection Sequence'), queryable('projectionState', 'Projection State'),
                queryable('messageCount', 'Messages'), queryable('updateTs', 'Updated', { dateTime: true }),
            ],
        },
    },
];
