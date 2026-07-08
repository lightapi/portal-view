import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { Alert, Box, Button, IconButton, Tooltip, CircularProgress, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { applyOwnershipColumns, applyOwnershipFilter, ownershipScope } from '../../utils/ownershipScope';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// Define the shape of the API response
type RuntimeInstanceApiResponse = {
  runtimeInstances: Array<RuntimeInstanceType>;
  total: number;
};

// Define the type for a single runtime instance record
type RuntimeInstanceType = {
  hostId: string;
  runtimeInstanceId: string;
  serviceId: string;
  envTag?: string;
  protocol: string;
  ipAddress: string;
  portNumber: number;
  instanceStatus: string;
  aggregateVersion?: number;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
};

export default function RuntimeInstanceAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host, userId, email, roles, positions } = useUserState() as { host: string; userId?: string; email?: string; roles?: string | null; positions?: string | null };
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const runtimeInstanceOwnership = useMemo(
    () => ownershipScope({
      roles,
      userId,
      positions,
      ownerField: 'ownerUserId',
    }),
    [roles, userId, positions],
  );
  const ownedOnly = runtimeInstanceOwnership.ownedOnly;
  const hasOwnerContext = runtimeInstanceOwnership.hasOwnerContext;
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, { hostId: host ?? '', userId: userId ?? '' }),
    [host, searchContext, userId],
  );

  // Data and fetching state
  const [data, setData] = useState<RuntimeInstanceType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([
    { id: 'active', value: 'true' },
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const hasRequestedData = useRef(false);

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    if (ownedOnly && !userId) return;
    const isInitialRequest = !hasRequestedData.current;
    hasRequestedData.current = true;
    setIsError(false);
    if (isInitialRequest) setIsLoading(true);
    else setIsRefetching(true);

    let activeStatus = true;
    const apiFilters: MRT_ColumnFiltersState = [];

    columnFilters.forEach((filter) => {
      if (filter.id === 'active') {
        activeStatus = filter.value === 'true' || filter.value === true;
      } else {
        apiFilters.push(filter);
      }
    });

    const scopedFilters = applyOwnershipFilter(apiFilters, runtimeInstanceOwnership);

    const cmd = {
      host: 'lightapi.net',
      service: 'instance',
      action: 'getRuntimeInstance',
      version: '0.1.0',
      data: {
        hostId: host,
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(scopedFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const json = (await fetchClient(url)) as RuntimeInstanceApiResponse;
      setData(json.runtimeInstances || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true);
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [host, userId, ownedOnly, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, runtimeInstanceOwnership]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler — uses Get Fresh then sends delete command
  const handleDelete = useCallback(
    async (row: MRT_Row<RuntimeInstanceType>) => {
      if (!runtimeInstanceOwnership.canModifyRecord(row.original)) {
        alert('You can only delete runtime instances you own.');
        return;
      }
      if (
        !window.confirm(
          `Are you sure you want to delete runtime instance: ${row.original.runtimeInstanceId}?`
        )
      )
        return;

      // Fetch fresh data first to ensure aggregateVersion is current
      const getFreshCmd = {
        host: 'lightapi.net',
        service: 'instance',
        action: 'getFreshRuntimeInstance', version: '0.1.0',
      data: { hostId: row.original.hostId, runtimeInstanceId: row.original.runtimeInstanceId, aggregateVersion: row.original.aggregateVersion },
      };
      const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(getFreshCmd));

      let freshData: RuntimeInstanceType;
      try {
        freshData = await fetchClient(url);
      } catch (error) {
        alert('Could not fetch the latest runtime instance data. Please refresh and try again.');
        return;
      }

      const originalData = [...data];
      const originalRowCount = rowCount;
      setData((prev) =>
        prev.filter((p) => p.runtimeInstanceId !== row.original.runtimeInstanceId)
      );
      setRowCount((prev) => Math.max(prev - 1, 0));

      const cmd = {
        host: 'lightapi.net',
        service: 'instance',
        action: 'deleteRuntimeInstance',
        version: '0.1.0',
        data: {
          hostId: freshData.hostId,
          runtimeInstanceId: freshData.runtimeInstanceId,
          aggregateVersion: freshData.aggregateVersion,
        },
      };

      try {
        const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
        if (result.error) {
          alert('Failed to delete runtime instance. Please try again.');
          setData(originalData);
          setRowCount(originalRowCount);
        }
      } catch (e) {
        alert('Failed to delete runtime instance due to a network error.');
        setData(originalData);
        setRowCount(originalRowCount);
      }
    },
    [runtimeInstanceOwnership, data, rowCount]
  );

  // Update handler — fetches fresh data then navigates to update form
  const handleUpdate = useCallback(
    async (row: MRT_Row<RuntimeInstanceType>) => {
      if (!runtimeInstanceOwnership.canModifyRecord(row.original)) {
        alert('You can only update runtime instances you own.');
        return;
      }
      const runtimeInstanceId = row.original.runtimeInstanceId;
      setIsUpdateLoading(runtimeInstanceId);

      const cmd = {
        host: 'lightapi.net',
        service: 'instance',
        action: 'getFreshRuntimeInstance', version: '0.1.0',
      data: { hostId: row.original.hostId, runtimeInstanceId: row.original.runtimeInstanceId, aggregateVersion: row.original.aggregateVersion },
      };
      const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

      try {
        const freshData = await fetchClient(url);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;
        navigate(buildTaskAwareRoute('/app/form/updateRuntimeInstance', searchParams, {
          ...taskContext,
          hostId: row.original.hostId,
          runtimeInstanceId,
          serviceId: row.original.serviceId,
        }), {
          state: {
            data: dataForForm,
            source: location.pathname,
          },
        });
      } catch (error) {
        console.error('Failed to fetch runtime instance for update:', error);
        alert('Could not load the latest runtime instance data. Please try again.');
      } finally {
        setIsUpdateLoading(null);
      }
    },
    [runtimeInstanceOwnership, location.pathname, navigate, searchParams, taskContext]
  );

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RuntimeInstanceType>[]>(
    () => applyOwnershipColumns([
        { accessorKey: 'serviceId', header: 'Service Id' },
        { accessorKey: 'envTag', header: 'Env Tag' },
        { accessorKey: 'protocol', header: 'Protocol' },
        { accessorKey: 'ipAddress', header: 'IP Address' },
        { accessorKey: 'portNumber', header: 'Port' },
        { accessorKey: 'instanceStatus', header: 'Status' },
        {
          accessorKey: 'active',
          header: 'Active',
          filterVariant: 'select',
          filterSelectOptions: [
            { label: 'True', value: 'true' },
            { label: 'False', value: 'false' },
          ],
          Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
        },
        { accessorKey: 'runtimeInstanceId', header: 'Runtime Instance Id' },
        { accessorKey: 'hostId', header: 'Host Id', enableColumnFilter: false },
        { accessorKey: 'updateUser', header: 'Update User' },
        {
          accessorKey: 'updateTs',
          header: 'Update Time',
          Cell: ({ cell }) =>
            cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
        },
        { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      ],
      runtimeInstanceOwnership,
    ),
    [runtimeInstanceOwnership]
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
    state: {
      isLoading,
      showAlertBanner: isError,
      showProgressBars: isRefetching,
      pagination,
      sorting,
      columnFilters,
      globalFilter,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.runtimeInstanceId,
    muiToolbarAlertBannerProps: isError
      ? { color: 'error', children: 'Error loading data' }
      : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.1rem' }}>
        <Tooltip title={runtimeInstanceOwnership.canModifyRecord(row.original) ? 'Update Runtime Instance' : 'You can only update runtime instances you own.'}>
          <span>
            <IconButton
              onClick={() => handleUpdate(row)}
              disabled={!runtimeInstanceOwnership.canModifyRecord(row.original) || isUpdateLoading === row.original.runtimeInstanceId}
            >
              {isUpdateLoading === row.original.runtimeInstanceId ? (
                <CircularProgress size={22} />
              ) : (
                <SystemUpdateIcon />
              )}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={runtimeInstanceOwnership.canModifyRecord(row.original) ? 'Delete Runtime Instance' : 'You can only delete runtime instances you own.'}>
          <span>
            <IconButton color="error" onClick={() => handleDelete(row)} disabled={!runtimeInstanceOwnership.canModifyRecord(row.original)}>
              <DeleteForeverIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate(buildTaskAwareRoute('/app/form/createRuntimeInstance', searchParams, taskContext))}
        >
          Create Runtime Instance
        </Button>
        {ownedOnly ? (
          <Typography variant="subtitle1">My Runtime Instances: <strong>{email || userId}</strong></Typography>
        ) : (
          <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>Admin View: All Runtime Instances</Typography>
        )}
      </Box>
    ),
  });

  return (
    <Box>
      <TaskActionPanel
        title="Instance Tasks"
        context={taskContext}
        taskIds={['manage-instance']}
        maxActions={3}
      />
      <Box mt={2}>
        {!hasOwnerContext && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            User context is required before owner-scoped runtime instances can be loaded.
          </Alert>
        )}
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
