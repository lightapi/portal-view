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
import SyncIcon from '@mui/icons-material/Sync';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';

// --- Type Definitions ---
type ConfigInstanceApiApiResponse = {
  instanceApis: Array<ConfigInstanceApiType>;
  total: number;
};

type ConfigInstanceApiType = {
  hostId: string;
  instanceApiId: string;
  instanceId: string;
  instanceName: string;
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

export default function ConfigInstanceApi() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const initialConfigId = location.state?.data?.configId;
  const initialInstanceId = location.state?.data?.instanceId;
  const initialInstanceApiId = location.state?.data?.instanceApiId;
  const initialApiId = location.state?.data?.apiId;
  const initialApiVersion = location.state?.data?.apiVersion;

  // Data and fetching state
  const [data, setData] = useState<ConfigInstanceApiType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);
  const [isSyncLoading, setIsSyncLoading] = useState(false);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
    const initialFilters: MRT_ColumnFiltersState = [
      { id: 'active', value: 'true' }
    ];
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
      host: 'lightapi.net', service: 'config', action: 'getConfigInstanceApi', version: '0.1.0',
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
  const handleDelete = useCallback(async (row: MRT_Row<ConfigInstanceApiType>) => {
    if (!window.confirm(`Are you sure you want to delete this property from the instance API?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(item => !(
      item.instanceApiId === row.original.instanceApiId &&
      item.configId === row.original.configId &&
      item.propertyName === row.original.propertyName
    )));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'config', action: 'deleteConfigInstanceApi', version: '0.1.0',
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

  const handleUpdate = useCallback(async (row: MRT_Row<ConfigInstanceApiType>) => {
    const propertyId = row.original.propertyId;
    setIsUpdateLoading(propertyId);

    const cmd = {
      host: 'lightapi.net', service: 'config', action: 'getFreshConfigInstanceApi', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    try {
      const freshData = await fetchClient(url);
      console.log("freshData", freshData);

      // Navigate with the fresh data
      navigate('/app/form/updateConfigInstanceApi', {
        state: {
          data: freshData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch config instance api property for update:", error);
      alert("Could not load the latest config instance api property data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);


  const handleSync = useCallback(async () => {
    if (!host) {
      alert("Host is required.");
      return;
    }
    if (!initialInstanceId || !initialInstanceApiId || !initialApiId || !initialApiVersion) {
      alert("Missing required context data (Instance ID, Instance API ID, API ID, or API Version) to sync.");
      return;
    }

    if (!window.confirm(`Are you sure you want to sync config from the API definition? This will fetch access-control and rules configuration and publish them to this instance API.`)) return;

    setIsSyncLoading(true);

    const cmd = {
      host: 'lightapi.net', service: 'config', action: 'syncConfigInstanceApi', version: '0.1.0',
      data: {
        hostId: host,
        instanceId: initialInstanceId,
        instanceApiId: initialInstanceApiId,
        apiId: initialApiId,
        apiVersion: initialApiVersion
      },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert(`Failed to sync config from api: ${result.error}`);
      } else {
        alert("Config synchronized successfully!");
        fetchData();
      }
    } catch (e) {
      console.error(e);
      alert('Failed to sync config due to a network error.');
    } finally {
      setIsSyncLoading(false);
    }
  }, [host, initialInstanceId, initialInstanceApiId, initialApiId, initialApiVersion, fetchData]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ConfigInstanceApiType>[]>(
    () => [
      { accessorKey: 'instanceApiId', header: 'Instance Api Id' },
      { accessorKey: 'configName', header: 'Config Name' },
      { accessorKey: 'propertyName', header: 'Property Name' },
      {
        accessorKey: 'propertyValue',
        header: 'Property Value',
        Cell: TruncatedCell,
        muiTableBodyCellProps: { sx: { maxWidth: '200px' } }
      },
      { accessorKey: 'apiId', header: 'Api Id' },
      { accessorKey: 'apiVersion', header: 'Api Version' },
      { accessorKey: 'configId', header: 'Config Id' },
      { accessorKey: 'propertyId', header: 'Property Id' },
      { accessorKey: 'hostId', header: 'Host Id' },
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
    ],
    [],
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
    getRowId: (row) => `${row.instanceApiId}-${row.configId}-${row.propertyName}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.5rem' }}>
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
        <Tooltip title="Delete Property">
          <IconButton color="error" onClick={() => handleDelete(row)}>
            <DeleteForeverIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createConfigInstanceApi', { state: { data: { instanceId: initialInstanceId, instanceApiId: initialInstanceApiId, configId: initialConfigId } } })}
          disabled={!initialConfigId && !initialInstanceApiId}
        >
          Add Config to Instance Api
        </Button>
        <Button
          variant="contained"
          startIcon={isSyncLoading ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
          onClick={handleSync}
          disabled={!initialInstanceApiId || isSyncLoading}
        >
          {isSyncLoading ? 'Syncing...' : 'Sync Config from Api'}
        </Button>
        {initialConfigId && (
          <Typography variant="subtitle1">
            For Config: <strong>{initialConfigId}</strong>
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
