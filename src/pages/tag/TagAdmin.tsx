import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
import PublicIcon from '@mui/icons-material/Public';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromObject, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

// --- Type Definitions ---
type TagApiResponse = {
  tags: Array<TagType>;
  total: number;
};

type TagType = {
  hostId?: string | null; // Can be null for global tags
  globalFlag?: boolean;
  tagId: string;
  entityType: string;
  tagName: string;
  tagDesc?: string;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
  active: boolean;
};

interface UserState {
  host?: string;
}

const TruncatedCell = <T extends MRT_RowData>({ cell }: { cell: MRT_Cell<T, unknown> }) => {
  const value = cell.getValue<string>() ?? '';
  return (
    <Tooltip title={value} placement="top-start">
      <Box component="span" sx={{ display: 'block', maxWidth: '200px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {value}
      </Box>
    </Tooltip>
  );
};

export default function TagAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { host } = useUserState() as UserState;
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, { hostId: host ?? '', metadataType: 'tag' }),
    [host, searchContext],
  );
  const contextForRow = useCallback(
    (row: TagType) => mergeTaskContext(taskContext, contextFromObject(row)),
    [taskContext],
  );

  // Data and fetching state
  const [data, setData] = useState<TagType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [isUpdateLoading, setIsUpdateLoading] = useState<string | null>(null);

  // Table state
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
      host: 'lightapi.net', service: 'tag', action: 'getTag', version: '0.1.0',
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
      setData(json.tags || []);
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

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<TagType>) => {
    if (!window.confirm(`Are you sure you want to delete tag: ${row.original.tagName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(tag => tag.tagId !== row.original.tagId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'tag', action: 'deleteTag', version: '0.1.0',
      data: row.original,
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete tag. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete tag due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Handler to fetch fresh data before navigating to update form
  const handleUpdate = useCallback(async (row: MRT_Row<TagType>) => {
    const tagId = row.original.tagId;
    setIsUpdateLoading(tagId);
    const freshRequest = { ...row.original };
    if (!freshRequest.hostId) delete freshRequest.hostId;

    const cmd = {
      host: 'lightapi.net', service: 'tag', action: 'getFreshTag', version: '0.1.0',
      data: freshRequest,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const freshData = await fetchClient(url);
      navigate(buildTaskAwareRoute('/app/form/updateTag', searchParams, contextForRow(row.original)), {
        state: {
          data: freshData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch tag for update:", error);
      alert("Could not load the latest tag data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [contextForRow, navigate, location.pathname, searchParams]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<TagType>[]>(
    () => [
      {
        accessorKey: 'hostId',
        header: 'Host ID',
        Cell: ({ cell }) => cell.getValue<string>() ? cell.getValue<string>() : (
          <Tooltip title="Global Tag"><PublicIcon fontSize="small" color="disabled" /></Tooltip>
        ),
      },
      { accessorKey: 'tagId', header: 'Tag ID' },
      { accessorKey: 'tagName', header: 'Tag Name' },
      { accessorKey: 'entityType', header: 'Entity Type' },
      {
        accessorKey: 'tagDesc',
        header: 'Tag Desc',
        Cell: TruncatedCell,
      },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
      },
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
    getRowId: (row) => row.tagId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    displayColumnDefOptions: {
      'mrt-row-actions': {
        header: 'Actions',
        size: 110,
      },
    },
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 0.5 }}>
        <Tooltip title="Update Tag">
          <IconButton onClick={() => handleUpdate(row)} disabled={isUpdateLoading === row.original.tagId}>
            {isUpdateLoading === row.original.tagId ? <CircularProgress size={22} /> : <SystemUpdateIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Tag">
          <IconButton color="error" onClick={() => handleDelete(row)}>
            <DeleteForeverIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate(buildTaskAwareRoute('/app/form/createTag', searchParams, taskContext))}>
        Create New Tag
      </Button>
    ),
  });

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ mb: 2 }}>
        <TaskActionPanel
          title="Portal Metadata Tasks"
          context={taskContext}
          taskIds={['manage-portal-metadata']}
          maxActions={1}
        />
      </Box>
      <MaterialReactTable table={table} />
    </Box>
  );
}
