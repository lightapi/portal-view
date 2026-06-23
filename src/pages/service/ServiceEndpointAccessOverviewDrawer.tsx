import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import fetchClient from '../../utils/fetchClient';

type Props = {
  open: boolean;
  hostId: string;
  apiVersionId: string;
  refreshKey: number;
  highlightedEndpointIds: string[];
  onClose: () => void;
};

type BucketItem = Record<string, unknown>;
type BucketMap = Record<string, BucketItem[]>;

type EndpointOverview = {
  endpointId: string;
  endpoint: string;
  httpMethod: string;
  endpointPath: string;
  rules: Record<string, string[]>;
  permissions: BucketMap;
  rowFilters: BucketMap;
  columnFilters: BucketMap;
  status: string;
};

type OverviewResponse = {
  total: number;
  summary: {
    withoutAccess: number;
    withRules: number;
    withPermissions: number;
    withRowFilters: number;
    withColumnFilters: number;
  };
  endpoints: EndpointOverview[];
  error?: string;
};

const emptyOverview: OverviewResponse = {
  total: 0,
  summary: {
    withoutAccess: 0,
    withRules: 0,
    withPermissions: 0,
    withRowFilters: 0,
    withColumnFilters: 0,
  },
  endpoints: [],
};

export default function ServiceEndpointAccessOverviewDrawer({
  open,
  hostId,
  apiVersionId,
  refreshKey,
  highlightedEndpointIds,
  onClose,
}: Props) {
  const [overview, setOverview] = useState<OverviewResponse>(emptyOverview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [highlightOnly, setHighlightOnly] = useState(false);

  useEffect(() => {
    if (!open || !hostId || !apiVersionId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const cmd = {
        host: 'lightapi.net',
        service: 'service',
        action: 'getApiEndpointAccessOverview',
        version: '0.1.0',
        data: { hostId, apiVersionId, active: true },
      };
      try {
        const json = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
        if (!cancelled) {
          setOverview(json ?? emptyOverview);
          if (json?.error) setError(json.error);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load access overview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [apiVersionId, hostId, open, refreshKey]);

  const highlighted = useMemo(() => new Set(highlightedEndpointIds), [highlightedEndpointIds]);
  const endpoints = useMemo(() => {
    return (overview.endpoints ?? []).filter((endpoint) => {
      if (missingOnly && endpoint.status !== 'No access configured') return false;
      if (highlightOnly && !highlighted.has(endpoint.endpointId)) return false;
      return true;
    });
  }, [highlightOnly, highlighted, missingOnly, overview.endpoints]);

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(overview, null, 2));
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: '100vw', md: 760 }, p: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Access Overview</Typography>
            <Typography variant="body2" color="text.secondary">
              Review endpoint-level rules, permissions, row filters, and column filters for this API version.
            </Typography>
          </Box>

          {error && <Alert severity="warning">{error}</Alert>}

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`Endpoints: ${overview.total ?? 0}`} />
            <Chip color="warning" variant="outlined" label={`Missing: ${overview.summary?.withoutAccess ?? 0}`} />
            <Chip variant="outlined" label={`Rules: ${overview.summary?.withRules ?? 0}`} />
            <Chip variant="outlined" label={`Permissions: ${overview.summary?.withPermissions ?? 0}`} />
            <Chip variant="outlined" label={`Row Filters: ${overview.summary?.withRowFilters ?? 0}`} />
            <Chip variant="outlined" label={`Column Filters: ${overview.summary?.withColumnFilters ?? 0}`} />
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <FormControlLabel
              control={<Switch checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} />}
              label="Missing only"
            />
            <FormControlLabel
              control={<Switch checked={highlightOnly} onChange={(event) => setHighlightOnly(event.target.checked)} disabled={highlighted.size === 0} />}
              label="Selected only"
            />
            <Button size="small" onClick={copyJson} disabled={!overview.endpoints?.length}>Copy JSON</Button>
          </Stack>

          {loading ? (
            <Typography variant="body2">Loading access overview...</Typography>
          ) : (
            <Box sx={{ maxHeight: 'calc(100vh - 230px)', overflow: 'auto' }}>
              {endpoints.map((endpoint) => (
                <Accordion key={endpoint.endpointId} disableGutters>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', minWidth: 0 }}>
                      <Chip size="small" label={endpoint.httpMethod} />
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>{endpoint.endpointPath || endpoint.endpoint}</Typography>
                      <Chip size="small" color={endpoint.status === 'No access configured' ? 'warning' : 'default'} label={endpoint.status} />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.5}>
                      <OverviewSection title="Rules" value={formatRules(endpoint.rules)} />
                      <OverviewSection title="Permissions" value={formatBuckets(endpoint.permissions)} />
                      <OverviewSection title="Row Filters" value={formatBuckets(endpoint.rowFilters)} />
                      <OverviewSection title="Column Filters" value={formatBuckets(endpoint.columnFilters)} />
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}
              {endpoints.length === 0 && (
                <Typography variant="body2" color="text.secondary">No endpoints match the current overview filters.</Typography>
              )}
            </Box>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}

function OverviewSection({ title, value }: { title: string; value: string }) {
  return (
    <Box>
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="body2" color={value === 'None' ? 'text.secondary' : 'text.primary'} sx={{ whiteSpace: 'pre-wrap' }}>
        {value}
      </Typography>
    </Box>
  );
}

function formatRules(rules: Record<string, string[]>) {
  const lines = Object.entries(rules ?? {}).flatMap(([ruleType, ruleIds]) => ruleIds.map((ruleId) => `${ruleType}: ${ruleId}`));
  return lines.length ? lines.join('\n') : 'None';
}

function formatBuckets(buckets: BucketMap) {
  const lines: string[] = [];
  Object.entries(buckets ?? {}).forEach(([bucket, items]) => {
    items.forEach((item) => {
      lines.push(`${bucket}: ${Object.entries(item).map(([key, value]) => `${key}=${String(value)}`).join(', ')}`);
    });
  });
  return lines.length ? lines.join('\n') : 'None';
}
