import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
  type MRT_Row,
} from 'material-react-table';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import CheckIcon from '@mui/icons-material/Check';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import { useUserState } from '../../../contexts/UserContext';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../../tasks/taskUtils';
import ConfigStructuredValueDialog from './ConfigStructuredValueDialog';
import {
  applyConfigUpdate,
  fetchConfigUpdateProperties,
  fetchEnvironmentOptions,
  fetchInstanceApiOptions,
  fetchInstanceAppOptions,
  fetchInstanceOptions,
  fetchProductOptions,
  fetchProductVersionOptions,
  getFreshOverride,
  targetPayload,
} from './configUpdateApi';
import { configUpdateScopes, isConfigUpdateScopeId, scopeById, targetLabel, type ConfigUpdateScopeId, type ConfigUpdateTargetKey } from './configUpdateScopes';
import { currentCommittedValue, displayValue, rowKey, structuredInitialValue, validateAndNormalizeValue } from './configValue';
import type { ConfigTargetOption, ConfigUpdateDraft, ConfigUpdateFilters, ConfigUpdateProperty, ConfigUpdateTarget } from './types';

type UserState = {
  host?: string | null;
};

const propertyTypeOptions = ['Config', 'File', 'Cert'];
const configPhaseOptions = ['G', 'D', 'R'];
const configTypeOptions = ['Module', 'Handler', 'Template'];
const resourceTypeOptions = ['none', 'api', 'app', 'api|app_api', 'app|app_api', 'app_api', 'all'];

function initialScope(searchParams: URLSearchParams): ConfigUpdateScopeId {
  const scope = searchParams.get('scope');
  if (isConfigUpdateScopeId(scope)) return scope;
  if (searchParams.get('productVersionId')) return 'productVersion';
  if (searchParams.get('productId')) return 'product';
  if (searchParams.get('environment')) return 'environment';
  if (searchParams.get('instanceApiId') && searchParams.get('instanceAppId')) return 'appApi';
  if (searchParams.get('instanceApiId')) return 'api';
  if (searchParams.get('instanceAppId')) return 'app';
  return 'instance';
}

