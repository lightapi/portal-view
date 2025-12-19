import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

// Define the shape of the API response
type InstanceApiPathPrefixApiResponse = {
  instanceApiPathPrefixes: Array<InstanceApiPathPrefixType>;
  total: number;
};

// Define the type for a single record
type InstanceApiPathPrefixType = {
  hostId: string;
  instanceApiId: string;
  instanceId: string;
  instanceName: string;
  productId: string;
  productVersion: string;
  apiVersionId: string;
  apiId: string;
  apiVersion: string;
  pathPrefix: string;
  updateUser?: string;
  updateTs?: string;
};

export default function InstanceApiPathPrefix() {
  const navigate = useNavigate();
  const location = useLocation();
  const userState: { host?: string } | null = useUserState();
  const host = userState?.host || '';

  // Contextual data from previous page, used for creating a new prefix
  const contextData = location.state?.data;

  // Data and fetching state
  const [data, setData] = useState<InstanceApiPathPrefixType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state
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
    if (!data.length) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }

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
      action: 'getInstanceApiPathPrefix',
      version: '0.1.0',
      data: {
        hostId: host,
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(apiFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };

    const url = `/portal/query?cmd=${encodeURIComponent(JSON.stringify(cmd))}`;
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as InstanceApiPathPrefixApiResponse;
      setData(json.instanceApiPathPrefixes || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true);
      console.error(error);
    } finally {
      setIsError(false);
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [
    host,
    columnFilters,
    globalFilter,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    data.length,
  ]);

  // useEffect to trigger fetchData when table state changes
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    host,
    columnFilters,
    globalFilter,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
  ]);

  const handleCreate = (instanceApiId?: string) => {
    if (instanceApiId) {
      navigate('/app/form/createInstanceApiPathPrefix', { state: { data: { instanceApiId } } });
    } else {
      console.error("Cannot create: instanceApiId is missing from context.");
    }
  };

  const handleUpdate = (rowData: InstanceApiPathPrefixType) => {
    navigate('/app/form/updateInstanceApiPathPrefix', { state: { data: rowData } });
  };

  const handleDelete = useCallback(async (row: MRT_Row<InstanceApiPathPrefixType>) => {
    if (!window.confirm(`Are you sure you want to delete the path prefix: ${row.original.pathPrefix}?`)) {
      return;
    }
    const cmd = {
      host: 'lightapi.net',
      service: 'instance',
      action: 'deleteInstanceApiPathPrefix',
      version: '0.1.0',
      data: row.original,
    };
    const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
    if (result.data) {
      // Refetch data on the current page after successful deletion
      fetchData();
    } else if (result.error) {
      console.error('API Error on delete:', result.error);
    }
  }, [fetchData]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<InstanceApiPathPrefixType>[]>(
    () => [
      { accessorKey: 'instanceApiId', header: 'Instance API ID' },
      { accessorKey: 'pathPrefix', header: 'Path Prefix' },
      { accessorKey: 'instanceName', header: 'Instance Name' },
      { accessorKey: 'apiId', header: 'API ID' },
      { accessorKey: 'apiVersion', header: 'API Version' },
      { accessorKey: 'productId', header: 'Product ID' },
      { accessorKey: 'updateUser', header: 'Update User' },
      {
        accessorKey: 'updateTs',
        header: 'Update Time',
        Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
      },
    ],
    [],
  );

  // Table instance configuration
  const table = useMaterialReactTable({
    columns,
    data,
    // Turn on manual modes
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount, // Set the total number of rows from the server
    initialState: {
      showColumnFilters: true,
      density: 'compact'
    },
    state: {
      isLoading,
      showAlertBanner: isError,
      showProgressBars: isLoading,
      pagination,
      sorting,
      columnFilters,
      globalFilter,
    },
    // Wire up the on-change handlers to update state
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => `${row.instanceApiId}-${row.pathPrefix}`,
    muiToolbarAlertBannerProps: isError
      ? { color: 'error', children: 'Error loading data' }
      : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.5rem' }}>
        <Tooltip title="Update">
          <IconButton onClick={() => handleUpdate(row.original)}>
            <SystemUpdateIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton color="error" onClick={() => handleDelete(row)}>
            <DeleteForeverIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Button
        variant="contained"
        startIcon={<AddBoxIcon />}
        onClick={() => handleCreate(contextData?.instanceApiId)}
        disabled={!contextData?.instanceApiId}
      >
        Create New Prefix
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
