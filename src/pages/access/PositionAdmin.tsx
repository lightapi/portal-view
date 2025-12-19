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
import { Box, Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import DoNotTouchIcon from '@mui/icons-material/DoNotTouch';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import RadarIcon from '@mui/icons-material/Radar';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type PositionApiResponse = {
  positions: Array<PositionType>;
  total: number;
};

type PositionType = {
  hostId: string;
  positionId: string;
  positionDesc?: string;
  inheritToAncestor?: string;
  inheritToSibling?: string;
  aggregateVersion?: number;
  updateUser: string;
  updateTs: string;
  active: boolean;
};

interface UserState {
  host?: string;
}

export default function PositionAdmin() {
  const navigate = useNavigate();
  const { host } = useUserState() as UserState;

  // Data and fetching state
  const [data, setData] = useState<PositionType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    [
      { id: 'active', value: 'true' }
    ]
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
      host: 'lightapi.net', service: 'position', action: 'getPosition', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(apiFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as PositionApiResponse;
      setData(json.positions || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, data.length]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<PositionType>) => {
    if (!window.confirm(`Are you sure you want to delete position: ${row.original.positionId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(pos => pos.positionId !== row.original.positionId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'position', action: 'deletePosition', version: '0.1.0',
      data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete position. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete position due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<PositionType>) => {
    const positionId = row.original.positionId;
    setIsUpdateLoading(positionId);

    const cmd = {
      host: 'lightapi.net', service: 'position', action: 'getFreshPosition', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const freshData = await response.json();
      console.log("freshData", freshData);
      if (!response.ok) {
        throw new Error(freshData.description || 'Failed to fetch latest position data.');
      }

      // Navigate with the fresh data
      navigate('/app/form/updatePosition', {
        state: {
          data: freshData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch position for update:", error);
      alert("Could not load the latest position data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<PositionType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'positionId', header: 'Position ID' },
      { accessorKey: 'positionDesc', header: 'Description' },
      { accessorKey: 'inheritToAncestor', header: 'Inherit Ancestor' },
      { accessorKey: 'inheritToSibling', header: 'Inherit Sibling' },
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
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Update Position">
            <IconButton
              onClick={() => handleUpdate(row)}
              disabled={isUpdateLoading === row.original.positionId}
            >
              {isUpdateLoading === row.original.positionId ? (
                <CircularProgress size={22} />
              ) : (
                <SystemUpdateIcon />
              )}
            </IconButton>
          </Tooltip>
        )
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (<Tooltip title="Delete Position"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
      {
        id: 'accessControl', header: 'Access Control', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
            <Tooltip title="Position Permissions"><IconButton onClick={() => navigate('/app/access/positionPermission', { state: { data: { positionId: row.original.positionId } } })}><DoNotTouchIcon /></IconButton></Tooltip>
            <Tooltip title="Position Row Filters"><IconButton onClick={() => navigate('/app/access/positionRowFilter', { state: { data: { positionId: row.original.positionId } } })}><KeyboardDoubleArrowDownIcon /></IconButton></Tooltip>
            <Tooltip title="Position Column Filters"><IconButton onClick={() => navigate('/app/access/positionColFilter', { state: { data: { positionId: row.original.positionId } } })}><KeyboardDoubleArrowRightIcon /></IconButton></Tooltip>
            <Tooltip title="Manage Users"><IconButton onClick={() => navigate('/app/access/positionUser', { state: { data: { positionId: row.original.positionId } } })}><RadarIcon /></IconButton></Tooltip>
          </Box>
        ),
      },
    ],
    [handleDelete, navigate],
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
    getRowId: (row) => row.positionId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createPosition')}>
        Create New Position
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
