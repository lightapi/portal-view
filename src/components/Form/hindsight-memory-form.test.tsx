import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Form from './Form';

const mocks = vi.hoisted(() => ({ fetchClient: vi.fn() }));

vi.mock('../../contexts/UserContext', () => ({
    useUserState: () => ({ host: 'host-a', isAuthenticated: true }),
}));
vi.mock('../../utils/fetchClient', () => ({ BASE_URL: '', default: mocks.fetchClient }));
vi.mock('../HelpLink', () => ({ default: () => null }));

describe('Hindsight memory forms', () => {
    beforeEach(() => {
        mocks.fetchClient.mockReset();
        mocks.fetchClient.mockResolvedValue({ entityId: 'entity-a' });
    });

    it('submits inherited bank scope unchanged and JSON metadata as an object', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={[{
                pathname: '/app/form/createAgentMemoryEntity',
                state: { data: {
                    hostId: 'host-a', bankId: 'bank-a', canonicalName: 'Ada',
                    metadata: { source: 'portal', aliases: ['Ada Lovelace'] },
                }, source: '/app/genai/MemoryBanks/bank-a?tab=entities' },
            }]}>
                <Routes>
                    <Route path="/app/form/:formId" element={<Form />} />
                    <Route path="/app/genai/MemoryBanks" element={<output>banks</output>} />
                    <Route path="/app/genai/MemoryBanks/:bankId" element={<output>bank workspace</output>} />
                    <Route path="/app/failure" element={<output>failure</output>} />
                </Routes>
            </MemoryRouter>,
        );

        expect(await screen.findByRole('heading', { name: 'Create Memory Entity' })).toBeInTheDocument();
        expect(screen.getByDisplayValue('host-a')).toBeInTheDocument();
        expect(screen.getByDisplayValue('bank-a')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Create Entity' }));
        await waitFor(() => expect(mocks.fetchClient).toHaveBeenCalledTimes(1));
        expect(mocks.fetchClient.mock.calls[0][1].body).toMatchObject({
            host: 'lightapi.net', service: 'genai', action: 'createAgentMemoryEntity', version: '0.1.0',
            data: {
                hostId: 'host-a', bankId: 'bank-a', canonicalName: 'Ada',
                metadata: { source: 'portal', aliases: ['Ada Lovelace'] },
            },
        });
        expect(mocks.fetchClient.mock.calls[0][1].body.data.metadata).not.toEqual(expect.any(String));
        expect(await screen.findByText('bank workspace')).toBeInTheDocument();
    });
});
