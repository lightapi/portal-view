import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ToolListRow from './ToolListRow';

describe('MCP schema publication preview workflow', () => {
  it('shows variant-only properties and exposes reset-to-endpoint action', async () => {
    const onEditDraftChange = vi.fn();
    render(<ToolListRow
      tool={{
        name: 'ingest', endpoint: '/events@post', description: '', selected: true,
        method: 'post', path: '/events',
        inputSchema: JSON.stringify({
          type: 'object',
          oneOf: [
            { properties: { eventType: { type: 'string' } } },
            { properties: { personId: { type: 'string', 'x-mcp-header': 'Mcp-Param-Person-Id' } } },
          ],
          unevaluatedProperties: false,
        }),
      }}
      isSelected
      isEditing
      editDraft={{
        name: 'ingest', description: '', inputSchema: JSON.stringify({
          type: 'object',
          oneOf: [
            { properties: { eventType: { type: 'string' } } },
            { properties: { personId: { type: 'string', 'x-mcp-header': 'Mcp-Param-Person-Id' } } },
          ],
          unevaluatedProperties: false,
        }), routingDomain: '', semanticNamespace: '', sensitivityTier: '',
        semanticWeight: '1', sourceProtocol: 'openapi', lifecycleStatus: 'active', costTier: '',
        readOnly: false, idempotent: false, destructive: false, humanApprovalRequired: false,
        estimatedLatencyMs: '', cacheTtlSeconds: '', semanticDescription: '', semanticKeywords: '',
        parameterMappings: { eventType: 'body', personId: 'body' },
        requireCompleteParameterMappings: true, unmappedArguments: 'reject', resetInputSchema: false,
      }}
      referenceOptions={{ sensitivityTier: [], sourceProtocol: [], lifecycleStatus: [], costTier: [], parameterLocation: [] }}
      onToggle={vi.fn()} onStartEdit={vi.fn()} onSaveEdit={vi.fn()} onCancelEdit={vi.fn()}
      onEditDraftChange={onEditDraftChange}
    />);

    await userEvent.click(screen.getByText('Advanced metadata'));
    expect(screen.getByText('eventType (conditional)')).toBeInTheDocument();
    expect(screen.getByText('personId (conditional) → Mcp-Param-Person-Id')).toBeInTheDocument();
    expect(screen.getByText(/must be absent when their argument is absent/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Reset schema to endpoint on save'));
    expect(onEditDraftChange).toHaveBeenCalledWith(expect.objectContaining({ resetInputSchema: true }));
  });
});
