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
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';

// --- Type Definitions ---
type PipelineApiResponse = {
  pipelines: Array<PipelineType>;
  total: number;
};

type PipelineType = {
  hostId: string;
  pipelineId: string;
  platformId: string;
  platformName: string;
  platformVersion: string;
  pipelineName: string;
  pipelineVersion: string;
  endpoint: string;
  current?: boolean;
  versionStatus: string;
  systemEnv: string;
  runtimeEnv?: string;
  requestSchema?: string;
  responseSchema?: string;
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

export default function PipelineAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const initialPlatformId = location.state?.data?.platformId;

  // Data and fetching state
  const [data, setData] = useState<PipelineType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    initialPlatformId 
      ? [
          { id: 'active', value: 'true' },
          { id: 'platformId', value: initialPlatformId }
        ]
      : [
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
    
    const apiFilters = columnFilters.map(filter => {
      // Add the IDs of all your boolean columns to this check
      if (filter.id === 'active' || filter.id === 'current') {
        return {
          ...filter,
          value: filter.value === 'true',
        };
      }
      return filter;
    });

    const cmd = {
      host: 'lightapi.net', service: 'deployment', action: 'getPipeline', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), 
        filters: JSON.stringify(apiFilters ?? []), 
        globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as PipelineApiResponse;
      setData(json.pipelines || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<PipelineType>) => {
    if (!window.confirm(`Are you sure you want to delete pipeline: ${row.original.pipelineName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(p => p.pipelineId !== row.original.pipelineId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'deployment', action: 'deletePipeline', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete pipeline. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete pipeline due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<PipelineType>) => {
    const pipelineId = row.original.pipelineId;
    setIsUpdateLoading(pipelineId);

    const cmd = {
      host: 'lightapi.net', service: 'deployment', action: 'getFreshPipeline', version: '0.1.0',
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
        throw new Error(freshData.description || 'Failed to fetch latest pipeline data.');
      }
      
      // Navigate with the fresh data
      navigate('/app/form/updatePipeline', { 
        state: { 
          data: freshData, 
          source: location.pathname 
        } 
      });
    } catch (error) {
      console.error("Failed to fetch pipeline for update:", error);
      alert("Could not load the latest pipeline data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<PipelineType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'platformId', header: 'Platform Id' },
      { accessorKey: 'platformName', header: 'Platform Name' },
      { accessorKey: 'pipelineId', header: 'Pipeline Id' },
      { accessorKey: 'pipelineName', header: 'Pipeline Name' },
      { accessorKey: 'pipelineVersion', header: 'Version' },
      { accessorKey: 'endpoint', header: 'Endpoint' },
      { accessorKey: 'versionStatus', header: 'Status' },
      { accessorKey: 'systemEnv', header: 'System Env' },
      { accessorKey: 'runtimeEnv', header: 'Runtime Env' },
      { 
        accessorKey: 'requestSchema', 
        header: 'Request Schema',
        Cell: TruncatedCell,
        muiTableBodyCellProps: { sx: { maxWidth: '200px' } }
      },
      { 
        accessorKey: 'responseSchema', 
        header: 'Response Schema',
        Cell: TruncatedCell,
        muiTableBodyCellProps: { sx: { maxWidth: '200px' } }
      },
      {
        accessorKey: 'current',
        header: 'Current',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
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
            <Tooltip title="Update Pipeline">
              <IconButton 
                onClick={() => handleUpdate(row)}
                disabled={isUpdateLoading === row.original.pipelineId}
              >
                {isUpdateLoading === row.original.pipelineId ? (
                  <CircularProgress size={22} />
                ) : (
                  <SystemUpdateIcon />
                )}
              </IconButton>
            </Tooltip>
      )},
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Delete Pipeline"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
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
    getRowId: (row) => row.pipelineId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createPipeline')}>
        Create New Pipeline
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
