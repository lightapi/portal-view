import { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { FGA, LabelOption } from './accessControl.types';

const normalizeOptionValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.value === 'string') return obj.value;
    if (typeof obj.id === 'string') return obj.id;
    if (typeof obj.ruleType === 'string') return obj.ruleType;
    if (typeof obj.ruleId === 'string') return obj.ruleId;
  }
  return '';
};

export interface AddRulePanelProps {
  host: string;
  apiId: string;
  apiVersion: string;
  endpointId: string;
  endpoint: string;
  endpointLabel: string;
  ruleTypeCacheRef: React.MutableRefObject<LabelOption[] | null>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddRulePanel({ host, apiId, apiVersion, endpointId, endpoint, endpointLabel, ruleTypeCacheRef, onSuccess, onCancel }: AddRulePanelProps) {
  const [ruleTypes, setRuleTypes] = useState<LabelOption[]>([]);
  const [selRuleType, setSelRuleType] = useState<LabelOption | null>(null);
  const [ruleIds, setRuleIds] = useState<LabelOption[]>([]);
  const [loadingRuleIds, setLoadingRuleIds] = useState(false);
  const [selRuleId, setSelRuleId] = useState<LabelOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ruleTypeCacheRef.current) { setRuleTypes(ruleTypeCacheRef.current); return; }
    fetchClient(`/r/data?name=rule_type&host=${encodeURIComponent(host)}`)
      .then((data) => {
        ruleTypeCacheRef.current = Array.isArray(data)
          ? data.map((d: any) => {
            const value = normalizeOptionValue(d?.value ?? d);
            const label = typeof d?.label === 'string' ? d.label : value;
            return { value, label };
          }).filter((d) => d.value)
          : [];
        setRuleTypes(ruleTypeCacheRef.current!);
      })
      .catch(() => { ruleTypeCacheRef.current = []; });
  }, [host, ruleTypeCacheRef]);

  const handleTypeChange = async (rt: LabelOption | null) => {
    setSelRuleType(rt); setSelRuleId(null); setRuleIds([]);
    if (!rt) return;
    const selectedRuleType = normalizeOptionValue(rt.value);
    if (!selectedRuleType) return;
    setLoadingRuleIds(true);
    try {
      const cmd = {
        host: 'lightapi.net', service: 'rule', action: 'getRuleByType', version: '0.1.0',
        data: { hostId: host, ruleType: selectedRuleType },
      };
      const data = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
      // Backend may return bare array or wrapped { rules: [...] }
      const rows: any[] = Array.isArray(data) ? data : (Array.isArray(data?.rules) ? data.rules : []);
      setRuleIds(rows.map((r: any) => {
        const id = normalizeOptionValue(r.ruleId ?? r.value ?? r.id);
        const name = r.ruleName ?? r.name ?? '';
        return { value: id, label: name ? `${id} - ${name}` : id };
      }).filter((r) => r.value));
    } finally { setLoadingRuleIds(false); }
  };

  const handleSubmit = async () => {
    if (!selRuleType || !selRuleId) return;
    const ruleType = normalizeOptionValue(selRuleType.value);
    const ruleId = normalizeOptionValue(selRuleId.value);
    if (!ruleType || !ruleId) {
      setError('Please select a valid rule type and rule.');
      return;
    }
    setSubmitting(true); setError(null);
    const result = await apiPost({
      url: '/portal/command', headers: {}, body: {
        host: 'lightapi.net', service: 'service', action: 'createApiEndpointRule', version: '0.1.0',
        data: { hostId: host, apiId, apiVersion, endpoint, endpointId, ruleType, ruleId },
      },
    });
    setSubmitting(false);
    if (result?.error) { setError(typeof result.error === 'string' ? result.error : 'Failed to add rule.'); return; }
    onSuccess();
  };

  return (
    <Box sx={(t) => ({ mt: 1.5, p: 1.5, borderRadius: 1.5, border: `1px solid ${alpha(t.palette.warning.main, 0.3)}`, bgcolor: alpha(t.palette.warning.main, 0.05) })}>
      <Stack spacing={1.5}>
        <Autocomplete
          options={ruleTypes} value={selRuleType}
          onChange={(_, v) => handleTypeChange(v)}
          getOptionLabel={(o) => o.label} isOptionEqualToValue={(a, b) => a.value === b.value}
          renderInput={(params) => <TextField {...params} label="Rule Type" size="small" required />}
          disabled={submitting}
        />
        <Autocomplete
          options={ruleIds} value={selRuleId}
          onChange={(_, v) => setSelRuleId(v)}
          getOptionLabel={(o) => o.label} isOptionEqualToValue={(a, b) => a.value === b.value}
          disabled={submitting || !selRuleType || loadingRuleIds}
          noOptionsText={selRuleType ? 'No rules for this type' : 'Select a rule type first'}
          renderInput={(params) => (
            <TextField {...params} label="Rule" size="small" required
              InputProps={{ ...params.InputProps, endAdornment: <>{loadingRuleIds && <CircularProgress size={16} />}{params.InputProps.endAdornment}</> }}
            />
          )}
        />
        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" color="inherit" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button size="small" variant="contained" onClick={handleSubmit}
            disabled={submitting || !selRuleType || !selRuleId}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}>
            Add Rule
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
