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
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import YardIcon from "@mui/icons-material/Yard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import AppsIcon from "@mui/icons-material/Apps";
import ApiIcon from "@mui/icons-material/Api";
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type ConfigApiResponse = {
  configs: Array<ConfigType>;
  total: number;
};

type ConfigType = {
  hostId: string;
  configId: string;
  configName?: string;
  configPhase?: string;
  configType?: string;
  light4jVersion?: string;
  classPath?: string;
  configDesc?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

export default function ConfigAdmin() {
  const navigate = useNavigate();
  const { host } = useUserState();

  // Data and fetching state
  const [data, setData] = useState<ConfigType[]>([]);
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
    if (!host) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    const cmd = {
      host: 'lightapi.net', service: 'config', action: 'getConfig', version: '0.1.0',
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
      const json = (await response.json()) as ConfigApiResponse;
      setData(json.configs || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<ConfigType>) => {
    if (!window.confirm(`Are you sure you want to delete config: ${row.original.configName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(config => config.configId !== row.original.configId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'config', action: 'deleteConfig', version: '0.1.0',
      data: { ...row.original, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete config. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete config due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ConfigType>[]>(
    () => [
      { accessorKey: 'configId', header: 'Config ID' },
      { accessorKey: 'configName', header: 'Name' },
      { accessorKey: 'configPhase', header: 'Phase' },
      { accessorKey: 'configType', header: 'Type' },
      { accessorKey: 'light4jVersion', header: 'Light4j Version' },
      { accessorKey: 'configDesc', header: 'Description' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
      {
        id: 'actions', header: 'Actions', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
            <Tooltip title="Update Config"><IconButton onClick={() => navigate('/app/form/updateConfig', { state: { data: { ...row.original } } })}><SystemUpdateIcon /></IconButton></Tooltip>
            <Tooltip title="Delete Config"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>
            <Tooltip title="Properties"><IconButton onClick={() => navigate('/app/config/configProperty', { state: { data: { ...row.original } } })}><FormatListBulletedIcon /></IconButton></Tooltip>
            <Tooltip title="Environments"><IconButton onClick={() => navigate('/app/config/configEnvironment', { state: { data: { ...row.original } } })}><YardIcon /></IconButton></Tooltip>
            <Tooltip title="Products"><IconButton onClick={() => navigate('/app/config/configProduct', { state: { data: { ...row.original } } })}><Inventory2Icon /></IconButton></Tooltip>
            <Tooltip title="Product Versions"><IconButton onClick={() => navigate('/app/config/configProductVersion', { state: { data: { ...row.original } } })}><AddToDriveIcon /></IconButton></Tooltip>
            <Tooltip title="Instances"><IconButton onClick={() => navigate('/app/config/configInstance', { state: { data: { ...row.original } } })}><InstallMobileIcon /></IconButton></Tooltip>
            <Tooltip title="Instance APIs"><IconButton onClick={() => navigate('/app/config/configInstanceApi', { state: { data: { ...row.original } } })}><ApiIcon /></IconButton></Tooltip>
            <Tooltip title="Instance Apps"><IconButton onClick={() => navigate('/app/config/configInstanceApp', { state: { data: { ...row.original } } })}><AppsIcon /></IconButton></Tooltip>
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
    getRowId: (row) => row.configId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createConfig')}>
        Create New Config
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
