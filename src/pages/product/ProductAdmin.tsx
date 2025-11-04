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
import { Box, Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import AddToDriveIcon from '@mui/icons-material/AddToDrive';
import LanguageIcon from '@mui/icons-material/Language';
import GridGoldenratioIcon from '@mui/icons-material/GridGoldenratio';
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type ProductVersionApiResponse = {
  products: Array<ProductVersionType>; // Original component used 'products'
  total: number;
};

type ProductVersionType = {
  hostId: string;
  productVersionId: string;
  productId: string;
  productVersion: string;
  light4jVersion?: string;
  breakCode?: boolean;
  breakConfig?: boolean;
  releaseNote?: string;
  versionDesc?: string;
  releaseType?: string;
  current?: boolean;
  versionStatus: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

export default function ProductVersionAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState();
  const initialData = location.state?.data || {};

  // Data and fetching state
  const [data, setData] = useState<ProductVersionType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() =>
    Object.entries(initialData)
      .map(([id, value]) => ({ id, value: value as string }))
      .filter(f => f.value)
      .concat([{ id: 'active', value: 'true' }])
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

    const apiFilters = columnFilters.map(filter => {
      // Add the IDs of all your boolean columns to this check
      if (filter.id === 'active' || filter.id === 'isKafkaApp') {
        return {
          ...filter,
          value: filter.value === 'true',
        };
      }
      return filter;
    });

    const cmd = {
      host: 'lightapi.net', service: 'product', action: 'getProductVersion', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), filters: JSON.stringify(apiFilters ?? []), globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as ProductVersionApiResponse;
      setData(json.products || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, data.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<ProductVersionType>) => {
    if (!window.confirm(`Are you sure you want to delete the product version: ${row.original.productVersion}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(pv => pv.productVersionId !== row.original.productVersionId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'product', action: 'deleteProductVersion', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete product version. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete product version due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Handler to fetch fresh data before navigating to update form
  const handleUpdate = useCallback(async (row: MRT_Row<ProductVersionType>) => {
    const productVersion = row.original.productVersion;
    setIsUpdateLoading(productVersion);

    const cmd = {
      host: 'lightapi.net', service: 'product', action: 'getFreshProductVersion', version: '0.1.0',
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
        throw new Error(freshData.description || 'Failed to fetch latest data.');
      }
      
      // Navigate with the fresh data
      navigate('/app/form/updateProductVersion', { 
        state: { 
          data: freshData, 
          source: location.pathname 
        } 
      });
    } catch (error) {
      console.error("Failed to fetch data for update:", error);
      alert("Could not load the latest data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ProductVersionType>[]>(
    () => [
      { accessorKey: 'productId', header: 'Product ID' },
      { accessorKey: 'productVersion', header: 'Version' },
      { accessorKey: 'versionStatus', header: 'Status' },
      {
        accessorKey: 'current', 
        header: 'Current', 
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      { accessorKey: 'light4jVersion', header: 'Light4j Version' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      {
        id: 'actions', header: 'Actions', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
          <Tooltip title="Update App">
            <IconButton 
              onClick={() => handleUpdate(row)}
              disabled={isUpdateLoading === row.original.productVersion}
            >
              {isUpdateLoading === row.original.productVersion ? (
                <CircularProgress size={22} />
              ) : (
                <SystemUpdateIcon />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>
          </Box>
        ),
      },
      {
        id: 'relations', header: 'Relations', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => {
          const { productVersionId, productId, productVersion } = row.original;
          const navState = { data: { productVersionId, productId, productVersion } };
          return (
            <Box sx={{ display: 'flex', gap: '0.1rem' }}>
              <Tooltip title="Version Configs"><IconButton onClick={() => navigate('/app/config/configProductVersion', { state: { data: { productVersionId } } })}><AddToDriveIcon /></IconButton></Tooltip>
              <Tooltip title="Environments"><IconButton onClick={() => navigate('/app/product/environment', { state: navState })}><LanguageIcon /></IconButton></Tooltip>
              <Tooltip title="Pipelines"><IconButton onClick={() => navigate('/app/product/pipeline', { state: navState })}><GridGoldenratioIcon /></IconButton></Tooltip>
              <Tooltip title="Product Configs"><IconButton onClick={() => navigate('/app/product/config', { state: navState })}><GridGoldenratioIcon /></IconButton></Tooltip>
              <Tooltip title="Product Properties"><IconButton onClick={() => navigate('/app/product/property', { state: navState })}><GridGoldenratioIcon /></IconButton></Tooltip>
            </Box>
          );
        },
      },
    ],
    [handleDelete, handleUpdate, isUpdateLoading, navigate],
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
    getRowId: (row) => row.productVersionId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createProductVersion')}>
        Create New Version
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
