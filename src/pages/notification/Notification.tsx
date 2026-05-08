import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
} from 'material-react-table';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import type { ChipProps } from '@mui/material';
import { useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';

type NotificationStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'DLQ' | 'SKIPPED' | string;

type NotificationData = {
  id?: string;
  hostId?: string;
  userId?: string;
  nonce?: number;
  eventClass?: string;
  processFlag?: boolean;
  status?: NotificationStatus;
  eventTs?: string | null;
  processTs?: string | null;
  eventJson?: string | null;
  error?: string | null;
  aggregateId?: string | null;
  aggregateType?: string | null;
  aggregateVersion?: number | null;
  eventPartition?: number | null;
  eventOffset?: number | null;
  transactionId?: string | null;
  readTs?: string | null;
};

type NotificationApiResponse = {
  notifications?: NotificationData[];
  total?: number;
};

const NOTIFICATION_FAILURES_READ_EVENT = 'portal:notification-failures-read';

const buildQueryUrl = (action: string, data: Record<string, unknown>) => {
  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action,
    version: '0.1.0',
    data,
  };

  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
};

const statusOptions = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Succeeded', value: 'SUCCEEDED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'DLQ', value: 'DLQ' },
  { label: 'Skipped', value: 'SKIPPED' },
];

const getFilterValue = (filters: MRT_ColumnFiltersState, id: string) => {
  const value = filters.find((filter) => filter.id === id)?.value;
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(',');
  return String(value).trim();
};

const statusFromNotification = (notification: NotificationData) => {
  if (notification.status) return notification.status;
  if (typeof notification.processFlag === 'boolean') {
    return notification.processFlag ? 'SUCCEEDED' : 'FAILED';
  }
  return '';
};

const processFlagFromStatus = (status: string) => {
  if (status === 'SUCCEEDED') return 'Y';
  if (status === 'FAILED' || status === 'DLQ' || status === 'SKIPPED') return 'N';
  return '';
};

const statusChipColor = (status: string): ChipProps['color'] => {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'SKIPPED') return 'default';
  return status ? 'error' : 'default';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatJson = (value?: string | null) => {
  if (!value) return '';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};

function TruncatedValue({ value, maxWidth = 260 }: { value?: unknown; maxWidth?: number }) {
  const text = value === undefined || value === null ? '' : String(value);
  if (!text) return null;

  return (
    <Tooltip title={text} placement="top-start">
      <Box
        component="span"
        sx={{
          display: 'block',
          maxWidth,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </Box>
    </Tooltip>
  );
}

function StatusChip({ status }: { status: string }) {
  const label = status || 'UNKNOWN';

  return (
    <Chip
      label={label}
      color={statusChipColor(status)}
      size="small"
      variant={status === 'SKIPPED' || !status ? 'outlined' : 'filled'}
      sx={{ fontWeight: 600 }}
    />
  );
}

function NotificationDetailPanel({ notification }: { notification: NotificationData }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 0.8fr) minmax(0, 2fr)' },
        p: 2,
      }}
    >
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Typography variant="subtitle2">Event Metadata</Typography>
        <Typography variant="body2">Host: {notification.hostId || ''}</Typography>
        <Typography variant="body2">User: {notification.userId || ''}</Typography>
        <Typography variant="body2">Transaction: {notification.transactionId || ''}</Typography>
        <Typography variant="body2">
          Position: {[notification.eventPartition, notification.eventOffset].filter((value) => value !== undefined && value !== null).join(' / ')}
        </Typography>
        <Typography variant="body2">Aggregate: {notification.aggregateId || ''}</Typography>
        <Typography variant="body2">Aggregate Type: {notification.aggregateType || ''}</Typography>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Event JSON
        </Typography>
        <Box
          component="pre"
          sx={{
            bgcolor: 'grey.100',
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            m: 0,
            maxHeight: 320,
            overflow: 'auto',
            p: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {formatJson(notification.eventJson)}
        </Box>
      </Box>
    </Box>
  );
}

