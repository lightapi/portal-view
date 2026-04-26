import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
} from 'material-react-table';
import { Box, Typography } from '@mui/material';
import { useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';
import {
  CopyableTruncatedText,
  DateTimeCell,
  EventTypeChip,
  FriendlyUserAgentCell,
  MetadataCell,
  ResultChip,
  suspiciousAuditRow,
  SuspiciousEventMarker,
  TruncatedCell,
} from './OAuthTableHelpers';

type AuthSessionAuditType = {
  auditId: string;
  hostId: string;
  sessionId?: string;
  userId?: string;
  email?: string;
  clientId?: string;
  providerId?: string;
  eventType: string;
  eventTs?: string;
  ipAddress?: string;
  userAgent?: string;
  oldRefreshTokenId?: string;
  newRefreshTokenId?: string;
  result?: string;
  failureReason?: string;
  metadata?: unknown;
};

interface UserState {
  host?: string;
}

export default function AuthSessionAudit() {
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const initialData = location.state?.data || {};

  const [data, setData] = useState<AuthSessionAuditType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() =>
    Object.entries(initialData)
      .map(([id, value]) => ({ id, value: value as string }))
      .filter((filter) => filter.value)
  );
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([{ id: 'eventTs', desc: true }]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const fetchData = useCallback(async () => {
    if (!host) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    const cmd = {
      host: 'lightapi.net',
      service: 'oauth',
      action: 'getAuthSessionAudit',
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

    try {
      const json = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
      setData(json.audits || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true);
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [host, data.length, pagination.pageIndex, pagination.pageSize, sorting, columnFilters, globalFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = useMemo<MRT_ColumnDef<AuthSessionAuditType>[]>(
    () => [
      {
        accessorKey: 'eventType',
        header: 'Event',
        filterVariant: 'select',
        filterSelectOptions: [
          'LOGIN_SUCCEEDED',
          'LOGIN_FAILED',
          'AUTH_CODE_ISSUED',
          'AUTH_CODE_CONSUMED',
          'REFRESH_TOKEN_ISSUED',
          'REFRESH_TOKEN_ROTATED',
          'REFRESH_TOKEN_REJECTED',
          'SESSION_REVOKED',
        ],
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <SuspiciousEventMarker eventType={row.original.eventType} result={row.original.result} />
            <EventTypeChip eventType={row.original.eventType} />
          </Box>
        ),
      },
      { accessorKey: 'eventTs', header: 'Time', Cell: DateTimeCell },
      {
        accessorKey: 'result',
        header: 'Result',
        filterVariant: 'select',
        filterSelectOptions: [{ label: 'Success', value: 'SUCCESS' }, { label: 'Failure', value: 'FAILURE' }],
        Cell: ({ row }) => <ResultChip result={row.original.result} />,
      },
      { accessorKey: 'email', header: 'Email', Cell: TruncatedCell },
      { accessorKey: 'userId', header: 'User ID', Cell: TruncatedCell },
      { accessorKey: 'clientId', header: 'Client ID', Cell: TruncatedCell },
      { accessorKey: 'providerId', header: 'Provider ID', Cell: TruncatedCell },
      { accessorKey: 'ipAddress', header: 'IP Address' },
      { accessorKey: 'userAgent', header: 'User Agent', Cell: FriendlyUserAgentCell },
      {
        accessorKey: 'sessionId',
        header: 'Session ID',
        Cell: ({ cell }) => <CopyableTruncatedText value={cell.getValue<string>()} maxWidth={220} label="Copy session id" />,
      },
      {
        accessorKey: 'oldRefreshTokenId',
        header: 'Old Refresh Token',
        Cell: ({ cell }) => <CopyableTruncatedText value={cell.getValue<string>()} maxWidth={220} label="Copy old refresh token" />,
      },
      {
        accessorKey: 'newRefreshTokenId',
        header: 'New Refresh Token',
        Cell: ({ cell }) => <CopyableTruncatedText value={cell.getValue<string>()} maxWidth={220} label="Copy new refresh token" />,
      },
      { accessorKey: 'failureReason', header: 'Failure Reason', Cell: TruncatedCell },
      { accessorKey: 'metadata', header: 'Context', Cell: MetadataCell },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data,
    initialState: { showColumnFilters: true, density: 'compact', columnVisibility: { sessionId: false, oldRefreshTokenId: false, newRefreshTokenId: false } },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: { isLoading, showAlertBanner: isError, showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.auditId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading session audit' } : undefined,
    muiTableBodyRowProps: ({ row }) => ({
      sx: suspiciousAuditRow(row.original.eventType, row.original.result)
        ? { backgroundColor: 'rgba(211, 47, 47, 0.06)' }
        : undefined,
    }),
    renderTopToolbarCustomActions: () => (
      <Typography variant="h5">Session Audit</Typography>
    ),
  });

  return <MaterialReactTable table={table} />;
}
