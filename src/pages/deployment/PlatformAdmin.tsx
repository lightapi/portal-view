import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import GridGoldenratioIcon from '@mui/icons-material/GridGoldenratio';
import { useUserState } from "../../contexts/UserContext.tsx";
import { apiPost } from "../../api/apiPost.ts";
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
};

interface UserState {
  host?: string;
}

export default function PlatformAdmin() {
  const navigate = useNavigate();
  const { host } = useUserState() as UserState;

  // Data and fetching state
  const [data, setData] = useState<PlatformType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    const cmd = {
      host: 'lightapi.net', service: 'deployment', action: 'getPlatform', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), filters: JSON.stringify(columnFilters ?? []), globalFilter: globalFilter ?? '',
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
      data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
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

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<PlatformType>[]>(
    () => [
      { accessorKey: 'platformId', header: 'Platform ID' },
      { accessorKey: 'platformName', header: 'Platform Name' },
      { accessorKey: 'platformVersion', header: 'Version' },
      { accessorKey: 'clientType', header: 'Client Type' },
      { accessorKey: 'environment', header: 'Environment' },
      { accessorKey: 'region', header: 'Region' },
      { accessorKey: 'handlerClass', header: 'Handler Class' },
      {
        id: 'actions', header: 'Actions', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
            <Tooltip title="Update Platform"><IconButton onClick={() => navigate('/app/form/updatePlatform', { state: { data: { ...row.original } } })}><SystemUpdateIcon /></IconButton></Tooltip>
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