function valueSummary(value: unknown) {
  const text = displayValue(value);
  if (!text) return 'Inherited';
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function errorSummary(error: unknown) {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (typeof error !== 'object') return String(error);

  const errorObject = error as Record<string, unknown>;
  const parts = [
    errorObject.message,
    errorObject.description,
    errorObject.code,
    errorObject.status,
  ].filter((value): value is string | number => typeof value === 'string' || typeof value === 'number');

  if (parts.length) return parts.map(String).join(' ');
  try {
    return JSON.stringify(errorObject);
  } catch {
    return 'Unknown error';
  }
}

function draftChip(row: ConfigUpdateProperty, draft?: ConfigUpdateDraft) {
  if (draft?.error) return <Chip size="small" color="error" label="error" />;
  if (draft?.operation === 'reset') return <Chip size="small" color="warning" label="reset" />;
  if (draft) return <Chip size="small" color="info" label="dirty" />;
  if (row.overridden) return <Chip size="small" color="success" label="overridden" />;
  return <Chip size="small" variant="outlined" label="inherited" />;
}

function targetInputKeysForScope(scopeId: ConfigUpdateScopeId): ConfigUpdateTargetKey[] {
  if (scopeId === 'api') return ['instanceId', 'instanceApiId'];
  if (scopeId === 'app') return ['instanceId', 'instanceAppId'];
  if (scopeId === 'appApi') return ['instanceId', 'instanceAppId', 'instanceApiId'];
  return scopeById[scopeId].targetKeys;
}

function selectedTargetOption(options: ConfigTargetOption[], value?: string) {
  if (!value) return null;
  return options.find((option) => option.id === value) ?? { id: value, label: value };
}

export default function ConfigUpdatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);

  const [scopeId, setScopeId] = useState<ConfigUpdateScopeId>(() => initialScope(searchParams));
  const selectedScope = scopeById[scopeId];
  const [target, setTarget] = useState<ConfigUpdateTarget>(() => ({
    environment: searchContext.environment,
    productId: searchContext.productId,
    productVersionId: searchContext.productVersionId,
    instanceId: searchContext.instanceId,
    instanceApiId: searchContext.instanceApiId,
    instanceAppId: searchContext.instanceAppId,
  }));
  const [filters, setFilters] = useState<ConfigUpdateFilters>({
    propertyTypes: ['Config'],
    configPhases: ['R'],
  });
  const [overriddenOnly, setOverriddenOnly] = useState(false);
  const [data, setData] = useState<ConfigUpdateProperty[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [pagination, setPagination] = useState<MRT_PaginationState>({ pageIndex: 0, pageSize: 50 });
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [targetOptions, setTargetOptions] = useState<Partial<Record<ConfigUpdateTargetKey, ConfigTargetOption[]>>>({});
  const [targetOptionsLoading, setTargetOptionsLoading] = useState<Partial<Record<ConfigUpdateTargetKey, boolean>>>({});
  const [targetOptionErrors, setTargetOptionErrors] = useState<Partial<Record<ConfigUpdateTargetKey, string>>>({});
  const [drafts, setDrafts] = useState<Record<string, ConfigUpdateDraft>>({});
  const [applyingRows, setApplyingRows] = useState<Record<string, boolean>>({});
  const [structuredRow, setStructuredRow] = useState<ConfigUpdateProperty | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, {
      hostId: host ?? '',
      environment: target.environment ?? '',
      productId: target.productId ?? '',
      productVersionId: target.productVersionId ?? '',
      instanceId: target.instanceId ?? '',
      instanceApiId: target.instanceApiId ?? '',
      instanceAppId: target.instanceAppId ?? '',
    }),
    [
      host,
      searchContext,
      target.environment,
      target.instanceApiId,
      target.instanceAppId,
      target.instanceId,
      target.productId,
      target.productVersionId,
    ],
  );

  const targetComplete = useMemo(
    () => selectedScope.targetKeys.every((key) => Boolean(target[key])),
    [selectedScope.targetKeys, target],
  );

  const targetInputKeys = useMemo(() => targetInputKeysForScope(scopeId), [scopeId]);

  const draftEntries = useMemo(
    () => Object.entries(drafts).filter(([, draft]) => draft.operation || draft.error),
    [drafts],
  );

  const fetchData = useCallback(async () => {
    if (!host || !targetComplete) return;
    setIsLoading(true);
    setIsError(false);
    setLoadError(null);
    setHasLoaded(false);
    try {
      const result = await fetchConfigUpdateProperties({
        hostId: host,
        scope: scopeId,
        target,
        filters,
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        overriddenOnly,
      });
      setData(result.properties || []);
      setRowCount(result.total || 0);
      setHasLoaded(true);
    } catch (error) {
      console.error('Failed to load config update properties:', error);
      setIsError(true);
      setLoadError(errorSummary(error));
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [filters, host, overriddenOnly, pagination.pageIndex, pagination.pageSize, scopeId, target, targetComplete]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    const loadOptionSet = async (key: ConfigUpdateTargetKey) => {
      if (!host) return;
      if ((key === 'instanceApiId' || key === 'instanceAppId') && !target.instanceId) {
        setTargetOptions((prev) => ({ ...prev, [key]: [] }));
        return;
      }

      setTargetOptionsLoading((prev) => ({ ...prev, [key]: true }));
      setTargetOptionErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      try {
        let options: ConfigTargetOption[] = [];
        if (key === 'environment') options = await fetchEnvironmentOptions(host);
        if (key === 'productId') options = await fetchProductOptions(host);
        if (key === 'productVersionId') options = await fetchProductVersionOptions(host);
        if (key === 'instanceId') options = await fetchInstanceOptions(host);
        if (key === 'instanceApiId' && target.instanceId) options = await fetchInstanceApiOptions(host, target.instanceId);
        if (key === 'instanceAppId' && target.instanceId) options = await fetchInstanceAppOptions(host, target.instanceId);

        if (!cancelled) setTargetOptions((prev) => ({ ...prev, [key]: options }));
      } catch (error) {
        if (!cancelled) {
          setTargetOptions((prev) => ({ ...prev, [key]: [] }));
          setTargetOptionErrors((prev) => ({ ...prev, [key]: errorSummary(error) ?? 'Failed to load options' }));
        }
      } finally {
        if (!cancelled) setTargetOptionsLoading((prev) => ({ ...prev, [key]: false }));
      }
    };

    setTargetOptions((prev) => {
      const next: Partial<Record<ConfigUpdateTargetKey, ConfigTargetOption[]>> = {};
      for (const key of targetInputKeys) next[key] = prev[key] ?? [];
      return next;
    });

    for (const key of targetInputKeys) void loadOptionSet(key);
    return () => {
      cancelled = true;
    };
  }, [host, scopeId, target.instanceId, targetInputKeys]);

  const setTargetValue = (key: keyof ConfigUpdateTarget, value: string) => {
    setTarget((prev) => {
      const next = { ...prev, [key]: value.trim() || undefined };
      if (key === 'instanceId' && scopeId !== 'instance') {
        next.instanceApiId = undefined;
        next.instanceAppId = undefined;
      }
      return next;
    });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setHasLoaded(false);
  };

  const setMultiFilter = (key: keyof ConfigUpdateFilters) => (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setFilters((prev) => ({
      ...prev,
      [key]: typeof value === 'string' ? value.split(',').filter(Boolean) : value,
    }));
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setHasLoaded(false);
  };

  const clearDraft = (key: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const stageValue = (row: ConfigUpdateProperty, rawValue: string) => {
    const key = rowKey(row);
    const normalized = validateAndNormalizeValue(row.valueType, rawValue);
    if (normalized.error) {
      setDrafts((prev) => ({
        ...prev,
        [key]: {
          operation: row.overridden ? 'update' : 'create',
          nextValue: rawValue,
          previousValue: currentCommittedValue(row),
          error: normalized.error,
        },
      }));
      return;
    }

    const nextValue = normalized.value ?? '';
    const committedOverride = row.overrideValue ?? '';
    if (row.overridden && nextValue === committedOverride) {
      clearDraft(key);
      return;
    }
    if (!row.overridden && nextValue === '') {
      clearDraft(key);
      return;
    }

    setDrafts((prev) => ({
      ...prev,
      [key]: {
        operation: row.overridden ? 'update' : 'create',
        nextValue,
        previousValue: currentCommittedValue(row),
      },
    }));
  };

  const stageReset = (row: ConfigUpdateProperty) => {
    if (row.canDeleteOverride === false) return;

    setDrafts((prev) => ({
      ...prev,
      [rowKey(row)]: {
        operation: 'reset',
        previousValue: row.overrideValue ?? null,
      },
    }));
  };

  const applyDraft = useCallback(async (row: ConfigUpdateProperty) => {
    const key = rowKey(row);
    const draft = drafts[key];
    if (!draft || draft.error) return;

    setApplyingRows((prev) => ({ ...prev, [key]: true }));
    try {
      let rowForApply = row;
      if ((draft.operation === 'update' || draft.operation === 'reset') && row.overridden) {
        const fresh = await getFreshOverride(row);
        if (fresh) {
          rowForApply = {
            ...row,
            overrideValue: fresh.propertyValue,
            overrideAggregateVersion: fresh.aggregateVersion,
          };
        }
      }

      const operation = draft.operation === 'reset'
        ? 'reset'
        : rowForApply.overridden
          ? 'update'
          : 'create';

      await applyConfigUpdate(rowForApply, operation, draft.nextValue);
      clearDraft(key);
      setNotice('Config change applied.');
      await fetchData();
    } catch (error: any) {
      console.error('Failed to apply config update:', error);
      setDrafts((prev) => ({
        ...prev,
        [key]: {
          ...draft,
          error: error?.description || error?.message || 'Apply failed.',
        },
      }));
    } finally {
      setApplyingRows((prev) => ({ ...prev, [key]: false }));
    }
  }, [drafts, fetchData]);

  const applyAllDrafts = async () => {
    for (const [key, draft] of draftEntries) {
      if (draft.error) continue;
      const row = data.find((item) => rowKey(item) === key);
      if (row) {
        await applyDraft(row);
      }
    }
    setReviewOpen(false);
  };

  const openFallbackForm = (row: ConfigUpdateProperty) => {
    if (draftEntries.length > 0 && !window.confirm('Open the generated form and discard unapplied staged changes?')) {
      return;
    }

    const formId = row.overridden ? selectedScope.updateForm : selectedScope.createForm;
    const payload = {
      ...row,
      ...targetPayload(row),
      propertyValue: row.overrideValue ?? '',
      aggregateVersion: row.overrideAggregateVersion,
    };
    navigate(
      buildTaskAwareRoute(`/app/form/${formId}`, searchParams, {
        ...taskContext,
        configId: row.configId,
        propertyId: row.propertyId,
      }),
      { state: { data: payload, source: location.pathname } },
    );
  };

  const copyIdentifiers = async (row: ConfigUpdateProperty) => {
    const text = JSON.stringify({
      scope: row.scope,
      hostId: row.hostId,
      environment: row.environment,
      productId: row.productId,
      productVersionId: row.productVersionId,
      productVersion: row.productVersion,
      instanceId: row.instanceId,
      instanceApiId: row.instanceApiId,
      instanceAppId: row.instanceAppId,
      configId: row.configId,
      propertyId: row.propertyId,
    }, null, 2);
    await navigator.clipboard?.writeText(text);
    setNotice('Identifiers copied.');
  };

  const renderValueEditor = (row: ConfigUpdateProperty) => {
    const key = rowKey(row);
    const draft = drafts[key];
    const type = (row.valueType || 'string').toLowerCase();
    const disabled = row.canUpdate === false || row.propertyType === 'File' || row.propertyType === 'Cert';
    const stagedValue = draft?.operation === 'reset'
      ? ''
      : draft?.nextValue ?? row.overrideValue ?? '';

    if (row.propertyType === 'File' || row.propertyType === 'Cert') {
      return (
        <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => openFallbackForm(row)}>
          Open Form
        </Button>
      );
    }

    if (type === 'list' || type === 'map') {
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant={draft ? 'contained' : 'outlined'}
            startIcon={<CodeIcon />}
            disabled={disabled}
            onClick={() => setStructuredRow(row)}
          >
            Edit
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {valueSummary(draft?.nextValue ?? row.overrideValue)}
          </Typography>
        </Stack>
      );
    }

    if (type === 'boolean') {
      return (
        <Select
          size="small"
          displayEmpty
          value={stagedValue}
          disabled={disabled}
          onChange={(event) => stageValue(row, event.target.value)}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value=""><em>Inherited</em></MenuItem>
          <MenuItem value="true">true</MenuItem>
          <MenuItem value="false">false</MenuItem>
        </Select>
      );
    }

    return (
      <TextField
        size="small"
        value={stagedValue}
        disabled={disabled}
        placeholder={valueSummary(row.effectiveValue)}
        onChange={(event) => stageValue(row, event.target.value)}
        error={Boolean(draft?.error)}
        helperText={draft?.error}
        sx={{ minWidth: 260 }}
      />
    );
  };

  const columns = useMemo<MRT_ColumnDef<ConfigUpdateProperty>[]>(
    () => [
      { accessorKey: 'configName', header: 'Config', size: 220 },
      { accessorKey: 'propertyName', header: 'Property', size: 240 },
      { accessorKey: 'valueType', header: 'Type', size: 90 },
      {
        accessorKey: 'inheritedValue',
        header: 'Inherited',
        size: 240,
        Cell: ({ row }) => (
          <Tooltip title={displayValue(row.original.inheritedValue)}>
            <Typography variant="body2" noWrap sx={{ maxWidth: 260 }}>
              {valueSummary(row.original.inheritedValue)}
            </Typography>
          </Tooltip>
        ),
      },
      {
        id: 'overrideEditor',
        header: 'Override',
        size: 360,
        Cell: ({ row }) => renderValueEditor(row.original),
      },
      {
        accessorKey: 'effectiveSourceType',
        header: 'Source',
        size: 150,
        Cell: ({ row }) => row.original.effectiveSourceType || row.original.propertySourceType || '',
      },
      {
        id: 'status',
        header: 'Status',
        size: 120,
        Cell: ({ row }) => draftChip(row.original, drafts[rowKey(row.original)]),
      },
      { accessorKey: 'required', header: 'Required', size: 90, Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No') },
      { accessorKey: 'resourceType', header: 'Resource', size: 120 },
      { accessorKey: 'configPhase', header: 'Phase', size: 90 },
      {
        accessorKey: 'propertyDesc',
        header: 'Description',
        size: 280,
        Cell: ({ cell }) => (
          <Tooltip title={displayValue(cell.getValue())}>
            <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
              {valueSummary(cell.getValue())}
            </Typography>
          </Tooltip>
        ),
      },
    ],
    [drafts],
  );

  const tableState = {
    isLoading,
    showAlertBanner: isError,
    pagination,
  };

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', lg: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Scope</InputLabel>
            <Select
              label="Scope"
              value={scopeId}
              onChange={(event) => {
                setScopeId(event.target.value as ConfigUpdateScopeId);
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                setHasLoaded(false);
              }}
            >
              {configUpdateScopes.map((scope) => (
                <MenuItem key={scope.id} value={scope.id}>{scope.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {targetInputKeys.map((key) => {
            const options = targetOptions[key] ?? [];
            const loading = Boolean(targetOptionsLoading[key]);
            const value = selectedTargetOption(options, target[key]);
            const dependsOnInstance = key === 'instanceApiId' || key === 'instanceAppId';
            const disabled = !host;
            const optionError = targetOptionErrors[key];

            return (
              <Autocomplete
                key={key}
                freeSolo
                size="small"
                options={options}
                value={value}
                loading={loading}
                disabled={disabled}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
                isOptionEqualToValue={(option, selected) => option.id === (typeof selected === 'string' ? selected : selected.id)}
                onChange={(_, nextValue) => {
                  if (typeof nextValue === 'string') {
                    setTargetValue(key, nextValue);
                  } else {
                    setTargetValue(key, nextValue?.id ?? '');
                  }
                }}
                onInputChange={(_, nextInput, reason) => {
                  if (reason === 'input' || reason === 'clear') setTargetValue(key, nextInput);
                }}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box>
                      <Typography variant="body2">{option.label}</Typography>
                      {option.label !== option.id && (
                        <Typography variant="caption" color="text.secondary">{option.id}</Typography>
                      )}
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={targetLabel(key)}
                    helperText={optionError ?? (dependsOnInstance && !target.instanceId ? 'Select an instance to load options.' : undefined)}
                    error={Boolean(optionError)}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loading ? <CircularProgress color="inherit" size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                sx={{ minWidth: 320 }}
              />
            );
          })}

          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={fetchData} disabled={!targetComplete || !host || isLoading}>
            Refresh
          </Button>
          <Button startIcon={<SaveIcon />} variant="contained" onClick={() => setReviewOpen(true)} disabled={draftEntries.length === 0}>
            Review & Apply ({draftEntries.length})
          </Button>
        </Stack>

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', lg: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Property Type</InputLabel>
            <Select multiple label="Property Type" value={filters.propertyTypes ?? []} onChange={setMultiFilter('propertyTypes')}>
              {propertyTypeOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Phase</InputLabel>
            <Select multiple label="Phase" value={filters.configPhases ?? []} onChange={setMultiFilter('configPhases')}>
              {configPhaseOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Config Type</InputLabel>
            <Select multiple label="Config Type" value={filters.configTypes ?? []} onChange={setMultiFilter('configTypes')}>
              {configTypeOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Resource Type</InputLabel>
            <Select multiple label="Resource Type" value={filters.resourceTypes ?? []} onChange={setMultiFilter('resourceTypes')}>
              {resourceTypeOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Checkbox checked={overriddenOnly} onChange={(event) => {
              setOverriddenOnly(event.target.checked);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              setHasLoaded(false);
            }} />}
            label="Overridden only"
          />
        </Stack>

        {!targetComplete && (
          <Alert severity="info">
            Select a scope and enter the required target ID values to load configurable properties.
          </Alert>
        )}

        {targetComplete && hasLoaded && !isLoading && !isError && data.length === 0 && (
          <Alert severity="info">
            No applicable config properties were found for this scope and target. For instance, API, app, and app API scopes, verify the product version has config and config property assignments.
          </Alert>
        )}

        <MaterialReactTable
          columns={columns}
          data={data}
          enableGrouping
          enableColumnResizing
          enableRowActions
          manualPagination
          rowCount={rowCount}
          onPaginationChange={setPagination}
          state={tableState}
          initialState={{ density: 'compact', grouping: ['configName'], expanded: true }}
          getRowId={(row) => rowKey(row)}
          muiToolbarAlertBannerProps={isError ? {
            color: 'error',
            children: loadError ? `Error loading config update properties: ${loadError}` : 'Error loading config update properties',
          } : undefined}
          renderRowActions={({ row }: { row: MRT_Row<ConfigUpdateProperty> }) => {
            const key = rowKey(row.original);
            const draft = drafts[key];
            const applying = applyingRows[key];
            return (
              <Stack direction="row" spacing={0.25}>
                <Tooltip title="Apply row">
                  <span>
                    <IconButton size="small" disabled={!draft || Boolean(draft.error) || applying} onClick={() => applyDraft(row.original)}>
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Reset override">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!row.original.overridden || row.original.canDeleteOverride === false || applying}
                      onClick={() => stageReset(row.original)}
                    >
                      <RestartAltIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Discard draft">
                  <span>
                    <IconButton size="small" disabled={!draft || applying} onClick={() => clearDraft(key)}>
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Open fallback form">
                  <IconButton size="small" onClick={() => openFallbackForm(row.original)}>
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy identifiers">
                  <IconButton size="small" onClick={() => copyIdentifiers(row.original)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            );
          }}
        />
      </Stack>

      <ConfigStructuredValueDialog
        open={Boolean(structuredRow)}
        row={structuredRow}
        value={structuredRow ? drafts[rowKey(structuredRow)]?.nextValue ?? structuredRow.overrideValue ?? structuredInitialValue(structuredRow.valueType, structuredRow.effectiveValue) : ''}
        onClose={() => setStructuredRow(null)}
        onSave={(value) => {
          if (structuredRow) stageValue(structuredRow, value);
          setStructuredRow(null);
        }}
      />

      <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Review Config Changes</DialogTitle>
        <DialogContent>
          {draftEntries.length === 0 ? (
            <Typography color="text.secondary">No staged changes.</Typography>
          ) : (
            <Stack spacing={1}>
              {draftEntries.map(([key, draft]) => {
                const row = data.find((item) => rowKey(item) === key);
                if (!row) return null;
                return (
                  <Box key={key} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {draftChip(row, draft)}
                      <Typography variant="subtitle2">{row.configName} / {row.propertyName}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {draft.operation === 'reset' ? 'Remove override and inherit value.' : `${valueSummary(draft.previousValue)} -> ${valueSummary(draft.nextValue)}`}
                    </Typography>
                    {draft.error && <Alert severity="error" sx={{ mt: 1 }}>{draft.error}</Alert>}
                  </Box>
                );
              })}
            </Stack>
          )}
          <Divider sx={{ mt: 2 }} />
          <Typography variant="caption" color="text.secondary">
            Changes are applied one row at a time through the existing config-command APIs.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<SaveIcon />} disabled={draftEntries.length === 0} onClick={applyAllDrafts}>
            Apply Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice(null)}>
        <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert>
      </Snackbar>
    </Box>
  );
}
