import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_RowSelectionState,
} from 'material-react-table';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import BatchPredictionIcon from '@mui/icons-material/BatchPrediction';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import fetchClient from '../../utils/fetchClient';
import { useUserState } from '../../contexts/UserContext';
import ServiceEndpointAccessOverviewDrawer from '../service/ServiceEndpointAccessOverviewDrawer';
import ServiceEndpointBulkAccessDrawer from '../service/ServiceEndpointBulkAccessDrawer';
import type { EndpointType } from '../service/ServiceEndpoint';

type UserState = {
  host?: string;
};

type ServiceRecord = {
  hostId: string;
  apiId: string;
  apiName?: string;
  apiDesc?: string;
  active?: boolean;
};

type ApiVersionRecord = {
  hostId: string;
  apiId: string;
  apiVersionId: string;
  apiVersion: string;
  active?: boolean;
};

type PrincipalType = 'roles' | 'users';

type PrincipalSummary = {
  endpointId: string;
  endpoint: string;
  httpMethod: string;
  endpointPath: string;
  permission: boolean;
  rowFilters: number;
  columnFilters: number;
  rules: string[];
};

const PRINCIPAL_CONFIG: Record<PrincipalType, { label: string; idKey: string; helper: string }> = {
  roles: {
    label: 'Role',
    idKey: 'roleId',
    helper: 'Shows endpoint grants and filters attached to the selected role.',
  },
  users: {
    label: 'User',
    idKey: 'userId',
    helper: 'Shows direct endpoint grants and filters attached to the selected user.',
  },
};

const textValue = (value: unknown) => (typeof value === 'string' ? value : '');

