import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import { usePersistentPagination, PAGE_SIZE_OPTIONS } from '../../hooks/usePersistentPagination';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
  type MRT_SortingState,
  type MRT_Row,
} from 'material-react-table';
import { Box, Button } from '@mui/material';
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
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute } from '../../tasks/taskUtils';

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

interface UserState {
  host?: string;
}

export default function User() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { host } = useUserState() as UserState;
  const taskContext = useMemo(() => ({ hostId: host ?? '' }), [host]);

  // Data and fetching state
  const [data, setData] = useState<UserType[]>([]);
  const [isError, setIsError] = useState<string | false>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([
    { id: 'active', value: 'true' },
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [pagination, setPagination] = usePersistentPagination();

  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    setIsError(false);
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    let activeStatus = true; // Default to true if not present
    const apiFilters: MRT_ColumnFiltersState = [];

    columnFilters.forEach(filter => {
      if (filter.id === 'active') {
        // Extract active status (assuming filter.value is 'true'/'false' string from select)
        activeStatus = filter.value === 'true' || filter.value === true;
      } else if (filter.id === 'verified' || filter.id === 'locked') {
        // Handle boolean conversion for specific columns
        apiFilters.push({ ...filter, value: filter.value === 'true' });
      } else {
        // Keep other filters as is
        apiFilters.push(filter);
      }
    });

    const cmd = {
      host: 'lightapi.net', service: 'user', action: 'listUserByHostId', version: '0.1.0',
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
      const json = await fetchClient(url) as UserApiResponse;
      setData(json.users || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(loadErrorMessage(error)); console.error(error);
    } finally {
      setIsLoading(false); setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting]);

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

    const cmd = { host: 'lightapi.net', service: 'user', action: 'deleteUserById', version: '0.1.0', data: { hostId: row.original.hostId, userId: row.original.userId , aggregateVersion: row.original.aggregateVersion} };
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

    try {
      const freshData = await fetchClient(url);
      console.log("freshData", freshData);

      // Navigate with the fresh data
      navigate(buildTaskAwareRoute('/app/form/updateUser', searchParams, { hostId: row.original.hostId, userId }), {
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
  }, [host, navigate, location.pathname, searchParams]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<UserType>[]>(
    () => [
      { accessorKey: 'email', header: 'Email', size: 250 },
      { accessorKey: 'userId', header: 'User Id', size: 300 },
      { accessorKey: 'hostId', header: 'Host Id' },
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
  const table = useMaterialReactTable(usePortalActionTableOptions({
    columns,
    data,
    initialState: { showColumnFilters: true, density: 'compact' },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: { isLoading, showAlertBanner: Boolean(isError), showProgressBars: isRefetching, pagination, sorting, columnFilters, globalFilter },
    onPaginationChange: setPagination,
    muiPaginationProps: { rowsPerPageOptions: PAGE_SIZE_OPTIONS },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getRowId: (row) => row.userId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: typeof isError === 'string' ? isError : 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => <PortalActions row={row} actions={[
      {
        id: "details",
        label: "Details",
        description: "View the complete record.",
        icon: <DetailsIcon />,
        onSelect: () => navigate('/app/userDetail', { state: { user: row.original } })
      },
      {
        id: "update",
        label: "Update",
        icon: (
          <SystemUpdateIcon />
        ),

        loading: () => Boolean(isUpdateLoading === row.original.userId),
        onSelect: () => handleUpdate(row)
      },
      {
        id: "lock-user",
        label: "Lock User",
        icon: <LockIcon />,
        disabledReason: () => (row.original.locked) ? ('This user is already locked.') : null,
        onSelect: () => handleStateChange(row, 'lockUser', { locked: true })
      },
      {
        id: "unlock-user",
        label: "Unlock User",
        icon: <LockOpenIcon />,
        disabledReason: () => (!row.original.locked) ? ('This user is not locked.') : null,
        onSelect: () => handleStateChange(row, 'unlockUser', { locked: false })
      },
      {
        id: "verify-user",
        label: "Verify User",
        icon: <DomainVerificationIcon />,
        disabledReason: () => (row.original.verified) ? ('This user is already verified.') : null,
        onSelect: () => handleStateChange(row, 'verifyUser', { verified: true })
      },
      {
        id: "roles",
        label: "Roles",
        icon: <CameraRollIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/access/roleUser', searchParams, { hostId: row.original.hostId, userId: row.original.userId }), { state: { data: { hostId: row.original.hostId, userId: row.original.userId } } })
      },
      {
        id: "groups",
        label: "Groups",
        icon: <GroupsIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/access/groupUser', searchParams, { hostId: row.original.hostId, userId: row.original.userId }), { state: { data: { hostId: row.original.hostId, userId: row.original.userId } } })
      },
      {
        id: "positions",
        label: "Positions",
        icon: <RadarIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/access/positionUser', searchParams, { hostId: row.original.hostId, userId: row.original.userId }), { state: { data: { hostId: row.original.hostId, userId: row.original.userId } } })
      },
      {
        id: "attributes",
        label: "Attributes",
        icon: <AttributionIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/access/attributeUser', searchParams, { hostId: row.original.hostId, userId: row.original.userId }), { state: { data: { hostId: row.original.hostId, userId: row.original.userId } } })
      },
      {
        id: "permissions",
        label: "Permissions",
        icon: <DoNotTouchIcon />,
        onSelect: () => navigate(buildTaskAwareRoute('/app/access/userPermission', searchParams, { hostId: row.original.hostId, userId: row.original.userId }), { state: { data: { hostId: row.original.hostId, userId: row.original.userId } } })
      },
      {
        id: "delete",
        label: "Delete",
        icon: <DeleteForeverIcon />,
        destructive: true,
        onSelect: () => handleDelete(row)
      }
    ]} />,
    renderTopToolbarCustomActions: () => (
      <Button
        variant="contained"
        startIcon={<AddBoxIcon />}
        onClick={() => navigate(buildTaskAwareRoute('/app/form/onboardUser', searchParams, taskContext))}
      >
        Onboard New User
      </Button>
    ),
  }));

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ mb: 2 }}>
        <TaskActionPanel
          title="User And Host Tasks"
          context={taskContext}
          taskIds={['manage-user-host-access']}
          maxActions={1}
        />
      </Box>
      <PortalActionScope><MaterialReactTable table={table} /></PortalActionScope>
    </Box>
  );
}
