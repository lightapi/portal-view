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
import Cookies from 'universal-cookie';

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

export default function RefValue() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState();
  const initialData = location.state?.data || {};

  // Data and fetching state
  const [data, setData] = useState<RefValueType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() =>
    Object.entries(initialData)
      .map(([id, value]) => ({ id, value: value as string }))
      .filter(f => f.value),
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

    const cmd = {
      host: 'lightapi.net', service: 'ref', action: 'getRefValue', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), filters: JSON.stringify(columnFilters ?? []), globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };
    console.log("cmd = ", cmd);

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as RefValueApiResponse;
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
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Update Value">
            <IconButton onClick={() => navigate('/app/form/updateRefValue', { state: { data: { ...row.original } } })}>
              <SystemUpdateIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Delete Value">
            <IconButton color="error" onClick={() => handleDelete(row)}>
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'locale', header: 'Locale', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Manage Locales">
            <IconButton onClick={() => navigate('/app/ref/locale', { state: { data: { valueId: row.original.valueId } } })}>
              <LanguageIcon />
            </IconButton>
          </Tooltip>
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
    getRowId: (row) => row.valueId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createRefValue', { state: { data: initialData } })}
        >
          Create New Value
        </Button>
        {initialData.tableId && (
          <Typography variant="subtitle1">
            For Table Id: <strong>{initialData.tableId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
