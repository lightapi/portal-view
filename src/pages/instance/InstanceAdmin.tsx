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
import {
  Box,
  Button,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import InstallDesktopIcon from "@mui/icons-material/InstallDesktop";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

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
};

// A component to handle the numerous row actions cleanly
const RowActionMenu = ({ row }: { row: MRT_Row<InstanceType> }) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const createNavHandler = (path: string, stateData: object) => () => {
    navigate(path, { state: { data: stateData } });
    handleCloseMenu();
  };

  return (
    <>
      <Tooltip title="Update">
        <IconButton onClick={createNavHandler('/app/form/updateInstance', { ...row.original })}>
          <SystemUpdateIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="More Actions">
        <IconButton onClick={handleOpenMenu}>
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={handleCloseMenu}>
        <MenuItem onClick={createNavHandler('/app/config/configInstance', { instanceId: row.original.instanceId })}>
          <ListItemIcon><AddToDriveIcon fontSize="small" /></ListItemIcon>
          Config
        </MenuItem>
        <MenuItem onClick={createNavHandler('/app/config/configInstanceFile', { instanceId: row.original.instanceId })}>
          <ListItemIcon><AttachFileIcon fontSize="small" /></ListItemIcon>
          Config File
        </MenuItem>
        <MenuItem onClick={createNavHandler('/app/instance/instanceApi', { ...row.original })}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          Instance API
        </MenuItem>
        <MenuItem onClick={createNavHandler('/app/instance/instanceApp', { ...row.original })}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          Instance App
        </MenuItem>
        <MenuItem onClick={createNavHandler('/app/instance/instanceAppApi', { ...row.original })}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          Instance App API
        </MenuItem>
        <MenuItem onClick={createNavHandler('/app/deployment/instance', { ...row.original })}>
          <ListItemIcon><InstallDesktopIcon fontSize="small" /></ListItemIcon>
          Deployment
        </MenuItem>
      </Menu>
    </>
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
    if (!data.length) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }

    const cmd = {
      host: 'lightapi.net',
      service: 'instance',
      action: 'getInstance',
      version: '0.1.0',
      data: {
        hostId: host,
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(columnFilters ?? []),
        globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    console.log("url", url);
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as InstanceApiResponse;
      setData(json.instances);
      setRowCount(json.total);
    } catch (error) {
      setIsError(true);
      console.error(error);
    } finally {
      setIsError(false);
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [
    host,
    columnFilters,
    globalFilter,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    data.length,
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
  ]);

  // Delete handler
  const handleDelete = useCallback(async (row: MRT_Row<InstanceType>) => {
    if (!window.confirm(`Are you sure you want to delete instance: ${row.original.instanceName || row.original.instanceId}?`)) {
      return;
    }
    const cmd = {
      host: 'lightapi.net',
      service: 'instance',
      action: 'deleteInstance',
      version: '0.1.0',
      data: row.original,
    };
    const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
    if (result.data) {
      fetchData(); // Refetch data after successful deletion
    } else if (result.error) {
      console.error('API Error on delete:', result.error);
    }
  }, [fetchData]);

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
      { accessorKey: 'current', header: 'Current', Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No') },
      { accessorKey: 'readonly', header: 'Readonly', Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No') },
      { accessorKey: 'updateUser', header: 'Update User' },
      {
        accessorKey: 'updateTs',
        header: 'Update Time',
        Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
      },
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
    getRowId: (row) => row.instanceId,
    muiToolbarAlertBannerProps: isError
      ? { color: 'error', children: 'Error loading data' }
      : undefined,
    enableRowActions: true,
    positionActionsColumn: 'last',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.1rem' }}>
        <RowActionMenu row={row} />
        <Tooltip title="Delete">
          <IconButton color="error" onClick={() => handleDelete(row)}>
            <DeleteForeverIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Button
        variant="contained"
        startIcon={<AddBoxIcon />}
        onClick={() => navigate('/app/form/createInstance')}
      >
        Create New Instance
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
