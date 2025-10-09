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
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type RefRelationApiResponse = {
  relations: Array<RefRelationType>;
  total: number;
};

type RefRelationType = {
  hostId: string;
  relationId: string;
  relationName?: string;
  valueIdFrom: string;
  valueCodeFrom?: string;
  valueIdTo: string;
  valueCodeTo?: string;
  active: boolean;
  updateUser: string;
  updateTs: string;
  aggregateVersion?: number;
};

export default function RefRelation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState();
  const initialRelationId = location.state?.data?.relationId;

  // Data and fetching state
  const [data, setData] = useState<RefRelationType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  // Table state, pre-filtered by relationId if provided
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    initialRelationId ? [{ id: 'relationId', value: initialRelationId }] : [],
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

    const cmd = {
      host: 'lightapi.net', service: 'ref', action: 'getRefRelation', version: '0.1.0',
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
      const json = (await response.json()) as RefRelationApiResponse;
      setData(json.relations || []);
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

  // Delete handler with optimistic update, handling composite key
  const handleDelete = useCallback(async (row: MRT_Row<RefRelationType>) => {
    const { relationId, valueIdFrom, valueIdTo } = row.original;
    if (!window.confirm(`Are you sure you want to delete this relation? (From: ${valueIdFrom}, To: ${valueIdTo})`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(r => !(r.relationId === relationId && r.valueIdFrom === valueIdFrom && r.valueIdTo === valueIdTo)));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'ref', action: 'deleteRefRelation', version: '0.1.0',
      data: { relationId, valueIdFrom, valueIdTo, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete relation. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete relation due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RefRelationType>[]>(
    () => [
      { accessorKey: 'relationId', header: 'Relation ID' },
      { accessorKey: 'relationName', header: 'Relation Name' },
      { accessorKey: 'valueIdFrom', header: 'From Value ID' },
      { accessorKey: 'valueCodeFrom', header: 'From Value Code' },
      { accessorKey: 'valueIdTo', header: 'To Value ID' },
      { accessorKey: 'valueCodeTo', header: 'To Value Code' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{text: 'Yes', value: 'true'}, {text: 'No', value: 'false'}],
        Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),
      },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Update Relation">
            <IconButton onClick={() => navigate('/app/form/updateRefRelation', { state: { data: { ...row.original } } })}>
              <SystemUpdateIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Delete Relation">
            <IconButton color="error" onClick={() => handleDelete(row)}>
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [handleDelete, navigate],
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
    getRowId: (row) => `${row.relationId}-${row.valueIdFrom}-${row.valueIdTo}`,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button
        variant="contained"
        startIcon={<AddBoxIcon />}
        onClick={() => navigate('/app/form/createRefRelation', { state: { data: { relationId: initialRelationId } } })}
        disabled={!initialRelationId}
      >
        Create New Relation
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
