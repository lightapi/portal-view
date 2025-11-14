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
import { Box, Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type OrgApiResponse = {
  orgs: Array<OrgType>;
  total: number;
};

type OrgType = {
  domain: string;
  orgName: string;
  orgDesc: string;
  orgOwner: string;
  active: boolean;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

interface UserState {
  host?: string;
}

export default function OrgAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;

  // Data and fetching state
  const [data, setData] = useState<OrgType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  // Table state, defaulting to show active orgs
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>([
    { id: 'active', value: 'true' },
  ]);
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
    
    const apiFilters = columnFilters.map(filter => {
      if (filter.id === 'active') {
        return { ...filter, value: filter.value === 'true' };
      }
      return filter;
    });

    const cmd = {
      host: 'lightapi.net', service: 'host', action: 'getOrg', version: '0.1.0',
      data: {
        hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
        sorting: JSON.stringify(sorting ?? []), 
        filters: JSON.stringify(apiFilters ?? []), 
        globalFilter: globalFilter ?? '',
      },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const json = (await response.json()) as OrgApiResponse;
      console.log("json = ", json);
      setData(json.orgs || []);
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
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<OrgType>) => {
    if (!window.confirm(`Are you sure you want to delete organization: ${row.original.orgName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(org => org.domain !== row.original.domain));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'host', action: 'deleteOrg', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete organization. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete organization due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Handler to fetch fresh data before navigating to update form
  const handleUpdate = useCallback(async (row: MRT_Row<OrgType>) => {
    const domain = row.original.domain;
    setIsUpdateLoading(domain);

    const cmd = {
      host: 'lightapi.net', service: 'host', action: 'getFreshOrg', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

    try {
      const response = await fetch(url, { headers, credentials: 'include' });
      const freshData = await response.json();
      if (!response.ok) {
        throw new Error(freshData.description || 'Failed to fetch latest org data.');
      }
      
      navigate('/app/form/updateOrg', { 
        state: { 
          data: freshData, 
          source: location.pathname 
        } 
      });
    } catch (error) {
      console.error("Failed to fetch org for update:", error);
      alert("Could not load the latest org data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<OrgType>[]>(
    () => [
      { accessorKey: 'domain', header: 'Domain' },
      { accessorKey: 'orgName', header: 'Organization Name' },
      { accessorKey: 'orgDesc', header: 'Description' },
      { accessorKey: 'orgOwner', header: 'Owner ID' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ text: 'True', value: 'true' }, { text: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (
          <Tooltip title="Update Organization">
            <IconButton 
              onClick={() => handleUpdate(row)}
              disabled={isUpdateLoading === row.original.domain}
            >
              {isUpdateLoading === row.original.domain ? (
                <CircularProgress size={22} />
              ) : (
                <SystemUpdateIcon />
              )}
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        Cell: ({ row }) => (<Tooltip title="Delete Organization"><IconButton color="error" onClick={() => handleDelete(row)}><DeleteForeverIcon /></IconButton></Tooltip>),
      },
    ],
    [handleDelete, handleUpdate, isUpdateLoading],
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
    getRowId: (row) => row.domain,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createOrg')}>
        Create New Organization
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
