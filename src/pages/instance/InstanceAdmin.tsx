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
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import InstallDesktopIcon from "@mui/icons-material/InstallDesktop";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';

// Define the shape of the API response
type InstanceApiResponse = {
  instances: Array<InstanceType>;
  total: number;
};

// Define the type for a single instance record
type InstanceType = {
  hostId: string;
  instanceId: string;
  instanceName?: string;
  productVersionId: string;
  productId?: string;
  productVersion?: string;
  serviceId?: string;
  current?: boolean;
  readonly?: boolean;
  environment?: string;
  serviceDesc?: string;
  instanceDesc?: string;
  zone?: string;
  region?: string;
  lob?: string;
  resourceName?: string;
  businessName?: string;
  envTag?: string;
  topicClassification?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

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


export default function InstanceAdmin() {
  const navigate = useNavigate();
  const { host } = useUserState() as { host: string };

  // Data and fetching state
  const [data, setData] = useState<InstanceType[]>([]);
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
      } else if (filter.id === 'current' || filter.id === 'readonly') {
        // Handle boolean conversion for specific columns
        apiFilters.push({ ...filter, value: filter.value === 'true' });
      } else {
        // Keep other filters as is
        apiFilters.push(filter);
      }
    });

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'getInstance', version: '0.1.0',
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
      const json = (await response.json()) as InstanceApiResponse;
      setData(json.instances || []);
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

  // Delete handler
  const handleDelete = useCallback(async (row: MRT_Row<InstanceType>) => {
    if (!window.confirm(`Are you sure you want to delete instance: ${row.original.instanceName || row.original.instanceId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(p => p.instanceId !== row.original.instanceId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'deleteInstance', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete platform. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete platform due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<InstanceType>) => {
    const instanceId = row.original.instanceId;
    setIsUpdateLoading(instanceId);

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'getFreshInstance', version: '0.1.0',
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
        throw new Error(freshData.description || 'Failed to fetch latest instance data.');
      }

      // Navigate with the fresh data
      navigate('/app/form/updateInstance', {
        state: {
          data: freshData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch instance for update:", error);
      alert("Could not load the latest instance data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<InstanceType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host ID', enableColumnFilter: false },
      { accessorKey: 'instanceId', header: 'Instance ID' },
      { accessorKey: 'instanceName', header: 'Instance Name' },
      { accessorKey: 'productVersionId', header: 'Product Version ID' },
      { accessorKey: 'productId', header: 'Product ID' },
      { accessorKey: 'productVersion', header: 'Product Version' },
      { accessorKey: 'serviceId', header: 'Service ID' },
      { accessorKey: 'environment', header: 'Environment' },
      {
        accessorKey: 'current',
        header: 'Current',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      {
        accessorKey: 'readonly',
        header: 'Readonly',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      {
        accessorKey: 'serviceDesc',
        header: 'Service Desc',
        Cell: TruncatedCell,
        muiTableBodyCellProps: { sx: { maxWidth: '200px' } }
      },
      {
        accessorKey: 'instanceDesc',
        header: 'Instance Desc',
        Cell: TruncatedCell,
        muiTableBodyCellProps: { sx: { maxWidth: '200px' } }
      },
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
        id: 'actions', header: 'Actions', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.1rem' }}>
            <Tooltip title="Update Instance">
              <IconButton
                onClick={() => handleUpdate(row)}
                disabled={isUpdateLoading === row.original.instanceId}
              >
                {isUpdateLoading === row.original.instanceId ? (
                  <CircularProgress size={22} />
                ) : (
                  <SystemUpdateIcon />
                )}
              </IconButton>
            </Tooltip>

            <Tooltip title="Delete Platform"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>
            <Tooltip title="Config">
              <IconButton onClick={() => navigate('/app/config/configInstance', { state: { data: { instanceId: row.original.instanceId } } })}>
                <AddToDriveIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Config File">
              <IconButton onClick={() => navigate('/app/config/configInstanceFile', { state: { data: { instanceId: row.original.instanceId } } })}>
                <AttachFileIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Instance API">
              <IconButton onClick={() => navigate('/app/instance/instanceApi', { state: { data: { ...row.original } } })}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Instance App">
              <IconButton onClick={() => navigate('/app/instance/instanceApp', { state: { data: { ...row.original } } })}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Instance App API">
              <IconButton onClick={() => navigate('/app/instance/instanceAppApi', { state: { data: { ...row.original } } })}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Deployment">
              <IconButton onClick={() => navigate('/app/deployment/instance', { state: { data: { ...row.original } } })}>
                <InstallDesktopIcon />
              </IconButton>
            </Tooltip>
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
    getRowId: (row) => row.instanceId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createInstance')}>
        Create New Instance
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
