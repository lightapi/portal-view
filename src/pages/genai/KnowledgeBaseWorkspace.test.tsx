import { render, screen, waitFor } from '@testing-library/react';
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

describe('Knowledge Base Agent binding', () => {
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
        render(<MemoryRouter initialEntries={['/app/genai/KnowledgeBases/kb-a?environment=dev']}>
            <Routes>
                <Route path="/app/genai/KnowledgeBases/:knowledgeBaseId" element={<KnowledgeBaseWorkspace />} />
            </Routes>
        </MemoryRouter>);

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
});
