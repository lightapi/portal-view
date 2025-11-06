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
import DetailsIcon from '@mui/icons-material/Details';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';

// --- Type Definitions ---
type SchemaApiResponse = {
  schemas: Array<SchemaType>;
  total: number;
};

type SchemaType = {
  hostId?: string;
  schemaId: string;
  schemaVersion: string;
  schemaType: string;
  specVersion: string;
  schemaSource: string;
  schemaDesc?: string;
  schemaBody: string;
  schemaOwner: string;
  schemaStatus: string;
  example?: string;
  commentStatus: string;
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

export default function SchemaAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;

  // Data and fetching state
  const [data, setData] = useState<SchemaType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([
    { id: 'active', value: 'true' },
  ]);
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
      if (filter.id === 'active') {
        return {
          ...filter,
          value: filter.value === 'true',
        };
      }
      return filter;
    });

    const cmd = {
      host: 'lightapi.net', service: 'schema', action: 'getSchema', version: '0.1.0',
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
      const json = (await response.json()) as SchemaApiResponse;
      setData(json.schemas || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<SchemaType>) => {
    if (!window.confirm(`Are you sure you want to delete the schema: ${row.original.schemaId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(schema => schema.schemaId !== row.original.schemaId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'schema', action: 'deleteJsonSchema', version: '0.1.0',
      data: row.original,
    };
    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete rule. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete schema due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Handler to fetch fresh data before navigating to update form
  const handleUpdate = useCallback(async (row: MRT_Row<SchemaType>) => {
    const schemaId = row.original.schemaId;
    setIsUpdateLoading(schemaId);

    const cmd = {
      host: 'lightapi.net', service: 'schema', action: 'getFreshSchema', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const freshData = await response.json();
      if (!response.ok) {
        throw new Error(freshData.description || 'Failed to fetch latest schema data.');
      }
      navigate('/app/form/updateJsonSchema', { state: { data: freshData } });
    } catch (error) {
      console.error("Failed to fetch schema for update:", error);
      alert("Could not load the latest schema data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<SchemaType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host' },
      { accessorKey: 'schemaId', header: 'Schema Id' },
      { accessorKey: 'schemaVersion', header: 'Version' },
      { accessorKey: 'schemaType', header: 'Type' },
      { accessorKey: 'specVersion', header: 'Spec Version' },
      { accessorKey: 'schemaSource', header: 'Source' },
      { accessorKey: 'schemaName', header: 'Name' },
      { accessorKey: 'schemaDesc', header: 'Schema Desc' },
      { accessorKey: 'schemaBody', header: 'Schema Body' },
      { accessorKey: 'schemaOwner', header: 'Schema Owner' },
      { accessorKey: 'schemaStatus', header: 'Schema Status' },
      { accessorKey: 'example', header: 'Schema Example' },
      { accessorKey: 'commentStatus', header: 'Comment Status' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
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
          <Tooltip title="Update Schema">
            <IconButton onClick={() => handleUpdate(row)} disabled={isUpdateLoading === row.original.schemaId}>
              {isUpdateLoading === row.original.schemaId ? <CircularProgress size={22} /> : <SystemUpdateIcon />}
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Delete Schema"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
    ],
    [handleDelete, handleUpdate, isUpdateLoading, navigate],
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
    getRowId: (row) => row.schemaId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createJsonSchema')}>
        Create New Schema
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
