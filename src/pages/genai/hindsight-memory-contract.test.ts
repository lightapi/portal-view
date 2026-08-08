// @ts-nocheck -- Vitest executes this source-contract test in Node; the application does not ship Node typings.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import forms from '../../data/Forms.json';
import { allPageRegistry } from '../../tasks/pageRegistry';
import { pageDefinitionForRoute } from '../../tasks/taskUtils';
import { HINDSIGHT_RESOURCES } from './hindsightMemoryResources';
import {
    hindsightErrorMessage,
    hindsightQueryCommand,
    hindsightQueryUrl,
    optimisticRemove,
} from './hindsightMemoryApi';

const formDefinitions = forms as Record<string, any>;

describe('Hindsight memory Portal contract', () => {
    it('uses the exact query namespace, action, version, and structured payload', () => {
        const data = {
            hostId: 'host-a', bankId: 'bank-a', offset: 0, limit: 25,
            filters: [{ id: 'canonicalName', value: 'Ada' }], sorting: [{ id: 'canonicalName', desc: false }],
            globalFilter: '', active: true,
        };
        expect(hindsightQueryCommand('getAgentMemoryEntities', data)).toEqual({
            host: 'lightapi.net', service: 'genai', action: 'getAgentMemoryEntities', version: '0.1.0', data,
        });
        const encoded = new URL(hindsightQueryUrl('getAgentMemoryEntities', data), 'https://portal.test');
        expect(JSON.parse(encoded.searchParams.get('cmd') || '{}')).toEqual(hindsightQueryCommand('getAgentMemoryEntities', data));
    });

    it('freezes every workspace list/fresh/collection contract and special lifecycle', () => {
        const byId = Object.fromEntries(HINDSIGHT_RESOURCES.map(resource => [resource.id, resource.config]));
        expect(Object.keys(byId)).toEqual([
            'documents', 'units', 'entities', 'associations', 'cooccurrences',
            'links', 'directives', 'reflections', 'sessions',
        ]);
        expect(byId.documents).toMatchObject({ listAction: 'getAgentMemoryDocs', freshAction: 'getFreshAgentMemoryDoc', collectionKey: 'agentMemoryDocs' });
        expect(byId.units).toMatchObject({ listAction: 'getAgentMemoryUnits', collectionKey: 'agentMemoryUnits', readOnly: true, deleteAction: 'deleteAgentMemoryUnit' });
        expect(byId.units.columns.find((column: any) => column.key === 'metadata')?.filterable).toBeUndefined();
        expect(byId.units.columns.find((column: any) => column.key === 'metadata')?.sortable).toBeUndefined();
        expect(byId.units.columns.find((column: any) => column.key === 'content')).toMatchObject({ filterable: true, sortable: true });
        expect(byId.entities).toMatchObject({ listAction: 'getAgentMemoryEntities', freshAction: 'getFreshAgentMemoryEntity', collectionKey: 'agentMemoryEntities' });
        expect(byId.associations).toMatchObject({ listAction: 'getAgentMemoryUnitEntities', collectionKey: 'agentMemoryUnitEntities', createForm: 'linkAgentMemoryUnitEntity', deleteAction: 'unlinkAgentMemoryUnitEntity', association: true });
        expect(byId.cooccurrences).toMatchObject({ listAction: 'getAgentMemoryEntityCooccurrences', collectionKey: 'agentMemoryEntityCooccurrences', readOnly: true });
        expect(byId.links).toMatchObject({ listAction: 'getAgentMemoryLinks', freshAction: 'getFreshAgentMemoryLink', collectionKey: 'agentMemoryLinks' });
        expect(byId.directives).toMatchObject({ listAction: 'getAgentMemoryDirectives', freshAction: 'getFreshAgentMemoryDirective', collectionKey: 'agentMemoryDirectives' });
        expect(byId.reflections).toMatchObject({ listAction: 'getAgentMemoryReflections', collectionKey: 'agentMemoryReflections', readOnly: true, deleteAction: 'deleteAgentMemoryReflection' });
        expect(byId.sessions).toMatchObject({ listAction: 'getAgentSessionHistories', collectionKey: 'agentSessionHistories', readOnly: true, sessionProjection: true });
        expect(byId.sessions).not.toHaveProperty('createForm');
        expect(byId.sessions).not.toHaveProperty('updateForm');
        expect(byId.sessions).not.toHaveProperty('deleteAction');
    });

    it('declares only Portal-enabled forms and keeps bank keys immutable', () => {
        const actionByForm: Record<string, string> = {
            createAgentMemoryBank: 'createAgentMemoryBank', updateAgentMemoryBank: 'updateAgentMemoryBank',
            createAgentMemoryDoc: 'createAgentMemoryDoc', updateAgentMemoryDoc: 'updateAgentMemoryDoc',
            createAgentMemoryEntity: 'createAgentMemoryEntity', updateAgentMemoryEntity: 'updateAgentMemoryEntity',
            linkAgentMemoryUnitEntity: 'linkAgentMemoryUnitEntity',
            createAgentMemoryLink: 'createAgentMemoryLink', updateAgentMemoryLink: 'updateAgentMemoryLink',
            createAgentMemoryDirective: 'createAgentMemoryDirective', updateAgentMemoryDirective: 'updateAgentMemoryDirective',
        };
        for (const [formId, action] of Object.entries(actionByForm)) {
            expect(formDefinitions[formId].actions[0]).toMatchObject({ host: 'lightapi.net', service: 'genai', action, version: '0.1.0' });
            expect(formDefinitions[formId].schema.properties.hostId).toMatchObject({ type: 'string', readonly: true });
            if (formId !== 'createAgentMemoryBank' && formId !== 'updateAgentMemoryBank') {
                expect(formDefinitions[formId].schema.properties.bankId).toMatchObject({ type: 'string', readonly: true });
            }
        }
        expect(formDefinitions.createAgentMemoryBank.schema.properties.disposition.type).toBe('object');
        expect(formDefinitions.createAgentMemoryBank.form.find((item: any) => item.key === 'disposition')).toMatchObject({ type: 'structured' });
        expect(formDefinitions.createAgentMemoryEntity.schema.properties.metadata.type).toBe('object');
        expect(formDefinitions.createAgentMemoryEntity.form.find((item: any) => item.key === 'metadata')).toMatchObject({ type: 'structured' });

        for (const obsolete of [
            'createAgentSessionHistory', 'updateAgentSessionHistory',
            'createSessionMemory', 'updateSessionMemory', 'createUserMemory', 'updateUserMemory',
            'createAgentMemory', 'updateAgentMemory', 'createOrgMemory', 'updateOrgMemory',
            'retainAgentMemoryUnit', 'updateAgentMemoryUnit', 'createAgentMemoryReflection', 'updateAgentMemoryReflection',
        ]) expect(formDefinitions).not.toHaveProperty(obsolete);
    });

    it('restores the exact page and total after an optimistic command failure', () => {
        const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        const result = optimisticRemove(rows, 17, row => row.id === 'b');
        expect(result.nextRows).toEqual([{ id: 'a' }, { id: 'c' }]);
        expect(result.nextRowCount).toBe(16);
        expect(result.rollback).toEqual({ rows, rowCount: 17 });
    });

    it('maps actionable Hindsight failures without exposing raw content', () => {
        expect(hindsightErrorMessage({ statusCode: 400, code: 'ERR11645' })).toContain('catching up');
        expect(hindsightErrorMessage({ statusCode: 404, code: 'ERR11637' })).toContain('no longer exists');
        expect(hindsightErrorMessage({ statusCode: 422, code: 'ERR11000' })).toContain('invalid');
        expect(hindsightErrorMessage({
            statusCode: 409,
            code: 'HINDSIGHT_MEMORY_BANK_NOT_EMPTY',
            description: 'Deactivate child resources, unlink unit/entity associations, and close bound sessions.',
        })).toContain('cannot be deactivated');
        expect(hindsightErrorMessage({ code: 403 })).toContain('not authorized');
        expect(hindsightErrorMessage({ message: 'active child session' })).toContain('operation failed');
    });

    it('removes obsolete routes and avoids embedding fields and sensitive console logging', () => {
        const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
        const app = source('src/App.tsx');
        const sidebar = source('src/components/Sidebar/Sidebar.tsx');
        expect(app).toContain('path="genai/MemoryBanks"');
        expect(app).toContain('path="genai/MemoryBanks/:bankId"');
        expect(sidebar).toContain('Hindsight Memory');
        expect(pageDefinitionForRoute(allPageRegistry, '/app/genai/MemoryBanks/bank-a')?.id)
            .toBe('genai-hindsight-memory-bank');
        for (const obsolete of ['AgentSessionHistory', 'SessionMemory', 'UserMemory', 'AgentMemory"', 'OrgMemory']) {
            expect(app).not.toContain(`genai/${obsolete}`);
            expect(sidebar).not.toContain(`genai/${obsolete}`);
        }
        const hindsightSources = [
            source('src/pages/genai/MemoryBanks.tsx'), source('src/pages/genai/MemoryBankWorkspace.tsx'),
            source('src/pages/genai/HindsightResourceTable.tsx'), source('src/pages/genai/hindsightMemoryApi.ts'),
        ].join('\n');
        expect(hindsightSources).not.toMatch(/\bembedding\b\s*:/i);
        expect(hindsightSources).not.toMatch(/console\.(log|debug|info)\s*\(/);
    });
});
