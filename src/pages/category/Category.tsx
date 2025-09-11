import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import PublicIcon from '@mui/icons-material/Public';
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type CategoryApiResponse = {
  categories: Array<CategoryType>;
  total: number;
};

type CategoryType = {
  hostId?: string;
  categoryId: string;
  entityType: string;
  categoryName: string;
  categoryDesc?: string;
  parentCategoryId?: string;
  sortOrder?: number;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

export default function Category() {
  const navigate = useNavigate();
  const { host } = useUserState();

  // Data and fetching state
  const [data, setData] = useState<CategoryType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
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
      host: 'lightapi.net', service: 'category', action: 'getCategory', version: '0.1.0',
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
      const json = (await response.json()) as CategoryApiResponse;
      setData(json.categories || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<CategoryType>) => {
    if (!window.confirm(`Are you sure you want to delete category: ${row.original.categoryName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(cat => cat.categoryId !== row.original.categoryId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'category', action: 'deleteCategory', version: '0.1.0',
      data: { categoryId: row.original.categoryId, hostId: row.original.hostId, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete category. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete category due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<CategoryType>[]>(
    () => [
      {
        accessorKey: 'hostId', header: 'Host ID',
        Cell: ({ cell }) => cell.getValue<string>() ? cell.getValue<string>() : (
            <Tooltip title="Global"><PublicIcon fontSize="small" color="disabled" /></Tooltip>
        ),
      },
      { accessorKey: 'categoryId', header: 'Category ID' },
      { accessorKey: 'categoryName', header: 'Name' },
      { accessorKey: 'entityType', header: 'Entity Type' },
      { accessorKey: 'categoryDesc', header: 'Description' },
      { accessorKey: 'parentCategoryId', header: 'Parent ID' },
      { accessorKey: 'sortOrder', header: 'Sort Order' },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Update Category"><IconButton onClick={() => navigate('/app/form/updateCategory', { state: { data: { ...row.original } } })}><SystemUpdateIcon /></IconButton></Tooltip>),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Delete Category"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
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
    getRowId: (row) => row.categoryId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createCategory')}>
        Create New Category
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
