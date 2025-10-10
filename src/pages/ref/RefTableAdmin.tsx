import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import DataObjectIcon from '@mui/icons-material/DataObject';
import { useUserState } from '../../contexts/UserContext.jsx';
import { apiPost } from '../../api/apiPost.js';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type RefTableApiResponse = {
  refTables: Array<RefTableType>;
  total: number;
};

type RefTableType = {
  hostId?: string;
  tableId: string;
  tableName: string;
  tableDesc: string;
  active: boolean;
  editable: boolean;
  updateUser?: string;
  updateTs?: string;
  aggregateVersion?: number;
};

export default function RefTableAdmin() {
  const navigate = useNavigate();
  const { host } = useUserState();

  // Data and fetching state
  const [data, setData] = useState<RefTableType[]>([]);
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

  // Data fetching logic
  useEffect(() => {
    const fetchData = async () => {
      if (!host) return;

      // Set loading state correctly. The previous check `!data.length` was part of the problem.
      setIsLoading(true);
      setIsRefetching(true); // Can set both, MRT will show the right one

      const cmd = {
        host: 'lightapi.net', service: 'ref', action: 'getRefTable', version: '0.1.0',
        data: {
          hostId: host, offset: pagination.pageIndex * pagination.pageSize, limit: pagination.pageSize,
          sorting: JSON.stringify(sorting ?? []), filters: JSON.stringify(columnFilters ?? []), globalFilter: globalFilter ?? '',
        },
      };

      console.log("FETCHING DATA with cmd:", cmd); // This will now log the correct number of times

      const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
      const cookies = new Cookies();
      const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };
      
      try {
        const response = await fetch(url, { headers, credentials: 'include' });
        const json = (await response.json()) as RefTableApiResponse;
        console.log("json = ", json);
        setData(json.refTables || []);
        setRowCount(json.total || 0);
      } catch (error) {
        setIsError(true); console.error(error);
      } finally {
        setIsLoading(false);
        setIsRefetching(false);
      }
    };
    
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ // The effect now depends ONLY on the inputs to the fetch.
    host,
    columnFilters,
    globalFilter,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
  ]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<RefTableType>) => {
    if (!window.confirm(`Are you sure you want to delete refTable: ${row.original.tableName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(table => table.tableId !== row.original.tableId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'ref', action: 'deleteRefTable', version: '0.1.0',
      data: { hostId: host, tableId: row.original.tableId, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete reference table. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete reference table due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data, host]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RefTableType>[]>(
    () => [
      { accessorKey: 'tableId', header: 'Table ID' },
      { accessorKey: 'tableName', header: 'Table Name' },
      { accessorKey: 'tableDesc', header: 'Description' },
      { accessorKey: 'active', header: 'Active', Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No') },
      { accessorKey: 'editable', header: 'Editable', Cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No') },
      { accessorKey: 'updateUser', header: 'Update User' },
      {
        accessorKey: 'updateTs', header: 'Update Time',
        Cell: ({ cell }) => cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleString() : '',
      },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Update">
            <IconButton onClick={() => navigate('/app/form/updateRefTable', { state: { data: { ...row.original } } })}>
              <SystemUpdateIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'delete', header: 'Delete', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Delete">
            <IconButton color="error" onClick={() => handleDelete(row)}>
              <DeleteForeverIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'values', header: 'Values', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Manage Values">
            <IconButton onClick={() => navigate('/app/ref/value', { state: { data: { tableId: row.original.tableId } } })}>
              <DataObjectIcon />
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
    getRowId: (row) => row.tableId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading data' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createRefTable')}>
        Create New Ref Table
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
