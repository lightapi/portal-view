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
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import LanguageIcon from '@mui/icons-material/Language';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost.js';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type RefValueApiResponse = {
  refValues: Array<RefValueType>;
  total: number;
};

type RefValueType = {
  hostId: string;
  tableId: string;
  tableName: string;
  valueId: string;
  valueCode: string;
  valueDesc?: string;
  active: boolean;
  startTs?: string;
  endTs?: string;
  displayOrder?: number;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};
interface UserState {
  host?: string;
}

export default function RefValue() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const initialTableId = location.state?.data?.tableId;

  // Data and fetching state
  const [data, setData] = useState<RefValueType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    initialTableId ? [
      { id: 'tableId', value: initialTableId },
      { id: 'active', value: 'true' },
    ] : [
      { id: 'active', value: 'true' }
    ],
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
      host: 'lightapi.net', service: 'ref', action: 'getRefValue', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(apiFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    console.log("cmd = ", cmd);

    try {
      const json = await fetchClient(url) as RefValueApiResponse;
      setData(json.refValues || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<RefValueType>) => {
    if (!window.confirm(`Are you sure you want to delete ref value: ${row.original.valueCode}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(value => value.valueId !== row.original.valueId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'ref', action: 'deleteRefValue', version: '0.1.0',
      data: { valueId: row.original.valueId, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete reference value. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete reference value due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RefValueType>[]>(
    () => [
      { accessorKey: 'tableId', header: 'Table ID' },
      { accessorKey: 'tableName', header: 'Table Name' },
      { accessorKey: 'valueId', header: 'Value Id' },
      { accessorKey: 'valueCode', header: 'Value Code' },
      { accessorKey: 'valueDesc', header: 'Description' },
      { accessorKey: 'displayOrder', header: 'Order' },
      { accessorKey: 'active', header: 'Active', Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No') },
    ],
    [],
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
    getRowId: (row) => row.valueId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.1rem' }}>
        <Tooltip title="Update Value">
          <IconButton onClick={() => navigate('/app/form/updateRefValue', { state: { data: { ...row.original } } })}>
            <SystemUpdateIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Value">
          <IconButton color="error" onClick={() => handleDelete(row)}>
            <DeleteForeverIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Manage Locales">
          <IconButton onClick={() => navigate('/app/ref/locale', { state: { data: { valueId: row.original.valueId } } })}>
            <LanguageIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createRefValue', { state: { data: { tableId: initialTableId } } })}
        >
          Create New Value
        </Button>
        {initialTableId && (
          <Typography variant="subtitle1">
            For Table Id: <strong>{initialTableId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
