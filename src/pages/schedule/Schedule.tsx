import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Alert, Box, Button, IconButton, Tooltip, CircularProgress, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { applyOwnershipFilter, defaultAllScopeRoles, ownershipScope } from '../../utils/ownershipScope';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromObject, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// --- Type Definitions ---
type ScheduleApiResponse = {
  schedules: Array<ScheduleType>;
  total: number;
};

type ScheduleType = {
  hostId: string;
  scheduleId: string;
  scheduleName: string;
  frequencyUnit: string;
  frequencyTime: number;
  startTs?: string;
  eventTopic: string;
  eventType: string;
  eventData: string;
  ownerUserId?: string;
  ownerPositionId?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

interface UserState {
  host?: string;
  userId?: string;
  email?: string;
  roles?: string | null;
  positions?: string | null;
}

const allScheduleScopeRoles = [...defaultAllScopeRoles, 'schedule-admin'];

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

export default function Schedule() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { host, userId, email, roles, positions } = useUserState() as UserState;
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  
  // Determine if we are in admin mode based on the URL path
  const isAdminView = location.pathname.includes('/admin');
  const scheduleOwnership = useMemo(
    () => ownershipScope({
      roles,
      positions,
      ownerField: 'ownerUserId',
      allScopeRoles: allScheduleScopeRoles,
      allScopeAllowed: isAdminView,
    }),
    [isAdminView, roles, userId],
  );
  const ownedOnly = scheduleOwnership.ownedOnly;
  const hasOwnerContext = scheduleOwnership.hasOwnerContext;
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, { hostId: host ?? '', userId: userId ?? '', metadataType: 'schedule' }),
    [host, searchContext, userId],
  );
  const contextForRow = useCallback(
    (row: ScheduleType) => mergeTaskContext(taskContext, contextFromObject(row)),
    [taskContext],
  );
  const canModifySchedule = useCallback(
    (schedule: ScheduleType) => scheduleOwnership.canModifyRecord(schedule),
    [scheduleOwnership],
  );

  // Data and fetching state
  const [data, setData] = useState<ScheduleType[]>([]);
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
    if (ownedOnly && !userId) return; // Owner-scoped view must have a user id.
    
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    let activeStatus = true; // Default to true if not present
    const apiFilters: MRT_ColumnFiltersState = [];

    columnFilters.forEach(filter => {
      if (filter.id === 'active') {
        activeStatus = filter.value === 'true' || filter.value === true;
      } else {
        apiFilters.push(filter);
      }
    });

    const scopedFilters = applyOwnershipFilter(apiFilters, scheduleOwnership);

    const cmdData = {
      hostId: host, 
      offset: pagination.pageIndex * pagination.pageSize, 
      limit: pagination.pageSize,
      sorting: JSON.stringify(sorting ?? []),
      filters: JSON.stringify(scopedFilters ?? []),
      globalFilter: globalFilter ?? '',
      active: activeStatus,
    };

    const cmd = {
      host: 'lightapi.net', 
      service: 'schedule', 
      action: 'getSchedule', 
      version: '0.1.0',
      data: cmdData,
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const json = await fetchClient(url);
      setData(json.schedules || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, userId, ownedOnly, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, scheduleOwnership]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<ScheduleType>) => {
    if (!canModifySchedule(row.original)) {
      alert('You can only delete schedules you own.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete schedule: ${row.original.scheduleName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(schedule => schedule.scheduleId !== row.original.scheduleId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'schedule', action: 'deleteSchedule', version: '0.1.0',
      data: { scheduleId: row.original.scheduleId },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete schedule. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete schedule due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [canModifySchedule, data]);

  const handleUpdate = useCallback(async (row: MRT_Row<ScheduleType>) => {
    if (!canModifySchedule(row.original)) {
      alert('You can only update schedules you own.');
      return;
    }

    const scheduleId = row.original.scheduleId;
    setIsUpdateLoading(scheduleId);

    const cmd = {
      host: 'lightapi.net', service: 'schedule', action: 'getFreshSchedule', version: '0.1.0',
      data: { hostId: row.original.hostId, scheduleId: row.original.scheduleId, aggregateVersion: row.original.aggregateVersion },
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const freshData = await fetchClient(url);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;
      navigate(
        buildTaskAwareRoute('/app/form/updateSchedule', searchParams, contextForRow(row.original)),
        { state: { data: dataForForm, source: location.pathname } },
      );
    } catch (error) {
      console.error("Failed to fetch schedule for update:", error);
      alert("Could not load the latest schedule data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [canModifySchedule, contextForRow, navigate, location.pathname, searchParams]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ScheduleType>[]>(
    () => {
      const allColumns: MRT_ColumnDef<ScheduleType>[] = [
        { accessorKey: 'scheduleId', header: 'Schedule ID' },
        { accessorKey: 'scheduleName', header: 'Schedule Name' },
        { accessorKey: 'frequencyUnit', header: 'Frequency Unit' },
        { accessorKey: 'frequencyTime', header: 'Frequency Time' },
        { accessorKey: 'eventTopic', header: 'Event Topic' },
        { accessorKey: 'eventType', header: 'Event Type' },
        {
          accessorKey: 'eventData',
          header: 'Event Data',
          Cell: TruncatedCell,
        },
        { accessorKey: 'ownerUserId', header: 'Owner User' },
        { accessorKey: 'ownerPositionId', header: 'Owner Position' },
        { accessorKey: 'updateUser', header: 'Update User' },
        { accessorKey: 'updateTs', header: 'Update Timestamp' },
        { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
        {
          accessorKey: 'active',
          header: 'Active',
          filterVariant: 'select',
          filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
          Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
        },
        {
          id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
          Cell: ({ row }) => {
            const disabled = !canModifySchedule(row.original);
            return (
              <Tooltip title={disabled ? 'You can only update schedules you own.' : 'Update Schedule'}>
                <span>
                  <IconButton onClick={() => handleUpdate(row)} disabled={disabled || isUpdateLoading === row.original.scheduleId}>
                    {isUpdateLoading === row.original.scheduleId ? <CircularProgress size={22} /> : <SystemUpdateIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            );
          },
        },
        {
          id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
          Cell: ({ row }) => {
            const disabled = !canModifySchedule(row.original);
            return (
              <Tooltip title={disabled ? 'You can only delete schedules you own.' : 'Delete Schedule'}>
                <span>
                  <IconButton color="error" onClick={() => handleDelete(row)} disabled={disabled}>
                    <DeleteForeverIcon />
                  </IconButton>
                </span>
              </Tooltip>
            );
          },
        },
      ];
      // Hide owner/audit columns for owner-scoped users.
      return ownedOnly
        ? allColumns.filter(col => col.accessorKey !== 'ownerUserId' && col.accessorKey !== 'ownerPositionId' && col.accessorKey !== 'updateUser')
        : allColumns;
    },
    [ownedOnly, isUpdateLoading, canModifySchedule, handleUpdate, handleDelete],
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
    getRowId: (row) => row.scheduleId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildTaskAwareRoute('/app/form/createSchedule', searchParams, taskContext))}>
          Create New Schedule
        </Button>
        {ownedOnly && (
          <Typography variant="subtitle1" sx={{ ml: 2 }}>
            My Schedules: <strong>{email || userId}</strong>
          </Typography>
        )}
        {!ownedOnly && (
          <Typography variant="subtitle1" sx={{ ml: 2, color: 'primary.main', fontWeight: 600 }}>
            Admin View: All Schedules
          </Typography>
        )}
      </Box>
    ),
  });

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ mb: 2 }}>
        <TaskActionPanel
          title="Portal Metadata Tasks"
          context={taskContext}
          taskIds={['manage-portal-metadata']}
          maxActions={1}
        />
      </Box>
      {!hasOwnerContext && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          User context is required before owner-scoped schedules can be loaded.
        </Alert>
      )}
      <MaterialReactTable table={table} />
    </Box>
  );
}
