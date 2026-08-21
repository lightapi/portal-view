import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fetchClient from '../../utils/fetchClient';
import { knowledgeCommand } from './knowledgeApi';

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
});
