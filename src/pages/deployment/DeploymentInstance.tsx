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
import { Box, Button, IconButton, Tooltip, Typography, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import AddToDriveIcon from '@mui/icons-material/AddToDrive';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// --- Type Definitions ---
type DeploymentInstanceApiResponse = {
  deploymentInstances: Array<DeploymentInstanceType>;
  total: number;
};

type DeploymentInstanceType = {
  hostId: string;
  instanceId: string;
  instanceName?: string;
  deploymentInstanceId: string;
  serviceId?: string;
  ipAddress?: string;
  portNumber?: number;
  systemEnv: string;
  runtimeEnv: string;
  pipelineId?: string;
  pipelineName?: string;
  pipelineVersion?: string;
  deployStatus?: string;
  platformJobId?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

interface UserState {
  host?: string;
}

export default function DeploymentInstance() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const initialInstanceId = location.state?.data?.instanceId ?? searchContext.instanceId;
  const initialServiceId = location.state?.data?.serviceId ?? searchContext.serviceId;
  const initialPipelineId = location.state?.data?.pipelineId ?? searchContext.pipelineId;
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, {
      hostId: host ?? '',
      instanceId: initialInstanceId ?? '',
      serviceId: initialServiceId ?? '',
      pipelineId: initialPipelineId ?? '',
    }),
    [host, initialInstanceId, initialPipelineId, initialServiceId, searchContext],
  );

  // Data and fetching state
  const [data, setData] = useState<DeploymentInstanceType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  // Table state, pre-filtered by configId if provided
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() => {
    const initialFilters: MRT_ColumnFiltersState = [{ id: 'active', value: 'true' }];
    if (initialInstanceId) initialFilters.push({ id: 'instanceId', value: initialInstanceId });
    if (initialServiceId) initialFilters.push({ id: 'serviceId', value: initialServiceId });
    if (searchContext.deploymentInstanceId) initialFilters.push({ id: 'deploymentInstanceId', value: searchContext.deploymentInstanceId });
    if (initialPipelineId) initialFilters.push({ id: 'pipelineId', value: initialPipelineId });
    return initialFilters;
  });
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
      } else {
        // Keep other filters as is
        apiFilters.push(filter);
      }
    });

    const cmd = {
      host: 'lightapi.net', service: 'deployment', action: 'getDeploymentInstance', version: '0.1.0',
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
      const json = await fetchClient(url) as DeploymentInstanceApiResponse;
      setData(json.deploymentInstances || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<DeploymentInstanceType>) => {
    if (!window.confirm(`Are you sure you want to delete deployment instance: ${row.original.deploymentInstanceId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(d => d.deploymentInstanceId !== row.original.deploymentInstanceId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'deployment', action: 'deleteDeploymentInstance', version: '0.1.0',
      data: { hostId: row.original.hostId, deploymentInstanceId: row.original.deploymentInstanceId , aggregateVersion: row.original.aggregateVersion},
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete deployment instance. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete deployment instance due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<DeploymentInstanceType>) => {
    const deploymentInstanceId = row.original.deploymentInstanceId;
    setIsUpdateLoading(deploymentInstanceId);

    const cmd = {
      host: 'lightapi.net', service: 'deployment', action: 'getFreshDeploymentInstance', version: '0.1.0',
      data: { hostId: row.original.hostId, deploymentInstanceId: row.original.deploymentInstanceId, aggregateVersion: row.original.aggregateVersion },
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const freshData = await fetchClient(url);
      console.log("freshData", freshData);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;

      // Navigate with the fresh data
      navigate(buildTaskAwareRoute('/app/form/updateDeploymentInstance', searchParams, {
        ...taskContext,
        deploymentInstanceId,
        instanceId: row.original.instanceId,
        serviceId: row.original.serviceId ?? '',
        pipelineId: row.original.pipelineId ?? '',
        systemEnv: row.original.systemEnv,
        runtimeEnv: row.original.runtimeEnv,
      }), {
        state: {
          data: dataForForm,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch deployment instance for update:", error);
      alert("Could not load the latest deployment instance data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname, searchParams, taskContext]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<DeploymentInstanceType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'instanceId', header: 'Instance Id' },
      { accessorKey: 'deploymentInstanceId', header: 'Deploy Inst Id' },
      { accessorKey: 'instanceName', header: 'Instance Name' },
      { accessorKey: 'serviceId', header: 'Service Id' },
      { accessorKey: 'ipAddress', header: 'IP Address' },
      { accessorKey: 'portNumber', header: 'Port' },
      { accessorKey: 'systemEnv', header: 'System Env' },
      { accessorKey: 'platformJobId', header: 'Platform Job Id' },
      { accessorKey: 'deployStatus', header: 'Status' },
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
        filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
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
    state: { isLoading, showAlertBanner: isError, showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.deploymentInstanceId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.5rem' }}>
        <Tooltip title="Update">
          <IconButton
            onClick={() => handleUpdate(row)}
            disabled={isUpdateLoading === row.original.deploymentInstanceId}
          >
            {isUpdateLoading === row.original.deploymentInstanceId ? (
              <CircularProgress size={22} />
            ) : (
              <SystemUpdateIcon />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Manage Config">
          <IconButton
            onClick={() =>
              navigate(buildTaskAwareRoute('/app/config/configDeploymentInstance', searchParams, {
                ...taskContext,
                instanceId: row.original.instanceId,
                deploymentInstanceId: row.original.deploymentInstanceId,
                serviceId: row.original.serviceId ?? '',
              }), {
                state: {
                  data: {
                    instanceId: row.original.instanceId,
                    deploymentInstanceId: row.original.deploymentInstanceId,
                  },
                },
              })
            }
          >
            <AddToDriveIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton color="error" onClick={() => handleDelete(row)}>
            <DeleteForeverIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddBoxIcon />}
          onClick={() => navigate(
            buildTaskAwareRoute('/app/form/createDeploymentInstance', searchParams, taskContext),
            { state: { data: { instanceId: initialInstanceId, serviceId: initialServiceId, pipelineId: initialPipelineId } } },
          )}
        >
          Create New Deployment Instance
        </Button>
        {initialInstanceId && (
          <Typography variant="subtitle1">
            For Instance: <strong>{initialInstanceId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ mb: 2 }}>
        <TaskActionPanel
          title="Deployment Tasks"
          context={taskContext}
          taskIds={['manage-deployment', 'manage-configuration']}
          maxActions={2}
        />
      </Box>
      <MaterialReactTable table={table} />
    </Box>
  );
}
