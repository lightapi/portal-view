import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import KnowledgeBaseWorkspace from './KnowledgeBaseWorkspace';

const mocks = vi.hoisted(() => ({ query: vi.fn(), command: vi.fn() }));

vi.mock('../../contexts/UserContext', () => ({
    useUserState: () => ({ host: 'host-a' }),
}));
vi.mock('./knowledgeApi', async importOriginal => {
    const actual = await importOriginal<typeof import('./knowledgeApi')>();
    return { ...actual, knowledgeQuery: mocks.query, knowledgeCommand: mocks.command };
});

function renderWorkspace() {
    return render(<MemoryRouter initialEntries={['/app/genai/KnowledgeBases/kb-a?environment=dev']}>
        <Routes>
            <Route path="/app/genai/KnowledgeBases/:knowledgeBaseId" element={<KnowledgeBaseWorkspace />} />
        </Routes>
    </MemoryRouter>);
}

describe('Knowledge Base workspace', () => {
    beforeEach(() => {
        mocks.query.mockReset();
        mocks.command.mockReset();
        mocks.command.mockResolvedValue({});
        mocks.query.mockImplementation((action: string) => {
            if (action === 'getFreshKnowledgeBase') {
                return Promise.resolve({
                    knowledgeBaseId: 'kb-a', hostId: 'host-a', name: 'Support Knowledge',
                    environment: 'dev', status: 'ACTIVE', version: 1,
                });
            }
            if (action === 'getKnowledgeRetrievalProfiles') {
                return Promise.resolve({
                    knowledgeRetrievalProfiles: [{
                        profileId: 'profile-a', profileName: 'Balanced', hostId: 'host-a',
                        strategy: 'HYBRID', active: true,
                    }],
                });
            }
            if (action === 'getAgentDefinitionLabel') {
                return Promise.resolve([{ id: 'agent-a', label: 'Support Agent' }]);
            }
            return Promise.resolve({});
        });
    });

    it('selects an active tenant Agent and submits its identifier', async () => {
        const user = userEvent.setup();
        renderWorkspace();

        await user.click(await screen.findByRole('tab', { name: 'Agent Bindings' }));
        await user.click(screen.getByRole('button', { name: 'Bind Agent' }));
        await user.click(screen.getByRole('combobox', { name: 'Agent' }));
        await user.click(await screen.findByRole('option', { name: 'Support Agent (agent-a)' }));
        await user.click(screen.getByRole('button', { name: 'Bind Agent' }));

        await waitFor(() => expect(mocks.command).toHaveBeenCalledWith('bindAgentKnowledgeBase', {
            scope: 'TENANT', environment: 'dev', knowledgeBaseId: 'kb-a',
            agentId: 'agent-a', retrievalProfileId: 'profile-a', priority: 50,
            evidenceRequired: false, allowedSourceTrustTiers: [],
        }));
    });

    it('loads Overview first and defers operational reads until their tab is selected', async () => {
        const user = userEvent.setup();
        renderWorkspace();

        await screen.findByText('Support Knowledge');
        expect(mocks.query.mock.calls.map(call => call[0])).toEqual(['getFreshKnowledgeBase']);

        await user.click(screen.getByRole('tab', { name: 'Documents' }));
        await waitFor(() => expect(mocks.query).toHaveBeenCalledWith(
            'getKnowledgeDocuments',
            expect.objectContaining({ knowledgeBaseId: 'kb-a', pageSize: 200 }),
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ));
        expect(mocks.query.mock.calls.map(call => call[0])).not.toContain('getKnowledgeSyncRuns');
    });

    it('surfaces and follows a document continuation instead of silently truncating', async () => {
        const user = userEvent.setup();
        let documentsPage = 0;
        mocks.query.mockImplementation((action: string, input: Record<string, unknown>) => {
            if (action === 'getFreshKnowledgeBase') {
                return Promise.resolve({
                    knowledgeBaseId: 'kb-a', hostId: 'host-a', name: 'Support Knowledge',
                    environment: 'dev', status: 'ACTIVE', version: 1,
                });
            }
            if (action === 'getKnowledgeDocuments') {
                documentsPage += 1;
                return Promise.resolve(documentsPage === 1 ? {
                    knowledgeDocuments: [{ documentId: 'document-1' }],
                    pagination: { knowledgeDocuments: { hasMore: true, nextCursor: 'cursor-2' } },
                } : {
                    knowledgeDocuments: [{ documentId: 'document-2' }],
                    pagination: { knowledgeDocuments: { hasMore: false, nextCursor: null } },
                    receivedCursor: input.cursor,
                });
            }
            return Promise.resolve({});
        });
        renderWorkspace();

        await user.click(await screen.findByRole('tab', { name: 'Documents' }));
        await screen.findByText(/document-1/);
        await user.click(await screen.findByRole('button', { name: 'Load more' }));

        await screen.findByText(/document-2/);
        expect(mocks.query).toHaveBeenLastCalledWith(
            'getKnowledgeDocuments',
            expect.objectContaining({ cursor: 'cursor-2', pageSize: 200 }),
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
        expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('keeps a tab failure local and exposes a targeted retry', async () => {
        const user = userEvent.setup();
        mocks.query.mockImplementation((action: string) => {
            if (action === 'getFreshKnowledgeBase') {
                return Promise.resolve({
                    knowledgeBaseId: 'kb-a', hostId: 'host-a', name: 'Support Knowledge',
                    environment: 'dev', status: 'ACTIVE', version: 1,
                });
            }
            if (action === 'getKnowledgeSyncRuns') return Promise.reject(new Error('sync unavailable'));
            return Promise.resolve({});
        });
        renderWorkspace();

        await user.click(await screen.findByRole('tab', { name: 'Sync Runs' }));
        expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.getByText('sync unavailable')).toBeInTheDocument();
        expect(screen.getByText('Support Knowledge')).toBeInTheDocument();
    });

    it('cancels an unfinished operational request when its tab is left', async () => {
        const user = userEvent.setup();
        let documentsSignal: AbortSignal | undefined;
        mocks.query.mockImplementation((action: string, _input: unknown,
            options?: { signal?: AbortSignal }) => {
            if (action === 'getFreshKnowledgeBase') {
                return Promise.resolve({
                    knowledgeBaseId: 'kb-a', hostId: 'host-a', name: 'Support Knowledge',
                    environment: 'dev', status: 'ACTIVE', version: 1,
                });
            }
            if (action === 'getKnowledgeDocuments') {
                documentsSignal = options?.signal;
                return new Promise(() => undefined);
            }
            return Promise.resolve({});
        });
        renderWorkspace();

        await user.click(await screen.findByRole('tab', { name: 'Documents' }));
        await waitFor(() => expect(documentsSignal).toBeDefined());
        await user.click(screen.getByRole('tab', { name: 'Sync Runs' }));

        expect(documentsSignal?.aborted).toBe(true);
    });

    it('polls only the Overview summary while a sync is active', async () => {
        vi.useFakeTimers();
        try {
            mocks.query.mockImplementation((action: string) => Promise.resolve(
                action === 'getFreshKnowledgeBase' ? {
                    knowledgeBaseId: 'kb-a', hostId: 'host-a', name: 'Support Knowledge',
                    environment: 'dev', status: 'ACTIVE', version: 1,
                    hasActiveSync: true, activeJobCount: 1,
                } : {},
            ));
            renderWorkspace();
            await act(async () => { await Promise.resolve(); });
            await act(async () => { await Promise.resolve(); });
            expect(mocks.query.mock.calls.map(call => call[0])).toEqual(['getFreshKnowledgeBase']);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(3000);
            });

            expect(mocks.query.mock.calls.map(call => call[0]))
                .toEqual(['getFreshKnowledgeBase', 'getFreshKnowledgeBase']);
        } finally {
            vi.useRealTimers();
        }
    });
});
