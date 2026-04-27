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
import DetailsIcon from '@mui/icons-material/Details';
import { useUserState } from '../../contexts/UserContext';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';

// --- Type Definitions ---
type RuleApiResponse = {
  rules: Array<RuleType>;
  total: number;
};

type RuleType = {
  hostId?: string;
  ruleId: string;
  ruleName?: string;
  ruleType?: string;
  common?: string;
  version?: string;
  ruleDesc?: string;
  ruleBody?: string;
  author?: string;
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

const operatorAliases: Record<string, string> = {
  '==': 'equals',
  eq: 'equals',
  '!=': 'notEquals',
  ne: 'notEquals',
  not_equals: 'notEquals',
  '>': 'greaterThan',
  '<': 'lessThan',
  '>=': 'greaterThanOrEqual',
  '<=': 'lessThanOrEqual',
  match: 'matches',
  exists: 'isNotNull',
  notExists: 'isNull',
};

const normalizeExpected = (condition: any) => {
  if (condition.expected !== undefined) {
    return Array.isArray(condition.expected)
      ? condition.expected.map((value: unknown) => String(value)).join(', ')
      : condition.expected;
  }
  const firstValue = Array.isArray(condition.conditionValues) ? condition.conditionValues[0] : undefined;
  if (firstValue?.conditionValue !== undefined) return firstValue.conditionValue;
  if (condition.value !== undefined) return condition.value;
  return undefined;
};

const normalizeActionValues = (actionValues: any) => {
  if (Array.isArray(actionValues)) return actionValues;
  if (!actionValues || typeof actionValues !== 'object') return [];
  return Object.entries(actionValues).map(([actionValueId, value]) => ({
    actionValueId,
    value: value == null ? '' : String(value),
  }));
};

const normalizeRuleForForm = (data: any) => {
  const normalized = { ...data };
  normalized.version = normalized.version ?? normalized.ruleVersion;
  normalized.author = normalized.author ?? normalized.ruleOwner;
  normalized.ruleName = normalized.ruleName ?? normalized.ruleId;
  normalized.common = normalized.common ?? 'N';

  if (Array.isArray(normalized.conditions)) {
    normalized.conditions = normalized.conditions.map((condition: any) => ({
      conditionId: condition.conditionId,
      conditionDesc: condition.conditionDesc,
      operand: condition.operand ?? condition.propertyPath ?? condition.field,
      operator: operatorAliases[condition.operator ?? condition.operatorCode] ?? condition.operator ?? condition.operatorCode,
      expected: normalizeExpected(condition),
      joinCode: condition.joinCode,
    }));
  }

  if (Array.isArray(normalized.actions)) {
    normalized.actions = normalized.actions.map((action: any) => ({
      actionId: action.actionId,
      actionDesc: action.actionDesc,
      actionRef: action.actionRef ?? action.actionClassName,
      actionValues: normalizeActionValues(action.actionValues),
    }));
  }

  delete normalized.ruleVersion;
  delete normalized.ruleGroup;
  delete normalized.ruleOwner;
  delete normalized.conditionExpression;
  delete normalized.ruleBody;
  return normalized;
};

export default function RuleAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { host } = useUserState() as UserState;

  // Data and fetching state
  const [data, setData] = useState<RuleType[]>([]);
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
      host: 'lightapi.net', service: 'rule', action: 'getRule', version: '0.1.0',
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
      const json = await fetchClient(url) as RuleApiResponse;
      setData(json.rules || []);
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
  const handleDelete = useCallback(async (row: MRT_Row<RuleType>) => {
    if (!window.confirm(`Are you sure you want to delete rule: ${row.original.ruleName}?`)) return;

    const originalData = [...data];
    setData(prev => prev.filter(rule => rule.ruleId !== row.original.ruleId));
    setRowCount(prev => prev - 1);

    const cmd = {
      host: 'lightapi.net', service: 'rule', action: 'deleteRule', version: '0.1.0',
      data: row.original,
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
  }, [data]);

  // Handler to fetch fresh data before navigating to update form
  const handleUpdate = useCallback(async (row: MRT_Row<RuleType>) => {
    const ruleId = row.original.ruleId;
    setIsUpdateLoading(ruleId);

    const cmd = {
      host: 'lightapi.net', service: 'rule', action: 'getFreshRule', version: '0.1.0',
      data: row.original,
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    try {
      const freshData = await fetchClient(url) as any;
      console.log("freshData", freshData);

      // Parse the stringified ruleBody to inflate conditions and actions for the form
      let parsedData = { ...freshData };
      if (parsedData.ruleBody) {
        try {
          const bodyObj = JSON.parse(parsedData.ruleBody);
          // Omit ruleBody string from the merged object to avoid recursive conflicts if needed,
          // but we spread bodyObj so its properties (like conditions and actions) become top-level.
          parsedData = { ...parsedData, ...bodyObj };
        } catch (e) {
          console.error("Failed to parse ruleBody JSON:", e);
        }
      }
      parsedData = normalizeRuleForForm(parsedData);

      // Navigate with the fresh data mapped correctly for updateRule form schema
      navigate('/app/form/updateRule', {
        state: {
          data: parsedData,
          source: location.pathname
        }
      });
    } catch (error) {
      console.error("Failed to fetch rule for update:", error);
      alert("Could not load the latest rule data. Please try again.");
    } finally {
      setIsUpdateLoading(null);
    }
  }, [host, navigate, location.pathname]);

  // Column definitions
  const columns = useMemo<MRT_ColumnDef<RuleType>[]>(
    () => [
      { accessorKey: 'ruleId', header: 'Rule Id' },
      { accessorKey: 'ruleName', header: 'Rule Name' },
      { accessorKey: 'ruleType', header: 'Type' },
      { accessorKey: 'version', header: 'Version' },
      { accessorKey: 'ruleDesc', header: 'Description', Cell: TruncatedCell },
      {
        accessorKey: 'ruleBody',
        header: 'Body',
        Cell: TruncatedCell,
        muiTableBodyCellProps: { sx: { maxWidth: '200px' } }
      },
      {
        accessorKey: 'common',
        header: 'Common',
        filterVariant: 'select',
        filterSelectOptions: [{ label: 'Yes', value: 'Y' }, { label: 'No', value: 'N' }],
      },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [{ label: 'True', value: 'true' }, { label: 'False', value: 'false' }],
        Cell: ({ cell }) => (cell.getValue() ? 'True' : 'False'),
      },
      { accessorKey: 'author', header: 'Author' },
      { accessorKey: 'hostId', header: 'Host Id' },
      { accessorKey: 'updateUser', header: 'Update User' },
      { accessorKey: 'updateTs', header: 'Update Timestamp' },
      { accessorKey: 'aggregateVersion', header: 'Aggregate Version' },
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
    getRowId: (row) => row.ruleId,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading rules' } : undefined,
    enableRowActions: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '0.1rem' }}>
        <Tooltip title="Details">
          <IconButton
            onClick={() => navigate('/app/ruleDetail', { state: { rule: row.original } })}
          >
            <DetailsIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Update Rule">
          <IconButton
            onClick={() => handleUpdate(row)}
            disabled={isUpdateLoading === row.original.ruleId}
          >
            {isUpdateLoading === row.original.ruleId ? (
              <CircularProgress size={22} />
            ) : (
              <SystemUpdateIcon />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton color="error" onClick={() => handleDelete(row)}>
            <DeleteForeverIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => navigate('/app/form/createRule')}>
        Create New Rule
      </Button>
    ),
  });

  return <MaterialReactTable table={table} />;
}
