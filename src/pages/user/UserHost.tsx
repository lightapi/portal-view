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
import Cookies from 'universal-cookie';

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
  const initialUserId = location.state?.data?.userId;
  const userEmail = location.state?.data?.email; // Optional: for display purposes

  console.log("userId", initialUserId);

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
      const cookies = new Cookies();
      const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

      try {
        const response = await fetch(url, { headers, credentials: 'include' });
        const jsonData = (await response.json()) as UserHostApiResponse;
        if (!response.ok) {
          // Assuming the error response has a 'description' field
          throw new Error((jsonData as any).description || 'Failed to fetch data');
        }
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
      {
        id: 'switch',
        header: 'Switch',
        enableSorting: false,
        enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title={row.original.current ? "This is the current host" : "Switch to this host"}>
            {/* Wrap IconButton in a span to ensure tooltip works when disabled */}
            <span>
              <IconButton
                color="primary" // Changed from 'error' for better semantics
                onClick={() => handleSwitch(row)}
                disabled={row.original.current} // This is the key logic
              >
                <ToggleOnIcon />
              </IconButton>
            </span>
          </Tooltip>
        ),
      },
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
    enableRowActions: false,
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
