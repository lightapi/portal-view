import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import type { EndpointType } from './ServiceEndpoint';

type Props = {
  open: boolean;
  hostId: string;
  apiVersionId: string;
  endpoints: EndpointType[];
  onClose: () => void;
  onSuccess: () => void;
};

type OperationConfig = {
  value: string;
  label: string;
  principalKey?: string;
  principalLabel?: string;
  lookupType?: LookupType;
  needsRule?: boolean;
  needsAttributeValue?: boolean;
  needsRowFilter?: boolean;
  needsColumns?: boolean;
};

type LookupType = 'rule' | 'role' | 'group' | 'position' | 'attribute';

type LookupConfig = {
  service: string;
  action: string;
  responseKey: string;
  idKey: string;
  labelKeys: string[];
};

type LookupOption = {
  id: string;
  label: string;
};

const OPERATIONS: OperationConfig[] = [
  { value: 'endpointRule', label: 'Endpoint Rule', lookupType: 'rule', needsRule: true },
  { value: 'rolePermission', label: 'Role Permission', principalKey: 'roleId', principalLabel: 'Role ID', lookupType: 'role' },
  { value: 'groupPermission', label: 'Group Permission', principalKey: 'groupId', principalLabel: 'Group ID', lookupType: 'group' },
  { value: 'positionPermission', label: 'Position Permission', principalKey: 'positionId', principalLabel: 'Position ID', lookupType: 'position' },
  { value: 'attributePermission', label: 'Attribute Permission', principalKey: 'attributeId', principalLabel: 'Attribute ID', lookupType: 'attribute', needsAttributeValue: true },
  { value: 'roleRowFilter', label: 'Role Row Filter', principalKey: 'roleId', principalLabel: 'Role ID', lookupType: 'role', needsRowFilter: true },
  { value: 'groupRowFilter', label: 'Group Row Filter', principalKey: 'groupId', principalLabel: 'Group ID', lookupType: 'group', needsRowFilter: true },
  { value: 'positionRowFilter', label: 'Position Row Filter', principalKey: 'positionId', principalLabel: 'Position ID', lookupType: 'position', needsRowFilter: true },
  { value: 'attributeRowFilter', label: 'Attribute Row Filter', principalKey: 'attributeId', principalLabel: 'Attribute ID', lookupType: 'attribute', needsAttributeValue: true, needsRowFilter: true },
  { value: 'roleColFilter', label: 'Role Column Filter', principalKey: 'roleId', principalLabel: 'Role ID', lookupType: 'role', needsColumns: true },
  { value: 'groupColFilter', label: 'Group Column Filter', principalKey: 'groupId', principalLabel: 'Group ID', lookupType: 'group', needsColumns: true },
  { value: 'positionColFilter', label: 'Position Column Filter', principalKey: 'positionId', principalLabel: 'Position ID', lookupType: 'position', needsColumns: true },
  { value: 'attributeColFilter', label: 'Attribute Column Filter', principalKey: 'attributeId', principalLabel: 'Attribute ID', lookupType: 'attribute', needsAttributeValue: true, needsColumns: true },
];

const OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'contains', 'startsWith', 'endsWith'];

const LOOKUP_CONFIG: Record<LookupType, LookupConfig> = {
  rule: { service: 'rule', action: 'getRule', responseKey: 'rules', idKey: 'ruleId', labelKeys: ['ruleName', 'ruleDesc'] },
  role: { service: 'role', action: 'getRole', responseKey: 'roles', idKey: 'roleId', labelKeys: ['roleName', 'roleDesc'] },
  group: { service: 'group', action: 'getGroup', responseKey: 'groups', idKey: 'groupId', labelKeys: ['groupName', 'groupDesc'] },
  position: { service: 'position', action: 'getPosition', responseKey: 'positions', idKey: 'positionId', labelKeys: ['positionName', 'positionDesc'] },
  attribute: { service: 'attribute', action: 'getAttribute', responseKey: 'attributes', idKey: 'attributeId', labelKeys: ['attributeName', 'attributeDesc'] },
};

