import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Alert, Box, Checkbox, CircularProgress, Divider,
  FormControlLabel, Stack, Typography,
} from '@mui/material';
import fetchClient from '../../utils/fetchClient';
import {
  enrichToolMetadataFields,
  toolMetadataWarnings,
  validateToolMetadataInputs,
} from '../../utils/toolMetadata';
import { fetchOptions } from './fetchOptions';
import type { McpToolType, McpToolsMeta, Option } from './types';
import ToolListRow from './ToolListRow';

function toKebabCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function normalizeSemanticWeight(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface Props {
  host: string;
  instanceApiId: string;
  apiVersionId: string;
  apiName?: string;
  onMetaChange: (meta: McpToolsMeta) => void;
  onSelectionChange: (selected: McpToolType[]) => void;
}

export type ToolMetadataReferenceOptions = {
  sensitivityTier: Option[];
  sourceProtocol: Option[];
  lifecycleStatus: Option[];
  costTier: Option[];
  parameterLocation: Option[];
};

export type EditDraft = {
  name: string;
  description: string;
  routingDomain: string;
  semanticNamespace: string;
  sensitivityTier: string;
  semanticWeight: string;
  sourceProtocol: string;
  lifecycleStatus: string;
  costTier: string;
  readOnly: boolean;
  idempotent: boolean;
  destructive: boolean;
  humanApprovalRequired: boolean;
  estimatedLatencyMs: string;
  cacheTtlSeconds: string;
  semanticDescription: string;
  semanticKeywords: string;
  parameterMappings: Record<string, string>;
};

const DEFAULT_REF_OPTIONS: ToolMetadataReferenceOptions = {
  sensitivityTier: [
    { value: 'public', label: 'Public' },
    { value: 'internal', label: 'Internal' },
    { value: 'confidential', label: 'Confidential' },
    { value: 'restricted', label: 'Restricted' },
  ],
  sourceProtocol: [
    { value: 'openapi', label: 'OpenAPI' },
    { value: 'mcp', label: 'MCP' },
    { value: 'lightapi', label: 'LightAPI' },
    { value: 'http', label: 'HTTP' },
  ],
  lifecycleStatus: [
    { value: 'active', label: 'Active' },
    { value: 'deprecated', label: 'Deprecated' },
    { value: 'retired', label: 'Retired' },
  ],
  costTier: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ],
  parameterLocation: [
    { value: 'path', label: 'Path' },
    { value: 'query', label: 'Query' },
    { value: 'header', label: 'Header' },
    { value: 'cookie', label: 'Cookie' },
    { value: 'body', label: 'Body' },
  ],
};

function optionsWithFallback(options: Option[], fallback: Option[]) {
  return options.length > 0 ? options : fallback;
}

