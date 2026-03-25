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
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type RoleColFilterApiResponse = {
  roleColFilters: Array<RoleColFilterType>;
  total: number;
};

type RoleColFilterType = {
  hostId: string;
  roleId: string;
  apiVersionId: string;
  apiId: string;
  apiVersion: string;
  endpointId: string;
  endpoint: string;
  columns: string;
  aggregateVersion?: number;
  updateUser: string;
  updateTs: string;
  active: boolean;
};

interface UserState {
  host?: string;
}

export default function RoleColFilter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const initialRoleId = location.state?.data?.roleId;

  // Data and fetching state
  const [data, setData] = useState<RoleColFilterType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    initialRoleId
      ? [
        { id: 'active', value: 'true' },
        { id: 'roleId', value: initialRoleId }
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
      host: 'lightapi.net', service: 'role', action: 'queryRoleColFilter', version: '0.1.0',
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
      setData(json.roleColFilters || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<RoleColFilterType>) => {
    if (!window.confirm(`Are you sure you want to delete this column filter?`)) return;

    const originalData = [...data];
    // This assumes roleId + endpoint is a unique key for a filter, adjust if needed
    setData(prev => prev.filter(r => !(r.roleId === row.original.roleId && r.endpointId === row.original.endpointId)));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'role', action: 'deleteRoleColFilter', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete column filter. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete column filter due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<RoleColFilterType>) => {
    const roleId = row.original.roleId;
    setIsUpdateLoading(roleId);

    const cmd = {
      host: 'lightapi.net', service: 'role', action: 'getFreshRoleColFilter', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    try {
      const freshData = await fetchClient(url);
      console.log("freshData", freshData);

      // Navigate with the fresh data
      navigate('/app/form/updateRoleColFilter', {
        state: {
          data: freshData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch role col filter for update:", error);
      alert("Could not load the latest role col filter data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RoleColFilterType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'roleId', header: 'Role Id' },
      { accessorKey: 'apiVersionId', header: 'API Version Id' },
      { accessorKey: 'apiId', header: 'API Id' },
      { accessorKey: 'apiVersion', header: 'API Version' },
      { accessorKey: 'endpointId', header: 'Endpoint Id' },
      { accessorKey: 'endpoint', header: 'Endpoint' },
      { accessorKey: 'columns', header: 'Filtered Columns' },
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
        filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
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
    getRowId: (row) => `${row.roleId}-${row.endpointId}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Update Row Col Filter">
          <IconButton
            onClick={() => handleUpdate(row)}
            disabled={isUpdateLoading === row.original.roleId}
          >
            {isUpdateLoading === row.original.roleId ? (
              <CircularProgress size={22} />
            ) : (
              <SystemUpdateIcon />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Filter">
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
          onClick={() => navigate('/app/form/createRoleColFilter', { state: { data: { roleId: initialRoleId } } })}
        >
          Create New Filter
        </Button>
        {initialRoleId && (
          <Typography variant="subtitle1">
            For Role: <strong>{initialRoleId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