export default function Notification() {
  const { host, userId } = useUserState();
  const [data, setData] = useState<NotificationData[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [seededUserId, setSeededUserId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([
    { id: 'processTs', desc: true },
  ]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  useEffect(() => {
    if (!userId || seededUserId === userId) return;
    setColumnFilters((prev) => (
      prev.some((filter) => filter.id === 'userId')
        ? prev
        : [{ id: 'userId', value: userId }, ...prev]
    ));
    setSeededUserId(userId);
  }, [seededUserId, userId]);

  const markFailuresRead = useCallback(async () => {
    if (!host || !userId) return;

    try {
      await fetchClient(buildQueryUrl('markFailureNotificationsRead', { hostId: host, userId }));
      window.dispatchEvent(new CustomEvent(NOTIFICATION_FAILURES_READ_EVENT));
    } catch (error) {
      console.error(error);
    }
  }, [host, userId]);

  useEffect(() => {
    markFailuresRead();
  }, [markFailuresRead]);

  const fetchData = useCallback(async () => {
    if (!host || !userId) {
      setData([]);
      setRowCount(0);
      setIsLoading(false);
      setIsRefetching(false);
      return;
    }

    if (hasLoadedRef.current) setIsRefetching(true); else setIsLoading(true);

    const status = getFilterValue(columnFilters, 'status');
    const legacyUserId = getFilterValue(columnFilters, 'userId') || userId || '';
    const legacyFilters = {
      userId: legacyUserId,
      nonce: getFilterValue(columnFilters, 'nonce'),
      eventClass: getFilterValue(columnFilters, 'eventClass'),
      status,
      processFlag: processFlagFromStatus(status),
      processTime: getFilterValue(columnFilters, 'processTs'),
      eventJson: getFilterValue(columnFilters, 'eventJson'),
      error: getFilterValue(columnFilters, 'error'),
    };

    const url = buildQueryUrl('getNotification', {
      hostId: host,
      userId,
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      sorting: JSON.stringify(sorting ?? []),
      filters: JSON.stringify(columnFilters ?? []),
      globalFilter: globalFilter ?? '',
      ...legacyFilters,
    });

    try {
      const json = await fetchClient(url) as NotificationApiResponse;
      setData(json.notifications || []);
      setRowCount(json.total || 0);
      setIsError(false);
    } catch (error) {
      setIsError(true);
      setData([]);
      setRowCount(0);
      console.error(error);
    } finally {
      hasLoadedRef.current = true;
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [columnFilters, globalFilter, host, pagination.pageIndex, pagination.pageSize, sorting, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = useMemo<MRT_ColumnDef<NotificationData>[]>(
    () => [
      {
        id: 'status',
        header: 'Status',
        accessorFn: statusFromNotification,
        filterVariant: 'select',
        filterSelectOptions: statusOptions,
        size: 130,
        Cell: ({ row }) => <StatusChip status={statusFromNotification(row.original)} />,
      },
      {
        accessorKey: 'processTs',
        header: 'Process Time',
        size: 210,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string | null>()),
      },
      {
        accessorKey: 'eventTs',
        header: 'Event Time',
        size: 210,
        Cell: ({ cell }) => formatDateTime(cell.getValue<string | null>()),
      },
      {
        accessorKey: 'eventClass',
        header: 'Event',
        size: 240,
        Cell: ({ cell }) => <TruncatedValue value={cell.getValue()} maxWidth={260} />,
      },
      {
        accessorKey: 'aggregateType',
        header: 'Aggregate Type',
        size: 170,
      },
      {
        accessorKey: 'aggregateId',
        header: 'Aggregate',
        size: 240,
        Cell: ({ cell }) => <TruncatedValue value={cell.getValue()} maxWidth={240} />,
      },
      {
        accessorKey: 'nonce',
        header: 'Nonce',
        size: 110,
      },
      {
        accessorKey: 'error',
        header: 'Error',
        size: 280,
        Cell: ({ cell }) => (
          <Typography color={cell.getValue<string>() ? 'error' : undefined} variant="body2">
            <TruncatedValue value={cell.getValue()} maxWidth={320} />
          </Typography>
        ),
      },
      {
        accessorKey: 'userId',
        header: 'User Id',
        size: 280,
        Cell: ({ cell }) => <TruncatedValue value={cell.getValue()} maxWidth={280} />,
      },
      {
        accessorKey: 'hostId',
        header: 'Host Id',
        size: 280,
        Cell: ({ cell }) => <TruncatedValue value={cell.getValue()} maxWidth={280} />,
      },
      {
        accessorKey: 'transactionId',
        header: 'Transaction Id',
        size: 280,
        Cell: ({ cell }) => <TruncatedValue value={cell.getValue()} maxWidth={280} />,
      },
      {
        accessorKey: 'eventPartition',
        header: 'Partition',
        size: 120,
      },
      {
        accessorKey: 'eventOffset',
        header: 'Offset',
        size: 120,
      },
      {
        accessorKey: 'eventJson',
        header: 'Event JSON',
        size: 320,
        Cell: ({ cell }) => <TruncatedValue value={cell.getValue()} maxWidth={320} />,
      },
    ],
    [],
  );

  const table = useMaterialReactTable({
    columns,
    data,
    initialState: {
      showColumnFilters: true,
      density: 'compact',
      columnVisibility: {
        eventTs: false,
        hostId: false,
        transactionId: false,
        eventPartition: false,
        eventOffset: false,
        eventJson: false,
      },
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
    getRowId: (row) => row.id || `${row.hostId || ''}-${row.userId || ''}-${row.nonce || ''}-${row.eventClass || ''}-${row.processTs || ''}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading notifications' } : undefined,
    enableExpanding: true,
    positionExpandColumn: 'first',
    renderDetailPanel: ({ row }) => <NotificationDetailPanel notification={row.original} />,
  });

  return (
    <Box sx={{ p: 1 }}>
      <MaterialReactTable table={table} />
    </Box>
  );
}
