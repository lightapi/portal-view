import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, CircularProgress, Stack, ToggleButton, ToggleButtonGroup, Tooltip,
} from '@mui/material';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import fetchClient from '../../utils/fetchClient';
import { SearchSortBar } from './SearchSortBar';
import { GatewayInstanceCard, GatewayInstanceRow } from './lists/GatewayInstanceCard';
import type { GatewayInstance } from './lists/GatewayInstanceCard';

type ViewMode = 'card' | 'row';
type SortField = 'instanceName' | 'envTag' | 'region' | 'lob' | 'serviceId' | 'productId';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'instanceName', label: 'Name' },
  { value: 'envTag',       label: 'Environment' },
  { value: 'region',       label: 'Region' },
  { value: 'lob',          label: 'LOB' },
  { value: 'serviceId',    label: 'Service' },
  { value: 'productId',    label: 'Product' },
];

interface Props {
  host: string;
  selectedInstanceId: string;
  onChange: (instanceId: string) => void;
  gatewayType?: 'centralized' | 'distributed';
  /** When set for distributed mode, only these instanceIds are shown. */
  allowedInstanceIds?: string[];
}

export default function SelectGatewayStep({ host, selectedInstanceId, onChange, gatewayType = 'centralized', allowedInstanceIds }: Props) {
  const [instances, setInstances] = useState<GatewayInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('instanceName');
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  useEffect(() => {
    if (!host) return;
    setLoading(true);
    const cmd = {
      host: 'lightapi.net', service: 'instance', action: 'getInstance', version: '0.1.0',
      data: { hostId: host, offset: 0, limit: 100, active: true },
    };
    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
    fetchClient(url)
      .then((data) => setInstances(data?.instances ?? []))
      .catch(() => setError('Failed to load gateway instances.'))
      .finally(() => setLoading(false));
  }, [host]);

  const displayed = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const eligible = instances.filter((inst) => {
      if (gatewayType === 'centralized') {
        return (inst.productId ?? '').toLowerCase().includes('lg');
      }
      // distributed: must not be lg, and if allowedInstanceIds is provided, must be in the list
      const notLg = !(inst.productId ?? '').toLowerCase().includes('lg');
      if (!notLg) return false;
      if (allowedInstanceIds && allowedInstanceIds.length > 0) {
        return allowedInstanceIds.includes(inst.instanceId);
      }
      return true;
    });
    const filtered = q
      ? eligible.filter((inst) =>
          [inst.instanceName, inst.instanceId, inst.serviceId, inst.serviceDesc,
           inst.environment, inst.envTag, inst.region, inst.zone, inst.lob, inst.productId, inst.instanceDesc]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q))
        )
      : eligible;
    return [...filtered].sort((a, b) => {
      const av = (a[sortBy] ?? '').toString().toLowerCase();
      const bv = (b[sortBy] ?? '').toString().toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [instances, filter, sortBy, sortAsc]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!instances.length) {
    return (
      <Alert severity="info">
        No {gatewayType === 'centralized' ? 'centralized gateway' : 'sidecar/distributed'} instances found. You can link your API to an instance later from the Instance admin.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
        <SearchSortBar
          filter={filter} onFilterChange={setFilter} placeholder="Filter instances…"
          sortBy={sortBy} onSortByChange={setSortBy} sortOptions={SORT_OPTIONS}
          sortAsc={sortAsc} onSortAscChange={setSortAsc}
          resultCount={displayed.length} totalCount={instances.length} sx={{ flex: 1 }}
        />
        <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)}>
          <ToggleButton value="card" aria-label="Card view">
            <Tooltip title="Card view"><ViewModuleIcon fontSize="small" /></Tooltip>
          </ToggleButton>
          <ToggleButton value="row" aria-label="Row view">
            <Tooltip title="Row view"><ViewListIcon fontSize="small" /></Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {displayed.length === 0 && <Alert severity="info" sx={{ mb: 2 }}>No instances match your filter.</Alert>}

      {viewMode === 'card' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 2 }}>
          {displayed.map((inst) => (
            <GatewayInstanceCard
              key={inst.instanceId}
              inst={inst}
              selected={inst.instanceId === selectedInstanceId}
              onSelect={() => onChange(inst.instanceId)}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Stack divider={null}>
            {displayed.map((inst, i) => (
              <GatewayInstanceRow
                key={inst.instanceId}
                inst={inst}
                selected={inst.instanceId === selectedInstanceId}
                onSelect={() => onChange(inst.instanceId)}
                showDivider={i > 0}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
