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

// --- Type Definitions ---
type GroupRowFilterApiResponse = {
  groupRowFilters: Array<GroupRowFilterType>;
  total: number;
};

type GroupRowFilterType = {
  hostId: string;
  groupId: string;
  apiVersionId: string;
  apiId: string;
  apiVersion: string;
  endpointId: string;
  endpoint: string;
  colName: string;
  operator: string;
  colValue: string;
  aggregateVersion?: number;
  updateUser: string;
  updateTs: string;
  active: boolean;
};

interface UserState {
  host?: string;
}

export default function GroupRowFilter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const initialGroupId = location.state?.data?.groupId;

  // Data and fetching state
  const [data, setData] = useState<GroupRowFilterType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    initialGroupId
      ? [
        { id: 'active', value: 'true' },
        { id: 'groupId', value: initialGroupId }
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
      host: 'lightapi.net', service: 'group', action: 'queryGroupRowFilter', version: '0.1.0',
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
      const json = (await response.json()) as GroupRowFilterApiResponse;
      setData(json.groupRowFilters || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<GroupRowFilterType>) => {
    if (!window.confirm(`Are you sure you want to delete this row filter?`)) return;
    const originalData = [...data];
    setData(prev => prev.filter(r => r.groupId !== row.original.groupId || r.endpointId !== row.original.endpointId || r.colName !== row.original.colName));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'group', action: 'deleteGroupRowFilter', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete row filter. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete row filter due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<GroupRowFilterType>) => {
    const groupId = row.original.groupId;
    setIsUpdateLoading(groupId);

    const cmd = {
      host: 'lightapi.net', service: 'group', action: 'getFreshGroupRowFilter', version: '0.1.0',
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
        throw new Error(freshData.description || 'Failed to fetch latest group row filter data.');
      }

      // Navigate with the fresh data
      navigate('/app/form/updateGroupRowFilter', {
        state: {
          data: freshData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch group row filter for update:", error);
      alert("Could not load the latest group row filter data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<GroupRowFilterType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'groupId', header: 'Group Id' },
      { accessorKey: 'apiVersionId', header: 'API Version Id' },
      { accessorKey: 'apiId', header: 'API Id' },
      { accessorKey: 'apiVersion', header: 'Version' },
      { accessorKey: 'endpointId', header: 'Endpoint Id' },
      { accessorKey: 'endpoint', header: 'Endpoint' },
      { accessorKey: 'colName', header: 'Column Name' },
      { accessorKey: 'operator', header: 'Operator' },
      { accessorKey: 'colValue', header: 'Column Value' },
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
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Update Group Row Filter">
            <IconButton
              onClick={() => handleUpdate(row)}
              disabled={isUpdateLoading === row.original.groupId}
            >
              {isUpdateLoading === row.original.groupId ? (
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
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Delete Filter">
            <IconButton color="error" onClick={() => handleDelete(row)}>
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>
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
    getRowId: (row) => `${row.groupId}-${row.endpointId}-${row.colName}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createGroupRowFilter', { state: { data: { groupId: initialGroupId } } })}
        >
          Create New Filter
        </Button>
        {initialGroupId && (
          <Typography variant="subtitle1">
            For Group: <strong>{initialGroupId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
