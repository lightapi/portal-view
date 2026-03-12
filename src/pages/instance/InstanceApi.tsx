import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import RouteIcon from "@mui/icons-material/Route";
import CodeOffIcon from '@mui/icons-material/CodeOff';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type InstanceApiApiResponse = {
  instanceApis: Array<InstanceApiType>;
  total: number;
};

type InstanceApiType = {
  hostId: string;
  instanceApiId: string;
  instanceId: string;
  instanceName?: string;
  productId?: string;
  productVersion?: string;
  serviceId?: string;
  apiType?: string;
  protocol?: string;
  envTag?: string;
  targetHost?: string;
  apiVersionId: string;
  apiId?: string;
  apiVersion?: string;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

export default function InstanceApi() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as { host: string };
  const initialData = location.state?.data || {};

  // Data and fetching state
  const [data, setData] = useState<InstanceApiType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
    const initialFilters: MRT_ColumnFiltersState = [
      { id: 'active', value: 'true' } // Default to active
    ];
    if (initialData.instanceApiId) initialFilters.push({ id: 'instanceApiId', value: initialData.instanceApiId });
    if (initialData.instanceId) initialFilters.push({ id: 'instanceId', value: initialData.instanceId });
    if (initialData.apiVersionId) initialFilters.push({ id: 'apiVersionId', value: initialData.apiVersionId });
    return initialFilters;
  });
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    let activeStatus = true; // Default to true if not present
    const apiFilters: MRT_ColumnFiltersState = [];

    columnFilters.forEach(filter => {
      if (filter.id === 'active') {
        // Extract active status (assuming filter.value is 'true'/'false' string from select)
        activeStatus = filter.value === 'true' || filter.value === true;
      } else {
        // Keep other filters as is
        apiFilters.push(filter);
      }
    });

    const cmd = {
      host: 'lightapi.net',
      service: 'instance',
      action: 'getInstanceApi',
      version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(apiFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const json = await fetchClient(url);
      setData(json.instanceApis || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, data.length]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<InstanceApiType>) => {
    if (!window.confirm(`Are you sure you want to delete instance API ${row.original.instanceApiId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(item => item.instanceApiId !== row.original.instanceApiId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'deleteInstanceApi', version: '0.1.0',
      data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete instance API. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete instance API due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<InstanceApiType>[]>(
    () => [
      { accessorKey: 'instanceApiId', header: 'Instance API Id' },
      { accessorKey: 'instanceName', header: 'Instance Name' },
      { accessorKey: 'productId', header: 'Product Id' },
      { accessorKey: 'serviceId', header: 'Service Id' },
      { accessorKey: 'apiId', header: 'API Id' },
      { accessorKey: 'apiVersion', header: 'API Version' },
      { accessorKey: 'apiType', header: 'API Type' },
      { accessorKey: 'protocol', header: 'Protocol' },
      { accessorKey: 'envTag', header: 'Env Tag' },
      { accessorKey: 'targetHost', header: 'Target Host' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'updateUser', header: 'Update User' },
      {
        accessorKey: 'updateTs',
        header: 'Update Time',
        Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
      },
      { accessorKey: 'aggregateVersion', header: 'AggregateVersion' },
    ],
    [navigate],
  );

  // Table instance configuration
  const table = useMaterialReactTable({
    columns,
    data,
    initialState: { showColumnFilters: true, density: 'compact' },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: { isLoading, showAlertBanner: isError, showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.instanceApiId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.1rem' }}>
        <Tooltip title="Delete Instance API">
          <IconButton color="error" onClick={() => handleDelete(row)}>
            <DeleteForeverIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Instnace Api Config">
          <IconButton color="primary" onClick={() => navigate('/app/config/configInstanceApi', { state: { data: { instanceApiId: row.original.instanceApiId, instanceId: row.original.instanceId, apiId: row.original.apiId, apiVersion: row.original.apiVersion } } })}>
            <AddToDriveIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Api Path Prefix">
          <IconButton color="primary" onClick={() => navigate('/app/instance/instanceApiPathPrefix', { state: { data: { instanceApiId: row.original.instanceApiId, instanceName: row.original.instanceName, productId: row.original.productId, apiId: row.original.apiId, apiVersion: row.original.apiVersion } } })}>
            <RouteIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Instance Api MCP Tool">
          <IconButton color="primary" onClick={() => navigate('/app/instance/instanceApiMcpTool', { state: { data: { instanceApiId: row.original.instanceApiId, instanceName: row.original.instanceName, productId: row.original.productId, apiId: row.original.apiId, apiVersion: row.original.apiVersion, apiVersionId: row.original.apiVersionId, serviceId: row.original.serviceId, apiType: row.original.apiType, protocol: row.original.protocol, envTag: row.original.envTag, targetHost: row.original.targetHost } } })}>
            <CodeOffIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createInstanceApi', { state: { data: initialData } })}
          disabled={!initialData.instanceId && !initialData.apiVersionId}
        >
          Create New Instance Api
        </Button>
        {initialData.instanceId && (
          <Typography variant="subtitle1">
            For Instance: <strong>{initialData.instanceId}</strong>
          </Typography>
        )}
        {initialData.apiVersionId && (
          <Typography variant="subtitle1">
            For API Version: <strong>{initialData.apiVersionId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
