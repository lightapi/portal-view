import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { FGA, FgaType, LabelOption } from './accessControl.types';

async function fetchPermOptions(host: string, type: FgaType): Promise<LabelOption[]> {
  const cfg = FGA[type];
  if (type === 'role') {
    const cmd = {
      host: 'lightapi.net', service: 'role', action: 'getRole', version: '0.1.0',
      data: { hostId: host, offset: 0, limit: 200, active: true, filters: '[]', sorting: '[]', globalFilter: '' },
    };
    const data = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
    return Array.isArray(data?.roles)
      ? data.roles.map((r: any) => ({ value: r.roleId, label: r.roleId + (r.roleDesc ? ` — ${r.roleDesc}` : '') }))
      : [];
  }
  const cmd = {
    host: 'lightapi.net', service: cfg.service, action: cfg.lookupAction, version: '0.1.0',
    data: { hostId: host },
  };
  const data = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
  return Array.isArray(data)
    ? data.map((d: any) => ({ value: d.value ?? d[cfg.idKey], label: d.label ?? d[cfg.idKey] }))
    : [];
}

export interface AddPermPanelProps {
  host: string;
  activeTab: FgaType;
  apiVersionId: string;
  endpointId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddPermPanel({ host, activeTab, apiVersionId, endpointId, onSuccess, onCancel }: AddPermPanelProps) {
  const cfg = FGA[activeTab];

  const [permOptions, setPermOptions] = useState<LabelOption[]>([]);
  const [loadingPermOptions, setLoadingPermOptions] = useState(false);
  const [selPerm, setSelPerm] = useState<LabelOption | null>(null);
  const [attrValue, setAttrValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newExtra, setNewExtra] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadOptions = useCallback(async (): Promise<LabelOption[]> => {
    setLoadingPermOptions(true);
    try {
      const opts = await fetchPermOptions(host, activeTab);
      setPermOptions(opts);
      return opts;
    } finally { setLoadingPermOptions(false); }
  }, [host, activeTab]);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  const handleSubmitCreate = async () => {
    const id = newId.trim();
    if (!id) return;
    setCreating(true); setCreateError(null);
    const payload: Record<string, string> = { hostId: host, [cfg.entityIdKey]: id };
    if (newDesc.trim()) payload[cfg.entityDescKey] = newDesc.trim();
    cfg.entityExtraFields.forEach(({ key }) => { if (newExtra[key]?.trim()) payload[key] = newExtra[key].trim(); });
    const result = await apiPost({
      url: '/portal/command', headers: {}, body: {
        host: 'lightapi.net', service: cfg.service, action: cfg.createEntityAction, version: '0.1.0', data: payload,
      },
    });
    if (result?.error) {
      setCreateError(typeof result.error === 'string' ? result.error : `Failed to create ${cfg.label}.`);
      setCreating(false); return;
    }
    const opts = await loadOptions();
    setSelPerm(opts.find((o) => o.value === id) ?? { value: id, label: id });
    setCreating(false);
    setShowCreate(false);
    setNewId(''); setNewDesc(''); setNewExtra({});
  };

  const handleSubmit = async () => {
    if (!selPerm) return;
    setSubmitting(true); setError(null);
    const data: Record<string, string> = {
      hostId: host, apiVersionId, endpointId, [cfg.idKey]: selPerm.value,
      ...(activeTab === 'attribute' && attrValue.trim() ? { attributeValue: attrValue.trim() } : {}),
    };
    const result = await apiPost({
      url: '/portal/command', headers: {}, body: {
        host: 'lightapi.net', service: cfg.service, action: cfg.createAction, version: '0.1.0', data,
      },
    });
    setSubmitting(false);
    if (result?.error) { setError(typeof result.error === 'string' ? result.error : `Failed to add ${cfg.label} permission.`); return; }
    onSuccess();
  };

  return (
    <Box sx={(t) => ({ p: 1.5, borderRadius: 1.5, border: `1px solid ${alpha(t.palette.success.main, 0.25)}`, bgcolor: alpha(t.palette.success.main, 0.04) })}>
      <Stack spacing={1.5}>
        <Autocomplete
          options={permOptions} value={selPerm}
          onChange={(_, v) => setSelPerm(v)}
          loading={loadingPermOptions}
          getOptionLabel={(o) => o.label} isOptionEqualToValue={(a, b) => a.value === b.value}
          disabled={submitting || showCreate}
          renderInput={(params) => (
            <TextField {...params} label={`Select ${cfg.label}`} size="small"
              InputProps={{ ...params.InputProps, endAdornment: <>{loadingPermOptions && <CircularProgress size={16} />}{params.InputProps.endAdornment}</> }}
            />
          )}
        />
        {activeTab === 'attribute' && !showCreate && (
          <TextField label="Attribute Value" size="small" fullWidth required
            value={attrValue} onChange={(e) => setAttrValue(e.target.value)} disabled={submitting}
            helperText="The value that the attribute must match (e.g. tenant-id, department code)"
          />
        )}

        <Box>
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: '0.8rem !important' }} />}
            onClick={() => { setShowCreate((v) => !v); setCreateError(null); }}
            disabled={submitting}
            sx={{ fontSize: '0.72rem', color: 'text.secondary', textTransform: 'none', pl: 0 }}
          >
            {showCreate ? 'Cancel create' : `Create new ${cfg.label.toLowerCase()}`}
          </Button>
        </Box>

        {showCreate && (
          <Box sx={(t) => ({ p: 1.25, borderRadius: 1, border: `1px solid ${alpha(t.palette.divider, 1)}`, bgcolor: 'background.paper' })}>
            <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'success.main' }}>
              New {cfg.label}
            </Typography>
            <Stack spacing={1.25}>
              <TextField label={`${cfg.label} ID`} size="small" fullWidth required
                value={newId} onChange={(e) => setNewId(e.target.value)} disabled={creating} />
              <TextField label="Description (optional)" size="small" fullWidth
                value={newDesc} onChange={(e) => setNewDesc(e.target.value)} disabled={creating} />
              {cfg.entityExtraFields.map(({ key, label }) => (
                <TextField key={key} label={label} size="small" fullWidth required
                  value={newExtra[key] ?? ''}
                  onChange={(e) => setNewExtra((prev) => ({ ...prev, [key]: e.target.value }))}
                  disabled={creating} />
              ))}
              {createError && <Alert severity="error" sx={{ py: 0.25, '& .MuiAlert-message': { fontSize: '0.78rem' } }}>{createError}</Alert>}
              <Button size="small" variant="outlined" onClick={handleSubmitCreate}
                disabled={creating || !newId.trim() || cfg.entityExtraFields.some(({ key }) => !newExtra[key]?.trim())}
                startIcon={creating ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
                sx={{ alignSelf: 'flex-start' }}>
                Create &amp; Select
              </Button>
            </Stack>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" color="inherit" onClick={onCancel} disabled={submitting || creating}>Cancel</Button>
          <Button size="small" variant="contained" onClick={handleSubmit}
            disabled={submitting || !selPerm || (activeTab === 'attribute' && !attrValue.trim()) || showCreate}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}>
            Add {cfg.label}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
