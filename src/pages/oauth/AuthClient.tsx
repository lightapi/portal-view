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
import { Alert, Box, Button, IconButton, Tooltip, Typography, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import fetchClient from '../../utils/fetchClient';
import { applyOwnershipColumns, applyOwnershipFilter, defaultAllScopeRoles, ownershipScope } from '../../utils/ownershipScope';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// --- Type Definitions ---
type AuthClientApiResponse = {
  clients: Array<AuthClientType>; // Assuming the API returns a 'clients' array
  total: number;
};

type AuthClientType = {
  hostId: string;
  clientId: string;
  ownerId?: string;
  ownerType?: 'app' | 'api_version' | 'instance' | 'service_account';
  ownerName?: string;
  clientName: string;
  appId?: string;
  appName?: string;
  apiId?: string;
  apiVersion?: string;
  apiVersionId?: string;
  apiName?: string;
  instanceId?: string;
  instanceName?: string;
  clientType: 'public' | 'confidential' | 'trusted' | 'external';
  clientProfile: 'webserver' | 'mobile' | 'browser' | 'service' | 'batch';
  clientSecret: string;
  clientScope?: string;
  customClaim?: string;
  redirectUri?: string;
  authenticateClass?: string;
  tokenExType?: string;
  deRefClientId?: string; // Correct property name from backend
  active: boolean;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

interface UserState {
  host?: string;
  userId?: string;
  email?: string;
  roles?: string | null;
  positions?: string | null;
}

const allOauthClientScopeRoles = [...defaultAllScopeRoles, 'oauth-client-admin'];

export default function AuthClient() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host, userId, email, roles, positions } = useUserState() as UserState;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const oauthClientOwnership = useMemo(
    () => ownershipScope({
      roles,
      positions,
      ownerField: 'ownerUserId',
      allScopeRoles: allOauthClientScopeRoles,
    }),
    [roles, userId, positions],
  );
  const ownedOnly = oauthClientOwnership.ownedOnly;
  const hasOwnerContext = oauthClientOwnership.hasOwnerContext;
  const initialData = useMemo(
    () => ({ ...searchContext, ...(location.state?.data || {}) }),
    [location.state, searchContext],
  );
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, {
      hostId: host ?? '',
      userId: userId ?? '',
      clientId: initialData.clientId ?? '',
      appId: initialData.appId ?? '',
      apiId: initialData.apiId ?? '',
      apiVersionId: initialData.apiVersionId ?? '',
      instanceId: initialData.instanceId ?? '',
    }),
    [host, userId, initialData.apiId, initialData.apiVersionId, initialData.appId, initialData.clientId, initialData.instanceId, searchContext],
  );

  // Data and fetching state
  const [data, setData] = useState<AuthClientType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  // Table state, pre-filtered by context if provided
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() =>
    Object.entries(initialData)
      .map(([id, value]) => ({ id, value: value as string }))
      .filter(f => f.value)
      .concat([{ id: 'active', value: 'true' }])
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

    const scopedFilters = applyOwnershipFilter(apiFilters, oauthClientOwnership);

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'getClient', version: '0.1.0',
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
      setData(json.clients || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, userId, ownedOnly, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, oauthClientOwnership]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<AuthClientType>) => {
    if (!oauthClientOwnership.canModifyRecord(row.original)) {
      alert('You can only delete OAuth clients you own.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete client: ${row.original.clientName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(client => client.clientId !== row.original.clientId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'deleteClient', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete client. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete client due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [oauthClientOwnership, data]);

  const handleUpdate = useCallback(async (row: MRT_Row<AuthClientType>) => {
    if (!oauthClientOwnership.canModifyRecord(row.original)) {
      alert('You can only update OAuth clients you own.');
      return;
    }
    const clientId = row.original.clientId;
    setIsUpdateLoading(clientId);

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'getFreshClient', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const freshData = await fetchClient(url);
      console.log("freshData", freshData);

      // Navigate with the fresh data
      navigate(buildTaskAwareRoute('/app/form/updateClient', searchParams, {
        ...taskContext,
        hostId: row.original.hostId,
        clientId,
        appId: row.original.appId ?? '',
        apiId: row.original.apiId ?? '',
        apiVersionId: row.original.apiVersionId ?? '',
        instanceId: row.original.instanceId ?? '',
      }), {
        state: {
          data: freshData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch data for update:", error);
      alert("Could not load the latest data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [oauthClientOwnership, navigate, location.pathname, searchParams, taskContext]);


  // Column definitions
  const columns = useMemo<MRT_ColumnDef<AuthClientType>[]>(
    () => applyOwnershipColumns([
        { accessorKey: 'clientId', header: 'Client Id' },
        { accessorKey: 'clientName', header: 'Client Name' },
        { accessorKey: 'ownerType', header: 'Owner Type' },
        { accessorKey: 'ownerName', header: 'Owner Name' },
        { accessorKey: 'clientType', header: 'Type' },
        { accessorKey: 'clientProfile', header: 'Profile' },
        { accessorKey: 'tokenExType', header: 'Token Ex Type' },
        { accessorKey: 'appId', header: 'App Id' },
        { accessorKey: 'appName', header: 'App Name' },
        { accessorKey: 'apiId', header: 'API Id' },
        { accessorKey: 'apiName', header: 'API Name' },
        { accessorKey: 'apiVersion', header: 'API Version' },
        { accessorKey: 'apiVersionId', header: 'API Version Id' },
        { accessorKey: 'instanceName', header: 'Instance Name' },
        { accessorKey: 'instanceId', header: 'Instance Id' },
        { accessorKey: 'clientScope', header: 'Scope' },
        { accessorKey: 'customClaim', header: 'Custom Claim' },
        { accessorKey: 'redirectUri', header: 'Redirect URI' },
        { accessorKey: 'authenticateClass', header: 'Authenticate Class' },
        { accessorKey: 'deRefClientId', header: 'Dereference Client Id' },
        { accessorKey: 'hostId', header: 'Host Id' },
        { accessorKey: 'updateUser', header: 'Update User' },
        { accessorKey: 'updateTs', header: 'Update Timestamp' },
        { accessorKey: 'aggregateVersion', header: 'Version' },
        {
          accessorKey: 'active',
          header: 'Active',
          filterVariant: 'select',
          filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
          Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
        },
      ],
      oauthClientOwnership,
    ),
    [oauthClientOwnership],
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
    getRowId: (row) => row.clientId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.1rem' }}>
        <Tooltip title="Client Tokens">
          <IconButton color="primary" onClick={() => navigate(buildTaskAwareRoute('/app/oauth/clientToken', searchParams, {
            ...taskContext,
            hostId: row.original.hostId,
            clientId: row.original.clientId,
            appId: row.original.appId ?? '',
            apiId: row.original.apiId ?? '',
            apiVersionId: row.original.apiVersionId ?? '',
            instanceId: row.original.instanceId ?? '',
          }), { state: { data: { clientId: row.original.clientId } } })}>
            <VpnKeyIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={oauthClientOwnership.canModifyRecord(row.original) ? 'Update Client' : 'You can only update OAuth clients you own.'}>
          <span>
            <IconButton onClick={() => handleUpdate(row)} disabled={!oauthClientOwnership.canModifyRecord(row.original) || isUpdateLoading === row.original.clientId}>
              {isUpdateLoading === row.original.clientId ? <CircularProgress size={22} /> : <SystemUpdateIcon />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={oauthClientOwnership.canModifyRecord(row.original) ? 'Delete Client' : 'You can only delete OAuth clients you own.'}>
          <span>
            <IconButton color="error" onClick={() => handleDelete(row)} disabled={!oauthClientOwnership.canModifyRecord(row.original)}>
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
          onClick={() => navigate(buildTaskAwareRoute('/app/form/createClient', searchParams, taskContext), { state: { data: initialData } })}
        >
          Create New Client
        </Button>
        {initialData.appId && (
          <Typography variant="subtitle1">
            For App: <strong>{initialData.appId}</strong>
          </Typography>
        )}
        {initialData.apiVersionId && (
          <Typography variant="subtitle1">
            For API Version: <strong>{initialData.apiVersionId}</strong>
          </Typography>
        )}
        {initialData.instanceId && (
          <Typography variant="subtitle1">
            For Instance: <strong>{initialData.instanceId}</strong>
          </Typography>
        )}
        {ownedOnly ? (
          <Typography variant="subtitle1">My OAuth Clients: <strong>{email || userId}</strong></Typography>
        ) : (
          <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>Admin View: All OAuth Clients</Typography>
        )}
      </Box>
    ),
  });

  return (
    <Box>
      <TaskActionPanel
        title="OAuth Client Tasks"
        context={taskContext}
        taskIds={['manage-oauth-provider', 'publish-api', 'mcp-onboard-api', 'manage-instance']}
        maxActions={3}
      />
      <Box mt={2}>
        {!hasOwnerContext && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            User context is required before owner-scoped OAuth clients can be loaded.
          </Alert>
        )}
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
