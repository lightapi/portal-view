import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
  type MRT_RowSelectionState,
} from 'material-react-table';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import FilterListIcon from "@mui/icons-material/FilterList";
import AccessibleForwardIcon from "@mui/icons-material/AccessibleForward";
import DoNotTouchIcon from "@mui/icons-material/DoNotTouch";
import KeyboardDoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import AccessibilityIcon from "@mui/icons-material/Accessibility";
import BatchPredictionIcon from "@mui/icons-material/BatchPrediction";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { useUserState } from "../../contexts/UserContext";
import fetchClient from "../../utils/fetchClient";
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';
import HelpLink from '../../components/HelpLink';
import ServiceEndpointBulkAccessDrawer from './ServiceEndpointBulkAccessDrawer';
import ServiceEndpointAccessOverviewDrawer from './ServiceEndpointAccessOverviewDrawer';

// --- Type Definitions ---
type EndpointApiResponse = {
  endpoints: Array<EndpointType>;
  total: number;
};

export type EndpointType = {
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
  routingDomain?: string;
  semanticNamespace?: string;
  sensitivityTier?: string;
  semanticWeight?: number;
  sourceProtocol?: string;
  targetPersonas?: string;
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
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [bulkAccessOpen, setBulkAccessOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Data fetching logic (unchanged)
  const fetchData = useCallback(async () => {
    if (!host || !initialApiVersionId) return;
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
      setIsLoading(false); setIsRefetching(false);
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
      { accessorKey: 'routingDomain', header: 'Routing Domain' },
      { accessorKey: 'semanticNamespace', header: 'Semantic Namespace' },
      { accessorKey: 'sensitivityTier', header: 'Sensitivity Tier' },
      { accessorKey: 'semanticWeight', header: 'Semantic Weight' },
      { accessorKey: 'sourceProtocol', header: 'Source Protocol' },
      { accessorKey: 'targetPersonas', header: 'Target Personas', Cell: TruncatedCell },
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

  const selectedEndpoints = useMemo(
    () => data.filter((row) => rowSelection[row.endpointId]),
    [data, rowSelection],
  );

  const handleBulkSuccess = useCallback(() => {
    setBulkAccessOpen(false);
    setRowSelection({});
    setOverviewRefreshKey((value) => value + 1);
    fetchData();
  }, [fetchData]);

  // Table instance configuration
  const table = useMaterialReactTable({
    columns,
    data,
    enableRowSelection: true,
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
    state: { isLoading, showAlertBanner: isError, showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter, rowSelection },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.endpointId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading endpoints' } : undefined,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<BatchPredictionIcon />}
          disabled={selectedEndpoints.length === 0}
          onClick={() => setBulkAccessOpen(true)}
        >
          Bulk Access
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FactCheckIcon />}
          disabled={!initialApiVersionId}
          onClick={() => setOverviewOpen(true)}
        >
          Access Overview
        </Button>
      </Box>
    ),
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" noWrap>Service Endpoints</Typography>
          {initialApiVersionId && (
            <Typography variant="body2" color="text.secondary" noWrap>{initialApiVersionId}</Typography>
          )}
        </Box>
        <HelpLink
          helpPath="/help/portal-view/pages/service-endpoint"
          tooltip="Help: Service Endpoint"
        />
      </Stack>
      <TaskActionPanel
        title="Endpoint Tasks"
        context={taskContext}
        taskIds={['publish-api', 'mcp-onboard-api', 'configure-access-control']}
        maxActions={3}
      />
      <Box mt={2}>
        <MaterialReactTable table={table} />
      </Box>
      <ServiceEndpointBulkAccessDrawer
        open={bulkAccessOpen}
        hostId={host ?? ''}
        apiVersionId={initialApiVersionId ?? ''}
        endpoints={selectedEndpoints}
        onClose={() => setBulkAccessOpen(false)}
        onSuccess={handleBulkSuccess}
      />
      <ServiceEndpointAccessOverviewDrawer
        open={overviewOpen}
        hostId={host ?? ''}
        apiVersionId={initialApiVersionId ?? ''}
        refreshKey={overviewRefreshKey}
        highlightedEndpointIds={selectedEndpoints.map((endpoint) => endpoint.endpointId)}
        onClose={() => setOverviewOpen(false)}
      />
    </Box>
  );
}
