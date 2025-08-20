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
import Cookies from "universal-cookie";

// --- Type Definitions ---
type EndpointApiResponse = {
  endpoints: Array<EndpointType>;
  total: number;
};

type EndpointType = {
  hostId: string;
  apiVersionId: string;
  apiId: string;
  apiVersion: string;
  endpoint: string;
  httpMethod: string;
  endpointPath: string;
  endpointDesc: string;
};

export default function ServiceEndpoint() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hostId, apiVersionId } = location.state.data;

  // Data and fetching state (unchanged)
  const [data, setData] = useState<EndpointType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state (unchanged)
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  // Data fetching logic (unchanged)
  const fetchData = useCallback(async () => {
    if (!hostId || !apiVersionId ) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    const cmd = {
      host: 'lightapi.net', service: 'service', action: 'getServiceEndpoint', version: '0.1.0',
      data: {
        hostId, apiVersionId,
        offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), filters: JSON.stringify(columnFilters ?? []), globalFilter: globalFilter ?? '',
      },
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as EndpointApiResponse;
      setData(json.endpoints || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [hostId, apiVersionId, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, data.length]);

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
      { accessorKey: 'endpointDesc', header: 'Description' },
      {
        id: 'generalActions', header: 'General', enableSorting: false, enableColumnFilter: false, size: 120,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
            <Tooltip title="List Scopes"><IconButton onClick={() => navigate('/app/listScope', { state: row.original })}><AccessibleForwardIcon /></IconButton></Tooltip>
            <Tooltip title="List Rules"><IconButton onClick={() => navigate('/app/listRule', { state: row.original })}><FilterListIcon /></IconButton></Tooltip>
          </Box>
        ),
      },
      {
        id: 'roleActions', header: 'Role Access', enableSorting: false, enableColumnFilter: false, size: 160,
        Cell: ({ row }) => {
          const s = { data: { ...row.original } };
          return (
            <Box sx={{ display: 'flex', gap: '0.1rem' }}>
              <Tooltip title="Role Permission"><IconButton onClick={() => navigate('/app/access/rolePermission', { state: s })}><DoNotTouchIcon /></IconButton></Tooltip>
              <Tooltip title="Role Row Filter"><IconButton onClick={() => navigate('/app/access/roleRowFilter', { state: s })}><KeyboardDoubleArrowDownIcon /></IconButton></Tooltip>
              <Tooltip title="Role Col Filter"><IconButton onClick={() => navigate('/app/access/roleColFilter', { state: s })}><KeyboardDoubleArrowRightIcon /></IconButton></Tooltip>
            </Box>
          );
        },
      },
      {
        id: 'groupActions', header: 'Group Access', enableSorting: false, enableColumnFilter: false, size: 160,
        Cell: ({ row }) => {
          const s = { data: { ...row.original } };
          return (
            <Box sx={{ display: 'flex', gap: '0.1rem' }}>
              <Tooltip title="Group Permission"><IconButton onClick={() => navigate('/app/access/groupPermission', { state: s })}><DoNotTouchIcon /></IconButton></Tooltip>
              <Tooltip title="Group Row Filter"><IconButton onClick={() => navigate('/app/access/groupRowFilter', { state: s })}><KeyboardDoubleArrowDownIcon /></IconButton></Tooltip>
              <Tooltip title="Group Col Filter"><IconButton onClick={() => navigate('/app/access/groupColFilter', { state: s })}><KeyboardDoubleArrowRightIcon /></IconButton></Tooltip>
            </Box>
          );
        },
      },
      {
        id: 'positionActions', header: 'Position Access', enableSorting: false, enableColumnFilter: false, size: 160,
        Cell: ({ row }) => {
          const s = { data: { ...row.original } };
          return (
            <Box sx={{ display: 'flex', gap: '0.1rem' }}>
              <Tooltip title="Position Permission"><IconButton onClick={() => navigate('/app/access/positionPermission', { state: s })}><DoNotTouchIcon /></IconButton></Tooltip>
              <Tooltip title="Position Row Filter"><IconButton onClick={() => navigate('/app/access/positionRowFilter', { state: s })}><KeyboardDoubleArrowDownIcon /></IconButton></Tooltip>
              <Tooltip title="Position Col Filter"><IconButton onClick={() => navigate('/app/access/positionColFilter', { state: s })}><KeyboardDoubleArrowRightIcon /></IconButton></Tooltip>
            </Box>
          );
        },
      },
      {
        id: 'attributeActions', header: 'Attribute Access', enableSorting: false, enableColumnFilter: false, size: 160,
        Cell: ({ row }) => {
          const s = { data: { ...row.original } };
          return (
            <Box sx={{ display: 'flex', gap: '0.1rem' }}>
              <Tooltip title="Attribute Permission"><IconButton onClick={() => navigate('/app/access/attributePermission', { state: s })}><DoNotTouchIcon /></IconButton></Tooltip>
              <Tooltip title="Attribute Row Filter"><IconButton onClick={() => navigate('/app/access/attributeRowFilter', { state: s })}><KeyboardDoubleArrowDownIcon /></IconButton></Tooltip>
              <Tooltip title="Attribute Col Filter"><IconButton onClick={() => navigate('/app/access/attributeColFilter', { state: s })}><KeyboardDoubleArrowRightIcon /></IconButton></Tooltip>
            </Box>
          );
        },
      },
      {
        id: 'userActions', header: 'User Access', enableSorting: false, enableColumnFilter: false, size: 120,
        Cell: ({ row }) => {
          const s = { data: { ...row.original } };
          return (
            <Tooltip title="User Permission"><IconButton onClick={() => navigate('/app/access/userPermission', { state: s })}><AccessibilityIcon /></IconButton></Tooltip>
          );
        },
      },
    ],
    [navigate],
  );

  // Table instance configuration
  const table = useMaterialReactTable({
    columns,
    data,
    enableRowActions: false, // Disable the single action column
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

  return <MaterialReactTable table={table} />;
}
