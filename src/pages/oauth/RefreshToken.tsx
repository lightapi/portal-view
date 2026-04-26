import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import fetchClient from '../../utils/fetchClient';
import {
  CopyableTruncatedText,
  DateTimeCell,
  RevokeDialog,
  type RevokeDialogTarget,
  TruncatedCell,
} from './OAuthTableHelpers';

// --- Type Definitions ---
type RefreshTokenApiResponse = {
  tokens: Array<RefreshTokenType>;
  total: number;
};

type RefreshTokenType = {
  hostId: string;
  refreshToken: string;
  providerId: string;
  userId: string;
  entityId: string;
  userType: string;
  email: string;
  roles?: string;
  groups?: string;
  positions?: string;
  attributes?: string;
  clientId: string;
  scope?: string;
  csrf?: string;
  customClaim?: string;
  sessionId?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

interface UserState {
  host?: string;
}

export default function RefreshTokenAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;
  const initialData = location.state?.data || {};

  // Data and fetching state
  const [data, setData] = useState<RefreshTokenType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [revokeTarget, setRevokeTarget] = useState<(RevokeDialogTarget & { row: RefreshTokenType }) | null>(null);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(() =>
    Object.entries(initialData)
      .map(([id, value]) => ({ id, value: value as string }))
      .filter((filter) => filter.value)
      .concat([{ id: 'active', value: 'true' }])
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
      } else {
        // Keep other filters as is
        apiFilters.push(filter);
      }
    });

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'getRefreshToken', version: '0.1.0',
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
      const json = await fetchClient(url);
      setData(json.tokens || []);
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

  const openRevokeDialog = useCallback((row: MRT_Row<RefreshTokenType>) => {
    setRevokeTarget({
      row: row.original,
      title: 'Revoke Session',
      message: `Revoke the session associated with ${row.original.email || row.original.userId}?`,
      confirmLabel: 'Revoke Session',
      defaultReason: 'ADMIN_REVOKED',
    });
  }, []);

  // Revoke handler with optimistic update
  const handleRevoke = useCallback(async (reason: string) => {
    if (!revokeTarget) return;
    const row = revokeTarget.row;
    const originalData = [...data];
    setData(prev => prev.filter(token => token.refreshToken !== row.refreshToken));
    setRowCount(prev => prev - 1);
    setRevokeTarget(null);

    const cmd = {
      host: 'lightapi.net', service: 'oauth', action: 'deleteRefreshToken', version: '0.1.0',
      data: { hostId: row.hostId || host, refreshToken: row.refreshToken, aggregateVersion: row.aggregateVersion, reason },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to revoke session. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to revoke session due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data, host, revokeTarget]);

  const viewAudit = useCallback((row: RefreshTokenType) => {
    navigate('/app/oauth/authSessionAudit', {
      state: { data: { sessionId: row.sessionId, userId: row.userId, clientId: row.clientId } },
    });
  }, [navigate]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RefreshTokenType>[]>(
    () => [
      { accessorKey: 'userId', header: 'User ID' },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'clientId', header: 'Client ID' },
      {
        accessorKey: 'refreshToken',
        header: 'Refresh Token',
        Cell: ({ cell }) => <CopyableTruncatedText value={cell.getValue<string>()} maxWidth={220} label="Copy refresh token" />,
      },
      {
        accessorKey: 'sessionId',
        header: 'Session ID',
        Cell: ({ cell }) => <CopyableTruncatedText value={cell.getValue<string>()} maxWidth={220} label="Copy session id" />,
      },
      {
        accessorKey: 'scope',
        header: 'Scope',
        Cell: TruncatedCell,
      },
      {
        accessorKey: 'roles',
        header: 'Roles',
        Cell: TruncatedCell,
      },
      {
        accessorKey: 'updateTs', header: 'Last Updated',
        Cell: DateTimeCell,
      },
    ],
    [],
  );

  // Table instance configuration
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
    getRowId: (row) => row.refreshToken,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading refresh tokens' } : undefined,
    enableRowActions: true,
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Session Audit">
          <span>
            <IconButton disabled={!row.original.sessionId} onClick={() => viewAudit(row.original)}>
              <ManageSearchIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Revoke Session">
          <IconButton color="error" onClick={() => openRevokeDialog(row)}>
            <DeleteForeverIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Typography variant="h5">
        Refresh Tokens
      </Typography>
    ),
  });

  return (
    <>
      <MaterialReactTable table={table} />
      <RevokeDialog target={revokeTarget} onCancel={() => setRevokeTarget(null)} onConfirm={handleRevoke} />
    </>
  );
}
