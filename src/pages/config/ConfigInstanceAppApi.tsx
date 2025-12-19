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
import { Box, Button, IconButton, Tooltip, Typography, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';

// --- Type Definitions ---
type ConfigInstanceAppApiApiResponse = {
  instanceAppApis: Array<ConfigInstanceAppApiType>;
  total: number;
};

type ConfigInstanceAppApiType = {
  hostId: string;
  instanceAppId: string;
  instanceApiId: string;
  instanceId: string;
  instanceName: string;
  appId: string;
  appVersion: string;
  apiVersionId: string;
  apiId: string;
  apiVersion: string;
  configId: string;
  configName: string;
  propertyId: string;
  propertyName: string;
  propertyValue?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

interface UserState {
  host?: string;
}

const TruncatedCell = <T extends MRT_RowData>({ cell }: { cell: MRT_Cell<T, unknown> }) => {
  const value = cell.getValue<string>() ?? '';
  return (
    <Tooltip title={value} placement="top-start">
      <Box component="span" sx={{ display: 'block', maxWidth: '200px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {value}
      </Box>
    </Tooltip>
  );
};

export default function ConfigInstanceAppApi() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const initialConfigId = location.state?.data?.configId;
  const initialInstanceAppId = location.state?.data?.instanceAppId;
  const initialInstanceApiId = location.state?.data?.instanceApiId;

  // Data and fetching state
  const [data, setData] = useState<ConfigInstanceAppApiType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
    const initialFilters: MRT_ColumnFiltersState = [
      { id: 'active', value: 'true' }
    ];
    if (initialInstanceAppId) initialFilters.push({ id: 'instanceAppId', value: initialInstanceAppId });
    if (initialInstanceApiId) initialFilters.push({ id: 'instanceApiId', value: initialInstanceApiId });
    if (initialConfigId) initialFilters.push({ id: 'configId', value: initialConfigId });
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
      host: 'lightapi.net', service: 'config', action: 'getConfigInstanceAppApi', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(apiFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as ConfigInstanceAppApiApiResponse;
      setData(json.instanceAppApis || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<ConfigInstanceAppApiType>) => {
    if (!window.confirm(`Are you sure you want to delete this instance app api property?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(item => !(
      item.instanceAppId === row.original.instanceAppId &&
      item.instanceApiId === row.original.instanceApiId &&
      item.propertyId === row.original.propertyId
    )));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'config', action: 'deleteConfigInstanceAppApi', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete property. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete property due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<ConfigInstanceAppApiType>) => {
    const propertyId = row.original.propertyId;
    setIsUpdateLoading(propertyId);

    const cmd = {
      host: 'lightapi.net', service: 'config', action: 'getFreshConfigInstanceAppApi', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const freshData = await response.json();
      console.log("freshData", freshData);
      if (!response.ok) {
        throw new Error(freshData.description || 'Failed to fetch latest config instance app api property data.');
      }

      // Navigate with the fresh data
      navigate('/app/form/updateConfigInstanceAppApi', {
        state: {
          data: freshData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch config instance app api property for update:", error);
      alert("Could not load the latest config instance app api property data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ConfigInstanceAppApiType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'instanceAppId', header: 'Instance App Id' },
      { accessorKey: 'instanceApiId', header: 'Instance Api Id' },
      { accessorKey: 'configId', header: 'Config Id' },
      { accessorKey: 'configName', header: 'Config Name' },
      { accessorKey: 'propertyId', header: 'Property Id' },
      { accessorKey: 'propertyName', header: 'Property Name' },
      {
        accessorKey: 'propertyValue',
        header: 'Property Value',
        Cell: TruncatedCell,
        muiTableBodyCellProps: { sx: { maxWidth: '200px' } }
      },
      { accessorKey: 'updateUser', header: 'Update User' },
      {
        accessorKey: 'updateTs',
        header: 'Update Time',
        Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
      },
      { accessorKey: 'aggregateVersion', header: 'AggregateVersion' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Tooltip title="Update Property">
            <IconButton
              onClick={() => handleUpdate(row)}
              disabled={isUpdateLoading === row.original.propertyId}
            >
              {isUpdateLoading === row.original.propertyId ? (
                <CircularProgress size={22} />
              ) : (
                <SystemUpdateIcon />
              )}
            </IconButton>
          </Tooltip>
        )
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Delete Property"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
    ],
    [handleDelete, navigate],
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
    getRowId: (row) => `${row.instanceAppId}-${row.instanceApiId}-${row.propertyId}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createConfigInstanceAppApi', { state: { data: { instanceApiId: initialInstanceApiId, instanceAppId: initialInstanceAppId, configId: initialConfigId } } })}
          disabled={!initialConfigId && !initialInstanceApiId && !initialInstanceAppId}
        >
          Add Property to Instance App Api
        </Button>
        {initialConfigId && (
          <Typography variant="subtitle1">
            For Config: <strong>{initialConfigId}</strong>
          </Typography>
        )}
        {initialInstanceAppId && (
          <Typography variant="subtitle1">
            For Instance App: <strong>{initialInstanceAppId}</strong>
          </Typography>
        )}
        {initialInstanceApiId && (
          <Typography variant="subtitle1">
            For Instance Api: <strong>{initialInstanceApiId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
