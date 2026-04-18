import AssessmentIcon from '@mui/icons-material/Assessment';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import HelpIcon from '@mui/icons-material/Help';
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import StorageIcon from '@mui/icons-material/Storage';
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
  productId?: string;
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
  productId: string;
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
function isCtrlPaneDebugEnabled() {
  if (import.meta.env.DEV) {
    return true;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const url = new URL(window.location.href);
    const queryValue = url.searchParams.get('ctrlPaneDebug');
    if (queryValue === '1' || queryValue === 'true') {
      return true;
    }
    const storageValue = window.localStorage.getItem('ctrlPaneDebug');
    return storageValue === '1' || storageValue === 'true';
  } catch {
    return false;
  }
}

function debugCtrlPane(message: string, details?: unknown) {
  if (!isCtrlPaneDebugEnabled()) {
    return;
  }
  if (details === undefined) {
    console.log(`[CtrlPaneDashboard] ${message}`);
    return;
  }
  console.log(`[CtrlPaneDashboard] ${message}`, details);
}

const mapDbToRuntimeInstance = (db: RuntimeInstanceType): RuntimeInstanceView => ({
  runtimeInstanceId: db.runtimeInstanceId,
  serviceId: db.serviceId,
  productId: db.productId,
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
    sort && (sort.id === 'serviceId' || sort.id === 'envTag' || sort.id === 'productId'),
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
    productId: rawPayload.productId || rawPayload.product_id,
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
  const [productIds, setProductIds] = useState<{ text: string; value: string }[]>([]);
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

  useEffect(() => {
    const fetchProductIds = async () => {
      if (!host) return;
      const url = '/r/data?name=platform_product';
      try {
        const response = await fetchClient(url);
        if (Array.isArray(response)) {
          setProductIds(response.map((p: any) => ({ text: p.label, value: p.id })));
        }
      } catch (err) {
        console.error('Failed to fetch product IDs', err);
      }
    };
    fetchProductIds();
  }, [host]);

  const serviceIdFilterValue = useMemo(
    () => columnFilters.find((columnFilter) => columnFilter.id === 'serviceId')?.value,
    [columnFilters],
  );

  const productIdFilterValue = useMemo(
    () => columnFilters.find((columnFilter) => columnFilter.id === 'productId')?.value,
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
    if (productIdFilterValue !== undefined) {
      nextServerFilters.push({ id: 'productId', value: productIdFilterValue });
    }

    return nextServerFilters;
  }, [serviceIdFilterValue, envTagFilterValue, productIdFilterValue]);

  const serverSorting = useMemo(() => {
    return sorting.filter((sort) => sort.id === 'serviceId' || sort.id === 'envTag' || sort.id === 'productId');
  }, [sorting]);

  const matchesFilter = useCallback(
    (instance: RuntimeInstanceView, filters: MRT_ColumnFiltersState, query: string) => {
      const normalizedQuery = (query || '').trim().toLowerCase();
      if (normalizedQuery) {
        const haystack = [
          instance.runtimeInstanceId,
          instance.serviceId,
          instance.productId || '',
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
          columnFilter.id === 'productId' &&
          !(instance.productId || '').toLowerCase().includes(value)
        ) {
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
      debugCtrlPane('Loaded baseline runtime instances', {
        count: dbInstances.length,
        runtimeInstanceIds: dbInstances.map((instance) => instance.runtimeInstanceId),
        rows: dbInstances.map((instance) => ({
          runtimeInstanceId: instance.runtimeInstanceId,
          serviceId: instance.serviceId,
          envTag: instance.envTag,
          productId: instance.productId,
          address: instance.metadata.address,
          port: instance.metadata.port,
        })),
      });
      setInstances(dbMap);
      setHasLoadedOnce(true);

      if (!isLiveConnected) {
        isSyncingRef.current = false;
        setHasCompletedSync(true);
        return;
      }

      const liveArgs: Record<string, string> = {};

      try {
        const liveResponse = await callTool('list_instances', liveArgs);
        if (requestVersionRef.current !== requestVersion) {
          return;
        }

        const liveInstances = Array.isArray(liveResponse?.instances) ? liveResponse.instances : [];
        debugCtrlPane('Received live runtime instances from controller', {
          args: liveArgs,
          count: liveInstances.length,
          runtimeInstanceIds: liveInstances.map((instance: any) =>
            instance?.runtimeInstanceId || instance?.runtime_instance_id || null,
          ),
          rows: liveInstances,
        });

        const reconciledInstances = reconcileInstances(
          dbMap,
          liveInstances,
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
        debugCtrlPane('Buffered live notification during sync', { method, params });
        return;
      }

      const runtimeInstanceId = getNotificationRuntimeInstanceId(params);
      if (!runtimeInstanceId && method !== 'notifications/instance_disconnected') {
        debugCtrlPane('Ignored live notification without runtimeInstanceId', { method, params });
        return;
      }

      debugCtrlPane('Applying live notification', { method, runtimeInstanceId, params });
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
      const key = `${instance.serviceId}|${instance.productId || ''}|${instance.envTag || ''}`;
      if (!groups[key]) {
        groups[key] = {
          serviceId: instance.serviceId,
          productId: instance.productId || '',
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
        productId: instance.productId,
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
          } else if (sort.id === 'productId') {
            comparison = left.productId.localeCompare(right.productId);
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
        accessorKey: 'productId',
        header: 'Product Id',
        enableColumnFilter: true,
        filterVariant: 'select',
        filterSelectOptions: productIds,
      },
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
    [productIds],
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

  const handleModule = (node: RuntimeInstanceRow) => {
    navigate('/app/controller/module', {
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

  const handleCache = (node: RuntimeInstanceRow) => {
    navigate('/app/controller/cache', {
      state: {
        data: {
          node: {
            runtimeInstanceId: node.runtimeInstanceId,
          },
        },
      },
    });
  };

  const table = useMaterialReactTable({
    columns,
    data: pagedData,
    getRowId: (row) => `${row.serviceId}|${row.productId}|${row.envTag}`,
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
                <TableCell align="right">Module</TableCell>
                <TableCell align="right">Cache</TableCell>
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
                    <TableCell align="right">
                      <IconButton aria-label="Module manager" onClick={() => handleModule(node)} disabled={!canInvoke}>
                        <ViewModuleIcon />
                      </IconButton>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton aria-label="Cache explorer" onClick={() => handleCache(node)} disabled={!canInvoke}>
                        <StorageIcon />
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
): Record<RuntimeInstanceId, RuntimeInstanceView> {
  const reconciledInstances: Record<RuntimeInstanceId, RuntimeInstanceView> = {};
  const unmatchedLiveInstances: RuntimeInstanceView[] = [];
  const inactiveBaselineInstances: RuntimeInstanceView[] = [];

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
        productId: existing.productId || normalizedLiveInstance.productId,
      };
      continue;
    }
    unmatchedLiveInstances.push(normalizedLiveInstance);
    if (matchesFilter(normalizedLiveInstance, columnFilters, globalFilter)) {
      reconciledInstances[normalizedLiveInstance.runtimeInstanceId] = normalizedLiveInstance;
    }
  }

  Object.values(reconciledInstances).forEach((instance) => {
    if (
      baselineInstances[instance.runtimeInstanceId] &&
      instance.liveStatus !== 'active'
    ) {
      inactiveBaselineInstances.push(instance);
    }
  });

  debugCtrlPane('Reconciled baseline and live runtime instances', {
    baselineCount: Object.keys(baselineInstances).length,
    liveCount: liveInstances.length,
    unmatchedLiveInstances: unmatchedLiveInstances.map((instance) => ({
      runtimeInstanceId: instance.runtimeInstanceId,
      serviceId: instance.serviceId,
      envTag: instance.envTag,
      address: instance.metadata.address,
      port: instance.metadata.port,
      liveStatus: instance.liveStatus,
    })),
    inactiveBaselineInstances: inactiveBaselineInstances.map((instance) => ({
      runtimeInstanceId: instance.runtimeInstanceId,
      serviceId: instance.serviceId,
      envTag: instance.envTag,
      address: instance.metadata.address,
      port: instance.metadata.port,
      liveStatus: instance.liveStatus,
    })),
  });

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
): Record<RuntimeInstanceId, RuntimeInstanceView> {
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
      debugCtrlPane('Ignored disconnect notification without matching current instance', {
        method,
        runtimeInstanceId,
        params,
      });
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
    debugCtrlPane('Ignored live notification with unparseable payload', { method, params });
    return currentInstances;
  }

  const existing = currentInstances[normalizedInstance.runtimeInstanceId];
  if (existing) {
    return {
      ...currentInstances,
      [normalizedInstance.runtimeInstanceId]: {
        ...existing,
        ...normalizedInstance,
        productId: existing.productId || normalizedInstance.productId,
      },
    };
  }

  if (!matchesFilter(normalizedInstance, columnFilters, globalFilter)) {
    debugCtrlPane('Ignored live notification that did not match current filters', {
      method,
      runtimeInstanceId: normalizedInstance.runtimeInstanceId,
      params,
    });
    return currentInstances;
  }

  debugCtrlPane('Inserted live-only runtime instance from notification', {
    method,
    runtimeInstanceId: normalizedInstance.runtimeInstanceId,
    serviceId: normalizedInstance.serviceId,
    envTag: normalizedInstance.envTag,
    address: normalizedInstance.metadata.address,
    port: normalizedInstance.metadata.port,
  });

  return {
    ...currentInstances,
    [normalizedInstance.runtimeInstanceId]: normalizedInstance,
  };
}

export default CtrlPaneDashboard;
