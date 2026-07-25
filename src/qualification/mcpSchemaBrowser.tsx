import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ToolListRow from '../wizards/mcp/ToolListRow';
import type { EditDraft, ToolMetadataReferenceOptions } from '../wizards/mcp/SelectMcpToolsStep';
import type { McpToolType } from '../wizards/mcp/types';
import { inputSchemaPropertyNames } from '../utils/toolMetadata';
import catalog from './mcp-phase6-tools.json';

type GeneratedTool = {
  name: string;
  description?: string;
  method?: string;
  path?: string;
  inputSchema: unknown;
};

const referenceOptions: ToolMetadataReferenceOptions = {
  sensitivityTier: [], sourceProtocol: [], lifecycleStatus: [], costTier: [], parameterLocation: [],
};

function draftFor(tool: McpToolType): EditDraft {
  const inputSchema = tool.inputSchema ?? '{}';
  return {
    name: tool.name,
    description: tool.description,
    inputSchema,
    routingDomain: '',
    semanticNamespace: '',
    sensitivityTier: '',
    semanticWeight: '1',
    sourceProtocol: 'openapi',
    lifecycleStatus: 'active',
    costTier: '',
    readOnly: false,
    idempotent: false,
    destructive: false,
    humanApprovalRequired: false,
    estimatedLatencyMs: '',
    cacheTtlSeconds: '',
    semanticDescription: '',
    semanticKeywords: '',
    parameterMappings: Object.fromEntries(
      inputSchemaPropertyNames(inputSchema).map((name) => [name, 'body']),
    ),
    requireCompleteParameterMappings: true,
    unmappedArguments: 'reject',
    resetInputSchema: false,
  };
}

function QualificationPage() {
  const [tool, setTool] = useState<McpToolType>();
  const [draft, setDraft] = useState<EditDraft>();
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.resolve(catalog as { tools: GeneratedTool[] })
      .then((generatedCatalog) => {
        const generated = generatedCatalog.tools.find((candidate) => candidate.name === 'discriminatedOneOf');
        if (!generated) throw new Error('generated discriminatedOneOf tool is missing');
        const selected: McpToolType = {
          name: generated.name,
          endpoint: `${generated.path}@${generated.method}`,
          description: generated.description ?? generated.name,
          method: generated.method,
          path: generated.path,
          inputSchema: JSON.stringify(generated.inputSchema, null, 2),
          selected: true,
        };
        setTool(selected);
        setDraft(draftFor(selected));
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const state = useMemo(() => error ? 'error' : tool && draft ? 'ready' : 'loading', [draft, error, tool]);
  return (
    <main data-mcp-qualification={state} data-reset={draft?.resetInputSchema ? 'true' : 'false'}>
      <h1>MCP generated schema preview qualification</h1>
      {error && <p role="alert">{error}</p>}
      {tool && draft && (
        <ToolListRow
          tool={tool}
          isSelected
          isEditing
          editDraft={draft}
          referenceOptions={referenceOptions}
          onToggle={() => undefined}
          onStartEdit={() => undefined}
          onSaveEdit={() => undefined}
          onCancelEdit={() => undefined}
          onEditDraftChange={setDraft}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<QualificationPage />);
