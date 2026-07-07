import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_ColumnFiltersState,
} from 'material-react-table';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddBoxIcon from '@mui/icons-material/AddBox';
import fetchClient from "../../utils/fetchClient";
import { apiPost } from "../../api/apiPost";
import { useUserState } from "../../contexts/UserContext";
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';

type RuleType = {
  hostId: string;
  endpointId: string;
  apiId: string;
  apiVersion: string;
  endpoint: string;
  ruleType: string;
  ruleId: string;
  aggregateVersion?: number;
  active: boolean;
};

export default function ListRule() {
  const location = useLocation();
  const navigate = useNavigate();
  const { host } = useUserState() as { host?: string };
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchContext = useMemo(() => contextFromSearchParams(searchParams), [searchParams]);
  const state = location.state as Partial<RuleType> | { data?: Partial<RuleType> } | null;
  const initialData = useMemo<Partial<RuleType>>(
    () => ({ ...searchContext, ...('data' in (state ?? {}) ? (state as { data?: Partial<RuleType> }).data : state) }),
    [searchContext, state],
  );
  const { endpointId, apiId, apiVersion, endpoint } = initialData;
  const hostId = initialData.hostId ?? host ?? '';
  const taskContext = useMemo(
    () => mergeTaskContext(searchContext, {
      hostId,
      apiId: apiId ?? '',
      endpointId: endpointId ?? '',
    }),
    [apiId, endpointId, hostId, searchContext],
  );

  const [data, setData] = useState<RuleType[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    [{ id: 'active', value: 'true' }]
  );

  const fetchData = useCallback(async () => {
    if (!hostId || !endpointId) return;
    setIsError(false);
    setIsLoading(true);

    const activeFilter = columnFilters.find((f) => f.id === 'active');

    const cmd = {
      host: "lightapi.net",
      service: "service",
      action: "getApiEndpointRule",
      version: "0.1.0",
      data: {
        hostId,
        endpointId,
        active: activeFilter ? activeFilter.value === 'true' : true
      },
    };
    const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));

    try {
      const json = await fetchClient(url);
      setData(json || []);
    } catch (error) {
      setIsError(true);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [hostId, endpointId, columnFilters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (row: RuleType) => {
    if (window.confirm("Are you sure you want to delete the rule for the endpoint?")) {
      const cmd = {
        host: "lightapi.net",
        service: "service",
        action: "deleteApiEndpointRule",
        version: "0.1.0",
        data: {
          hostId: row.hostId,
          endpointId: row.endpointId,
          ruleId: row.ruleId,
          aggregateVersion: row.aggregateVersion,
        },
      };

      const result = await apiPost({
        url: "/portal/command",
        headers: {},
        body: cmd,
      });
      if (result.data) {
        console.log("delete rule successfully", result.data);
        fetchData();
      } else if (result.error) {
        console.error("Api Error", result.error);
      }
    }
  };

  const handleCreateRule = () => {
    navigate(buildTaskAwareRoute("/app/form/createApiEndpointRule", searchParams, taskContext), {
      state: { data: { hostId, endpointId, apiId, apiVersion, endpoint } },
    });
  };

  const columns = useMemo<MRT_ColumnDef<RuleType>[]>(
    () => [
      { accessorKey: 'apiId', header: 'Api Id' },
      { accessorKey: 'apiVersion', header: 'Api Version' },
      { accessorKey: 'endpoint', header: 'Endpoint' },
      { accessorKey: 'ruleType', header: 'Rule Type' },
      { accessorKey: 'ruleId', header: 'Rule Id' },
      { accessorKey: 'hostId', header: 'Host Id' },
      {
        accessorKey: 'active',
        header: 'Active',
        filterVariant: 'select',
        filterSelectOptions: [
          { label: 'True', value: 'true' },
          { label: 'False', value: 'false' },
        ],
        Cell: ({ cell }) => (cell.getValue<boolean>() ? 'True' : 'False'),
      },
    ],
    [],
  );

  const table = useMaterialReactTable({
    columns,
    data,
    enablePagination: false,
    enableRowActions: true,
    enableGlobalFilter: true,
    enableColumnFilters: true,
    manualFiltering: true,
    positionActionsColumn: 'first',
    renderRowActions: ({ row }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Delete">
          <IconButton color="error" onClick={() => handleDelete(row.original)}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: () => (
      <Button
        color="primary"
        onClick={handleCreateRule}
        variant="contained"
        startIcon={<AddBoxIcon />}
      >
        Add Rule to Endpoint
      </Button>
    ),
    initialState: { density: 'compact', showColumnFilters: true },
    onColumnFiltersChange: setColumnFilters,
    muiToolbarAlertBannerProps: isError ? { color: 'error', children: 'Error loading rules' } : undefined,
    state: { isLoading, showAlertBanner: isError, columnFilters },
  });

  return (
    <Box>
      <TaskActionPanel
        title="Endpoint Tasks"
        context={taskContext}
        taskIds={['configure-access-control', 'publish-api', 'mcp-onboard-api']}
        maxActions={3}
      />
      <Box mt={2}>
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
