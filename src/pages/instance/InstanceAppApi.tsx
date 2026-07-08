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
import { Alert, Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { applyOwnershipColumns, applyOwnershipFilter, ownershipScope } from '../../utils/ownershipScope';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// --- Type Definitions ---
type InstanceAppApiApiResponse = {
  instanceAppApis: Array<InstanceAppApiType>;
  total: number;
};

type InstanceAppApiType = {
  hostId: string;
  instanceAppId: string;
  instanceApiId: string;
  instanceId?: string;
  instanceName?: string;
  productId?: string;
  productVersion?: string;
  appId?: string;
  appVersion?: string;
  apiVersionId?: string;
  apiId?: string;
  apiVersion?: string;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

export default function InstanceAppApi() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host, userId, email, roles, positions } = useUserState() as { host: string; userId?: string; email?: string; roles?: string | null; positions?: string | null };
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const instanceAppApiOwnership = useMemo(
    () => ownershipScope({
      roles,
      userId,
      positions,
      ownerField: 'ownerUserId',
    }),
    [roles, userId, positions],
  );
  const ownedOnly = instanceAppApiOwnership.ownedOnly;
  const hasOwnerContext = instanceAppApiOwnership.hasOwnerContext;
  const initialData = useMemo(
    () => ({ ...searchContext, ...(location.state?.data || {}) }),
    [location.state, searchContext],
  );
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, {
      hostId: host ?? '',
      userId: userId ?? '',
      instanceId: initialData.instanceId ?? '',
      instanceAppId: initialData.instanceAppId ?? '',
      instanceApiId: initialData.instanceApiId ?? '',
      productId: initialData.productId ?? '',
      appId: initialData.appId ?? '',
      apiVersionId: initialData.apiVersionId ?? '',
      apiId: initialData.apiId ?? '',
    }),
    [
      host,
      initialData.apiId,
      initialData.apiVersionId,
      initialData.appId,
      initialData.instanceApiId,
      initialData.instanceAppId,
      initialData.instanceId,
      initialData.productId,
      userId,
      searchContext,
    ],
  );

  // Data and fetching state
  const [data, setData] = useState<InstanceAppApiType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state, pre-filtered by context if provided
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
    const initialFilters: MRT_ColumnFiltersState = [
      { id: 'active', value: 'true' }
    ];
    if (initialData.instanceAppId) initialFilters.push({ id: 'instanceAppId', value: initialData.instanceAppId });
    if (initialData.instanceApiId) initialFilters.push({ id: 'instanceApiId', value: initialData.instanceApiId });
    return initialFilters;
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
    if (ownedOnly && !userId) return;
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

    const scopedFilters = applyOwnershipFilter(apiFilters, instanceAppApiOwnership);

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'getInstanceAppApi', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(scopedFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const json = await fetchClient(url);
      setData(json.instanceAppApis || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, userId, ownedOnly, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, instanceAppApiOwnership]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<InstanceAppApiType>) => {
    if (!instanceAppApiOwnership.canModifyRecord(row.original)) {
      alert('You can only delete instance app API associations you own.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete this instance app api association?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(item => !(
      item.instanceAppId === row.original.instanceAppId &&
      item.instanceApiId === row.original.instanceApiId
    )));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'deleteInstanceAppApi', version: '0.1.0',
      data: { hostId: row.original.hostId, instanceAppId: row.original.instanceAppId, instanceApiId: row.original.instanceApiId , aggregateVersion: row.original.aggregateVersion},
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete association. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete association due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [instanceAppApiOwnership, data]);

  const contextForRow = useCallback((row: InstanceAppApiType) => ({
    ...taskContext,
    hostId: row.hostId,
    instanceId: row.instanceId ?? '',
    instanceAppId: row.instanceAppId,
    instanceApiId: row.instanceApiId,
    productId: row.productId ?? '',
    appId: row.appId ?? '',
    apiVersionId: row.apiVersionId ?? '',
    apiId: row.apiId ?? '',
  }), [taskContext]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<InstanceAppApiType>[]>(
    () => applyOwnershipColumns([
        { accessorKey: 'hostId', header: 'Host Id' },
        { accessorKey: 'instanceAppId', header: 'Instance App Id' },
        { accessorKey: 'instanceApiId', header: 'Instance API Id' },
        { accessorKey: 'instanceId', header: 'Instance Id' },
        { accessorKey: 'instanceName', header: 'Instance Name' },
        { accessorKey: 'productId', header: 'Product Id' },
        { accessorKey: 'productVersion', header: 'Product Version' },
        { accessorKey: 'appId', header: 'App Id' },
        { accessorKey: 'appVersion', header: 'App Version' },
        { accessorKey: 'apiVersionId', header: 'Api Version Id' },
        { accessorKey: 'apiId', header: 'Api Id' },
        { accessorKey: 'apiVersion', header: 'Api Version' },
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
        {
          id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
          Cell: ({ row }) => {
            const disabled = !instanceAppApiOwnership.canModifyRecord(row.original);
            return (
              <Tooltip title={disabled ? 'You can only delete instance app API associations you own.' : 'Delete Association'}>
                <span>
                  <IconButton color="error" onClick={() => handleDelete(row)} disabled={disabled}><DeleteForeverIcon /></IconButton>
                </span>
              </Tooltip>
            );
          },
        },
        {
          id: 'config', header: 'Config', enableSorting: false, enableColumnFilter: false,
          Cell: ({ row }) => (
            <Box sx={{ display: 'flex', gap: '0.1rem' }}>
              <Tooltip title="Config Properties"><IconButton onClick={() => navigate(buildTaskAwareRoute('/app/config/configInstanceAppApi', searchParams, contextForRow(row.original)), { state: { data: { instanceAppId: row.original.instanceAppId, instanceApiId: row.original.instanceApiId } } })}><AddToDriveIcon /></IconButton></Tooltip>
            </Box>
          ),
        },
      ],
      instanceAppApiOwnership,
    ),
    [contextForRow, handleDelete, instanceAppApiOwnership, navigate, searchParams],
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
    getRowId: (row) => `${row.instanceAppId}-${row.instanceApiId}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate(buildTaskAwareRoute('/app/form/createInstanceAppApi', searchParams, taskContext), { state: { data: initialData } })}
          disabled={!initialData.instanceId}
        >
          Create New Association
        </Button>
        {initialData.instanceId && (
          <Typography variant="subtitle1">
            For Instance: <strong>{initialData.instanceId}</strong>
          </Typography>
        )}
        {ownedOnly ? (
          <Typography variant="subtitle1">My Instance App APIs: <strong>{email || userId}</strong></Typography>
        ) : (
          <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>Admin View: All Instance App APIs</Typography>
        )}
      </Box>
    ),
  });

  return (
    <Box>
      <TaskActionPanel
        title="Instance Tasks"
        context={taskContext}
        taskIds={['manage-instance', 'manage-configuration']}
        maxActions={3}
      />
      <Box mt={2}>
        {!hasOwnerContext && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            User context is required before owner-scoped instance app API associations can be loaded.
          </Alert>
        )}
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
