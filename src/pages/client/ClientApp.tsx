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
import AirlineSeatReclineNormalIcon from '@mui/icons-material/AirlineSeatReclineNormal';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { applyOwnershipColumns, applyOwnershipFilter, defaultAllScopeRoles, ownershipScope } from '../../utils/ownershipScope';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// --- Type Definitions ---
type AppApiResponse = {
  apps: Array<AppType>;
  total: number;
};

type AppType = {
  hostId: string;
  appId: string;
  appName?: string;
  appDesc?: string;
  isKafkaApp?: boolean;
  operationOwner?: string;
  deliveryOwner?: string;
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

const allClientAppScopeRoles = [...defaultAllScopeRoles, 'app-admin'];

export default function ClientApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { host, userId, email, roles, positions } = useUserState() as UserState;
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const clientAppOwnership = useMemo(
    () => ownershipScope({
      roles,
      positions,
      ownerField: 'ownerUserId',
      allScopeRoles: allClientAppScopeRoles,
    }),
    [roles, userId, positions],
  );
  const ownedOnly = clientAppOwnership.ownedOnly;
  const hasOwnerContext = clientAppOwnership.hasOwnerContext;
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, { hostId: host ?? '', userId: userId ?? '' }),
    [host, searchContext, userId],
  );
  const contextForRow = useCallback(
    (row: AppType) => mergeTaskContext(taskContext, { hostId: row.hostId, appId: row.appId }),
    [taskContext],
  );

  // Data and fetching state
  const [data, setData] = useState<AppType[]>([]);
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
    if (ownedOnly && !userId) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    let activeStatus = true; // Default to true if not present
    const apiFilters: MRT_ColumnFiltersState = [];

    columnFilters.forEach(filter => {
      if (filter.id === 'active') {
        // Extract active status (assuming filter.value is 'true'/'false' string from select)
        activeStatus = filter.value === 'true' || filter.value === true;
      } else if (filter.id === 'isKafkaApp') {
        // Handle boolean conversion for specific columns
        apiFilters.push({ ...filter, value: filter.value === 'true' });
      } else {
        // Keep other filters as is
        apiFilters.push(filter);
      }
    });

    const scopedFilters = applyOwnershipFilter(apiFilters, clientAppOwnership);

    const cmd = {
      host: 'lightapi.net', service: 'client', action: 'getApp', version: '0.1.0',
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
      setData(json.apps || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, userId, ownedOnly, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, clientAppOwnership]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<AppType>) => {
    if (!clientAppOwnership.canModifyRecord(row.original)) {
      alert('You can only delete client apps you own.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete app: ${row.original.appName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(app => app.appId !== row.original.appId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'client', action: 'deleteApp', version: '0.1.0',
      data: { hostId: row.original.hostId, appId: row.original.appId , aggregateVersion: row.original.aggregateVersion},
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete app. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete app due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [clientAppOwnership, data]);

  // Handler to fetch fresh data before navigating to update form
  const handleUpdate = useCallback(async (row: MRT_Row<AppType>) => {
    if (!clientAppOwnership.canModifyRecord(row.original)) {
      alert('You can only update client apps you own.');
      return;
    }
    const appId = row.original.appId;
    setIsUpdateLoading(appId);

    const cmd = {
      host: 'lightapi.net', service: 'client', action: 'getAppById', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const freshData = await fetchClient(url);
      console.log("freshData", freshData);

      // Navigate with the fresh data
      navigate(buildTaskAwareRoute('/app/form/updateApp', searchParams, contextForRow(row.original)), {
        state: {
          data: freshData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch app for update:", error);
      alert("Could not load the latest app data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [clientAppOwnership, contextForRow, navigate, location.pathname, searchParams]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<AppType>[]>(
    () => applyOwnershipColumns([
        { accessorKey: 'appId', header: 'App ID' },
        { accessorKey: 'appName', header: 'App Name' },
        { accessorKey: 'appDesc', header: 'Description' },
        {
          accessorKey: 'isKafkaApp',
          header: 'Kafka App',
          filterVariant: 'select',
          filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
          Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
        },
        { accessorKey: 'operationOwner', header: 'Ops Owner' },
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
      ],
      clientAppOwnership,
    ),
    [clientAppOwnership],
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
    getRowId: (row) => row.appId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.5rem' }}>
        <Tooltip title={clientAppOwnership.canModifyRecord(row.original) ? 'Update App' : 'You can only update client apps you own.'}>
          <span>
            <IconButton
              onClick={() => handleUpdate(row)}
              disabled={!clientAppOwnership.canModifyRecord(row.original) || isUpdateLoading === row.original.appId}
            >
              {isUpdateLoading === row.original.appId ? (
                <CircularProgress size={22} />
              ) : (
                <SystemUpdateIcon />
              )}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={clientAppOwnership.canModifyRecord(row.original) ? 'Delete App' : 'You can only delete client apps you own.'}>
          <span>
            <IconButton color="error" onClick={() => handleDelete(row)} disabled={!clientAppOwnership.canModifyRecord(row.original)}>
              <DeleteForeverIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="OAuth Clients">
          <IconButton onClick={() => navigate(
            buildTaskAwareRoute('/app/oauth/authClient', searchParams, contextForRow(row.original)),
            { state: { data: { hostId: row.original.hostId, appId: row.original.appId } } },
          )}>
            <AirlineSeatReclineNormalIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Create OAuth Client">
          <IconButton onClick={() => navigate(
            buildTaskAwareRoute('/app/form/createClient', searchParams, contextForRow(row.original)),
            { state: { data: { hostId: row.original.hostId, appId: row.original.appId } } },
          )}>
            <VpnKeyIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Instance Apps">
          <IconButton onClick={() => navigate(
            buildTaskAwareRoute('/app/instance/InstanceApp', searchParams, contextForRow(row.original)),
            { state: { data: { hostId: row.original.hostId, appId: row.original.appId } } },
          )}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildTaskAwareRoute('/app/form/createApp', searchParams, taskContext))}>
          Create New App
        </Button>
        {ownedOnly ? (
          <Typography variant="subtitle1">My Apps: <strong>{email || userId}</strong></Typography>
        ) : (
          <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>Admin View: All Apps</Typography>
        )}
      </Box>
    ),
  });

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ mb: 2 }}>
        <TaskActionPanel
          title="Client App Tasks"
          context={taskContext}
          taskIds={['manage-client-app', 'manage-oauth-provider', 'manage-instance']}
          maxActions={3}
        />
      </Box>
      {!hasOwnerContext && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          User context is required before owner-scoped client apps can be loaded.
        </Alert>
      )}
      <MaterialReactTable table={table} />
    </Box>
  );
}
