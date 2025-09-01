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
import DetailsIcon from '@mui/icons-material/Details';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import Cookies from 'universal-cookie';

// --- Type Definitions ---
type RuleApiResponse = {
  rules: Array<RuleType>;
  total: number;
};

type RuleType = {
  hostId: string;
  ruleId: string;
  ruleName?: string;
  ruleVersion?: string;
  ruleType?: string;
  ruleGroup?: string;
  common?: string;
  ruleBody?: string;
  ruleOwner?: string;
  aggregateVersion?: number;
};

export default function RuleAdmin() {
  const navigate = useNavigate();
  const { host } = useUserState();

  // Data and fetching state
  const [data, setData] = useState<RuleType[]>([]);
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
    pageSize: 25,
  });

  // Data fetching logic
  const fetchData = useCallback(async () => {
    if (!host) return;
    if (!data.length) setIsLoading(true); else setIsRefetching(true);

    const cmd = {
      host: 'lightapi.net', service: 'rule', action: 'getRule', version: '0.1.0',
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
      const json = (await response.json()) as RuleApiResponse;
      setData(json.rules || []);
      setRowCount(json.total || 0);
    } catch (error) {
      setIsError(true); console.error(error);
    } finally {
      setIsError(false); setIsLoading(false); setIsRefetching(false);
    }
  }, [host, columnFilters, globalFilter, pagination.pageIndex, pagination.pageSize, sorting, data.length]);

  // useEffect to trigger fetchData when table state changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler with optimistic update
  const handleDelete = useCallback(async (row: MRT_Row<RuleType>) => {
    if (!window.confirm(`Are you sure you want to delete rule: ${row.original.ruleName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(rule => rule.ruleId !== row.original.ruleId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'rule', action: 'deleteRule', version: '0.1.0',
      data: { hostId: host, ruleId: row.original.ruleId, aggregateVersion: row.original.aggregateVersion },
    };

    try {
      const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
      if (result.error) {
        alert('Failed to delete rule. Please try again.');
        setData(originalData);
        setRowCount(originalData.length);
      }
    } catch (e) {
      alert('Failed to delete rule due to a network error.');
      setData(originalData);
      setRowCount(originalData.length);
    }
  }, [data, host]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RuleType>[]>(
    () => [
      { accessorKey: 'ruleId', header: 'Rule ID' },
      { accessorKey: 'ruleName', header: 'Rule Name' },
      { accessorKey: 'ruleVersion', header: 'Version' },
      { accessorKey: 'ruleType', header: 'Type' },
      { accessorKey: 'ruleGroup', header: 'Group' },
      { accessorKey: 'ruleOwner', header: 'Owner' },
      {
        id: 'detail', header: 'Detail', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Details">
            <IconButton onClick={() => navigate('/app/ruleDetail', { state: { rule: row.original } })}>
              <DetailsIcon />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        id: 'update', header: 'Update', enableSorting: false, enableColumnFilter: false,
        muiTableBodyCellProps: { align: 'center' }, muiTableHeadCellProps: { align: 'center' },
        Cell: ({ row }) => (
          <Tooltip title="Update">
            <IconButton onClick={() => navigate('/app/form/updateRule', { state: { rule: row.original } })}>
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
    getRowId: (row) => row.ruleId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading rules' } : undefined,
    enableRowActions: false,
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createRule')}>
        Create New Rule
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