function draftString(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function draftFromTool(tool: McpToolType): EditDraft {
  const enriched = enrichToolMetadataFields(tool);
  return {
    name: enriched.name,
    description: enriched.description,
    routingDomain: draftString(enriched.routingDomain),
    semanticNamespace: draftString(enriched.semanticNamespace),
    sensitivityTier: draftString(enriched.sensitivityTier),
    semanticWeight: draftString(enriched.semanticWeight ?? 1),
    sourceProtocol: draftString(enriched.sourceProtocol),
    lifecycleStatus: draftString(enriched.lifecycleStatus ?? 'active'),
    costTier: draftString(enriched.costTier),
    readOnly: !!enriched.readOnly,
    idempotent: !!enriched.idempotent,
    destructive: !!enriched.destructive,
    humanApprovalRequired: !!enriched.humanApprovalRequired,
    estimatedLatencyMs: draftString(enriched.estimatedLatencyMs),
    cacheTtlSeconds: draftString(enriched.cacheTtlSeconds),
    semanticDescription: draftString(enriched.semanticDescription),
    semanticKeywords: draftString(enriched.semanticKeywords),
    parameterMappings: { ...(enriched.parameterMappings ?? {}) },
  };
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalInteger(value: string): number | undefined {
  const parsed = optionalNumber(value);
  if (parsed === undefined) return undefined;
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toolFromDraft(tool: McpToolType, draft: EditDraft): McpToolType {
  return enrichToolMetadataFields({
    ...tool,
    name: draft.name.trim(),
    description: draft.description,
    routingDomain: optionalString(draft.routingDomain),
    semanticNamespace: optionalString(draft.semanticNamespace),
    sensitivityTier: optionalString(draft.sensitivityTier),
    semanticWeight: optionalNumber(draft.semanticWeight),
    sourceProtocol: optionalString(draft.sourceProtocol),
    lifecycleStatus: optionalString(draft.lifecycleStatus),
    costTier: optionalString(draft.costTier),
    readOnly: draft.readOnly,
    idempotent: draft.idempotent,
    destructive: draft.destructive,
    humanApprovalRequired: draft.humanApprovalRequired,
    estimatedLatencyMs: optionalInteger(draft.estimatedLatencyMs),
    cacheTtlSeconds: optionalInteger(draft.cacheTtlSeconds),
    semanticDescription: optionalString(draft.semanticDescription),
    semanticKeywords: optionalString(draft.semanticKeywords),
    parameterMappings: draft.parameterMappings,
  });
}

export default function SelectMcpToolsStep({ host, instanceApiId, apiVersionId, apiName = '', onMetaChange, onSelectionChange }: Props) {
  const [tools, setTools] = useState<McpToolType[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(draftFromTool({ name: '', endpoint: '', description: '', selected: false }));
  const [referenceOptions, setReferenceOptions] = useState<ToolMetadataReferenceOptions>(DEFAULT_REF_OPTIONS);

  const fetchTools = useCallback(async () => {
    if (!host || !instanceApiId) return;
    setLoading(true);
    setError(null);
    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'getInstanceApiMcpTool', version: '0.1.0',
      data: { hostId: host, instanceApiId, apiVersionId },
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    try {
      const json = await fetchClient(url);
      const raw: any[] = json?.endpoints ?? [];
      const normalized: McpToolType[] = raw.map((t) => {
        const endpointName = t.endpointName || '';
        let finalName = t.name;
        const semanticWeight = normalizeSemanticWeight(t.semanticWeight);
        if (!finalName || finalName === endpointName) {
          finalName = toKebabCase(`lp-${apiName}-${endpointName}`);
        }
        finalName = finalName.replace(/-+/g, '-').replace(/^-|-$/g, '');
        return enrichToolMetadataFields({
          name: finalName,
          endpointId: t.endpointId,
          endpointName,
          endpoint: t.endpoint ?? '',
          method: t.method ?? t.httpMethod ?? '',
          path: t.path ?? t.endpointPath ?? '',
          description: t.description ?? t.endpointDesc ?? '',
          inputSchema: t.inputSchema ?? t.toolSchema ?? '',
          toolSchema: t.toolSchema ?? t.inputSchema ?? '',
          toolMetadata: t.toolMetadata ?? '',
          selected: !!t.selected,
          ...(t.routingDomain != null && { routingDomain: t.routingDomain }),
          ...(t.semanticNamespace != null && { semanticNamespace: t.semanticNamespace }),
          ...(t.sensitivityTier != null && { sensitivityTier: t.sensitivityTier }),
          ...(semanticWeight != null && { semanticWeight }),
          ...(t.sourceProtocol != null && { sourceProtocol: t.sourceProtocol }),
          ...(t.lifecycleStatus != null && { lifecycleStatus: t.lifecycleStatus }),
          ...(t.costTier != null && { costTier: t.costTier }),
          ...(t.targetPersonas != null && { targetPersonas: t.targetPersonas }),
        });
      });
      setTools(normalized);
      onMetaChange({
        propertyId: json?.propertyId ?? null,
        configId: json?.configId ?? null,
        aggregateVersion: json?.aggregateVersion ?? 0,
        exists: json?.exists ?? false,
      });
      setSelected(new Set(normalized.filter((t) => t.selected).map((t) => t.endpoint)));
    } catch {
      setError('Could not load API endpoints from the sidecar instance. You can skip this step and configure MCP tools from the Instance admin once the sidecar is running.');
    } finally {
      setLoading(false);
    }
  }, [host, instanceApiId, apiVersionId, apiName, onMetaChange]);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    Promise.all([
      fetchOptions(`/r/data?name=sensitivity_tier&host=${host}`),
      fetchOptions(`/r/data?name=source_protocol&host=${host}`),
      fetchOptions(`/r/data?name=lifecycle_status&host=${host}`),
      fetchOptions(`/r/data?name=cost_tier&host=${host}`),
      fetchOptions(`/r/data?name=parameter_location&host=${host}`),
    ]).then(([sensitivityTier, sourceProtocol, lifecycleStatus, costTier, parameterLocation]) => {
      if (cancelled) return;
      setReferenceOptions({
        sensitivityTier: optionsWithFallback(sensitivityTier, DEFAULT_REF_OPTIONS.sensitivityTier),
        sourceProtocol: optionsWithFallback(sourceProtocol, DEFAULT_REF_OPTIONS.sourceProtocol),
        lifecycleStatus: optionsWithFallback(lifecycleStatus, DEFAULT_REF_OPTIONS.lifecycleStatus),
        costTier: optionsWithFallback(costTier, DEFAULT_REF_OPTIONS.costTier),
        parameterLocation: optionsWithFallback(parameterLocation, DEFAULT_REF_OPTIONS.parameterLocation),
      });
    });
    return () => { cancelled = true; };
  }, [host]);

  const selectedTools = useMemo(
    () => tools.filter((t) => selected.has(t.endpoint)),
    [tools, selected],
  );
  const validationErrors = useMemo(() => validateToolMetadataInputs(selectedTools), [selectedTools]);
  const warnings = useMemo(() => toolMetadataWarnings(selectedTools), [selectedTools]);

  useEffect(() => {
    onSelectionChange(selectedTools);
  }, [selectedTools, onSelectionChange]);

  const toggle = (endpoint: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(endpoint) ? next.delete(endpoint) : next.add(endpoint);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(tools.map((t) => t.endpoint)));
  const deselectAll = () => setSelected(new Set());

  const startEdit = (e: React.MouseEvent, tool: McpToolType) => {
    e.stopPropagation();
    setEditingEndpoint(tool.endpoint);
    setEditDraft(draftFromTool(tool));
  };

  const saveEdit = () => {
    if (!editingEndpoint) return;
    const toolBeingEdited = tools.find((t) => t.endpoint === editingEndpoint);
    if (!toolBeingEdited) return;
    setTools((prev) => prev.map((t) => t.endpoint === editingEndpoint ? toolFromDraft(t, editDraft) : t));
    setEditingEndpoint(null);
  };

  const cancelEdit = () => setEditingEndpoint(null);

  if (!instanceApiId) {
    return (
      <Alert severity="info">
        No sidecar instance was linked in the previous step. MCP tool configuration requires a running sidecar — you can set this up from the Instance admin after deployment.
      </Alert>
    );
  }
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="warning">{error}</Alert>;
  if (!tools.length) {
    return (
      <Alert severity="info">
        No endpoints were detected for this API version. If you just uploaded a spec, processing may still be in progress — you can select MCP tools from the Instance admin once the endpoints appear.
      </Alert>
    );
  }

  const allSelected = selected.size === tools.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
        <FormControlLabel
          control={
            <Checkbox checked={allSelected} indeterminate={someSelected} onChange={allSelected ? deselectAll : selectAll} size="small" />
          }
          label={
            <Typography variant="body2" fontWeight={600}>
              {selected.size === 0 ? 'Select all tools' : `${selected.size} of ${tools.length} selected`}
            </Typography>
          }
        />
        <Typography variant="caption" color="text.secondary">
          Only selected tools will be registered on the sidecar and visible to MCP clients.
        </Typography>
      </Box>

      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        {tools.map((tool, idx) => (
          <Box key={tool.endpoint || tool.endpointId || tool.name}>
            {idx > 0 && <Divider />}
            <ToolListRow
              tool={tool}
              isSelected={selected.has(tool.endpoint)}
              isEditing={editingEndpoint === tool.endpoint}
              editDraft={editDraft}
              referenceOptions={referenceOptions}
              onToggle={toggle}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onEditDraftChange={setEditDraft}
            />
          </Box>
        ))}
      </Box>

      {validationErrors.length > 0 && (
        <Alert severity="error">
          {validationErrors.join(' ')}
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert severity="warning">
          {warnings.join(' ')}
        </Alert>
      )}
    </Stack>
  );
}
