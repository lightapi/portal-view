import AssessmentIcon from '@mui/icons-material/Assessment';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import HelpIcon from '@mui/icons-material/Help';
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ExpandedState,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
} from 'material-react-table';
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../contexts/AppContext';
import { useController } from '../../contexts/ControllerContext';
import { useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';
import {
  LiveStatus,
  RuntimeInstance,
  RuntimeInstanceApiResponse,
  RuntimeInstanceId,
  RuntimeInstanceType,
} from '../../controller/types';

type RuntimeInstanceView = RuntimeInstance & {
  liveStatus: LiveStatus;
};

type RuntimeInstanceRow = {
  runtimeInstanceId: string;
  serviceId: string;
  envTag?: string;
  protocol: string;
  ipAddress: string;
  portNumber: number;
  liveStatus: LiveStatus;
  active: boolean;
};

type GroupStatus = 'All Live' | 'Partial Live' | 'None Live' | 'Syncing';

type ServiceGroup = {
  serviceId: string;
  envTag: string;
  nodeCount: number;
  nodes: RuntimeInstanceRow[];
  status: GroupStatus;
};

type BufferedNotification = {
  method: string;
  params: any;
};

const DB_LIMIT = 1000;

const mapDbToRuntimeInstance = (db: RuntimeInstanceType): RuntimeInstanceView => ({
  runtimeInstanceId: db.runtimeInstanceId,
  serviceId: db.serviceId,
  envTag: db.envTag,
  connected: false,
  connectedAt: db.updateTs || '',
  lastSeenAt: db.updateTs || '',
  active: false,
  liveStatus: 'unknown',
  metadata: {
    address: db.ipAddress,
    port: db.portNumber,
    protocol: db.protocol,
    environment: db.envTag || '',
    version: '0.1.0',
    tags: {},
  },
});

const buildQueryCommand = (
  hostId: string,
  filters: MRT_ColumnFiltersState,
  globalFilter: string,
  sorting: MRT_SortingState,
) => {
  const safeSorting = (sorting ?? []).filter((sort) =>
    sort && (sort.id === 'serviceId' || sort.id === 'envTag'),
  );

  return {
    host: 'lightapi.net',
    service: 'instance',
    action: 'getRuntimeInstance',
    version: '0.1.0',
    data: {
      hostId,
      offset: 0,
      limit: DB_LIMIT,
      sorting: JSON.stringify(safeSorting),
      filters: JSON.stringify(filters ?? []),
      globalFilter: globalFilter ?? '',
      active: true,
    },
  };
};

function parseRuntimeInstancePayload(rawPayload: any): RuntimeInstanceView | null {
  const runtimeInstanceId =
    rawPayload && typeof rawPayload === 'object'
      ? rawPayload.runtimeInstanceId || rawPayload.runtime_instance_id
      : undefined;
  if (!rawPayload || typeof rawPayload !== 'object' || !runtimeInstanceId) {
    return null;
  }

  return {
    runtimeInstanceId,
    serviceId: rawPayload.serviceId || '',
    envTag: rawPayload.envTag || rawPayload.env_tag || '',
    connectedAt: rawPayload.connectedAt || rawPayload.connected_at || '',
    lastSeenAt: rawPayload.lastSeenAt || rawPayload.last_seen_at || '',
    connected: true,
    active: true,
    liveStatus: 'active',
    metadata: {
      address: rawPayload.metadata?.address || 'unknown',
      port: rawPayload.metadata?.port || 0,
      protocol: rawPayload.metadata?.protocol || 'http',
      environment:
        rawPayload.metadata?.environment || rawPayload.envTag || rawPayload.env_tag || '',
      version: rawPayload.metadata?.version || '0.1.0',
      tags: rawPayload.metadata?.tags || {},
    },
  };
}

function normalizeLiveSnapshotInstance(rawPayload: any): RuntimeInstanceView | null {
  const parsed = parseRuntimeInstancePayload(rawPayload);
  if (!parsed) {
    return null;
  }
  return {
    ...parsed,
    connected: rawPayload.connected ?? true,
    active: rawPayload.active ?? true,
    liveStatus: rawPayload.active === false ? 'inactive' : 'active',
  };
}

function getNotificationRuntimeInstanceId(params: any): RuntimeInstanceId | undefined {
  const rawPayload =
    params && typeof params === 'object' && 'instance' in params ? params.instance : params;
  if (!rawPayload || typeof rawPayload !== 'object') {
    return undefined;
  }
  return rawPayload.runtimeInstanceId || rawPayload.runtime_instance_id;
}

function statusChipProps(status: GroupStatus) {
  switch (status) {
    case 'All Live':
      return { color: 'success' as const };
    case 'Partial Live':
      return { color: 'warning' as const };
    case 'Syncing':
      return { color: 'default' as const };
    default:
      return { color: 'error' as const };
  }
}

function nodeChipProps(status: LiveStatus) {
  switch (status) {
    case 'active':
      return { label: 'Active', color: 'success' as const };
    case 'inactive':
      return { label: 'Inactive', color: 'error' as const };
    default:
      return { label: 'Syncing', color: 'default' as const };
  }
}

function CtrlPaneDashboard() {
  const navigate = useNavigate();
  const { filter } = useAppState() as { filter: string };
  const { host } = useUserState() as { host: string };
  const { callTool, subscribeToNotifications, isLiveConnected, error } = useController();

  const [instances, setInstances] = useState<Record<RuntimeInstanceId, RuntimeInstanceView>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [hasCompletedSync, setHasCompletedSync] = useState(false);
  const [liveSyncError, setLiveSyncError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<MRT_ExpandedState>({});
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState(filter);
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const deferredGlobalFilter = useDeferredValue(globalFilter);

  const bufferedNotificationsRef = useRef<BufferedNotification[]>([]);
  const isSyncingRef = useRef(false);
  const requestVersionRef = useRef(0);
  const queryRef = useRef({
    columnFilters,
    globalFilter: filter,
  });

  useEffect(() => {
    queryRef.current = { columnFilters, globalFilter };
  }, [columnFilters, globalFilter]);

  useEffect(() => {
    setGlobalFilter(filter);
  }, [filter]);

  const serviceIdFilterValue = useMemo(
    () => columnFilters.find((columnFilter) => columnFilter.id === 'serviceId')?.value,
    [columnFilters],
  );

  const envTagFilterValue = useMemo(
    () => columnFilters.find((columnFilter) => columnFilter.id === 'envTag')?.value,
    [columnFilters],
  );

  const serverFilters = useMemo(() => {
    const nextServerFilters: MRT_ColumnFiltersState = [];

    if (serviceIdFilterValue !== undefined) {
      nextServerFilters.push({ id: 'serviceId', value: serviceIdFilterValue });
    }
    if (envTagFilterValue !== undefined) {
      nextServerFilters.push({ id: 'envTag', value: envTagFilterValue });
    }

    return nextServerFilters;
  }, [serviceIdFilterValue, envTagFilterValue]);

  const serviceIdSort = useMemo(
    () => sorting.find((sort) => sort.id === 'serviceId'),
    [sorting],
  );

  const envTagSort = useMemo(
    () => sorting.find((sort) => sort.id === 'envTag'),
    [sorting],
  );

  const serverSorting = useMemo(() => {
    const nextServerSorting: MRT_SortingState = [];

    if (serviceIdSort) {
      nextServerSorting.push(serviceIdSort);
    }
    if (envTagSort) {
      nextServerSorting.push(envTagSort);
    }

    return nextServerSorting;
  }, [serviceIdSort?.desc, envTagSort?.desc]);

  const matchesFilter = useCallback(
    (instance: RuntimeInstanceView, filters: MRT_ColumnFiltersState, query: string) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (normalizedQuery) {
        const haystack = [
          instance.runtimeInstanceId,
          instance.serviceId,
          instance.envTag || '',
          instance.metadata.protocol,
          instance.metadata.address,
          String(instance.metadata.port),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }

      for (const columnFilter of filters) {
        const value = String(columnFilter.value ?? '').trim().toLowerCase();
        if (!value || columnFilter.id === 'status') {
          continue;
        }
        if (columnFilter.id === 'serviceId' && !instance.serviceId.toLowerCase().includes(value)) {
          return false;
        }
        if (
          columnFilter.id === 'envTag' &&
          !(instance.envTag || '').toLowerCase().includes(value)
        ) {
          return false;
        }
      }

      return true;
    },
    [],
  );

  const applyBufferedNotifications = useCallback(
    (
      baseInstances: Record<RuntimeInstanceId, RuntimeInstanceView>,
      filters: MRT_ColumnFiltersState,
      query: string,
    ) => {
      let nextInstances = baseInstances;
      for (const notification of bufferedNotificationsRef.current) {
        nextInstances = applyNotificationToInstances(
          nextInstances,
          notification.method,
          notification.params,
          filters,
          query,
          matchesFilter,
        );
      }
      bufferedNotificationsRef.current = [];
      return nextInstances;
    },
    [matchesFilter],
  );

  const fetchBaselineAndSync = useCallback(async () => {
    if (!host) {
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    const currentFilters = serverFilters;
    const currentGlobalFilter = deferredGlobalFilter;
    const isInitialRequest = !hasLoadedOnce;

    isSyncingRef.current = true;
    bufferedNotificationsRef.current = [];
    setHasCompletedSync(false);
    setLiveSyncError(null);
    if (isInitialRequest) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }

    try {
      const cmd = buildQueryCommand(host, currentFilters, currentGlobalFilter, serverSorting);
      const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
      const dbResponse = (await fetchClient(url)) as RuntimeInstanceApiResponse;
      if (requestVersionRef.current !== requestVersion) {
        return;
      }

      const dbInstances = (dbResponse.runtimeInstances || []).map(mapDbToRuntimeInstance);
      const dbMap: Record<RuntimeInstanceId, RuntimeInstanceView> = {};
      dbInstances.forEach((instance) => {
        dbMap[instance.runtimeInstanceId] = instance;
      });
      setInstances(dbMap);
      setHasLoadedOnce(true);

      if (!isLiveConnected) {
        isSyncingRef.current = false;
        setHasCompletedSync(true);
        return;
      }

      const liveArgs: Record<string, string> = {};
      const serviceIdFilter = currentFilters.find((columnFilter) => columnFilter.id === 'serviceId');
      const envTagFilter = currentFilters.find((columnFilter) => columnFilter.id === 'envTag');
      if (typeof serviceIdFilter?.value === 'string' && serviceIdFilter.value.trim()) {
        liveArgs.serviceId = serviceIdFilter.value.trim();
      }
      if (typeof envTagFilter?.value === 'string' && envTagFilter.value.trim()) {
        liveArgs.envTag = envTagFilter.value.trim();
      }

      try {
        const liveResponse = await callTool('list_instances', liveArgs);
        if (requestVersionRef.current !== requestVersion) {
          return;
        }

        const reconciledInstances = reconcileInstances(
          dbMap,
          Array.isArray(liveResponse?.instances) ? liveResponse.instances : [],
          currentFilters,
          currentGlobalFilter,
          matchesFilter,
        );
        const finalizedInstances = applyBufferedNotifications(
          reconciledInstances,
          currentFilters,
          currentGlobalFilter,
        );

        setInstances(finalizedInstances);
        isSyncingRef.current = false;
        setHasCompletedSync(true);
      } catch (liveSyncError) {
        console.error('Failed to synchronize live runtime instances', liveSyncError);
        if (requestVersionRef.current === requestVersion) {
          const fallbackInstances = applyBufferedNotifications(
            dbMap,
            currentFilters,
            currentGlobalFilter,
          );
          setInstances(fallbackInstances);
          isSyncingRef.current = false;
          setHasCompletedSync(true);
          setLiveSyncError('Live status synchronization failed');
        }
      }
    } catch (syncError) {
      console.error('Failed to load or reconcile controller services', syncError);
      if (requestVersionRef.current === requestVersion) {
        setHasLoadedOnce(true);
        setHasCompletedSync(true);
        setLiveSyncError('Failed to load controller services');
      }
    } finally {
      if (requestVersionRef.current === requestVersion) {
        isSyncingRef.current = false;
        bufferedNotificationsRef.current = [];
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  }, [
    applyBufferedNotifications,
    callTool,
    deferredGlobalFilter,
    hasLoadedOnce,
    host,
    isLiveConnected,
    matchesFilter,
    serverFilters,
    serverSorting,
  ]);

  useEffect(() => {
    fetchBaselineAndSync();
  }, [fetchBaselineAndSync]);

  useEffect(() => {
    return subscribeToNotifications((method, params) => {
      if (!method.startsWith('notifications/instance_')) {
        return;
      }

      if (isSyncingRef.current) {
        bufferedNotificationsRef.current.push({ method, params });
        return;
      }

      const runtimeInstanceId = getNotificationRuntimeInstanceId(params);
      if (!runtimeInstanceId && method !== 'notifications/instance_disconnected') {
        return;
      }

      setInstances((currentInstances) =>
        applyNotificationToInstances(
          currentInstances,
          method,
          params,
          queryRef.current.columnFilters,
          queryRef.current.globalFilter,
          matchesFilter,
        ),
      );
    });
  }, [matchesFilter, subscribeToNotifications]);

  const groupedData = useMemo(() => {
    const groups: Record<string, ServiceGroup> = {};

    Object.values(instances).forEach((instance) => {
      const key = `${instance.serviceId}|${instance.envTag || ''}`;
      if (!groups[key]) {
        groups[key] = {
          serviceId: instance.serviceId,
          envTag: instance.envTag || '',
          nodeCount: 0,
          nodes: [],
          status: 'None Live',
        };
      }
      groups[key].nodeCount += 1;
      groups[key].nodes.push({
        runtimeInstanceId: instance.runtimeInstanceId,
        serviceId: instance.serviceId,
        envTag: instance.envTag,
        protocol: instance.metadata.protocol,
        ipAddress: instance.metadata.address,
        portNumber: instance.metadata.port,
        liveStatus: instance.liveStatus ?? 'unknown',
        active: instance.liveStatus === 'active',
      });
    });

    let result = Object.values(groups).map((group) => {
      const activeCount = group.nodes.filter((node) => node.liveStatus === 'active').length;
      const unknownCount = group.nodes.filter((node) => node.liveStatus === 'unknown').length;
      if (unknownCount > 0) {
        group.status = 'Syncing';
      } else if (activeCount === group.nodeCount && group.nodeCount > 0) {
        group.status = 'All Live';
      } else if (activeCount === 0) {
        group.status = 'None Live';
      } else {
        group.status = 'Partial Live';
      }
      return group;
    });

    const statusFilter = columnFilters.find((columnFilter) => columnFilter.id === 'status');
    if (statusFilter?.value) {
      result = result.filter((group) => group.status === statusFilter.value);
    }

    if (sorting.length > 0) {
      result = [...result].sort((left, right) => {
        for (const sort of sorting) {
          let comparison = 0;
          if (sort.id === 'serviceId') {
            comparison = left.serviceId.localeCompare(right.serviceId);
          } else if (sort.id === 'envTag') {
            comparison = left.envTag.localeCompare(right.envTag);
          } else if (sort.id === 'nodeCount') {
            comparison = left.nodeCount - right.nodeCount;
          } else if (sort.id === 'status') {
            comparison = left.status.localeCompare(right.status);
          }
          if (comparison !== 0) {
            return sort.desc ? comparison * -1 : comparison;
          }
        }
        return 0;
      });
    }

    return result;
  }, [columnFilters, instances, sorting]);

  const pagedData = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return groupedData.slice(start, start + pagination.pageSize);
  }, [groupedData, pagination.pageIndex, pagination.pageSize]);

  useEffect(() => {
    const maxPageIndex =
      groupedData.length === 0 ? 0 : Math.max(0, Math.ceil(groupedData.length / pagination.pageSize) - 1);
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((current) => ({ ...current, pageIndex: maxPageIndex }));
    }
  }, [groupedData.length, pagination.pageIndex, pagination.pageSize]);

  const columns = useMemo<MRT_ColumnDef<ServiceGroup>[]>(
    () => [
      { accessorKey: 'serviceId', header: 'Service Id', enableColumnFilter: true },
      { accessorKey: 'envTag', header: 'Environment Tag', enableColumnFilter: true },
      {
        accessorKey: 'status',
        header: 'Status',
        filterVariant: 'select',
        filterSelectOptions: ['All Live', 'Partial Live', 'None Live', 'Syncing'],
        Cell: ({ cell }) => {
          const status = cell.getValue<GroupStatus>();
          const chip = statusChipProps(status);
          return <Chip label={status} size="small" color={chip.color} variant="outlined" />;
        },
      },
      {
        accessorKey: 'nodeCount',
        header: 'Number of Nodes',
        muiTableBodyCellProps: { align: 'right' },
        muiTableHeadCellProps: { align: 'right' },
        enableColumnFilter: false,
      },
    ],
    [],
  );

  const handleCheck = (node: RuntimeInstanceRow) => {
    navigate('/app/controller/check', { state: { data: { runtimeInstanceId: node.runtimeInstanceId } } });
  };

  const handleLogger = (node: RuntimeInstanceRow) => {
    navigate('/app/controller/logger', {
      state: {
        data: {
          node: {
            protocol: node.protocol,
            address: node.ipAddress,
            port: node.portNumber,
            apiName: node.serviceId,
            runtimeInstanceId: node.runtimeInstanceId,
          },
        },
      },
    });
  };

  const handleInfo = (node: RuntimeInstanceRow) => {
    const originUrl =
      typeof window !== 'undefined'
        ? window.location.protocol + '//' + window.location.host
        : 'null';
    navigate('/app/controller/info', {
      state: {
        data: {
          node: `${node.ipAddress}:${node.portNumber}`,
          protocol: node.protocol,
          address: node.ipAddress,
          port: node.portNumber,
          baseUrl: originUrl,
          runtimeInstanceId: node.runtimeInstanceId,
        },
      },
    });
  };

  const handleChaosMonkey = (node: RuntimeInstanceRow) => {
    const originUrl =
      typeof window !== 'undefined'
        ? window.location.protocol + '//' + window.location.host
        : 'null';
    navigate('/app/controller/chaos', {
      state: {
        data: {
          protocol: node.protocol,
          address: node.ipAddress,
          port: node.portNumber,
          baseUrl: originUrl,
          runtimeInstanceId: node.runtimeInstanceId,
        },
      },
    });
  };

  const table = useMaterialReactTable({
    columns,
    data: pagedData,
    getRowId: (row) => `${row.serviceId}|${row.envTag}`,
    enableExpandAll: false,
    enableExpanding: true,
    getRowCanExpand: () => true,
    positionExpandColumn: 'first',
    enableColumnFilters: true,
    initialState: { showColumnFilters: true, density: 'compact' },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount: groupedData.length,
    state: {
      isLoading: isLoading || (!hasCompletedSync && !error && !liveSyncError && isLiveConnected),
      showAlertBanner: !!(error || liveSyncError),
      showProgressBars: isRefetching,
      globalFilter,
      expanded,
      columnFilters,
      sorting,
      pagination,
    },
    onExpandedChange: setExpanded,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    muiToolbarAlertBannerProps: error || liveSyncError
      ? { color: 'error', children: error || liveSyncError }
      : undefined,
    renderDetailPanel: ({ row }) => (
      <Box sx={{ margin: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 2 }}>
          <Typography variant="h6" component="div">
            Nodes
          </Typography>
          <Chip
            label={
              isLiveConnected
                ? liveSyncError
                  ? 'Live Sync Failed'
                  : hasCompletedSync
                  ? 'Live Control Plane Connected'
                  : 'Live Status Syncing'
                : 'Control Plane Disconnected'
            }
            size="small"
            color={
              isLiveConnected
                ? liveSyncError
                  ? 'warning'
                  : hasCompletedSync
                    ? 'success'
                    : 'default'
                : 'warning'
            }
            variant="outlined"
          />
        </Box>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Protocol</TableCell>
                <TableCell>Address</TableCell>
                <TableCell align="right">Port</TableCell>
                <TableCell align="center">Live Status</TableCell>
                <TableCell align="right">Check</TableCell>
                <TableCell align="right">Info</TableCell>
                <TableCell align="right">Logger</TableCell>
                <TableCell align="right">Chaos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {row.original.nodes.map((node) => {
                const chip = nodeChipProps(node.liveStatus);
                const canInvoke = node.liveStatus === 'active';
                return (
                  <TableRow key={node.runtimeInstanceId}>
                    <TableCell>{node.protocol}</TableCell>
                    <TableCell>{node.ipAddress}</TableCell>
                    <TableCell align="right">{node.portNumber}</TableCell>
                    <TableCell align="center">
                      <Chip label={chip.label} size="small" color={chip.color} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton aria-label="Status check" onClick={() => handleCheck(node)} disabled={!canInvoke}>
                        <CloudDoneIcon />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton aria-label="Server info" onClick={() => handleInfo(node)} disabled={!canInvoke}>
                        <HelpIcon />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton aria-label="Logger config" onClick={() => handleLogger(node)} disabled={!canInvoke}>
                        <PermDataSettingIcon />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton aria-label="Chaos monkey" onClick={() => handleChaosMonkey(node)} disabled={!canInvoke}>
                        <AssessmentIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    ),
  });

  return (
    <Box className="App" sx={{ p: 2 }}>
      <MaterialReactTable table={table} />
    </Box>
  );
}

function reconcileInstances(
  baselineInstances: Record<RuntimeInstanceId, RuntimeInstanceView>,
  liveInstances: any[],
  columnFilters: MRT_ColumnFiltersState,
  globalFilter: string,
  matchesFilter: (
    instance: RuntimeInstanceView,
    filters: MRT_ColumnFiltersState,
    query: string,
  ) => boolean,
) {
  const reconciledInstances: Record<RuntimeInstanceId, RuntimeInstanceView> = {};

  Object.values(baselineInstances).forEach((instance) => {
    reconciledInstances[instance.runtimeInstanceId] = {
      ...instance,
      connected: false,
      active: false,
      liveStatus: 'inactive',
    };
  });

  for (const rawLiveInstance of liveInstances) {
    const normalizedLiveInstance = normalizeLiveSnapshotInstance(rawLiveInstance);
    if (!normalizedLiveInstance) {
      continue;
    }
    const existing = reconciledInstances[normalizedLiveInstance.runtimeInstanceId];
    if (existing) {
      reconciledInstances[normalizedLiveInstance.runtimeInstanceId] = {
        ...existing,
        ...normalizedLiveInstance,
      };
      continue;
    }
    if (matchesFilter(normalizedLiveInstance, columnFilters, globalFilter)) {
      reconciledInstances[normalizedLiveInstance.runtimeInstanceId] = normalizedLiveInstance;
    }
  }

  return reconciledInstances;
}

function applyNotificationToInstances(
  currentInstances: Record<RuntimeInstanceId, RuntimeInstanceView>,
  method: string,
  params: any,
  columnFilters: MRT_ColumnFiltersState,
  globalFilter: string,
  matchesFilter: (
    instance: RuntimeInstanceView,
    filters: MRT_ColumnFiltersState,
    query: string,
  ) => boolean,
) {
  if (
    method !== 'notifications/instance_connected' &&
    method !== 'notifications/instance_updated' &&
    method !== 'notifications/instance_disconnected'
  ) {
    return currentInstances;
  }

  if (method === 'notifications/instance_disconnected') {
    const runtimeInstanceId = getNotificationRuntimeInstanceId(params);
    if (!runtimeInstanceId || !currentInstances[runtimeInstanceId]) {
      return currentInstances;
    }
    return {
      ...currentInstances,
      [runtimeInstanceId]: {
        ...currentInstances[runtimeInstanceId],
        connected: false,
        active: false,
        liveStatus: 'inactive',
      },
    };
  }

  const rawPayload =
    params && typeof params === 'object' && 'instance' in params ? params.instance : params;
  const normalizedInstance = normalizeLiveSnapshotInstance(rawPayload);
  if (!normalizedInstance) {
    return currentInstances;
  }

  const existing = currentInstances[normalizedInstance.runtimeInstanceId];
  if (existing) {
    return {
      ...currentInstances,
      [normalizedInstance.runtimeInstanceId]: {
        ...existing,
        ...normalizedInstance,
      },
    };
  }

  if (!matchesFilter(normalizedInstance, columnFilters, globalFilter)) {
    return currentInstances;
  }

  return {
    ...currentInstances,
    [normalizedInstance.runtimeInstanceId]: normalizedInstance,
  };
}

export default CtrlPaneDashboard;