const truncateCell = ({ cell }: { cell: { getValue: () => unknown } }) => {
  const value = String(cell.getValue() ?? '');
  return (
    <Tooltip title={value} placement="top-start">
      <Box component="span" sx={{ display: 'block', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </Box>
    </Tooltip>
  );
};

export default function AccessAdmin() {
  const { host } = useUserState() as UserState;
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [versions, setVersions] = useState<ApiVersionRecord[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointType[]>([]);
  const [selectedApiId, setSelectedApiId] = useState('');
  const [selectedApiVersionId, setSelectedApiVersionId] = useState('');
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [bulkAccessOpen, setBulkAccessOpen] = useState(false);
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);
  const [principalType, setPrincipalType] = useState<PrincipalType>('roles');
  const [principalId, setPrincipalId] = useState('');
  const [overview, setOverview] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedEndpoints = useMemo(
    () => endpoints.filter((endpoint) => rowSelection[endpoint.endpointId]),
    [endpoints, rowSelection],
  );

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    const loadServices = async () => {
      setError('');
      const cmd = {
        host: 'lightapi.net',
        service: 'service',
        action: 'getApi',
        version: '0.1.0',
        data: {
          hostId: host,
          offset: 0,
          limit: 1000,
          sorting: JSON.stringify([{ id: 'apiId', desc: false }]),
          filters: JSON.stringify([]),
          globalFilter: '',
          active: true,
        },
      };
      try {
        const json = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
        if (cancelled) return;
        const rows = Array.isArray(json?.services) ? json.services as ServiceRecord[] : [];
        const portalServices = rows.filter((service) => textValue(service.apiId).startsWith('LPS'));
        setServices(portalServices);
        setSelectedApiId((current) => current || portalServices[0]?.apiId || '');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load portal handler services.');
      }
    };
    loadServices();
    return () => { cancelled = true; };
  }, [host]);

  useEffect(() => {
    if (!host || !selectedApiId) {
      setVersions([]);
      setSelectedApiVersionId('');
      return;
    }
    let cancelled = false;
    const loadVersions = async () => {
      const cmd = {
        host: 'lightapi.net',
        service: 'service',
        action: 'getApiVersion',
        version: '0.1.0',
        data: {
          hostId: host,
          apiId: selectedApiId,
          active: true,
        },
      };
      try {
        const json = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
        if (cancelled) return;
        const rows = Array.isArray(json) ? json as ApiVersionRecord[] : (Array.isArray(json?.apiVersions) ? json.apiVersions as ApiVersionRecord[] : []);
        setVersions(rows);
        setSelectedApiVersionId((current) => rows.some((version) => version.apiVersionId === current) ? current : rows[0]?.apiVersionId ?? '');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load API versions.');
      }
    };
    loadVersions();
    return () => { cancelled = true; };
  }, [host, selectedApiId]);

  const loadEndpoints = useCallback(async () => {
    if (!host || !selectedApiVersionId) {
      setEndpoints([]);
      return;
    }
    setLoading(true);
    setError('');
    const cmd = {
      host: 'lightapi.net',
      service: 'service',
      action: 'getApiEndpoint',
      version: '0.1.0',
      data: {
        hostId: host,
        offset: 0,
        limit: 1000,
        sorting: JSON.stringify([{ id: 'endpoint', desc: false }]),
        filters: JSON.stringify([{ id: 'apiVersionId', value: selectedApiVersionId }]),
        globalFilter: '',
        active: true,
      },
    };
    try {
      const json = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
      setEndpoints(Array.isArray(json?.endpoints) ? json.endpoints : []);
      setRowSelection({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load portal handlers.');
    } finally {
      setLoading(false);
    }
  }, [host, selectedApiVersionId]);

  useEffect(() => {
    loadEndpoints();
  }, [loadEndpoints]);

  useEffect(() => {
    if (!host || !selectedApiVersionId) {
      setOverview([]);
      return;
    }
    let cancelled = false;
    const loadOverview = async () => {
      const cmd = {
        host: 'lightapi.net',
        service: 'service',
        action: 'getApiEndpointAccessOverview',
        version: '0.1.0',
        data: { hostId: host, apiVersionId: selectedApiVersionId, active: true },
      };
      try {
        const json = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
        if (!cancelled) setOverview(Array.isArray(json?.endpoints) ? json.endpoints : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load effective access overview.');
      }
    };
    loadOverview();
    return () => { cancelled = true; };
  }, [host, overviewRefreshKey, selectedApiVersionId]);

  const principalSummary = useMemo<PrincipalSummary[]>(() => {
    const idKey = PRINCIPAL_CONFIG[principalType].idKey;
    const selected = principalId.trim();
    if (!selected) return [];
    return overview.map((endpoint) => {
      const permissions = bucketItems(endpoint, 'permissions', principalType);
      const rowFilters = bucketItems(endpoint, 'rowFilters', principalType);
      const columnFilters = bucketItems(endpoint, 'columnFilters', principalType);
      const rules = Object.entries((endpoint.rules as Record<string, string[]> | undefined) ?? {})
        .flatMap(([ruleType, ruleIds]) => ruleIds.map((ruleId) => `${ruleType}: ${ruleId}`));
      return {
        endpointId: textValue(endpoint.endpointId),
        endpoint: textValue(endpoint.endpoint),
        httpMethod: textValue(endpoint.httpMethod),
        endpointPath: textValue(endpoint.endpointPath),
        permission: permissions.some((item) => textValue(item[idKey]) === selected),
        rowFilters: rowFilters.filter((item) => textValue(item[idKey]) === selected).length,
        columnFilters: columnFilters.filter((item) => textValue(item[idKey]) === selected).length,
        rules,
      };
    }).filter((item) => item.permission || item.rowFilters > 0 || item.columnFilters > 0);
  }, [overview, principalId, principalType]);

  const endpointColumns = useMemo<MRT_ColumnDef<EndpointType>[]>(
    () => [
      { accessorKey: 'endpoint', header: 'Logical Handler', Cell: truncateCell },
      { accessorKey: 'httpMethod', header: 'Method', size: 90 },
      { accessorKey: 'endpointPath', header: 'Transport Path', size: 140 },
      { accessorKey: 'sourceProtocol', header: 'Source', size: 120 },
      { accessorKey: 'sensitivityTier', header: 'Sensitivity', size: 120 },
      { accessorKey: 'endpointDesc', header: 'Description', Cell: truncateCell },
    ],
    [],
  );

  const summaryColumns = useMemo<MRT_ColumnDef<PrincipalSummary>[]>(
    () => [
      { accessorKey: 'endpoint', header: 'Logical Handler', Cell: truncateCell },
      { accessorKey: 'httpMethod', header: 'Method', size: 90 },
      { accessorKey: 'endpointPath', header: 'Transport Path' },
      {
        accessorKey: 'permission',
        header: 'Request Access',
        Cell: ({ cell }) => cell.getValue<boolean>() ? 'Allowed' : 'No direct grant',
      },
      { accessorKey: 'rowFilters', header: 'Row Filters', size: 110 },
      { accessorKey: 'columnFilters', header: 'Column Filters', size: 130 },
      {
        accessorKey: 'rules',
        header: 'Rules',
        Cell: ({ row }) => row.original.rules.length ? row.original.rules.join(', ') : 'None',
      },
    ],
    [],
  );

  const endpointTable = useMaterialReactTable({
    columns: endpointColumns,
    data: endpoints,
    enableRowSelection: true,
    enableRowActions: false,
    getRowId: (row) => row.endpointId,
    state: { isLoading: loading, rowSelection },
    onRowSelectionChange: setRowSelection,
    initialState: { density: 'compact', showGlobalFilter: true },
    renderTopToolbarCustomActions: () => (
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button
          variant="contained"
          size="small"
          startIcon={<BatchPredictionIcon />}
          disabled={selectedEndpoints.length === 0}
          onClick={() => setBulkAccessOpen(true)}
        >
          Bulk Access
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FactCheckIcon />}
          disabled={!selectedApiVersionId}
          onClick={() => setOverviewOpen(true)}
        >
          Policy Overview
        </Button>
      </Stack>
    ),
  });

  const summaryTable = useMaterialReactTable({
    columns: summaryColumns,
    data: principalSummary,
    enableRowSelection: false,
    initialState: { density: 'compact' },
  });

  const handleBulkSuccess = useCallback(() => {
    setBulkAccessOpen(false);
    setRowSelection({});
    setOverviewRefreshKey((value) => value + 1);
    loadEndpoints();
  }, [loadEndpoints]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Access Admin</Typography>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Portal Handler Catalog</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 280 } }}>
              <InputLabel id="portal-service-label">Service API</InputLabel>
              <Select
                labelId="portal-service-label"
                label="Service API"
                value={selectedApiId}
                onChange={(event) => setSelectedApiId(event.target.value)}
              >
                {services.map((service) => (
                  <MenuItem key={service.apiId} value={service.apiId}>
                    {service.apiId}{service.apiName ? ` - ${service.apiName}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 220 } }}>
              <InputLabel id="portal-version-label">Version</InputLabel>
              <Select
                labelId="portal-version-label"
                label="Version"
                value={selectedApiVersionId}
                onChange={(event) => setSelectedApiVersionId(event.target.value)}
              >
                {versions.map((version) => (
                  <MenuItem key={version.apiVersionId} value={version.apiVersionId}>
                    {version.apiVersion}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Chip label={`${endpoints.length} handlers`} sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }} />
          </Stack>
          <MaterialReactTable table={endpointTable} />
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Effective Access</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="principal-type-label">Principal</InputLabel>
              <Select
                labelId="principal-type-label"
                label="Principal"
                value={principalType}
                onChange={(event) => setPrincipalType(event.target.value as PrincipalType)}
              >
                <MenuItem value="roles">Role</MenuItem>
                <MenuItem value="users">User</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label={`${PRINCIPAL_CONFIG[principalType].label} ID`}
              value={principalId}
              onChange={(event) => setPrincipalId(event.target.value)}
              sx={{ minWidth: { xs: '100%', md: 320 } }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {PRINCIPAL_CONFIG[principalType].helper}
            </Typography>
          </Stack>
          <MaterialReactTable table={summaryTable} />
        </Box>
      </Stack>

      <ServiceEndpointBulkAccessDrawer
        open={bulkAccessOpen}
        hostId={host ?? ''}
        apiVersionId={selectedApiVersionId}
        endpoints={selectedEndpoints}
        onClose={() => setBulkAccessOpen(false)}
        onSuccess={handleBulkSuccess}
      />
      <ServiceEndpointAccessOverviewDrawer
        open={overviewOpen}
        hostId={host ?? ''}
        apiVersionId={selectedApiVersionId}
        refreshKey={overviewRefreshKey}
        highlightedEndpointIds={selectedEndpoints.map((endpoint) => endpoint.endpointId)}
        onClose={() => setOverviewOpen(false)}
      />
    </Box>
  );
}

function bucketItems(endpoint: Record<string, unknown>, section: string, bucket: string) {
  const sectionValue = endpoint[section];
  if (!sectionValue || typeof sectionValue !== 'object' || Array.isArray(sectionValue)) return [];
  const items = (sectionValue as Record<string, unknown>)[bucket];
  return Array.isArray(items) ? items as Array<Record<string, unknown>> : [];
}