const formatLookupOption = (item: Record<string, unknown>, config: LookupConfig): LookupOption | null => {
  const id = String(item[config.idKey] ?? '');
  if (!id) return null;
  const labelValue = config.labelKeys.map((key) => item[key]).find((value) => typeof value === 'string' && value.trim());
  const label = typeof labelValue === 'string' ? `${id} - ${labelValue}` : id;
  return { id, label };
};

export default function ServiceEndpointBulkAccessDrawer({
  open,
  hostId,
  apiVersionId,
  endpoints,
  onClose,
  onSuccess,
}: Props) {
  const [operation, setOperation] = useState('endpointRule');
  const [conflictMode, setConflictMode] = useState('skipExisting');
  const [ruleId, setRuleId] = useState('');
  const [principalId, setPrincipalId] = useState('');
  const [attributeValue, setAttributeValue] = useState('');
  const [colName, setColName] = useState('');
  const [operator, setOperator] = useState('=');
  const [colValue, setColValue] = useState('');
  const [columns, setColumns] = useState('');
  const [lookupOptions, setLookupOptions] = useState<LookupOption[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resultText, setResultText] = useState('');

  const config = useMemo(
    () => OPERATIONS.find((item) => item.value === operation) ?? OPERATIONS[0],
    [operation],
  );

  useEffect(() => {
    setRuleId('');
    setPrincipalId('');
    setLookupOptions([]);
    setLookupError('');
  }, [operation]);

  useEffect(() => {
    const lookupType = config.lookupType;
    if (!open || !hostId || !lookupType) {
      setLookupOptions([]);
      return;
    }

    let cancelled = false;
    const fetchLookupOptions = async () => {
      setLookupLoading(true);
      setLookupError('');
      const lookupConfig = LOOKUP_CONFIG[lookupType];
      const cmd = {
        host: 'lightapi.net',
        service: lookupConfig.service,
        action: lookupConfig.action,
        version: '0.1.0',
        data: {
          hostId,
          offset: 0,
          limit: 1000,
          sorting: JSON.stringify([]),
          filters: JSON.stringify([]),
          globalFilter: '',
          active: true,
        },
      };

      try {
        const json = await fetchClient(`/portal/query?cmd=${encodeURIComponent(JSON.stringify(cmd))}`);
        if (cancelled) return;
        const rows = Array.isArray(json?.[lookupConfig.responseKey]) ? json[lookupConfig.responseKey] : [];
        setLookupOptions(
          rows
            .map((item: Record<string, unknown>) => formatLookupOption(item, lookupConfig))
            .filter((item: LookupOption | null): item is LookupOption => Boolean(item)),
        );
      } catch (e) {
        if (!cancelled) {
          setLookupOptions([]);
          setLookupError(e instanceof Error ? e.message : `Unable to load ${lookupType} options.`);
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    };

    fetchLookupOptions();

    return () => {
      cancelled = true;
    };
  }, [config.lookupType, hostId, open]);

  const payload = useMemo(() => {
    const next: Record<string, string> = {};
    if (config.needsRule) next.ruleId = ruleId.trim();
    if (config.principalKey) next[config.principalKey] = principalId.trim();
    if (config.needsAttributeValue) next.attributeValue = attributeValue.trim();
    if (config.needsRowFilter) {
      next.colName = colName.trim();
      next.operator = operator;
      next.colValue = colValue.trim();
    }
    if (config.needsColumns) next.columns = columns.trim();
    return next;
  }, [attributeValue, colName, colValue, columns, config, operator, principalId, ruleId]);

  const validate = () => {
    if (!hostId || !apiVersionId) return 'Host and API version are required.';
    if (endpoints.length === 0) return 'Select at least one endpoint.';
    const missingField = Object.entries(payload).find(([, value]) => !value);
    if (missingField) return `Missing required value: ${missingField[0]}`;
    return '';
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (conflictMode === 'overwriteExisting' && !window.confirm(`Overwrite matching access records for ${endpoints.length} endpoints?`)) {
      return;
    }
    setSubmitting(true);
    setError('');
    setResultText('');
    const body = {
      host: 'lightapi.net',
      service: 'service',
      action: 'bulkUpdateApiEndpointAccess',
      version: '0.1.0',
      data: {
        hostId,
        apiVersionId,
        endpointIds: endpoints.map((endpoint) => endpoint.endpointId),
        operation,
        conflictMode,
        payload,
      },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body });
      if (result.error) {
        setError(result.error.message ?? 'Bulk access update failed.');
        return;
      }
      const data = result.data ?? result;
      setResultText(`Submitted ${data.submitted ?? endpoints.length} endpoint updates. Failed: ${data.failed ?? 0}.`);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk access update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', sm: 520 }, p: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Bulk Access</Typography>
            <Typography variant="body2" color="text.secondary">
              Apply endpoint-level access configuration to {endpoints.length} selected endpoints.
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          {resultText && <Alert severity="success">{resultText}</Alert>}

          <FormControl fullWidth size="small">
            <InputLabel id="bulk-operation-label">Operation</InputLabel>
            <Select
              labelId="bulk-operation-label"
              label="Operation"
              value={operation}
              onChange={(event) => setOperation(event.target.value)}
            >
              {OPERATIONS.map((item) => (
                <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel id="bulk-conflict-label">Conflict Mode</InputLabel>
            <Select
              labelId="bulk-conflict-label"
              label="Conflict Mode"
              value={conflictMode}
              onChange={(event) => setConflictMode(event.target.value)}
            >
              <MenuItem value="skipExisting">Skip Existing</MenuItem>
              <MenuItem value="overwriteExisting">Overwrite Existing</MenuItem>
            </Select>
          </FormControl>

          {lookupError && <Alert severity="warning">{lookupError}</Alert>}

          {config.needsRule && (
            <FormControl fullWidth size="small">
              <InputLabel id="bulk-rule-label">Rule ID</InputLabel>
              <Select
                labelId="bulk-rule-label"
                label="Rule ID"
                value={ruleId}
                onChange={(event) => setRuleId(event.target.value)}
                disabled={lookupLoading}
              >
                {lookupOptions.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {config.principalKey && (
            <FormControl fullWidth size="small">
              <InputLabel id="bulk-principal-label">{config.principalLabel}</InputLabel>
              <Select
                labelId="bulk-principal-label"
                label={config.principalLabel}
                value={principalId}
                onChange={(event) => setPrincipalId(event.target.value)}
                disabled={lookupLoading}
              >
                {lookupOptions.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {config.needsAttributeValue && (
            <TextField size="small" label="Attribute Value" value={attributeValue} onChange={(event) => setAttributeValue(event.target.value)} />
          )}

          {config.needsRowFilter && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField size="small" label="Column Name" value={colName} onChange={(event) => setColName(event.target.value)} sx={{ flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id="bulk-operator-label">Operator</InputLabel>
                <Select labelId="bulk-operator-label" label="Operator" value={operator} onChange={(event) => setOperator(event.target.value)}>
                  {OPERATORS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Value" value={colValue} onChange={(event) => setColValue(event.target.value)} sx={{ flex: 1 }} />
            </Stack>
          )}

          {config.needsColumns && (
            <TextField
              size="small"
              label="Columns"
              value={columns}
              onChange={(event) => setColumns(event.target.value)}
              helperText="Comma-separated column names"
            />
          )}

          <Divider />

          <Box>
            <Typography variant="subtitle2">Selected Endpoints</Typography>
            <Box sx={{ mt: 1, maxHeight: 180, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {endpoints.map((endpoint) => (
                <Box key={endpoint.endpointId} sx={{ px: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2">{endpoint.httpMethod} {endpoint.endpointPath}</Typography>
                  <Typography variant="caption" color="text.secondary">{endpoint.endpoint}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={submitting || endpoints.length === 0}>
              Apply
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
}
