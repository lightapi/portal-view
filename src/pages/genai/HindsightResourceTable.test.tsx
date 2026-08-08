import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HindsightResourceTable, { type HindsightResourceConfig } from './HindsightResourceTable';

const mocks = vi.hoisted(() => ({ query: vi.fn(), command: vi.fn() }));

vi.mock('./hindsightMemoryApi', async importOriginal => {
    const actual = await importOriginal<typeof import('./hindsightMemoryApi')>();
    return { ...actual, runHindsightQuery: mocks.query, runHindsightCommand: mocks.command };
});
vi.mock('./genAiTaskUtils', () => ({ buildGenAiTaskRoute: (route: string) => route }));

const baseProps = {
    hostId: 'host-a',
    bankId: 'bank-a',
    searchParams: new URLSearchParams(),
    taskContext: { hostId: 'host-a', bankId: 'bank-a' },
};

describe('Hindsight resource lifecycle UI', () => {
    beforeEach(() => {
        mocks.query.mockReset();
        mocks.command.mockReset();
        mocks.command.mockResolvedValue({});
        vi.stubGlobal('confirm', vi.fn(() => true));
    });

    it('renders session history read-only and loads projection detail without event freshness', async () => {
        const config: HindsightResourceConfig = {
            label: 'Session History', listAction: 'getAgentSessionHistories', collectionKey: 'agentSessionHistories',
            rowKeys: ['hostId', 'bankId', 'sessionId'], readOnly: true, sessionProjection: true,
            columns: [
                { key: 'sessionId', label: 'Session Id' }, { key: 'projectionSequence', label: 'Projection Sequence' },
                { key: 'projectionState', label: 'Projection State' }, { key: 'messageCount', label: 'Messages' },
            ],
        };
        mocks.query
            .mockResolvedValueOnce({ agentSessionHistories: [{
                hostId: 'host-a', bankId: 'bank-a', sessionId: 'session-a', projectionSequence: 8,
                projectionState: 'CURRENT', messageCount: 2, active: true,
            }], total: 1 })
            .mockResolvedValueOnce({
                hostId: 'host-a', bankId: 'bank-a', sessionId: 'session-a', projectionSequence: 8,
                projectionState: 'CURRENT', messages: [{ role: 'user', content: 'hello' }], metadata: {}, active: true,
            });

        render(<MemoryRouter><HindsightResourceTable {...baseProps} config={config} /></MemoryRouter>);
        expect(await screen.findByText('session-a')).toBeInTheDocument();
        expect(screen.getByText(/runtime-owned projection/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Create/ })).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Deactivate|Delete|Update/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('VisibilityIcon').closest('button')!);
        await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(2));
        expect(mocks.query.mock.calls[0][0]).toBe('getAgentSessionHistories');
        expect(mocks.query.mock.calls[0][1]).toMatchObject({ hostId: 'host-a', bankId: 'bank-a', filters: [], sorting: [], active: true });
        expect(mocks.query.mock.calls[1]).toEqual(['getAgentSessionHistoryProjection', {
            hostId: 'host-a', bankId: 'bank-a', sessionId: 'session-a',
        }]);
        expect(await screen.findByText(/Projection state: CURRENT · sequence 8/)).toBeInTheDocument();
        expect(mocks.command).not.toHaveBeenCalled();
    });

    it('unlinks unit/entity associations as hard links without aggregate version or optimistic removal', async () => {
        const config: HindsightResourceConfig = {
            label: 'Unit / Entity Association', listAction: 'getAgentMemoryUnitEntities',
            collectionKey: 'agentMemoryUnitEntities', rowKeys: ['hostId', 'bankId', 'unitId', 'entityId'],
            createForm: 'linkAgentMemoryUnitEntity', deleteAction: 'unlinkAgentMemoryUnitEntity', association: true,
            columns: [{ key: 'unitId', label: 'Unit Id' }, { key: 'entityId', label: 'Entity Id' }],
        };
        const response = { agentMemoryUnitEntities: [{
            hostId: 'host-a', bankId: 'bank-a', unitId: 'unit-a', entityId: 'entity-a',
        }], total: 1 };
        mocks.query.mockResolvedValue(response);
        render(<MemoryRouter><HindsightResourceTable {...baseProps} config={config} /></MemoryRouter>);
        expect(await screen.findByText('unit-a')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Link Unit and Entity' })).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('DeleteForeverIcon').closest('button')!);
        await waitFor(() => expect(mocks.command).toHaveBeenCalledTimes(1));
        expect(mocks.command).toHaveBeenCalledWith('unlinkAgentMemoryUnitEntity', {
            hostId: 'host-a', bankId: 'bank-a', unitId: 'unit-a', entityId: 'entity-a',
        });
        expect(mocks.command.mock.calls[0][1]).not.toHaveProperty('aggregateVersion');
        expect(screen.getByText('unit-a')).toBeInTheDocument();
        await waitFor(() => expect(mocks.query.mock.calls.length).toBeGreaterThan(1));
    });

    it('keeps every mutation action hidden for runtime-managed banks', async () => {
        const config: HindsightResourceConfig = {
            label: 'Document', listAction: 'getAgentMemoryDocs', collectionKey: 'agentMemoryDocs',
            rowKeys: ['hostId', 'bankId', 'docId'], createForm: 'createAgentMemoryDoc',
            updateForm: 'updateAgentMemoryDoc', deleteAction: 'deleteAgentMemoryDoc',
            columns: [{ key: 'docId', label: 'Document Id' }],
        };
        mocks.query.mockResolvedValue({ agentMemoryDocs: [{
            hostId: 'host-a', bankId: 'bank-a', docId: 'doc-a', aggregateVersion: 1, active: true,
        }], total: 1 });
        render(<MemoryRouter><HindsightResourceTable {...baseProps} config={config} bankReadOnly /></MemoryRouter>);
        expect(await screen.findByText('doc-a')).toBeInTheDocument();
        expect(screen.getByText(/Runtime-managed banks and their resources are read-only/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Create Document/ })).not.toBeInTheDocument();
        expect(screen.queryByTestId('EditIcon')).not.toBeInTheDocument();
        expect(screen.queryByTestId('DeleteForeverIcon')).not.toBeInTheDocument();
    });
});
