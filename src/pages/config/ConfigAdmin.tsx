import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { usePersistentPagination, PAGE_SIZE_OPTIONS } from '../../hooks/usePersistentPagination';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Box, Button, Tooltip } from '@mui/material';
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
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute } from '../../tasks/taskUtils';

// --- Type Definitions ---
type ConfigApiResponse = {
  configs: Array<ConfigType>;
  total: number;
};

type ConfigType = {
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
  active: boolean;
};

interface UserState {
  host?: string;
}

const TruncatedCell = <T extends MRT_RowData>({ cell }: { cell: MRT_Cell<T, unknown> }) => {
  const value = cell.getValue<string>() ?? '';
  return (
    <Tooltip title={value} placement="top-start">
      <Box component="span" sx={{ display: 'block', maxWidth: '200px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {value}
      </Box>
    </Tooltip>
  );
};

export default function ConfigAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { host } = useUserState() as UserState;
  const taskContext = useMemo(() => ({ hostId: host ?? '' }), [host]);

  // Data and fetching state
  const [data, setData] = useState<ConfigType[]>([]);
  const [isError, setIsError] = useState<string | false>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([
    { id: 'active', value: 'true' },
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = usePersistentPagination();

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    setIsError(false);
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
      host: 'lightapi.net', service: 'config', action: 'getConfig', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(apiFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    try {
      const json = await fetchClient(url);
      setData(json.configs || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(loadErrorMessage(error)); console.error(error);
    } finally {
      setIsLoading(false); setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

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
      data: { configId: row.original.configId , aggregateVersion: row.original.aggregateVersion},
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

  const handleUpdate = useCallback(async (row: MRT_Row<ConfigType>) => {
    const configId = row.original.configId;
    setIsUpdateLoading(configId);

    const cmd = {
      host: 'lightapi.net', service: 'config', action: 'getFreshConfig', version: '0.1.0',
      data: { configId: row.original.configId, aggregateVersion: row.original.aggregateVersion },
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    try {
      const freshData = await fetchClient(url);
      console.log("freshData", freshData);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;

      // Navigate with the fresh data
      navigate(buildTaskAwareRoute('/app/form/updateConfig', searchParams, { hostId: host ?? '', configId }), {
        state: {
          data: dataForForm,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch config for update:", error);
      alert("Could not load the latest config data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname, searchParams]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<ConfigType>[]>(
    () => [
      { accessorKey: 'configName', header: 'Name' },
      { accessorKey: 'configPhase', header: 'Phase' },
      { accessorKey: 'configType', header: 'Type' },
      { accessorKey: 'light4jVersion', header: 'Light4j Version' },
      { accessorKey: 'classPath', header: 'Class Path' },
      {
        accessorKey: 'configDesc',
        header: 'Description',
        Cell: TruncatedCell,
        muiTableBodyCellProps: { sx: { maxWidth: '200px' } }
      },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      { accessorKey: 'configId', header: 'Config Id' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
    ],
    [],
  );

  // Table instance configuration
  const table = useMaterialReactTable(usePortalActionTableOptions({
    columns,
    data,
    initialState: { showColumnFilters: true, density: 'compact' },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: { isLoading, showAlertBanner: Boolean(isError), showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
    onPaginationChange: setPagination,
    muiPaginationProps: { rowsPerPageOptions: PAGE_SIZE_OPTIONS },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.configId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: typeof isError === 'string' ? isError : 'Error loading data' } : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => <PortalActions row={row} actions={[
      {
        id: "update-config",
        label: "Update Config",
        icon: (
          <SystemUpdateIcon />
        ),

        loading: () => Boolean(isUpdateLoading === row.original.configId),
        onSelect: () => handleUpdate(row)
      },
      {
        id: "properties",
        label: "Properties",
        description: "Manage configuration property definitions.",
        icon: <FormatListBulletedIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/config/configProperty', searchParams, { hostId: host ?? '', configId: row.original.configId }), { state: { data: { ...row.original } } })
      },
      {
        id: "environments",
        label: "Environments",
        description: "Manage environment associations.",
        icon: <YardIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/config/configEnvironment', searchParams, { hostId: host ?? '', configId: row.original.configId }), { state: { data: { ...row.original } } })
      },
      {
        id: "products",
        label: "Products",
        description: "Manage product associations.",
        icon: <Inventory2Icon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/config/configProduct', searchParams, { hostId: host ?? '', configId: row.original.configId }), { state: { data: { ...row.original } } })
      },
      {
        id: "product-versions",
        label: "Product Versions",
        description: "Manage product version associations.",
        icon: <AddToDriveIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/config/configProductVersion', searchParams, { hostId: host ?? '', configId: row.original.configId }), { state: { data: { ...row.original } } })
      },
      {
        id: "instances",
        label: "Instances",
        description: "Manage instance configuration associations.",
        icon: <InstallMobileIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/config/configInstance', searchParams, { hostId: host ?? '', configId: row.original.configId }), { state: { data: { ...row.original } } })
      },
      {
        id: "instance-apis",
        label: "Instance APIs",
        description: "Manage APIs associated with this instance.",
        icon: <ApiIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/config/configInstanceApi', searchParams, { hostId: host ?? '', configId: row.original.configId }), { state: { data: { ...row.original } } })
      },
      {
        id: "instance-apps",
        label: "Instance Apps",
        description: "Manage application associations.",
        icon: <AppsIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/config/configInstanceApp', searchParams, { hostId: host ?? '', configId: row.original.configId }), { state: { data: { ...row.original } } })
      },
      {
        id: "instance-app-api",
        label: "Instance App Api",
        description: "Manage application API configuration associations.",
        icon: <FormatIndentIncreaseIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/config/configInstanceAppApi', searchParams, { hostId: host ?? '', configId: row.original.configId }), { state: { data: { ...row.original } } })
      },
      {
        id: "delete-config",
        label: "Delete Config",
        icon: <DeleteForeverIcon />,
        destructive: true,
        onSelect: () => handleDelete(row)
      }
    ]} />,
    renderTopToolbarCustomActions: () => (
      <Button
        variant="contained"
        startIcon={<AddBoxIcon />}
        onClick={() => navigate(buildTaskAwareRoute('/app/form/createConfig', searchParams, taskContext))}
      >
        Create New Config
      </Button>
    ),
  }));

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ mb: 2 }}>
        <TaskActionPanel
          title="Configuration Tasks"
          context={taskContext}
          taskIds={['manage-configuration', 'promote-configuration']}
          maxActions={2}
        />
      </Box>
      <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>
    </Box>
  );
}
