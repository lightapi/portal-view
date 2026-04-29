import { useState } from 'react';
import {
  Alert, Box, CircularProgress, Divider, Link, Paper,
  Stack, Tab, TablePagination, Tabs, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { config } from '../../../../config';
import SkeletonCardRow from '../../../components/SkeletonCardRow';
import EmptyState from '../../../components/EmptyState';
import { apiIconColor } from '../McpStatusChip';
import VersionPickerRow from './VersionPickerRow';
import type { PickerApiRow } from '../listTypes';
import type { ExistingApiSelection } from '../SelectExistingApiStep';

interface ApiPickerListProps {
  apis: PickerApiRow[];
  selection: ExistingApiSelection | null;
  onChange: (s: ExistingApiSelection) => void;
  mode: 'existing-api' | 'gateway-onboard';
  mcpResolved: boolean;
  isLoading: boolean;
  error: string | null;
  q: string;
}

type ApiTab = 'all' | 'deployed' | 'registry';

export default function ApiPickerList({ apis, selection, onChange, mode, mcpResolved, isLoading, error, q }: ApiPickerListProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tab, setTab] = useState<ApiTab>('all');

  const hasInstance = (a: PickerApiRow) =>
    (a.versions ?? []).some((v) => v.instanceApiId);

  const tabFiltered = mode !== 'existing-api' ? apis : (
    tab === 'deployed'  ? apis.filter(hasInstance) :
    tab === 'registry'  ? apis.filter((a) => !hasInstance(a)) :
    apis
  );

  const filtered = q.trim()
    ? tabFiltered.filter((a) =>
        [a.apiId, a.apiName, a.apiDesc, ...(a.versions ?? []).map((v) => v.instanceName)]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q.toLowerCase()))
      )
    : tabFiltered;

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (isLoading || !mcpResolved) {
    return <SkeletonCardRow count={3} avatarSize={32} />;
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  const deployedCount  = apis.filter(hasInstance).length;
  const registryCount  = apis.filter((a) => !hasInstance(a)).length;

  const TAB_META: Record<ApiTab, { info: React.ReactNode; warning?: React.ReactNode }> = {
    all: {
      info: <>
        Shows all APIs registered in the platform. <strong>Deployed APIs</strong> have at least one active sidecar or micro-gateway instance and can be exposed directly or via a centralized gateway.
        {' '}<strong>Registry-only APIs</strong> have no running instance and require a centralized gateway to serve MCP tools.
      </>,
    },
    deployed: {
      info: <>These APIs have at least one active <strong>sidecar or micro-gateway instance</strong>. MCP tools can be served directly from that instance or routed through a centralized gateway.</>,
      warning: <>
        Don't see your API here? Its sidecar or micro-gateway instances may be running an older product version that does not support MCP.
        {' '}Upgrade the <strong>sidecar/micro-gateway</strong> (not the API itself) to the latest version to enable MCP support.
        {' '}<Link href={config.productReleaseUrl} target="_blank" rel="noopener noreferrer">View latest release</Link>
      </>,
    },
    registry: {
      info: <>These APIs are registered in the catalog but have no active sidecar or micro-gateway instance. They can only be exposed as MCP tools through a <strong>centralized gateway</strong>.</>,
    },
  };

  return (
    <Stack spacing={2}>
      {mode === 'existing-api' && (
        <Box>
          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setPage(0); }}
            variant="scrollable"
            scrollButtons="auto"
            TabIndicatorProps={{ style: { display: 'none' } }}
            sx={{ minHeight: 44, '& .MuiTabs-flexContainer': { gap: 0.5 } }}
          >
            {([
              { value: 'all',      label: 'All',           count: apis.length,    icon: <ApiOutlinedIcon sx={{ fontSize: 14 }} /> },
              { value: 'deployed', label: 'Deployed',      count: deployedCount,  icon: <DnsOutlinedIcon sx={{ fontSize: 14 }} /> },
              { value: 'registry', label: 'Registry Only', count: registryCount,  icon: <LayersOutlinedIcon sx={{ fontSize: 14 }} /> },
            ] as const).map(({ value, label, count, icon }) => {
              const isActive = tab === value;
              return (
                <Tab
                  key={value}
                  value={value}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: '50%',
                        bgcolor: isActive ? 'primary.main' : 'action.selected',
                        color: isActive ? '#fff' : 'text.secondary',
                        flexShrink: 0, transition: 'background-color 0.2s',
                      }}>
                        {icon}
                      </Box>
                      <Typography variant="caption" sx={{
                        fontWeight: isActive ? 700 : 500, fontSize: '0.78rem',
                        color: isActive ? 'primary.main' : 'text.secondary',
                        transition: 'color 0.2s',
                      }}>
                        {label} ({count})
                      </Typography>
                    </Box>
                  }
                  sx={{
                    minHeight: 44, px: 1.5, py: 0, textTransform: 'none',
                    borderRadius: '8px 8px 0 0',
                    bgcolor: isActive ? (t: any) => alpha(t.palette.primary.main, 0.07) : 'transparent',
                    '&:hover': { bgcolor: (t: any) => alpha(t.palette.primary.main, 0.04) },
                  }}
                />
              );
            })}
          </Tabs>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1.5 }} />
          <Stack spacing={1} sx={{ mb: 0.5 }}>
            <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: '0.82rem' } }}>
              {TAB_META[tab].info}
            </Alert>
            {TAB_META[tab].warning && (
              <Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: '0.82rem' } }}>
                {TAB_META[tab].warning}
              </Alert>
            )}
          </Stack>
        </Box>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ApiOutlinedIcon sx={{ fontSize: 48, opacity: 0.2 }} />}
          title="No APIs found"
          py={5}
        />
      ) : (
        <Stack spacing={2}>
          {paginated.map((api) => {
        const color = apiIconColor(api.apiName ?? api.apiId ?? '?');
        const isSelected = selection?.apiId === api.apiId;

        return (
          <Paper
            key={api.apiId}
            variant="outlined"
            sx={{
              borderRadius: 2, overflow: 'hidden',
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? 'primary.main' : (t) => alpha(t.palette.divider, 0.7),
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: isSelected ? (t) => `0 0 0 3px ${alpha(t.palette.primary.main, 0.12)}` : 'none',
            }}
          >
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
                cursor: 'default',
                bgcolor: isSelected
                  ? (t) => alpha(t.palette.primary.main, 0.05)
                  : (t) => alpha(t.palette.common.black, 0.02),
                '&:hover': {
                  bgcolor: (t) => alpha(t.palette.common.black, 0.02),
                },
              }}
            >
              <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ApiOutlinedIcon sx={{ color: '#fff', fontSize: 17 }} />
              </Box>
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, overflow: 'hidden' }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{api.apiName ?? api.apiId}</Typography>
                  <Typography variant="caption" color="text.disabled" noWrap sx={{ fontFamily: 'monospace', fontSize: '0.7rem', flexShrink: 0 }}>{api.apiId}</Typography>
                </Box>
                {api.apiDesc && (
                  <Typography variant="caption" color="text.secondary" noWrap display="block">{api.apiDesc}</Typography>
                )}
              </Box>
            </Box>

            {api.versions === null ? (
              <Box sx={{ px: 2, py: 1 }}><CircularProgress size={14} /></Box>
            ) : api.versions.length === 0 ? (
              <>
                <Divider />
                <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <HubOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                    No versions — you'll add one in the next step
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                <Divider />
                <Stack divider={<Divider />}>
                  {api.versions.map((ver) => (
                    <VersionPickerRow
                      key={ver.apiVersionId}
                      version={ver}
                      selected={selection?.apiId === api.apiId && selection?.apiVersionId === ver.apiVersionId}
                      onClick={() =>
                        onChange({
                          apiId: api.apiId, apiName: api.apiName, apiDesc: api.apiDesc,
                          apiVersionId: ver.apiVersionId, apiVersion: ver.apiVersion,
                          instanceApiId: ver.instanceApiId,
                          distributedInstanceIds: ver.distributedInstanceIds ?? [],
                          mcpState: ver.mcpState,
                        })
                      }
                    />
                  ))}
                </Stack>
              </>
            )}
          </Paper>
        );
      })}

      {filtered.length > rowsPerPage && (
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPageOptions={[10, 25, 50]}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
          )}
        </Stack>
      )}
    </Stack>
  );
}
