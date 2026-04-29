import { useEffect, useState, useCallback } from 'react';
import {
  Alert, Box, Checkbox, CircularProgress, Divider,
  FormControlLabel, Stack, Typography,
} from '@mui/material';
import fetchClient from '../../utils/fetchClient';
import type { McpToolType, McpToolsMeta } from './types';
import ToolListRow from './ToolListRow';

function toKebabCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

interface Props {
  host: string;
  instanceApiId: string;
  apiVersionId: string;
  apiName?: string;
  onMetaChange: (meta: McpToolsMeta) => void;
  onSelectionChange: (selected: McpToolType[]) => void;
}

type EditDraft = { name: string; description: string };

export default function SelectMcpToolsStep({ host, instanceApiId, apiVersionId, apiName = '', onMetaChange, onSelectionChange }: Props) {
  const [tools, setTools] = useState<McpToolType[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ name: '', description: '' });

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
        if (!finalName || finalName === endpointName) {
          finalName = toKebabCase(`lp-${apiName}-${endpointName}`);
        }
        finalName = finalName.replace(/-+/g, '-').replace(/^-|-$/g, '');
        return {
          name: finalName,
          endpointId: t.endpointId,
          endpoint: t.endpoint ?? '',
          method: t.method ?? t.httpMethod ?? '',
          path: t.path ?? t.endpointPath ?? '',
          description: t.description ?? t.endpointDesc ?? '',
          inputSchema: t.inputSchema ?? t.toolSchema ?? '',
          toolMetadata: t.toolMetadata ?? '',
          selected: !!t.selected,
        };
      });
      setTools(normalized);
      onMetaChange({
        propertyId: json?.propertyId ?? null,
        configId: json?.configId ?? null,
        aggregateVersion: json?.aggregateVersion ?? 0,
        exists: json?.exists ?? false,
      });
      setSelected(new Set(normalized.filter((t) => t.selected).map((t) => t.name)));
    } catch {
      setError('Could not load API endpoints from the sidecar instance. You can skip this step and configure MCP tools from the Instance admin once the sidecar is running.');
    } finally {
      setLoading(false);
    }
  }, [host, instanceApiId, apiVersionId, apiName, onMetaChange]);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  useEffect(() => {
    onSelectionChange(tools.filter((t) => selected.has(t.name)));
  }, [tools, selected, onSelectionChange]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(tools.map((t) => t.name)));
  const deselectAll = () => setSelected(new Set());

  const startEdit = (e: React.MouseEvent, tool: McpToolType) => {
    e.stopPropagation();
    setEditingEndpoint(tool.endpoint);
    setEditDraft({ name: tool.name, description: tool.description });
  };

  const saveEdit = () => {
    if (!editingEndpoint) return;
    const toolBeingEdited = tools.find((t) => t.endpoint === editingEndpoint);
    if (!toolBeingEdited) return;
    const oldName = toolBeingEdited.name;
    const newName = editDraft.name;
    setTools((prev) => prev.map((t) => t.endpoint === editingEndpoint ? { ...t, name: newName, description: editDraft.description } : t));
    setSelected((prev) => {
      const next = new Set(prev);
      if (prev.has(oldName) && oldName !== newName) { next.delete(oldName); next.add(newName); }
      return next;
    });
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
          <Box key={tool.endpoint}>
            {idx > 0 && <Divider />}
            <ToolListRow
              tool={tool}
              isSelected={selected.has(tool.name)}
              isEditing={editingEndpoint === tool.endpoint}
              editDraft={editDraft}
              onToggle={toggle}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onEditDraftChange={setEditDraft}
            />
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
