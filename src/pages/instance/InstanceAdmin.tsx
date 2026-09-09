import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { usePersistentPagination, PAGE_SIZE_OPTIONS } from '../../hooks/usePersistentPagination';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_SortingState,
  type MRT_Row,
  type MRT_RowSelectionState,
} from 'material-react-table';
import { Alert, Box, Button, Chip, Tooltip, CircularProgress, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import InstallDesktopIcon from "@mui/icons-material/InstallDesktop";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CameraIcon from '@mui/icons-material/Camera';
import ApiIcon from "@mui/icons-material/Api";
import AppsIcon from "@mui/icons-material/Apps";
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PolicyIcon from '@mui/icons-material/Policy';
import ChatIcon from '@mui/icons-material/Chat';
import AgentPolicyPublicationDialog from '../genai/AgentPolicyPublicationDialog';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';
import { applyOwnershipColumns, applyOwnershipFilter, ownershipScope } from '../../utils/ownershipScope';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';
import { getCurrentConfigSnapshotsByInstances } from './instanceCurrentSnapshotsApi';
import {
  instanceComparisonIssue,
  instanceSelectionKey,
  MAX_CURRENT_SNAPSHOT_INSTANCES,
  updateSelectedInstances,
} from './instanceCurrentSnapshotSelection';

// Define the shape of the API response
type InstanceApiResponse = {
  instances: Array<InstanceType>;
  total: number;
};

// Define the type for a single instance record
export type InstanceType = {
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
  const [publishingAgent, setPublishingAgent] = useState<InstanceType | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { host, userId, email, roles, positions } = useUserState() as { host: string; userId?: string; email?: string; roles?: string | null; positions?: string | null };
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const instanceOwnership = useMemo(
    () => ownershipScope({
      roles,
      userId,
      positions,
      ownerField: 'ownerUserId',
    }),
    [roles, userId, positions],
  );
  const ownedOnly = instanceOwnership.ownedOnly;
  const hasOwnerContext = instanceOwnership.hasOwnerContext;
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, { hostId: host ?? '', userId: userId ?? '' }),
    [host, searchContext, userId],
  );

  // Data and fetching state
  const [data, setData] = useState<InstanceType[]>([]);
  const [isError, setIsError] = useState<string | false>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);
  const [selectedInstances, setSelectedInstances] = useState<Map<string, InstanceType>>(new Map());
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [resolverError, setResolverError] = useState<string | null>(null);
  const [isResolvingSnapshots, setIsResolvingSnapshots] = useState(false);
  const resolverController = useRef<AbortController | null>(null);
  const resolverGeneration = useRef(0);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    [
      { id: 'active', value: 'true' }
    ]
  );
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = usePersistentPagination();

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    if (ownedOnly && !userId) return;
    setIsError(false);
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

    const scopedFilters = applyOwnershipFilter(apiFilters, instanceOwnership);

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'getInstance', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(scopedFilters ?? []),
        globalFilter: globalFilter ?? '',
        active: activeStatus,
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const json = await fetchClient(url);
      setData(json.instances || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(loadErrorMessage(error)); console.error(error);
    } finally {
      setIsLoading(false); setIsRefetching(false);
    }
  }, [host, userId, ownedOnly, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, instanceOwnership]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const cancelResolver = useCallback(() => {
    resolverGeneration.current += 1;
    resolverController.current?.abort();
    resolverController.current = null;
    setIsResolvingSnapshots(false);
  }, []);

  useEffect(() => {
    cancelResolver();
    setSelectedInstances(new Map());
    setSelectionMessage(null);
    setResolverError(null);
  }, [cancelResolver, host]);

  useEffect(() => () => {
    resolverGeneration.current += 1;
    resolverController.current?.abort();
  }, []);

  const selectedRows = useMemo(() => Array.from(selectedInstances.values()), [selectedInstances]);
  const selectedCount = selectedRows.length;
  const compareIssue = useMemo(() => instanceComparisonIssue(selectedRows), [selectedRows]);
  const rowSelection = useMemo<MRT_RowSelectionState>(
    () => Object.fromEntries(Array.from(selectedInstances.keys()).map(key => [key, true])),
    [selectedInstances],
  );

  const handleRowSelectionChange = useCallback((
    updater: MRT_RowSelectionState | ((old: MRT_RowSelectionState) => MRT_RowSelectionState),
  ) => {
    cancelResolver();
    setResolverError(null);
    setSelectedInstances(current => {
      const currentSelection = Object.fromEntries(Array.from(current.keys()).map(key => [key, true]));
      const nextSelection = typeof updater === 'function' ? updater(currentSelection) : updater;
      const { selected, capped } = updateSelectedInstances(current, data, nextSelection);
      setSelectionMessage(capped ? 'You can compare at most four instances.' : null);
      return selected;
    });
  }, [cancelResolver, data]);

  const clearSelection = useCallback(() => {
    cancelResolver();
    setSelectedInstances(new Map());
    setSelectionMessage(null);
    setResolverError(null);
  }, [cancelResolver]);

  const removeSelectedInstance = useCallback((instance: InstanceType) => {
    cancelResolver();
    setResolverError(null);
    setSelectionMessage(null);
    setSelectedInstances(current => {
      const next = new Map(current);
      next.delete(instanceSelectionKey(instance));
      return next;
    });
  }, [cancelResolver]);

  const compareCurrentSnapshots = useCallback(async () => {
    if (!host || compareIssue || isResolvingSnapshots) return;
    resolverController.current?.abort();
    const controller = new AbortController();
    const generation = ++resolverGeneration.current;
    resolverController.current = controller;
    setResolverError(null);
    setIsResolvingSnapshots(true);
    try {
      const response = await getCurrentConfigSnapshotsByInstances({
        hostId: host,
        instanceIds: selectedRows.map(instance => instance.instanceId),
        signal: controller.signal,
      });
      if (controller.signal.aborted || generation !== resolverGeneration.current) return;
      const snapshotIds = response.snapshots.map(snapshot => snapshot.snapshotId);
      navigate(`/app/config/configSnapshotCompare?snapshotIds=${snapshotIds.join(',')}&source=current-instances`);
    } catch (caught: unknown) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      if (generation === resolverGeneration.current) {
        setResolverError(caught instanceof Error ? caught.message : 'Unable to resolve current configuration snapshots.');
      }
    } finally {
      if (generation === resolverGeneration.current) {
        resolverController.current = null;
        setIsResolvingSnapshots(false);
      }
    }
  }, [compareIssue, host, isResolvingSnapshots, navigate, selectedRows]);

  // Delete handler
  const handleDelete = useCallback(async (row: MRT_Row<InstanceType>) => {
    if (!instanceOwnership.canModifyRecord(row.original)) {
      alert('You can only delete instances you own.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete instance: ${row.original.instanceName || row.original.instanceId}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(p => p.instanceId !== row.original.instanceId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'deleteInstance', version: '0.1.0',
      data: { hostId: row.original.hostId, instanceId: row.original.instanceId , aggregateVersion: row.original.aggregateVersion},
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
  }, [instanceOwnership, data]);

  const handleUpdate = useCallback(async (row: MRT_Row<InstanceType>) => {
    if (!instanceOwnership.canModifyRecord(row.original)) {
      alert('You can only update instances you own.');
      return;
    }
    const instanceId = row.original.instanceId;
    setIsUpdateLoading(instanceId);

    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'getFreshInstance', version: '0.1.0',
      data: { hostId: row.original.hostId, instanceId: row.original.instanceId, aggregateVersion: row.original.aggregateVersion },
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const freshData = await fetchClient(url);
      console.log("freshData", freshData);
      const dataForForm = freshData.aggregateVersion === row.original.aggregateVersion ? row.original : freshData;

      // Navigate with the fresh data
      navigate(buildTaskAwareRoute('/app/form/updateInstance', searchParams, {
        ...taskContext,
        hostId: row.original.hostId,
        instanceId,
        productId: row.original.productId ?? '',
        productVersionId: row.original.productVersionId ?? '',
        serviceId: row.original.serviceId ?? '',
      }), {
        state: {
          data: dataForForm,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch instance for update:", error);
      alert("Could not load the latest instance data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [instanceOwnership, navigate, location.pathname, searchParams, taskContext]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<InstanceType>[]>(
    () => applyOwnershipColumns([
        { accessorKey: 'instanceName', header: 'Instance Name' },
        { accessorKey: 'productId', header: 'Product ID' },
        { accessorKey: 'productVersion', header: 'Product Version' },
        { accessorKey: 'serviceId', header: 'Service ID' },
        { accessorKey: 'envTag', header: 'Env Tag' },
        {
          accessorKey: 'current',
          header: 'Current',
          filterVariant: 'select',
          filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
          Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
        },
        {
          accessorKey: 'readonly',
          header: 'Readonly',
          filterVariant: 'select',
          filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
          Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
        },
        {
          accessorKey: 'active',
          header: 'Active',
          filterVariant: 'select',
          filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
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
        { accessorKey: 'hostId', header: 'Host Id', enableColumnFilter: false },
        { accessorKey: 'instanceId', header: 'Instance Id' },
        { accessorKey: 'productVersionId', header: 'Product Version ID' },
        { accessorKey: 'updateUser', header: 'Update User' },
        {
          accessorKey: 'updateTs',
          header: 'Update Time',
          Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
        },
        { accessorKey: 'aggregateVersion', header: 'AggregateVersion' },
      ],
      instanceOwnership,
    ),
    [instanceOwnership],
  );

  const contextForRow = useCallback((row: InstanceType) => ({
    ...taskContext,
    hostId: row.hostId,
    instanceId: row.instanceId,
    productId: row.productId ?? '',
    productVersionId: row.productVersionId ?? '',
    serviceId: row.serviceId ?? '',
    environment: row.envTag ?? '',
  }), [taskContext]);

  // Table instance configuration
  const table = useMaterialReactTable(usePortalActionTableOptions({
    columns,
    data,
    initialState: { showColumnFilters: true, density: 'compact' },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: { isLoading, showAlertBanner: Boolean(isError), showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter, rowSelection },
    onPaginationChange: setPagination,
    muiPaginationProps: { rowsPerPageOptions: PAGE_SIZE_OPTIONS },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row: InstanceType) => instanceSelectionKey(row),
    enableRowSelection: row => selectedInstances.has(instanceSelectionKey(row.original)) || selectedCount < MAX_CURRENT_SNAPSHOT_INSTANCES,
    onRowSelectionChange: handleRowSelectionChange,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: typeof isError === 'string' ? isError : 'Error loading data' } : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => <PortalActions row={row} actions={[
      {
        id: "update-instance",
        label: "Update Instance",
        icon: (
          <SystemUpdateIcon />
        ),
        disabledReason: () => (!instanceOwnership.canModifyRecord(row.original) || isUpdateLoading === row.original.instanceId) ? ((isUpdateLoading === row.original.instanceId) ? 'Action in progress.' : ('You can only update instances you own.')) : null,
        loading: () => Boolean(isUpdateLoading === row.original.instanceId),
        onSelect: () => handleUpdate(row)
      },
      {
        id: "clone-instance",
        label: "Clone Instance",
        icon: <ContentCopyIcon />,
        disabledReason: () => (row.original.readonly || !instanceOwnership.canModifyRecord(row.original)) ? (row.original.readonly ? 'Read-only instances cannot be cloned.' : 'You can only clone instances you own.') : null,
        onSelect: () => navigate(buildTaskAwareRoute('/app/instance/InstanceClone', searchParams, contextForRow(row.original)), {
          state: { data: { ...row.original }, source: location.pathname },
        })
      },
      {
        id: "publish-agent-policy",
        label: "Publish Agent policy",
        description: "Open the agent policy publication dialog.",
        icon: <PolicyIcon />,
        hidden: () => !((row.original.productId === 'agt')),
        disabledReason: () => (!row.original.active || !row.original.current || row.original.readonly || !instanceOwnership.canModifyRecord(row.original)) ? (!instanceOwnership.canModifyRecord(row.original) ? 'You can only publish policies for instances you own.' : !row.original.active ? 'Activate this instance before publishing.' : !row.original.current ? 'Select a current instance before publishing.' : 'Read-only instances cannot publish policies.') : null,
        onSelect: () => setPublishingAgent(row.original)
      },
      {
        id: "open-agent-chat",
        label: "Open Agent chat",
        description: "Open Chat with this instance selected.",
        icon: <ChatIcon />,
        hidden: () => !((row.original.productId === 'agt')),
        onSelect: () => navigate('/app/genai/chat?' + new URLSearchParams({ instanceId: row.original.instanceId, serviceId: row.original.serviceId || '', envTag: row.original.envTag || '' }))
      },
      {
        id: "snapshot",
        label: "Snapshot",
        description: "View configuration snapshots for this instance.",
        icon: <CameraIcon />,
        onSelect: () =>
          navigate(buildTaskAwareRoute('/app/config/configSnapshot', searchParams, contextForRow(row.original)), {
            state: { data: { instanceId: row.original.instanceId } },
          })
      },
      {
        id: "config",
        label: "Config",
        description: "Manage instance configuration values.",
        icon: <AddToDriveIcon />,
        onSelect: () =>
          navigate(buildTaskAwareRoute('/app/config/configInstance', searchParams, contextForRow(row.original)), {
            state: { data: { instanceId: row.original.instanceId } },
          })
      },
      {
        id: "config-file",
        label: "Config File",
        description: "Manage files attached to this instance.",
        icon: <AttachFileIcon />,
        onSelect: () =>
          navigate(buildTaskAwareRoute('/app/config/configInstanceFile', searchParams, contextForRow(row.original)), {
            state: { data: { instanceId: row.original.instanceId } },
          })
      },
      {
        id: "instance-apis",
        label: "Instance APIs",
        description: "Manage APIs associated with this instance.",
        icon: <ApiIcon />,
        onSelect: () =>
          navigate(buildTaskAwareRoute('/app/instance/InstanceApi', searchParams, contextForRow(row.original)), { state: { data: { ...row.original } } })
      },
      {
        id: "create-oauth-client",
        label: "Create OAuth Client",
        description: "Create an OAuth client with this record preselected.",
        icon: <VpnKeyIcon />,
        onSelect: () =>
          navigate(buildTaskAwareRoute('/app/form/createClient', searchParams, contextForRow(row.original)), { state: { data: { hostId: row.original.hostId, instanceId: row.original.instanceId } } })
      },
      {
        id: "instance-apps",
        label: "Instance Apps",
        description: "Manage application associations.",
        icon: <AppsIcon />,
        onSelect: () =>
          navigate(buildTaskAwareRoute('/app/instance/InstanceApp', searchParams, contextForRow(row.original)), { state: { data: { ...row.original } } })
      },
      {
        id: "instance-app-api",
        label: "Instance App API",
        description: "Manage application API associations.",
        icon: <FormatIndentIncreaseIcon />,
        onSelect: () =>
          navigate(buildTaskAwareRoute('/app/instance/InstanceAppApi', searchParams, contextForRow(row.original)), { state: { data: { ...row.original } } })
      },
      {
        id: "deployment",
        label: "Deployment",
        description: "View deployments for this instance.",
        icon: <InstallDesktopIcon />,
        onSelect: () =>
          navigate(buildTaskAwareRoute('/app/deployment/instance', searchParams, contextForRow(row.original)), { state: { data: { ...row.original } } })
      },
      {
        id: "delete-instance",
        label: "Delete Instance",
        icon: <DeleteForeverIcon />,
        destructive: true,
        disabledReason: () => (!instanceOwnership.canModifyRecord(row.original)) ? ('You can only delete instances you own.') : null,
        onSelect: () => handleDelete(row)
      }
    ]} />,
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildTaskAwareRoute('/app/form/createInstance', searchParams, taskContext))}>
          Create New Instance
        </Button>
        <Tooltip title={compareIssue ?? `Compare current snapshots for ${selectedCount} instances`}>
          <span>
            <Button
              variant="outlined"
              startIcon={isResolvingSnapshots ? <CircularProgress size={18} /> : <CompareArrowsIcon />}
              disabled={Boolean(compareIssue) || isResolvingSnapshots}
              onClick={compareCurrentSnapshots}
            >
              {isResolvingSnapshots ? 'Resolving current snapshots…' : `Compare current snapshots (${selectedCount})`}
            </Button>
          </span>
        </Tooltip>
        {selectedCount > 0 && <Button onClick={clearSelection}>Clear selection</Button>}
        {selectedRows.map(instance => (
          <Chip
            key={instanceSelectionKey(instance)}
            size="small"
            label={`${instance.instanceName || instance.instanceId}${instance.envTag ? ` · ${instance.envTag}` : ''}`}
            onDelete={() => removeSelectedInstance(instance)}
          />
        ))}
        {ownedOnly ? (
          <Typography variant="subtitle1">My Instances: <strong>{email || userId}</strong></Typography>
        ) : (
          <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>Admin View: All Instances</Typography>
        )}
      </Box>
    ),
  }));

  return (
    <Box>
      {publishingAgent && publishingAgent.hostId === host && <AgentPolicyPublicationDialog
        key={`${publishingAgent.hostId}:${publishingAgent.instanceId}`}
        hostId={publishingAgent.hostId} instanceId={publishingAgent.instanceId}
        serviceId={publishingAgent.serviceId} onClose={() => setPublishingAgent(null)} />}
      <TaskActionPanel
        title="Instance Tasks"
        context={taskContext}
        taskIds={['manage-instance', 'manage-deployment', 'manage-configuration']}
        maxActions={3}
      />
      <Box mt={2}>
        {!hasOwnerContext && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            User context is required before owner-scoped instances can be loaded.
          </Alert>
        )}
        {selectionMessage && <Alert severity="warning" sx={{ mb: 1 }}>{selectionMessage}</Alert>}
        {selectedCount >= 2 && compareIssue && <Alert severity="warning" sx={{ mb: 1 }}>{compareIssue}</Alert>}
        {resolverError && <Alert severity="error" sx={{ mb: 1 }}>{resolverError}</Alert>}
        <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>
      </Box>
    </Box>
  );
}
