import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
} from 'material-react-table';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import { apiPost } from "../../api/apiPost.ts";
import fetchClient from '../../utils/fetchClient';
import { useUserState } from '../../contexts/UserContext';

// --- Type Definitions ---
// The API returns an array directly
type UserHostApiResponse = Array<UserHostType>;

type UserHostType = {
  hostId: string;
  domain?: string;
  subDomain?: string;
  userId: string;
  current?: boolean;
  email?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

interface UserState {
  host?: string;
}

export default function UserHost() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId: contextUserId, email: contextEmail } = useUserState();
  const initialUserId = location.state?.data?.userId || contextUserId;
  const userEmail = location.state?.data?.email || contextEmail; // Optional: for display purposes


  // Data and fetching state
  const [data, setData] = useState<UserHostType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data fetching logic (fetches all hosts for the user)
  useEffect(() => {
    if (!initialUserId) {
      console.error("UserHost page loaded without a userId.");
      setIsError(true);
      setIsLoading(false);
      return;
    }

    const fetchUserHosts = async () => {
      setIsLoading(true);
      setIsError(false);

      const cmd = {
        host: 'lightapi.net', service: 'user', action: 'getHostsByUserId', version: '0.1.0',
        data: { userId: initialUserId },
      };

      const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

      try {
        const jsonData = await fetchClient(url) as UserHostApiResponse;
        setData(jsonData || []);
      } catch (error) {
        console.error(error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserHosts();
  }, [initialUserId]);

  const handleSwitch = useCallback(async (row: MRT_Row<UserHostType>) => {
    if (!window.confirm(`Are you sure you want to switch to this host: ${row.original.subDomain}.${row.original.domain}`)) return;

    const cmd = {
      host: 'lightapi.net', service: 'host', action: 'switchUserHost', version: '0.1.0',
      data: { hostId: row.original.hostId, userId: row.original.userId, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to switch user to host. Please try again.');
      }
    } catch (e) {
      alert('Failed to switch user to host due to a network error.');
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<UserHostType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host ID' },
      { accessorKey: 'domain', header: 'Domain' },
      { accessorKey: 'subDomain', header: 'Subdomain' },
      {
        accessorKey: 'current', header: 'Current',
        Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
      },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Ts' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
    ],
    [handleSwitch],
  );

  // Table instance configuration
  const table = useMaterialReactTable({
    columns,
    data, // Data is handled client-side by MRT
    initialState: { showColumnFilters: true, density: 'compact' },
    // No manual props needed for client-side operations
    state: {
      isLoading,
      showAlertBanner: isError,
    },
    getRowId: (row) => `${row.hostId}-${row.userId}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading hosts for user' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title={row.original.current ? "This is the current host" : "Switch to this host"}>
          <span>
            <IconButton
              color="primary"
              onClick={() => handleSwitch(row)}
              disabled={row.original.current}
            >
              <ToggleOnIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {initialUserId && (
          <Typography variant="subtitle1">
            Hosts for User: <strong>{userEmail || initialUserId}</strong>
          </Typography>
        )}
      </Box>
    ),
  });

  return <MaterialReactTable table={table} />;
}
