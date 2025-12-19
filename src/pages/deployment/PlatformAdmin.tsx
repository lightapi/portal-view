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
import { Box, Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import GridGoldenratioIcon from '@mui/icons-material/GridGoldenratio';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type PlatformApiResponse = {
  platforms: Array<PlatformType>;
  total: number;
};

type PlatformType = {
  hostId: string;
  platformId: string;
  platformName?: string;
  platformVersion?: string;
  clientType?: string;
  handlerClass: string;
  clientUrl?: string;
  credentials?: string;
  proxyUrl?: string;
  proxyPort?: number;
  consoleUrl?: string;
  environment?: string;
  zone?: string;
  region?: string;
  lob?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

interface UserState {
  host?: string;
}

export default function PlatformAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;

  // Data and fetching state
  const [data, setData] = useState<PlatformType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    [
      { id: 'active', value: 'true' }
    ]
  );
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
      host: 'lightapi.net', service: 'deployment', action: 'getPlatform', version: '0.1.0',
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
      const json = (await response.json()) as PlatformApiResponse;
      setData(json.platforms || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<PlatformType>) => {
    if (!window.confirm(`Are you sure you want to delete platform: ${row.original.platformName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(p => p.platformId !== row.original.platformId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'deployment', action: 'deletePlatform', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete platform. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete platform due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<PlatformType>) => {
    const platformId = row.original.platformId;
    setIsUpdateLoading(platformId);

    const cmd = {
      host: 'lightapi.net', service: 'deployment', action: 'getFreshPlatform', version: '0.1.0',
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
        throw new Error(freshData.description || 'Failed to fetch latest platform data.');
      }

      // Navigate with the fresh data
      navigate('/app/form/updatePlatform', {
        state: {
          data: freshData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch platform for update:", error);
      alert("Could not load the latest platform data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<PlatformType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'platformId', header: 'Platform Id' },
      { accessorKey: 'platformName', header: 'Platform Name' },
      { accessorKey: 'platformVersion', header: 'Version' },
      { accessorKey: 'clientType', header: 'Client Type' },
      { accessorKey: 'clientUrl', header: 'Client Url' },
      { accessorKey: 'credentials', header: 'Credentials' },
      { accessorKey: 'proxyUrl', header: 'Proxy Url' },
      { accessorKey: 'proxyPort', header: 'Proxy Port' },
      { accessorKey: 'handlerClass', header: 'Handler Class' },
      { accessorKey: 'consoleUrl', header: 'Console Url' },
      { accessorKey: 'environment', header: 'Environment' },
      { accessorKey: 'zone', header: 'Zone' },
      { accessorKey: 'region', header: 'Region' },
      { accessorKey: 'lob', header: 'LOB' },
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
        id: 'actions', header: 'Actions', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
            <Tooltip title="Update Platform">
              <IconButton
                onClick={() => handleUpdate(row)}
                disabled={isUpdateLoading === row.original.platformId}
              >
                {isUpdateLoading === row.original.platformId ? (
                  <CircularProgress size={22} />
                ) : (
                  <SystemUpdateIcon />
                )}
              </IconButton>
            </Tooltip>

            <Tooltip title="Delete Platform"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>
            <Tooltip title="Manage Pipelines"><IconButton onClick={() => navigate('/app/deployment/PipelineAdmin', { state: { data: { platformId: row.original.platformId } } })}><GridGoldenratioIcon /></IconButton></Tooltip>
          </Box>
        ),
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
    getRowId: (row) => row.platformId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createPlatform')}>
        Create New Platform
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
