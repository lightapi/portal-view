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

    it('uses cryptographic UUID bytes when randomUUID is unavailable', async () => {
        vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(3) });
        await knowledgeCommand('requestKnowledgeBaseReindex', { knowledgeBaseId: 'kb-a' });
        expect(mockedFetchClient).toHaveBeenCalledWith('/portal/command', expect.objectContaining({
            headers: { 'Idempotency-Key': '03030303-0303-4303-8303-030303030303' },
        }));
    });

    it('does not send idempotent commands without Web Crypto', async () => {
        vi.stubGlobal('crypto', undefined);
        await expect(knowledgeCommand('createKnowledgeBase', {})).rejects.toThrow('Secure random ID generation is unavailable');
        expect(mockedFetchClient).not.toHaveBeenCalled();
    });

    it('does not request randomness for ordinary aggregate updates', async () => {
        vi.stubGlobal('crypto', undefined);
        await knowledgeCommand('updateKnowledgeBase', { aggregateVersion: 1 });
        expect(mockedFetchClient).toHaveBeenCalledWith('/portal/command', expect.not.objectContaining({ headers: expect.anything() }));
    });

    it('generates separate keys for separate invocations', async () => {
        const uuid = vi.fn().mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
            .mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
        vi.stubGlobal('crypto', { randomUUID: uuid });
        await knowledgeCommand('createKnowledgeBase', { name: 'first' });
        await knowledgeCommand('createKnowledgeBase', { name: 'second' });
        expect(mockedFetchClient.mock.calls.map(call => call[1].headers['Idempotency-Key']))
            .toEqual(['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']);
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
