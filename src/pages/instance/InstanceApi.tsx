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
import RouteIcon from "@mui/icons-material/Route";
import CodeOffIcon from '@mui/icons-material/CodeOff';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { applyOwnershipColumns, applyOwnershipFilter, defaultAllScopeRoles, ownershipScope } from '../../utils/ownershipScope';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// --- Type Definitions ---
type InstanceApiApiResponse = {
  instanceApis: Array<InstanceApiType>;
  total: number;
};

type InstanceApiType = {
  hostId: string;
  instanceApiId: string;
  instanceId: string;
  instanceName?: string;
  productId?: string;
  productVersion?: string;
  serviceId?: string;
  apiType?: string;
  protocol?: string;
  envTag?: string;
  targetHost?: string;
  apiVersionId: string;
  apiId?: string;
  apiVersion?: string;
  apiName?: string;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

const allInstanceApiScopeRoles = [...defaultAllScopeRoles, 'instance-admin'];

export default function InstanceApi() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host, userId, email, roles, positions } = useUserState() as { host: string; userId?: string; email?: string; roles?: string | null; positions?: string | null };
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const instanceApiOwnership = useMemo(
    () => ownershipScope({
      roles,
      positions,
      ownerField: 'ownerUserId',
      allScopeRoles: allInstanceApiScopeRoles,
    }),
    [roles, userId, positions],
  );
  const ownedOnly = instanceApiOwnership.ownedOnly;
  const hasOwnerContext = instanceApiOwnership.hasOwnerContext;
  const initialData = useMemo(
    () => ({ ...searchContext, ...(location.state?.data || {}) }),
    [location.state, searchContext],
  );
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, {
      hostId: initialData.hostId ?? host,
      userId: userId ?? '',
      instanceApiId: initialData.instanceApiId ?? '',
      instanceId: initialData.instanceId ?? '',
      apiVersionId: initialData.apiVersionId ?? '',
      apiId: initialData.apiId ?? '',
    }),
    [host, userId, initialData.apiId, initialData.apiVersionId, initialData.hostId, initialData.instanceApiId, initialData.instanceId, searchContext],
  );

  // Data and fetching state
  const [data, setData] = useState<InstanceApiType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
    const initialFilters: MRT_ColumnFiltersState = [
      { id: 'active', value: 'true' } // Default to active
    ];
    if (initialData.instanceApiId) initialFilters.push({ id: 'instanceApiId', value: initialData.instanceApiId });
    if (initialData.instanceId) initialFilters.push({ id: 'instanceId', value: initialData.instanceId });
    if (initialData.apiVersionId) initialFilters.push({ id: 'apiVersionId', value: initialData.apiVersionId });
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

    const scopedFilters = applyOwnershipFilter(apiFilters, instanceApiOwnership);

    const cmd = {
      host: 'lightapi.net',
      service: 'instance',
      action: 'getInstanceApi',
      version: '0.1.0',
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
      setData(json.instanceApis || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, userId, ownedOnly, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, instanceApiOwnership]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<InstanceApiType>) => {
    if (!instanceApiOwnership.canModifyRecord(row.original)) {
      alert('You can only delete instance API links you own.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete instance API ${row.original.instanceApiId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(item => item.instanceApiId !== row.original.instanceApiId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'deleteInstanceApi', version: '0.1.0',
      data: { hostId: row.original.hostId, instanceApiId: row.original.instanceApiId , aggregateVersion: row.original.aggregateVersion},
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete instance API. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete instance API due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [instanceApiOwnership, data]);

  const contextForRow = useCallback((row: InstanceApiType) => ({
    ...taskContext,
    hostId: row.hostId,
    instanceApiId: row.instanceApiId,
    instanceId: row.instanceId,
    productId: row.productId ?? '',
    serviceId: row.serviceId ?? '',
    apiVersionId: row.apiVersionId,
    apiId: row.apiId ?? '',
  }), [taskContext]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<InstanceApiType>[]>(
    () => applyOwnershipColumns([
        { accessorKey: 'instanceApiId', header: 'Instance API Id' },
        { accessorKey: 'instanceName', header: 'Instance Name' },
        { accessorKey: 'productId', header: 'Product Id' },
        { accessorKey: 'serviceId', header: 'Service Id' },
        { accessorKey: 'apiId', header: 'API Id' },
        { accessorKey: 'apiVersion', header: 'API Version' },
        { accessorKey: 'apiName', header: 'API Name' },
        { accessorKey: 'apiType', header: 'API Type' },
        { accessorKey: 'protocol', header: 'Protocol' },
        { accessorKey: 'envTag', header: 'Env Tag' },
        { accessorKey: 'targetHost', header: 'Target Host' },
        {
          accessorKey: 'active',
          header: 'Active',
          filterVariant: 'select',
          filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
          Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
        },
        { accessorKey: 'hostId', header: 'Host Id' },
        { accessorKey: 'updateUser', header: 'Update User' },
        {
          accessorKey: 'updateTs',
          header: 'Update Time',
          Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
        },
        { accessorKey: 'aggregateVersion', header: 'AggregateVersion' },
      ],
      instanceApiOwnership,
    ),
    [instanceApiOwnership],
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
    getRowId: (row) => row.instanceApiId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.1rem' }}>
        <Tooltip title={instanceApiOwnership.canModifyRecord(row.original) ? 'Delete Instance API' : 'You can only delete instance API links you own.'}>
          <span>
            <IconButton color="error" onClick={() => handleDelete(row)} disabled={!instanceApiOwnership.canModifyRecord(row.original)}>
              <DeleteForeverIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Instance Api Config">
          <IconButton color="primary" onClick={() => navigate(buildTaskAwareRoute('/app/config/configInstanceApi', searchParams, contextForRow(row.original)), { state: { data: { instanceApiId: row.original.instanceApiId, instanceId: row.original.instanceId, apiId: row.original.apiId, apiVersion: row.original.apiVersion } } })}>
            <AddToDriveIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Api Path Prefix">
          <IconButton color="primary" onClick={() => navigate(buildTaskAwareRoute('/app/instance/InstanceApiPathPrefix', searchParams, contextForRow(row.original)), { state: { data: { instanceApiId: row.original.instanceApiId, instanceName: row.original.instanceName, productId: row.original.productId, apiId: row.original.apiId, apiVersion: row.original.apiVersion } } })}>
            <RouteIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Instance Api MCP Tool">
          <IconButton color="primary" onClick={() => navigate(buildTaskAwareRoute('/app/instance/InstanceApiMcpTool', searchParams, contextForRow(row.original)), { state: { data: { instanceApiId: row.original.instanceApiId, instanceName: row.original.instanceName, productId: row.original.productId, apiId: row.original.apiId, apiVersion: row.original.apiVersion, apiVersionId: row.original.apiVersionId, serviceId: row.original.serviceId, apiName: row.original.apiName, apiType: row.original.apiType, protocol: row.original.protocol, envTag: row.original.envTag, targetHost: row.original.targetHost } } })}>
            <CodeOffIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate(buildTaskAwareRoute('/app/form/createInstanceApi', searchParams, taskContext), { state: { data: initialData } })}
          disabled={!initialData.instanceId && !initialData.apiVersionId}
        >
          Create New Instance Api
        </Button>
        {initialData.instanceId && (
          <Typography variant="subtitle1">
            For Instance: <strong>{initialData.instanceId}</strong>
          </Typography>
        )}
        {initialData.apiVersionId && (
          <Typography variant="subtitle1">
            For API Version: <strong>{initialData.apiVersionId}</strong>
          </Typography>
        )}
        {ownedOnly ? (
          <Typography variant="subtitle1">My Instance APIs: <strong>{email || userId}</strong></Typography>
        ) : (
          <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>Admin View: All Instance APIs</Typography>
        )}
      </Box>
    ),
  });

  return (
    <Box>
      <TaskActionPanel
        title="Instance Tasks"
        context={taskContext}
        taskIds={["manage-instance", "mcp-onboard-api", "register-standalone-mcp-server", "configure-access-control"]}
      />
      <Box mt={2}>
        {!hasOwnerContext && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            User context is required before owner-scoped instance API links can be loaded.
          </Alert>
        )}
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
