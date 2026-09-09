import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { usePersistentPagination, PAGE_SIZE_OPTIONS } from '../../hooks/usePersistentPagination';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_Row,
  type MRT_SortingState,
} from 'material-react-table';
import { Typography } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import KeyIcon from '@mui/icons-material/Key';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import { apiPost } from '../../api/apiPost';
import { signOut, useUserDispatch, useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';
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
import {
  isSelfSessionView,
  lockedCurrentUserFilter,
  type OAuthSessionPageProps,
  userScopedRouteState,
  withLockedFilter,
} from './oauthSessionScope';

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
  host?: string | null;
  userId?: string | null;
  email?: string | null;
  sessionId?: string | null;
}

export default function AuthSession({ viewMode = 'admin' }: OAuthSessionPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const userDispatch = useUserDispatch();
  const { host, userId, email, sessionId: currentSessionId } = useUserState() as UserState;
  const selfView = isSelfSessionView(viewMode);
  const missingSelfContext = selfView && !userId;
  const initialData = location.state?.data || {};

  const [data, setData] = useState<AuthSessionType[]>([]);
  const [isError, setIsError] = useState<string | false>(false);
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
  const [pagination, setPagination] = usePersistentPagination();

  const fetchData = useCallback(async () => {
    if (!host) return;
    if (missingSelfContext) {
      setData([]);
      setRowCount(0);
      setIsLoading(false);
      setIsRefetching(false);
      return;
    }
    setIsError(false);
    if (!data.length) setIsLoading(true); else setIsRefetching(true);
    const apiFilters = withLockedFilter(columnFilters ?? [], lockedCurrentUserFilter(selfView ? userId : null));

    const cmd = {
      host: 'lightapi.net',
      service: 'oauth',
      action: selfView ? 'getMyAuthSession' : 'getAuthSession',
      version: '0.1.0',
      data: {
        hostId: host,
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []),
        filters: JSON.stringify(apiFilters),
        globalFilter: globalFilter ?? '',
      },
    };

    try {
      const json = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
      setData(json.sessions || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(loadErrorMessage(error));
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [host, missingSelfContext, data.length, columnFilters, selfView, userId, pagination.pageIndex, pagination.pageSize, sorting, globalFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const viewAudit = useCallback((row: AuthSessionType) => {
    navigate(selfView ? '/app/user/session/audit' : '/app/oauth/authSessionAudit', {
      state: { data: userScopedRouteState({ sessionId: row.sessionId, userId: row.userId, clientId: row.clientId }, selfView) },
    });
  }, [navigate, selfView]);

  const viewRefreshToken = useCallback((row: AuthSessionType) => {
    navigate(selfView ? '/app/user/session/refresh-tokens' : '/app/oauth/refreshToken', {
      state: { data: userScopedRouteState({ sessionId: row.sessionId, userId: row.userId, clientId: row.clientId }, selfView) },
    });
  }, [navigate, selfView]);

  const openRevokeDialog = useCallback((row: MRT_Row<AuthSessionType>) => {
    const currentSessionTarget = selfView && currentSessionId && row.original.sessionId === currentSessionId;
    const unknownCurrentSession = selfView && !currentSessionId;
    setRevokeTarget({
      row: row.original,
      title: 'Revoke Session',
      message: (
        <>
          <Typography component="span" variant="body2">
            Revoke the active session for {row.original.email || row.original.userId}?
          </Typography>
          {(currentSessionTarget || unknownCurrentSession) && (
            <Typography component="span" variant="body2" color="error" sx={{ display: 'block', mt: 1 }}>
              {currentSessionTarget
                ? 'This is your current browser session. You will be signed out after it is revoked.'
                : 'If this is your current browser session, you may be signed out after it is revoked.'}
            </Typography>
          )}
        </>
      ),
      confirmLabel: 'Revoke Session',
      defaultReason: selfView ? 'USER_REVOKED' : 'ADMIN_REVOKED',
    });
  }, [currentSessionId, selfView]);

  const handleRevoke = useCallback(async (reason: string) => {
    if (!revokeTarget) return;
    const row = revokeTarget.row;

    const originalData = [...data];
    setData((prev) => prev.map((session) => session.sessionId === row.sessionId ? { ...session, status: 'REVOKED', hasActiveTokens: false } : session));
    setRevokeTarget(null);

    const cmd = {
      host: 'lightapi.net',
      service: 'oauth',
      action: selfView ? 'revokeMyAuthSession' : 'revokeAuthSession',
      version: '0.1.0',
      data: { hostId: row.hostId || host, sessionId: row.sessionId, reason },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to revoke session. Please try again.');
        setData(originalData);
      } else if (selfView && currentSessionId && row.sessionId === currentSessionId) {
        await signOut(userDispatch, navigate);
      }
    } catch (error) {
      alert('Failed to revoke session due to a network error.');
      setData(originalData);
    }
  }, [currentSessionId, data, host, navigate, revokeTarget, selfView, userDispatch]);

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

  const table = useMaterialReactTable(usePortalActionTableOptions({
    columns,
    data,
    initialState: { showColumnFilters: true, density: 'compact', columnVisibility: { sessionId: false, userId: !selfView, email: !selfView, roles: false } },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: { isLoading, showAlertBanner: Boolean(isError) || missingSelfContext, showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
    onPaginationChange: setPagination,
    muiPaginationProps: { rowsPerPageOptions: PAGE_SIZE_OPTIONS },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.sessionId,
    muiToolbarAlertBannerProps: missingSelfContext
      ? { color: 'warning', children: 'User context is required to load your sessions.' }
      : isError
        ? { color: 'error', children: typeof isError === 'string' ? isError : 'Error loading sessions' }
        : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => <PortalActions row={row} actions={[
      {
        id: "session-audit",
        label: "Session Audit",
        icon: <ManageSearchIcon />,
        onSelect: () => viewAudit(row.original)
      },
      {
        id: "refresh-tokens",
        label: "Refresh Tokens",
        icon: <KeyIcon />,
        onSelect: () => viewRefreshToken(row.original)
      },
      {
        id: "revoke-session",
        label: "Revoke Session",
        icon: <DeleteForeverIcon />,
        destructive: true,
        disabledReason: () => (computedSessionStatus(row.original.status, row.original.expiresTs) !== 'ACTIVE' || row.original.hasActiveTokens === false) ? ('This session is inactive or has no active tokens.') : null,
        onSelect: () => openRevokeDialog(row)
      }
    ]} />,
    renderTopToolbarCustomActions: () => (
      <Typography variant="h5">{selfView ? 'My Sessions' : 'Sessions'}</Typography>
    ),
  }));

  return (
    <>
      <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>
      <RevokeDialog target={revokeTarget} onCancel={() => setRevokeTarget(null)} onConfirm={handleRevoke} />
    </>
  );
}
