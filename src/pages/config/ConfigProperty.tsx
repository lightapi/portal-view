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
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type ConfigPropertyApiResponse = {
  configProperties: Array<ConfigPropertyType>;
  total: number;
};

type ConfigPropertyType = {
  hostId: string;
  configId: string;
  configName?: string;
  propertyName: string;
  propertyType?: string;
  light4jVersion?: string;
  displayOrder?: number;
  required?: boolean;
  propertyDesc?: string;
  propertyValue?: string;
  valueType?: string;
  propertyFile?: string;
  resourceType?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

export default function ConfigPropertyAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState();
  const initialConfigId = location.state?.data?.configId;

  // Data and fetching state
  const [data, setData] = useState<ConfigPropertyType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state, pre-filtered by configId if provided
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    initialConfigId ? [{ id: 'configId', value: initialConfigId }] : [],
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
      host: 'lightapi.net', service: 'config', action: 'getConfigProperty', version: '0.1.0',
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
      const json = (await response.json()) as ConfigPropertyApiResponse;
      setData(json.configProperties || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<ConfigPropertyType>) => {
    if (!window.confirm(`Are you sure you want to delete property: ${row.original.propertyName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(prop => !(prop.configId === row.original.configId && prop.propertyName === row.original.propertyName)));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'config', action: 'deleteConfigProperty', version: '0.1.0',
      data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete property. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete property due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ConfigPropertyType>[]>(
    () => [
      { accessorKey: 'configId', header: 'Config ID' },
      { accessorKey: 'configName', header: 'Config Name' },
      { accessorKey: 'propertyName', header: 'Property Name' },
      { accessorKey: 'propertyType', header: 'Type' },
      { accessorKey: 'propertyValue', header: 'Value' },
      {
        accessorKey: 'required',
        header: 'Required',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
      },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Update Property"><IconButton onClick={() => navigate('/app/form/updateConfigProperty', { state: { data: { ...row.original } } })}><SystemUpdateIcon /></IconButton></Tooltip>),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Delete Property"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
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
    getRowId: (row) => `${row.configId}-${row.propertyName}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate('/app/form/createConfigProperty', { state: { data: { configId: initialConfigId } } })}
          disabled={!initialConfigId}
        >
          Create New Property
        </Button>
        {initialConfigId && (
          <Typography variant="subtitle1">
            For Config: <strong>{initialConfigId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
