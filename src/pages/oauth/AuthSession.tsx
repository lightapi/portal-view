import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_Row,
  type MRT_SortingState,
} from 'material-react-table';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import KeyIcon from '@mui/icons-material/Key';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import { apiPost } from '../../api/apiPost';
import { useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';
import {
  CopyableTruncatedText,
  DateTimeCell,
  FriendlyUserAgentCell,
  RevokeDialog,
  type RevokeDialogTarget,
  StatusChip,
  TruncatedCell,
  computedSessionStatus,
} from './OAuthTableHelpers';

type AuthSessionType = {
  hostId: string;
  sessionId: string;
  userId: string;
  email?: string;
  clientId: string;
  providerId: string;
  userType?: string;
  entityId?: string;
  roles?: string;
  scope?: string;
  status: string;
  loginTs?: string;
  startTs?: string;
  lastRefreshTs?: string;
  expiresTs?: string;
  refreshCount?: number;
  ipAddress?: string;
  userAgent?: string;
  hasActiveTokens?: boolean;
};

interface UserState {
  host?: string;
}

export default function AuthSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const initialData = location.state?.data || {};

  const [data, setData] = useState<AuthSessionType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [revokeTarget, setRevokeTarget] = useState<(RevokeDialogTarget & { row: AuthSessionType }) | null>(null);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() =>
    Object.entries(initialData)
      .map(([id, value]) => ({ id, value: value as string }))
      .filter((filter) => filter.value)
      .concat([{ id: 'status', value: 'ACTIVE' }])
  );
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([{ id: 'loginTs', desc: true }]);
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
      action: 'getAuthSession',
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
      setData(json.sessions || []);
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

  const viewAudit = useCallback((row: AuthSessionType) => {
    navigate('/app/oauth/authSessionAudit', {
      state: { data: { sessionId: row.sessionId, userId: row.userId, clientId: row.clientId } },
    });
  }, [navigate]);

  const viewRefreshToken = useCallback((row: AuthSessionType) => {
    navigate('/app/oauth/refreshToken', {
      state: { data: { sessionId: row.sessionId, userId: row.userId, clientId: row.clientId } },
    });
  }, [navigate]);

  const openRevokeDialog = useCallback((row: MRT_Row<AuthSessionType>) => {
    setRevokeTarget({
      row: row.original,
      title: 'Revoke Session',
      message: `Revoke the active session for ${row.original.email || row.original.userId}?`,
      confirmLabel: 'Revoke Session',
      defaultReason: 'ADMIN_REVOKED',
    });
  }, []);

  const handleRevoke = useCallback(async (reason: string) => {
    if (!revokeTarget) return;
    const row = revokeTarget.row;

    const originalData = [...data];
    setData((prev) => prev.map((session) => session.sessionId === row.sessionId ? { ...session, status: 'REVOKED', hasActiveTokens: false } : session));
    setRevokeTarget(null);

    const cmd = {
      host: 'lightapi.net',
      service: 'oauth',
      action: 'revokeAuthSession',
      version: '0.1.0',
      data: { hostId: row.hostId || host, sessionId: row.sessionId, reason },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to revoke session. Please try again.');
        setData(originalData);
      }
    } catch (error) {
      alert('Failed to revoke session due to a network error.');
      setData(originalData);
    }
  }, [data, host, revokeTarget]);

  const columns = useMemo<MRT_ColumnDef<AuthSessionType>[]>(
    () => [
      { accessorKey: 'email', header: 'Email', Cell: TruncatedCell },
      { accessorKey: 'userId', header: 'User ID', Cell: TruncatedCell },
      { accessorKey: 'clientId', header: 'Client ID', Cell: TruncatedCell },
      { accessorKey: 'providerId', header: 'Provider ID', Cell: TruncatedCell },
      {
        accessorKey: 'status',
        header: 'Status',
        filterVariant: 'select',
        filterSelectOptions: [{ label: 'Active', value: 'ACTIVE' }, { label: 'Revoked', value: 'REVOKED' }, { label: 'Expired', value: 'EXPIRED' }],
        Cell: ({ row }) => <StatusChip status={row.original.status} expiresTs={row.original.expiresTs} />,
      },
      { accessorKey: 'loginTs', header: 'Login Time', Cell: DateTimeCell },
      { accessorKey: 'lastRefreshTs', header: 'Last Refresh', Cell: DateTimeCell },
      { accessorKey: 'refreshCount', header: 'Refresh Count' },
      {
        accessorKey: 'hasActiveTokens',
        header: 'Active Tokens',
        enableColumnFilter: false,
        Cell: ({ cell }) => cell.getValue<boolean>() ? 'Yes' : 'No',
      },
      { accessorKey: 'expiresTs', header: 'Expires', Cell: DateTimeCell },
      { accessorKey: 'ipAddress', header: 'IP Address' },
      { accessorKey: 'userAgent', header: 'User Agent', Cell: FriendlyUserAgentCell },
      {
        accessorKey: 'sessionId',
        header: 'Session ID',
        Cell: ({ cell }) => <CopyableTruncatedText value={cell.getValue<string>()} maxWidth={220} label="Copy session id" />,
      },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data,
    initialState: { showColumnFilters: true, density: 'compact', columnVisibility: { sessionId: false } },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: { isLoading, showAlertBanner: isError, showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.sessionId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading sessions' } : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Session Audit">
          <IconButton onClick={() => viewAudit(row.original)}>
            <ManageSearchIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Refresh Tokens">
          <IconButton onClick={() => viewRefreshToken(row.original)}>
            <KeyIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Revoke Session">
          <span>
            <IconButton
              color="error"
              disabled={computedSessionStatus(row.original.status, row.original.expiresTs) !== 'ACTIVE' || row.original.hasActiveTokens === false}
              onClick={() => openRevokeDialog(row)}
            >
              <DeleteForeverIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Typography variant="h5">Sessions</Typography>
    ),
  });

  return (
    <>
      <MaterialReactTable table={table} />
      <RevokeDialog target={revokeTarget} onCancel={() => setRevokeTarget(null)} onConfirm={handleRevoke} />
    </>
  );
}
