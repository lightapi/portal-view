import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MemoryBanks from './MemoryBanks';

const mocks = vi.hoisted(() => ({ fetchClient: vi.fn() }));

vi.mock('../../contexts/UserContext', () => ({ useUserState: () => ({ host: 'host-a' }) }));
vi.mock('../../utils/fetchClient', () => ({ default: mocks.fetchClient }));
vi.mock('./genAiTaskUtils', () => ({
    buildGenAiTaskContext: (host: string) => ({ hostId: host }),
    buildGenAiTaskRoute: (route: string) => route,
    GenAiTaskLayout: ({ children }: any) => children,
}));

function RouteResult() {
    return <output>{useLocation().pathname}</output>;
}

function queryCall(index: number) {
    const url = new URL(mocks.fetchClient.mock.calls[index][0], 'https://portal.test');
    return JSON.parse(url.searchParams.get('cmd') || '{}');
}

describe('Hindsight memory banks page', () => {
    beforeEach(() => {
        mocks.fetchClient.mockReset();
        mocks.fetchClient.mockResolvedValue({
            agentMemoryBanks: [{
                hostId: 'host-a', bankId: 'bank-a', bankName: 'renamed-by-admin',
                runtimeManaged: true, aggregateVersion: 3, active: true,
            }],
            total: 1,
        });
    });

    it('uses the plural collection, excludes runtime banks by default, and keeps structural labeling after rename', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/app/genai/MemoryBanks']}>
                <Routes>
                    <Route path="/app/genai/MemoryBanks" element={<MemoryBanks />} />
                </Routes>
            </MemoryRouter>,
        );

        expect(await screen.findByText('renamed-by-admin')).toBeInTheDocument();
        expect(screen.getByText('Runtime managed')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Update bank' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Deactivate bank' })).toBeDisabled();
        expect(queryCall(0)).toMatchObject({
            host: 'lightapi.net', service: 'genai', action: 'getAgentMemoryBanks', version: '0.1.0',
            data: { hostId: 'host-a', includeRuntimeManaged: false, filters: [], sorting: [], offset: 0, limit: 25 },
        });

        await user.click(screen.getByRole('switch', { name: 'Include runtime-managed banks' }));
        await waitFor(() => expect(mocks.fetchClient.mock.calls.length).toBeGreaterThan(1));
        expect(queryCall(mocks.fetchClient.mock.calls.length - 1).data.includeRuntimeManaged).toBe(true);
    });

    it('opens the bank-scoped workspace route', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/app/genai/MemoryBanks']}>
                <Routes>
                    <Route path="/app/genai/MemoryBanks" element={<MemoryBanks />} />
                    <Route path="/app/genai/MemoryBanks/:bankId" element={<RouteResult />} />
                </Routes>
            </MemoryRouter>,
        );
        await user.click(await screen.findByRole('button', { name: 'renamed-by-admin' }));
        expect(await screen.findByText('/app/genai/MemoryBanks/bank-a')).toBeInTheDocument();
    });
});
