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
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

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
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const initialGroupId = location.state?.data?.groupId ?? searchContext.groupId;
  const initialApiVersionId = location.state?.data?.apiVersionId ?? searchContext.apiVersionId;
  const initialEndpointId = location.state?.data?.endpointId ?? searchContext.endpointId;
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, {
      hostId: host ?? '',
      groupId: initialGroupId ?? '',
      apiVersionId: initialApiVersionId ?? '',
      endpointId: initialEndpointId ?? '',
    }),
    [host, initialGroupId, initialApiVersionId, initialEndpointId, searchContext],
  );

  // Data and fetching state
  const [data, setData] = useState<GroupRowFilterType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
    const filters: MRT_ColumnFiltersState = [{ id: 'active', value: 'true' }];
    if (initialGroupId) filters.push({ id: 'groupId', value: initialGroupId });
    if (initialApiVersionId) filters.push({ id: 'apiVersionId', value: initialApiVersionId });
    if (initialEndpointId) filters.push({ id: 'endpointId', value: initialEndpointId });
    return filters;
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
    try {
      const json = await fetchClient(url);
      setData(json.groupRowFilters || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<GroupRowFilterType>) => {
    if (!window.confirm(`Are you sure you want to delete this row filter?`)) return;
    const originalData = [...data];
    setData(prev => prev.filter(r => r.groupId !== row.original.groupId || r.endpointId !== row.original.endpointId || r.colName !== row.original.colName));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'group', action: 'deleteGroupRowFilter', version: '0.1.0',
      data: { hostId: row.original.hostId, groupId: row.original.groupId, endpointId: row.original.endpointId, colName: row.original.colName },
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
      data: { hostId: row.original.hostId, groupId: row.original.groupId, endpointId: row.original.endpointId, colName: row.original.colName, aggregateVersion: row.original.aggregateVersion },
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    try {
      const freshData = await fetchClient(url);
      console.log("freshData", freshData);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;

      // Navigate with the fresh data
      navigate(buildTaskAwareRoute('/app/form/updateGroupRowFilter', searchParams, {
        ...taskContext,
        groupId,
        apiVersionId: row.original.apiVersionId,
        endpointId: row.original.endpointId,
      }), {
        state: {
          data: dataForForm,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch group row filter for update:", error);
      alert("Could not load the latest group row filter data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname, searchParams, taskContext]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<GroupRowFilterType>[]>(
    () => [
      { accessorKey: 'groupId', header: 'Group Id' },
      { accessorKey: 'apiId', header: 'API Id' },
      { accessorKey: 'apiVersion', header: 'Version' },
      { accessorKey: 'endpoint', header: 'Endpoint' },
      { accessorKey: 'colName', header: 'Column Name' },
      { accessorKey: 'operator', header: 'Operator' },
      { accessorKey: 'colValue', header: 'Column Value' },
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'apiVersionId', header: 'API Version Id' },
      { accessorKey: 'endpointId', header: 'Endpoint Id' },
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
    getRowId: (row) => `${row.groupId}-${row.endpointId}-${row.colName}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '8px' }}>
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
          onClick={() => navigate(
            buildTaskAwareRoute('/app/form/createGroupRowFilter', searchParams, taskContext),
            {
              state: {
                data: {
                  groupId: initialGroupId,
                  apiVersionId: initialApiVersionId,
                  endpointId: initialEndpointId,
                }
              }
            },
          )}
        >
          Create Group Row Filter
        </Button>
        {initialGroupId && (
          <Typography variant="subtitle1">
            For Group: <strong>{initialGroupId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ mb: 2 }}>
        <TaskActionPanel
          title="Access Filter Tasks"
          context={taskContext}
          taskIds={['configure-access-control']}
          maxActions={1}
        />
      </Box>
      <MaterialReactTable table={table} />
    </Box>
  );
}
