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
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type ProductVersionEnvironmentApiResponse = {
  productEnvironments: Array<ProductVersionEnvironmentType>;
  total: number;
};

type ProductVersionEnvironmentType = {
  hostId: string;
  productVersionId: string;
  productId: string;
  productVersion: string;
  systemEnv: string;
  runtimeEnv: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

export default function ProductEnvironment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState();
  const initialData = location.state?.data || {};

  // Data and fetching state
  const [data, setData] = useState<ProductVersionEnvironmentType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state, pre-filtered by context if provided
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() =>
    Object.entries(initialData)
      .map(([id, value]) => ({ id, value: value as string }))
      .filter(f => f.value),
  );
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    const cmd = {
      host: 'lightapi.net', service: 'product', action: 'getProductVersionEnvironment', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), filters: JSON.stringify(columnFilters ?? []), globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as ProductVersionEnvironmentApiResponse;
      setData(json.productEnvironments || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<ProductVersionEnvironmentType>) => {
    if (!window.confirm(`Are you sure you want to delete the environment: ${row.original.systemEnv}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(item => !(
      item.productVersionId === row.original.productVersionId &&
      item.systemEnv === row.original.systemEnv
    )));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'product', action: 'deleteProductVersionEnvironment', version: '0.1.0',
      data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete environment. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete environment due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ProductVersionEnvironmentType>[]>(
    () => [
      { accessorKey: 'productVersionId', header: 'Product Version ID' },
      { accessorKey: 'productId', header: 'Product ID' },
      { accessorKey: 'productVersion', header: 'Version' },
      { accessorKey: 'systemEnv', header: 'System Env' },
      { accessorKey: 'runtimeEnv', header: 'Runtime Env' },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => (<Tooltip title="Delete Environment"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
    ],
    [handleDelete],
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
    getRowId: (row) => `${row.productVersionId}-${row.systemEnv}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createProductVersionEnvironment', { state: { data: initialData } })}
          disabled={!initialData.productVersionId}
        >
          Add Environment
        </Button>
        {initialData.productVersionId && (
          <Typography variant="subtitle1">
            For Product Version: <strong>{initialData.productVersion} ({initialData.productId})</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
