import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fetchClient from '../../utils/fetchClient';
import { knowledgeCommand, knowledgeError, knowledgeQuery } from './knowledgeApi';

vi.mock('../../utils/fetchClient', () => ({ default: vi.fn() }));

const mockedFetchClient = vi.mocked(fetchClient);

describe('Knowledge command API', () => {
    beforeEach(() => {
        mockedFetchClient.mockReset();
        mockedFetchClient.mockResolvedValue({});
        vi.stubGlobal('crypto', { randomUUID: () => '018f0000-0000-7000-8000-000000000001' });
    });

    afterEach(() => vi.unstubAllGlobals());

    it('sends a stable per-invocation idempotency key with the command', async () => {
        const data = { knowledgeBaseId: '018f0000-0000-7000-8000-000000000002', environment: 'dev' };

        await knowledgeCommand('requestKnowledgeBaseReindex', data);

        expect(mockedFetchClient).toHaveBeenCalledWith('/portal/command', {
            method: 'POST',
            headers: { 'Idempotency-Key': '018f0000-0000-7000-8000-000000000001' },
            body: {
                host: 'lightapi.net',
                service: 'genai',
                version: '0.1.0',
                action: 'requestKnowledgeBaseReindex',
                data,
            },
        });
    });

    it('does not send an idempotency key for ordinary aggregate updates', async () => {
        const data = {
            knowledgeBaseId: '018f0000-0000-7000-8000-000000000002',
            environment: 'dev', aggregateVersion: 1,
        };

        await knowledgeCommand('updateKnowledgeBase', data);

        expect(mockedFetchClient).toHaveBeenCalledWith('/portal/command', {
            method: 'POST',
            body: {
                host: 'lightapi.net',
                service: 'genai',
                version: '0.1.0',
                action: 'updateKnowledgeBase',
                data,
            },
        });
    });

    it('forwards cancellation to the query transport', async () => {
        const controller = new AbortController();

        await knowledgeQuery('getKnowledgeDocuments', {
            hostId: 'host-a', environment: 'dev', knowledgeBaseId: 'kb-a',
        }, { signal: controller.signal });

        expect(mockedFetchClient).toHaveBeenCalledWith(expect.stringContaining('/portal/query?cmd='), {
            signal: controller.signal,
        });
    });
});

describe('Knowledge error messages', () => {
    it('shows a plain-text gateway denial', () => {
        expect(knowledgeError(
            'HTTP 403 Forbidden: Access denied: no access control rule defined for getKnowledgeBases',
        )).toBe('HTTP 403 Forbidden: Access denied: no access control rule defined for getKnowledgeBases');
    });

    it('shows the backend code and description', () => {
        expect(knowledgeError({
            code: 'AUTH_TOKEN_SCOPE_MISMATCH',
            description: 'portal.knowledge.r is required',
        })).toBe('AUTH_TOKEN_SCOPE_MISMATCH: portal.knowledge.r is required');
    });

    it('unwraps a JSON-RPC error returned by the query transport', () => {
        expect(knowledgeError({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Knowledge configuration is unavailable' },
        })).toBe('-32603: Knowledge configuration is unavailable');
    });

    it('uses a specific fallback only when the response has no usable detail', () => {
        expect(knowledgeError({})).toBe('Knowledge Base operation failed without an error message.');
    });
});
