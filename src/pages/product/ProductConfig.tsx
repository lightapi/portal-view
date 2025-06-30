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
import { Button, IconButton, Tooltip } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from "universal-cookie";

// Define the shape of the API response
type ProductConfigApiResponse = {
  productConfigs: Array<ProductConfigType>;
  total: number;
};

// Define the type for a single product configuration record
type ProductConfigType = {
  hostId: string;
  productVersionId: string;
  productId: string;
  productVersion: string;
  configId: string;
  configName: string;
  updateUser?: string;
  updateTs?: string;
};

export default function ProductConfig() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as { host: string };
  
  // Contextual data passed from the previous page, used for creating new entities
  const contextData = location.state?.data;

  // Data and fetching state
  const [data, setData] = useState<ProductConfigType[]>([]);
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
    pageSize: 10,
  });

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!data.length) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }

    const cmd = {
      host: 'lightapi.net',
      service: 'product',
      action: 'getProductVersionConfig',
      version: '0.1.0',
      data: {
        hostId: host,
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(table.getState().columnFilters ?? []), // MRT uses 'filters', let's be consistent
        globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as ProductConfigApiResponse;
      setData(json.productConfigs);
      setRowCount(json.total);
    } catch (error) {
      setIsError(true);
      console.error(error);
      return;
    }
    setIsError(false);
    setIsLoading(false);
    setIsRefetching(false);
  }, [
    host,
    columnFilters,
    globalFilter,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    data.length, // Dependency to manage initial loading state
  ]);

  // useEffect to trigger fetchData when table state changes
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    columnFilters,
    globalFilter,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    contextData,
  ]);

  // Delete handler
  const handleDelete = useCallback(
    async (row: MRT_Row<ProductConfigType>) => {
      if (
        !window.confirm(
          `Are you sure you want to delete config: ${row.original.configName}?`,
        )
      ) {
        return;
      }
      const cmd = {
        host: 'lightapi.net',
        service: 'product',
        action: 'deleteProductVersionConfig',
        version: '0.1.0',
        data: row.original,
      };
      const result = await apiPost({
        url: '/portal/command',
        headers: {},
        body: cmd,
      });
      if (result.data) {
        // Refetch data after successful deletion
        fetchData();
      } else if (result.error) {
        console.error('API Error on delete:', result.error);
        // Optionally, show an error to the user
      }
    },
    [fetchData],
  );

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ProductConfigType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host ID' },
      { accessorKey: 'productVersionId', header: 'Product Version ID' },
      { accessorKey: 'productId', header: 'Product ID' },
      { accessorKey: 'productVersion', header: 'Product Version' },
      { accessorKey: 'configId', header: 'Config ID' },
      { accessorKey: 'configName', header: 'Config Name' },
      { accessorKey: 'updateUser', header: 'Update User' },
      {
        accessorKey: 'updateTs',
        header: 'Update Time',
        Cell: ({ cell }) =>
          cell.getValue<string>()
            ? new Date(cell.getValue<string>()).toLocaleString()
            : '',
      },
    ],
    [],
  );

  // Table instance configuration
  const table = useMaterialReactTable({
    columns,
    data,
    initialState: {
      showColumnFilters: true,
      columnFilters: [
        ...(contextData?.productVersionId
          ? [{ id: 'productVersionId', value: contextData.productVersionId }]
          : []),
        ...(contextData?.productId ? [{ id: 'productId', value: contextData.productId }] : []),
        ...(contextData?.productVersion ? [{ id: 'productVersion', value: contextData.productVersion }] : []),
      ],
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: {
      isLoading,
      showAlertBanner: isError,
      showProgressBars: isRefetching,
      pagination,
      sorting,
      columnFilters,
      globalFilter,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => `${row.productVersionId}-${row.configId}`,
    muiToolbarAlertBannerProps: isError
      ? { color: 'error', children: 'Error loading data' }
      : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => (
      <Tooltip title="Delete">
        <IconButton color="error" onClick={() => handleDelete(row)}>
          <DeleteForeverIcon />
        </IconButton>
      </Tooltip>
    ),
    renderTopToolbarCustomActions: () => (
      <Button
        variant="contained"
        startIcon={<AddBoxIcon />}
        onClick={() => {
          if (contextData) {
            navigate('/app/form/createProductVersionConfig', {
              state: { data: contextData },
            });
          } else {
            // Handle case where context is missing, maybe disable the button or show a message
            console.warn('Cannot create: No context data available.');
          }
        }}
        disabled={!contextData}
      >
        Create New Config
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
