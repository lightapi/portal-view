import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { usePersistentPagination, PAGE_SIZE_OPTIONS } from '../../hooks/usePersistentPagination';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Box, Button } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import DoNotTouchIcon from '@mui/icons-material/DoNotTouch';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import GroupsIcon from '@mui/icons-material/Groups';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute } from '../../tasks/taskUtils';

// --- Type Definitions ---
type GroupApiResponse = {
  groups: Array<GroupType>;
  total: number;
};

type GroupType = {
  hostId: string;
  groupId: string;
  groupDesc?: string;
  aggregateVersion?: number;
  updateUser: string;
  updateTs: string;
  active: boolean;
};

interface UserState {
  host?: string;
}

export default function GroupAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const taskContext = useMemo(() => ({ hostId: host ?? '' }), [host]);

  // Data and fetching state
  const [data, setData] = useState<GroupType[]>([]);
  const [isError, setIsError] = useState<string | false>(false);
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
  const [pagination, setPagination] = usePersistentPagination();

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    setIsError(false);
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
      host: 'lightapi.net', service: 'group', action: 'getGroup', version: '0.1.0',
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
      setData(json.groups || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(loadErrorMessage(error)); console.error(error);
    } finally {
      setIsLoading(false); setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<GroupType>) => {
    if (!window.confirm(`Are you sure you want to delete group: ${row.original.groupId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(group => group.groupId !== row.original.groupId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'group', action: 'deleteGroup', version: '0.1.0',
      data: { hostId: row.original.hostId, groupId: row.original.groupId , aggregateVersion: row.original.aggregateVersion},
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete group. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete group due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<GroupType>) => {
    const groupId = row.original.groupId;
    setIsUpdateLoading(groupId);

    const cmd = {
      host: 'lightapi.net', service: 'group', action: 'getFreshGroup', version: '0.1.0',
      data: { hostId: row.original.hostId, groupId: row.original.groupId, aggregateVersion: row.original.aggregateVersion },
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    try {
      const freshData = await fetchClient(url);
      console.log("freshData", freshData);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;

      // Navigate with the fresh data
      navigate(buildTaskAwareRoute('/app/form/updateGroup', searchParams, { ...taskContext, groupId }), {
        state: {
          data: dataForForm,
          source: location.pathname
        }
      });
    } catch (error: any) {
      console.error("Failed to fetch group for update:", error);
      alert(error.message || "Could not load the latest group data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname, searchParams, taskContext]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<GroupType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'groupId', header: 'Group ID' },
      { accessorKey: 'groupDesc', header: 'Description' },
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
  const table = useMaterialReactTable(usePortalActionTableOptions({
    columns,
    data,
    initialState: { showColumnFilters: true, density: 'compact' },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: { isLoading, showAlertBanner: Boolean(isError), showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
    onPaginationChange: setPagination,
    muiPaginationProps: { rowsPerPageOptions: PAGE_SIZE_OPTIONS },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.groupId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: typeof isError === 'string' ? isError : 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => <PortalActions row={row} actions={[
      {
        id: "update-group",
        label: "Update Group",
        icon: (
          <SystemUpdateIcon />
        ),

        loading: () => Boolean(isUpdateLoading === row.original.groupId),
        onSelect: () => handleUpdate(row)
      },
      {
        id: "group-permissions",
        label: "Group Permissions",
        icon: <DoNotTouchIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/access/groupPermission', searchParams, { ...taskContext, groupId: row.original.groupId }), { state: { data: { groupId: row.original.groupId } } })
      },
      {
        id: "group-row-filters",
        label: "Group Row Filters",
        icon: <KeyboardDoubleArrowDownIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/access/groupRowFilter', searchParams, { ...taskContext, groupId: row.original.groupId }), { state: { data: { groupId: row.original.groupId } } })
      },
      {
        id: "group-column-filters",
        label: "Group Column Filters",
        icon: <KeyboardDoubleArrowRightIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/access/groupColFilter', searchParams, { ...taskContext, groupId: row.original.groupId }), { state: { data: { groupId: row.original.groupId } } })
      },
      {
        id: "manage-users",
        label: "Manage Users",
        icon: <GroupsIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/access/groupUser', searchParams, { ...taskContext, groupId: row.original.groupId }), { state: { data: { groupId: row.original.groupId } } })
      },
      {
        id: "delete-group",
        label: "Delete Group",
        icon: <DeleteForeverIcon />,
        destructive: true,
        onSelect: () => handleDelete(row)
      }
    ]} />,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildTaskAwareRoute('/app/form/createGroup', searchParams, taskContext))}>
        Create New Group
      </Button>
    ),
  }));

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ mb: 2 }}>
        <TaskActionPanel
          title="Access Control Tasks"
          context={taskContext}
          taskIds={['configure-access-control']}
          maxActions={1}
        />
      </Box>
      <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>
    </Box>
  );
}
