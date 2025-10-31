import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_PaginationState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import DetailsIcon from '@mui/icons-material/Details';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import DomainVerificationIcon from '@mui/icons-material/DomainVerification';
import CameraRollIcon from '@mui/icons-material/CameraRoll';
import GroupsIcon from '@mui/icons-material/Groups';
import RadarIcon from '@mui/icons-material/Radar';
import AttributionIcon from '@mui/icons-material/Attribution';
import DoNotTouchIcon from '@mui/icons-material/DoNotTouch';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type UserApiResponse = {
  users: Array<UserType>;
  total: number;
};

type UserType = {
  hostId: string;
  userId: string;
  email?: string;
  language?: string;
  userType?: string;
  entityId?: string;
  referralId?: string;
  managerId?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  gender?: string;
  birthday?: string;
  country?: string;
  province?: string;
  city?: string;
  address?: string;
  postCode?: string;
  verified: boolean;
  locked: boolean;
  aggregateVersion?: number;
};

export default function User() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState();

  // Data and fetching state
  const [data, setData] = useState<UserType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    const cmd = {
      host: 'lightapi.net', service: 'user', action: 'listUserByHostId', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), filters: JSON.stringify(columnFilters ?? []), globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as UserApiResponse;
      setData(json.users || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, data.length]);

  // useEffect to trigger fetchData
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

  // Generic handler for optimistic state-changing commands (lock, unlock, verify)
  const handleStateChange = useCallback(async (row: MRT_Row<UserType>, action: 'lockUser' | 'unlockUser' | 'verifyUser', optimisticUpdate: Partial<UserType>) => {
    const originalData = [...data];
    setData(prev => prev.map(user => user.userId === row.original.userId ? { ...user, ...optimisticUpdate } : user));

    const cmd = { host: 'lightapi.net', service: 'user', action, version: '0.1.0', data: { hostId: row.original.hostId, userId: row.original.userId } };
    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert(`Failed to ${action}. Please try again.`);
        setData(originalData);
      }
    } catch (e) {
      alert(`Failed to ${action} due to a network error.`);
      setData(originalData);
    }
  }, [data]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<UserType>) => {
    if (!window.confirm(`Are you sure you want to delete user: ${row.original.email}?`)) return;
    const originalData = [...data];
    setData(prev => prev.filter(user => user.userId !== row.original.userId));
    setRowCount(prev => prev - 1);

    const cmd = { host: 'lightapi.net', service: 'user', action: 'deleteUserById', version: '0.1.0', data: { hostId: row.original.hostId, userId: row.original.userId } };
    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete user. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete user due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  const handleUpdate = useCallback(async (row: MRT_Row<UserType>) => {
    const userId = row.original.userId;
    setIsUpdateLoading(userId);

    // Assumes an action 'getUserById' that fetches a single user
    const cmd = {
      host: 'lightapi.net', service: 'user', action: 'getUserById', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const freshData = await response.json();
      console.log("freshData", freshData);
      if (!response.ok) {
        throw new Error(freshData.description || 'Failed to fetch latest user data.');
      }
      
      // Navigate with the fresh data
      navigate('/app/form/updateUser', { 
        state: { 
          data: freshData, 
          source: location.pathname 
        } 
      });
    } catch (error) {
      console.error("Failed to fetch user for update:", error);
      alert("Could not load the latest user data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<UserType>[]>(
    () => [
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'userId', header: 'User Id', size: 300 },
      { accessorKey: 'email', header: 'Email', size: 250 },
      { accessorKey: 'language', header: 'Language' },
      { accessorKey: 'userType', header: 'User Type' },
      { accessorKey: 'entityId', header: 'Entity Id' },
      { accessorKey: 'firstName', header: 'First Name' },
      { accessorKey: 'lastName', header: 'Last Name' },
      { accessorKey: 'verified', header: 'Verified', size: 100, Cell: ({ cell }) => (cell.getValue() ? 'Y' : 'N'), muiTableBodyCellProps: { align: 'center' } },
      { accessorKey: 'locked', header: 'Locked', size: 100, Cell: ({ cell }) => (cell.getValue() ? 'Y' : 'N'), muiTableBodyCellProps: { align: 'center' } },
    ],
    [],
  );

  // Table instance configuration
  const table = useMaterialReactTable({
    columns,
    data,
    initialState: { showColumnFilters: true, density: 'compact' },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: { isLoading, showAlertBanner: isError, showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.userId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'last',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.1rem', flexWrap: 'nowrap' }}>
        <Tooltip title="Details"><IconButton onClick={() => navigate('/app/userDetail', { state: { user: row.original } })}><DetailsIcon /></IconButton></Tooltip>
        <Tooltip title="Update">
          <IconButton 
            onClick={() => handleUpdate(row)}
            disabled={isUpdateLoading === row.original.userId}
          >
            {isUpdateLoading === row.original.userId ? (
              <CircularProgress size={22} />
            ) : (
              <SystemUpdateIcon />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Lock User">
          <span>
            <IconButton onClick={() => handleStateChange(row, 'lockUser', { locked: true })} disabled={row.original.locked}>
              <LockIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Unlock User">
          <span>
            <IconButton onClick={() => handleStateChange(row, 'unlockUser', { locked: false })} disabled={!row.original.locked}>
              <LockOpenIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Verify User">
          <span>
            <IconButton color="success" onClick={() => handleStateChange(row, 'verifyUser', { verified: true })} disabled={row.original.verified}>
              <DomainVerificationIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Roles"><IconButton onClick={() => navigate('/app/access/roleUser', { state: { data: { hostId: row.original.hostId, userId: row.original.userId } } })}><CameraRollIcon /></IconButton></Tooltip>
        <Tooltip title="Groups"><IconButton onClick={() => navigate('/app/access/groupUser', { state: { data: { hostId: row.original.hostId, userId: row.original.userId } } })}><GroupsIcon /></IconButton></Tooltip>
        <Tooltip title="Positions"><IconButton onClick={() => navigate('/app/access/positionUser', { state: { data: { hostId: row.original.hostId, userId: row.original.userId } } })}><RadarIcon /></IconButton></Tooltip>
        <Tooltip title="Attributes"><IconButton onClick={() => navigate('/app/access/attributeUser', { state: { data: { hostId: row.original.hostId, userId: row.original.userId } } })}><AttributionIcon /></IconButton></Tooltip>
        <Tooltip title="Permissions"><IconButton onClick={() => navigate('/app/access/userPermission', { state: { data: { hostId: row.original.hostId, userId: row.original.userId } } })}><DoNotTouchIcon /></IconButton></Tooltip>
        <Tooltip title="Delete"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/onboardUser')}>
        Onboard New User
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
