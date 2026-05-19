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
import { Alert, Box, Button, IconButton, Tooltip, CircularProgress, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import DetailsIcon from '@mui/icons-material/Details';
import AirlineSeatReclineNormalIcon from '@mui/icons-material/AirlineSeatReclineNormal';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { applyOwnershipColumns, applyOwnershipFilter, defaultAllScopeRoles, ownershipScope } from '../../utils/ownershipScope';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// --- Type Definitions ---
type ServiceApiResponse = {
  services: Array<ServiceType>;
  total: number;
};

type ServiceType = {
  hostId: string;
  apiId: string;
  apiName?: string;
  apiDesc?: string;
  operationOwner?: string;
  deliveryOwner?: string;
  region?: string;
  businessGroup?: string;
  lob?: string;
  platform?: string;
  capability?: string;
  gitRepo?: string;
  tagIds?: string[];
  tags?: string[];
  categoryIds?: string[];
  categories?: string[];
  apiStatus?: string;
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

const allApiScopeRoles = [...defaultAllScopeRoles, 'api-admin'];

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

const listText = (value?: string[] | string | null) => {
  if (Array.isArray(value)) return value.join(', ');
  return value ?? '';
};

const toApiFormData = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const data = { ...(value as Record<string, unknown>) };
  delete data.tags;
  delete data.categories;
  return data;
};

export default function Service() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host, userId, email, roles, positions } = useUserState() as UserState;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const apiOwnership = useMemo(
    () => ownershipScope({
      roles,
      positions,
      ownerField: 'ownerUserId',
      allScopeRoles: allApiScopeRoles,
    }),
    [roles, userId, positions],
  );
  const ownedOnly = apiOwnership.ownedOnly;
  const hasOwnerContext = apiOwnership.hasOwnerContext;
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, { hostId: host ?? '', userId: userId ?? '' }),
    [host, searchContext, userId],
  );

  // Data and fetching state
  const [data, setData] = useState<ServiceType[]>([]);
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
      } else {
        // Keep other filters as is
        apiFilters.push(filter);
      }
    });

    const scopedFilters = applyOwnershipFilter(apiFilters, apiOwnership);

    const cmd = {
      host: 'lightapi.net', service: 'service', action: 'getApi', version: '0.1.0',
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
      setData(json.services || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, userId, ownedOnly, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, apiOwnership]);

  // useEffect to trigger fetchData when table state changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<ServiceType>) => {
    if (!apiOwnership.canModifyRecord(row.original)) {
      alert('You can only delete APIs you own.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete api: ${row.original.apiName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(service => service.apiId !== row.original.apiId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'service', action: 'deleteApi', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete api. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete api due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [apiOwnership, data]);

  const handleUpdate = useCallback(async (row: MRT_Row<ServiceType>) => {
    if (!apiOwnership.canModifyRecord(row.original)) {
      alert('You can only update APIs you own.');
      return;
    }
    const apiId = row.original.apiId;
    setIsUpdateLoading(apiId);

    const cmd = {
      host: 'lightapi.net', service: 'service', action: 'getFreshApi', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const freshData = await fetchClient(url);
      navigate(buildTaskAwareRoute('/app/form/updateApi', searchParams, {
        ...taskContext,
        hostId: row.original.hostId,
        apiId,
      }), { state: { data: toApiFormData(freshData), source: location.pathname } });
    } catch (error) {
      console.error("Failed to fetch api for update:", error);
      alert("Could not load the latest api data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [apiOwnership, navigate, location.pathname, searchParams, taskContext]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ServiceType>[]>(
    () => applyOwnershipColumns([
        { accessorKey: 'apiId', header: 'API ID' },
        { accessorKey: 'apiName', header: 'API Name' },
        {
          accessorKey: 'apiDesc',
          header: 'Description',
          Cell: TruncatedCell,
        },
        { accessorKey: 'operationOwner', header: 'Ops Owner' },
        { accessorKey: 'deliveryOwner', header: 'Dly Owner' },
        { accessorKey: 'apiStatus', header: 'Status' },
        {
          id: 'categories',
          header: 'Categories',
          accessorFn: (row) => listText(row.categories?.length ? row.categories : row.categoryIds),
          Cell: TruncatedCell,
        },
        {
          id: 'tags',
          header: 'Tags',
          accessorFn: (row) => listText(row.tags?.length ? row.tags : row.tagIds),
          Cell: TruncatedCell,
        },
        { accessorKey: 'gitRepo', header: 'Git Repo' },
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
      apiOwnership,
    ),
    [apiOwnership],
  );

  const contextForRow = useCallback((row: ServiceType) => ({
    ...taskContext,
    hostId: row.hostId,
    apiId: row.apiId,
  }), [taskContext]);

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
    getRowId: (row) => row.apiId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.5rem' }}>
        <Tooltip title="Details">
          <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/apiDetail', searchParams, contextForRow(row.original)), { state: { service: row.original } })}>
            <DetailsIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={apiOwnership.canModifyRecord(row.original) ? 'Update Api' : 'You can only update APIs you own.'}>
          <span>
            <IconButton onClick={() => handleUpdate(row)} disabled={!apiOwnership.canModifyRecord(row.original) || isUpdateLoading === row.original.apiId}>
              {isUpdateLoading === row.original.apiId ? <CircularProgress size={22} /> : <SystemUpdateIcon />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="OAuth Clients">
          <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/oauth/authClient', searchParams, contextForRow(row.original)), { state: { data: { hostId: row.original.hostId, apiId: row.original.apiId } } })}>
            <AirlineSeatReclineNormalIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={apiOwnership.canModifyRecord(row.original) ? 'Delete Api' : 'You can only delete APIs you own.'}>
          <span>
            <IconButton color="error" onClick={() => handleDelete(row)} disabled={!apiOwnership.canModifyRecord(row.original)}>
              <DeleteForeverIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildTaskAwareRoute('/app/form/createApi', searchParams, taskContext))}>
          Create New Api
        </Button>
        {ownedOnly ? (
          <Typography variant="subtitle1">My APIs: <strong>{email || userId}</strong></Typography>
        ) : (
          <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>Admin View: All APIs</Typography>
        )}
      </Box>
    ),
  });

  return (
    <Box>
      <TaskActionPanel
        title="API Tasks"
        context={taskContext}
        taskIds={['publish-api', 'mcp-onboard-api', 'register-standalone-mcp-server']}
        maxActions={3}
      />
      <Box mt={2}>
        {!hasOwnerContext && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            User context is required before owner-scoped APIs can be loaded.
          </Alert>
        )}
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
