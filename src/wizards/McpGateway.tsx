import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Stack,
  TablePagination,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined';
import { useUserState } from '../contexts/UserContext';
import fetchClient from '../utils/fetchClient';
import GatewayCard, { type GatewayRow } from './mcp/cards/GatewayCard';
import type { GatewayServer } from './mcp/cards/GatewayServerRow';
import type { McpStatus } from './mcp/listTypes';
import { SearchSortBar } from './mcp/SearchSortBar';
import SkeletonCardRow from '../components/SkeletonCardRow';
import EmptyState from '../components/EmptyState';

interface UserState { host?: string; }

type GatewaySortField = 'instanceName' | 'envTag' | 'region' | 'serverCount' | 'toolCount';

const GATEWAY_SORT_OPTIONS: { value: GatewaySortField; label: string }[] = [
  { value: 'instanceName', label: 'Name' },
  { value: 'envTag', label: 'Environment' },
  { value: 'region', label: 'Region' },
  { value: 'serverCount', label: 'Server count' },
  { value: 'toolCount', label: 'Tool count' },
];

export default function McpGateway() {
  const navigate = useNavigate();
  const { host } = useUserState() as UserState;

  const [gateways, setGateways] = useState<GatewayRow[]>([]);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<GatewaySortField>('instanceName');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchData = useCallback(async () => {
    if (!host) return;
    setPageLoading(true);
    setPageError(false);

    try {
      // 1. Load all gateway instances (productId === 'lg')
      const instanceCmd = {
        host: 'lightapi.net', service: 'instance', action: 'getInstance', version: '0.1.0',
        data: { hostId: host, offset: 0, limit: 100, active: true, sorting: '[]', filters: '[]', globalFilter: '' },
      };
      const instanceData = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(instanceCmd)));
      const instances: any[] = instanceData?.instances ?? [];

      // 2. Load all instanceApis at once
      const iaCmd = {
        host: 'lightapi.net', service: 'instance', action: 'getInstanceApi', version: '0.1.0',
        data: { hostId: host, offset: 0, limit: 500, active: true, sorting: '[]', filters: '[]', globalFilter: '' },
      };
      const iaData = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(iaCmd)));
      const instanceApis: any[] = iaData?.instanceApis ?? [];

      // 3. Resolve API names in one batch
      const uniqueApiIds = Array.from(new Set(instanceApis.map((ia) => ia.apiId).filter(Boolean)));
      const apiNameMap = new Map<string, { apiName: string; apiType?: string }>();
      if (uniqueApiIds.length > 0) {
        try {
          const apiCmd = {
            host: 'lightapi.net', service: 'service', action: 'getApi', version: '0.1.0',
            data: { hostId: host, apiIds: uniqueApiIds, offset: 0, limit: uniqueApiIds.length, active: true, filters: '[]', sorting: '[]', globalFilter: '' },
          };
          const apiData = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(apiCmd)));
          for (const a of (apiData?.services ?? [])) {
            apiNameMap.set(a.apiId, { apiName: a.apiName, apiType: a.apiType });
          }
        } catch { /* non-fatal */ }
      }

      // 4. Build gateway rows with placeholder mcpStatus = 'loading'
      const rows: GatewayRow[] = instances.map((inst) => {
        const myApis = instanceApis.filter((ia) => ia.instanceId === inst.instanceId);
        return {
          instanceId: inst.instanceId,
          instanceName: inst.instanceName ?? inst.instanceId,
          instanceDesc: inst.instanceDesc ?? undefined,
          serviceId: inst.serviceId ?? undefined,
          envTag: inst.envTag,
          region: inst.region,
          loading: myApis.length > 0,
          servers: myApis.map((ia): GatewayServer => {
            const meta = apiNameMap.get(ia.apiId);
            return {
              instanceApiId: ia.instanceApiId,
              apiId: ia.apiId ?? '',
              apiName: meta?.apiName ?? ia.apiId ?? ia.instanceApiId,
              apiVersion: ia.apiVersion ?? '',
              apiVersionId: ia.apiVersionId,
              apiType: meta?.apiType ?? ia.apiType,
              envTag: ia.envTag,
              mcpStatus: { phase: 'loading' } as McpStatus,
            };
          }),
        };
      });

      setGateways(rows);
      setPageLoading(false);

      // 5. Resolve tool states concurrently per gateway
      await Promise.all(
        rows.map(async (row) => {
          if (row.servers.length === 0) return;
          const resolved = await Promise.all(
            row.servers.map(async (srv) => {
              try {
                const toolCmd = {
                  host: 'lightapi.net', service: 'instance', action: 'getInstanceApiMcpTool', version: '0.1.0',
                  data: { hostId: host, instanceApiId: srv.instanceApiId, apiVersionId: srv.apiVersionId },
                };
                const toolData = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(toolCmd)));
                if (!toolData?.exists) {
                  return { ...srv, mcpStatus: { phase: 'unconfigured', instanceApiId: srv.instanceApiId, apiVersionId: srv.apiVersionId, apiVersion: srv.apiVersion, instanceName: srv.apiName } as McpStatus };
                }
                const selected = (toolData.endpoints ?? []).filter((e: any) => e.selected);
                const tools = selected.map((e: any) => e.name ?? e.endpoint);
                return {
                  ...srv,
                  mcpStatus: selected.length > 0
                    ? { phase: 'ready', instanceApiId: srv.instanceApiId, apiVersionId: srv.apiVersionId, apiVersion: srv.apiVersion, instanceName: srv.apiName, toolCount: selected.length, tools } as McpStatus
                    : { phase: 'no-tools', instanceApiId: srv.instanceApiId, apiVersionId: srv.apiVersionId, apiVersion: srv.apiVersion, instanceName: srv.apiName, tools: [] } as McpStatus,
                };
              } catch {
                return { ...srv, mcpStatus: { phase: 'unconfigured', instanceApiId: srv.instanceApiId, apiVersionId: srv.apiVersionId, apiVersion: srv.apiVersion, instanceName: srv.apiName } as McpStatus };
              }
            }),
          );
          setGateways((prev) =>
            prev.map((g) => g.instanceId === row.instanceId ? { ...g, loading: false, servers: resolved } : g),
          );
        }),
      );
    } catch {
      setPageLoading(false);
      setPageError(true);
    }
  }, [host]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [filter, sortBy, sortAsc]);

  const displayedGateways = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const withComputed = gateways.map((g) => ({
      g,
      serverCount: g.servers.length,
      toolCount: g.servers.reduce((sum, s) => sum + (s.mcpStatus.phase === 'ready' ? s.mcpStatus.toolCount : 0), 0),
    }));

    // Only show gateways that are still loading (unknown tool count) OR have at least one tool
    const withTools = withComputed.filter(({ g, toolCount }) => g.loading || toolCount > 0);

    const filtered = q
      ? withTools.filter(({ g }) => {
          const fields = [g.instanceName, g.instanceId, g.envTag ?? '', g.region ?? ''];
          for (const s of g.servers) {
            fields.push(s.apiName, s.apiId, s.apiVersion);
            if (s.mcpStatus.phase === 'ready') fields.push(...s.mcpStatus.tools);
          }
          return fields.some((v) => v.toLowerCase().includes(q));
        })
      : withTools;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'serverCount' || sortBy === 'toolCount') {
        const av = sortBy === 'serverCount' ? a.serverCount : a.toolCount;
        const bv = sortBy === 'serverCount' ? b.serverCount : b.toolCount;
        return sortAsc ? av - bv : bv - av;
      }
      const av = ((a.g[sortBy] ?? '') as string).toLowerCase();
      const bv = ((b.g[sortBy] ?? '') as string).toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }).map((x) => x.g);
  }, [gateways, filter, sortBy, sortAsc]);

  const gatewaysWithTools = useMemo(
    () => gateways.filter((g) => g.loading || g.servers.some((s) => s.mcpStatus.phase === 'ready' && s.mcpStatus.toolCount > 0)),
    [gateways],
  );

  const paginatedGateways = useMemo(
    () => displayedGateways.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [displayedGateways, page, rowsPerPage],
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Page header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.25}>
            <RouterOutlinedIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h5" fontWeight={700}>MCP Gateway</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Gateway-centric view of all onboarded MCP servers and their tool configurations
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/app/mcp/wizard?flow=onboard')}
          sx={{ mt: 0.5, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Onboard to Gateway
        </Button>
      </Box>

      <SearchSortBar
        filter={filter}
        onFilterChange={setFilter}
        placeholder="Search gateways, servers, or tools..."
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOptions={GATEWAY_SORT_OPTIONS}
        sortAsc={sortAsc}
        onSortAscChange={setSortAsc}
        resultCount={displayedGateways.length}
        totalCount={gatewaysWithTools.length}
        sx={{ mb: 2 }}
      />

      {pageError && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to load gateway data. Please try again.</Alert>
      )}

      {pageLoading ? (
        <SkeletonCardRow count={2} avatarSize={36} />
      ) : gateways.length === 0 || gatewaysWithTools.length === 0 ? (
        <EmptyState
          icon={<RouterOutlinedIcon sx={{ fontSize: 56, opacity: 0.15 }} />}
          title="No MCP-enabled gateways"
          description="Gateways appear here once at least one API version has MCP tools selected."
          py={8}
        />
      ) : displayedGateways.length === 0 ? (
        <EmptyState
          icon={<RouterOutlinedIcon sx={{ fontSize: 56, opacity: 0.15 }} />}
          title="No gateways match your filter"
          description="Try adjusting search text or sort settings."
          py={8}
        />
      ) : (
        <Stack spacing={2}>
          {paginatedGateways.map((gw) => (
            <GatewayCard key={gw.instanceId} gateway={gw} navigate={navigate} />
          ))}
          {displayedGateways.length > rowsPerPage && (
            <TablePagination
              component="div"
              count={displayedGateways.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPageOptions={[10, 25, 50]}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
          )}
        </Stack>
      )}
    </Box>
  );
}
