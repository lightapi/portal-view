import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Box, IconButton, Tooltip } from '@mui/material';
import FilterListIcon from "@mui/icons-material/FilterList";
import AccessibleForwardIcon from "@mui/icons-material/AccessibleForward";
import DoNotTouchIcon from "@mui/icons-material/DoNotTouch";
import KeyboardDoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import AccessibilityIcon from "@mui/icons-material/Accessibility";
import { useUserState } from "../../contexts/UserContext";
import fetchClient from "../../utils/fetchClient";
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// --- Type Definitions ---
type EndpointApiResponse = {
  endpoints: Array<EndpointType>;
  total: number;
};

type EndpointType = {
  hostId: string;
  endpointId: string;
  apiVersionId: string;
  apiId: string;
  apiVersion: string;
  endpoint: string;
  httpMethod: string;
  endpointPath: string;
  toolSchema?: string;
  toolMetadata?: string;
  endpointDesc: string;
  active: boolean;
};
interface UserState {
  host?: string;
}

const TruncatedCell = ({ cell }: { cell: any }) => {
  const value = cell.getValue() ?? '';
  return (
    <Tooltip title={value} placement="top-start">
      <Box component="span" sx={{ display: 'block', maxWidth: '200px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {value}
      </Box>
    </Tooltip>
  );
};

export default function ServiceEndpoint() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const state = location.state as { data?: Partial<EndpointType> } | Partial<EndpointType> | null;
  const initialData = useMemo(
    () => ({ ...searchContext, ...('data' in (state ?? {}) ? (state as { data?: Partial<EndpointType> }).data : state) }),
    [searchContext, state],
  );
  const initialApiVersionId = initialData.apiVersionId;
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, {
      hostId: initialData.hostId ?? host ?? '',
      apiId: initialData.apiId ?? '',
      apiVersionId: initialApiVersionId ?? '',
      endpointId: initialData.endpointId ?? '',
    }),
    [host, initialApiVersionId, initialData.apiId, initialData.endpointId, initialData.hostId, searchContext],
  );

  // Data and fetching state (unchanged)
  const [data, setData] = useState<EndpointType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state (unchanged)
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    initialApiVersionId ? [
      { id: 'apiVersionId', value: initialApiVersionId },
      { id: 'active', value: 'true' },
    ] : [
      { id: 'active', value: 'true' },
    ],
  );
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Data fetching logic (unchanged)
  const fetchData = useCallback(async () => {
    if (!host || !initialApiVersionId) return;
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
      host: 'lightapi.net', service: 'service', action: 'getApiEndpoint', version: '0.1.0',
      data: {
        hostId: host,
        offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(apiFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const json = await fetchClient(url);
      setData(json.endpoints || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, initialApiVersionId, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

  // useEffect to trigger fetchData (unchanged)
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Column definitions (unchanged)
  const columns = useMemo<MRT_ColumnDef<EndpointType>[]>(
    () => [
      { accessorKey: 'endpoint', header: 'Endpoint' },
      { accessorKey: 'httpMethod', header: 'Method' },
      { accessorKey: 'endpointPath', header: 'Path' },
      { accessorKey: 'toolSchema', header: 'Tool Schema', Cell: TruncatedCell },
      { accessorKey: 'toolMetadata', header: 'Tool Metadata', Cell: TruncatedCell },
      { accessorKey: 'endpointDesc', header: 'Description', Cell: TruncatedCell },
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

  const contextForRow = useCallback((row: EndpointType) => ({
    ...taskContext,
    hostId: row.hostId,
    apiId: row.apiId,
    apiVersionId: row.apiVersionId,
    endpointId: row.endpointId,
  }), [taskContext]);

  // Table instance configuration
  const table = useMaterialReactTable({
    columns,
    data,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => {
      const s = { data: { ...row.original } };
      const rowContext = contextForRow(row.original);
      return (
        <Box sx={{ display: 'flex', gap: '0.1rem' }}>
          <Tooltip title="List Scopes">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/listScope', searchParams, rowContext), { state: row.original })}>
              <AccessibleForwardIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="List Rules">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/listRule', searchParams, rowContext), { state: row.original })}>
              <FilterListIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Role Permission">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/rolePermission', searchParams, rowContext), { state: s })}>
              <DoNotTouchIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Role Row Filter">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/roleRowFilter', searchParams, rowContext), { state: s })}>
              <KeyboardDoubleArrowDownIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Role Col Filter">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/roleColFilter', searchParams, rowContext), { state: s })}>
              <KeyboardDoubleArrowRightIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Group Permission">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/groupPermission', searchParams, rowContext), { state: s })}>
              <DoNotTouchIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Group Row Filter">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/groupRowFilter', searchParams, rowContext), { state: s })}>
              <KeyboardDoubleArrowDownIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Group Col Filter">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/groupColFilter', searchParams, rowContext), { state: s })}>
              <KeyboardDoubleArrowRightIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Position Permission">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/positionPermission', searchParams, rowContext), { state: s })}>
              <DoNotTouchIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Position Row Filter">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/positionRowFilter', searchParams, rowContext), { state: s })}>
              <KeyboardDoubleArrowDownIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Position Col Filter">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/positionColFilter', searchParams, rowContext), { state: s })}>
              <KeyboardDoubleArrowRightIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Attribute Permission">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/attributePermission', searchParams, rowContext), { state: s })}>
              <DoNotTouchIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Attribute Row Filter">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/attributeRowFilter', searchParams, rowContext), { state: s })}>
              <KeyboardDoubleArrowDownIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Attribute Col Filter">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/attributeColFilter', searchParams, rowContext), { state: s })}>
              <KeyboardDoubleArrowRightIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="User Permission">
            <IconButton onClick={() => navigate(buildTaskAwareRoute('/app/access/userPermission', searchParams, rowContext), { state: s })}>
              <AccessibilityIcon />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
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
    getRowId: (row) => row.endpoint,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading endpoints' } : undefined,
  });

  return (
    <Box>
      <TaskActionPanel
        title="Endpoint Tasks"
        context={taskContext}
        taskIds={['publish-api', 'mcp-onboard-api', 'configure-access-control']}
        maxActions={3}
      />
      <Box mt={2}>
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
