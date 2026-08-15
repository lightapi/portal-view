import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import YAML from 'yaml';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@uiw/react-codemirror', () => ({
    default: ({ value, onChange, onUpdate }: {
        value?: string;
        onChange?: (value: string) => void;
        onUpdate?: (update: unknown) => void;
    }) => (
        <textarea
            aria-label="Workflow YAML source"
            value={value || ''}
            onChange={event => onChange?.(event.target.value)}
            onSelect={event => onUpdate?.({
                selectionSet: true,
                docChanged: false,
                state: {
                    doc: { toString: () => event.currentTarget.value },
                    selection: { main: { head: event.currentTarget.selectionStart } },
                },
            })}
        />
    ),
}));

vi.mock('../../contexts/UserContext', () => ({
    useUserState: () => ({ host: '', userId: 'user-1' }),
}));

vi.mock('./WorkflowGraph', () => ({
    default: ({ onSelectStep }: { onSelectStep?: (stepId: string) => void }) => (
        <div data-testid="workflow-graph">
            <button type="button" onClick={() => onSelectStep?.('missing-step')}>Select missing graph step</button>
        </div>
    ),
}));

import WorkflowEditor from './WorkflowEditor';

describe('WorkflowEditor YAML cursor insertion', () => {
    it('selects the step under the cursor and inserts the palette step after it', () => {
        const definition = `document:
  dsl: "1.0.3"
  namespace: test
  name: cursor-insertion
  version: "1.0.0"
do:
  - first:
      set:
        value: 1
  - second:
      wait:
        duration: PT5M
  - third:
      set:
        value: 3
`;
        render(
            <MemoryRouter initialEntries={[{
                pathname: '/app/workflow/editor',
                state: { data: { hostId: '', definition } },
            }]}
            >
                <Routes>
                    <Route path="/app/workflow/editor" element={<WorkflowEditor />} />
                </Routes>
            </MemoryRouter>,
        );

        const source = screen.getByLabelText('Workflow YAML source') as HTMLTextAreaElement;
        const cursor = definition.indexOf('  - second:');
        source.setSelectionRange(cursor, cursor);
        fireEvent.select(source);

        const insert = screen.getByRole('button', { name: 'Insert after second' });
        fireEvent.click(insert);

        const stepIds = YAML.parse(source.value).do
            .map((step: Record<string, unknown>) => Object.keys(step)[0]);
        expect(stepIds).toEqual(['first', 'second', 'ask-input', 'third']);
    });

    it('reports a stale relative target instead of silently appending', () => {
        const definition = `document:\n  name: stale-target\ndo:\n  - first:\n      set:\n        value: 1\n`;
        render(
            <MemoryRouter initialEntries={[{
                pathname: '/app/workflow/editor',
                state: { data: { hostId: '', definition } },
            }]}
            >
                <Routes>
                    <Route path="/app/workflow/editor" element={<WorkflowEditor />} />
                </Routes>
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Select missing graph step' }));
        fireEvent.click(screen.getByRole('button', { name: 'Insert after missing-step' }));

        expect(screen.getByText(/Selected step "missing-step" is no longer available/)).toBeInTheDocument();
        const source = screen.getByLabelText('Workflow YAML source') as HTMLTextAreaElement;
        expect(YAML.parse(source.value).do).toHaveLength(1);
    });

    it('keeps an explicit fork branch target while the YAML cursor moves', () => {
        const definition = `document:\n  name: branch-target\ndo:\n  - choose:\n      fork:\n        branches:\n          - left:\n              set:\n                value: 1\n          - right:\n              set:\n                value: 2\n  - finish:\n      set:\n        value: 3\n`;
        render(
            <MemoryRouter initialEntries={[{
                pathname: '/app/workflow/editor',
                state: { data: { hostId: '', definition } },
            }]}
            >
                <Routes>
                    <Route path="/app/workflow/editor" element={<WorkflowEditor />} />
                </Routes>
            </MemoryRouter>,
        );

        const source = screen.getByLabelText('Workflow YAML source') as HTMLTextAreaElement;
        const chooseCursor = definition.indexOf('  - choose:');
        source.setSelectionRange(chooseCursor, chooseCursor);
        fireEvent.select(source);
        fireEvent.click(screen.getAllByRole('button', { name: 'Add Step' })[0]);
        expect(screen.getByText('Insert into choose / left')).toBeInTheDocument();

        const finishCursor = definition.indexOf('  - finish:');
        source.setSelectionRange(finishCursor, finishCursor);
        fireEvent.select(source);
        expect(screen.getByText('Insert into choose / left')).toBeInTheDocument();
    });
});
