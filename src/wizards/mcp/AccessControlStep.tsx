import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpenOutlined';
import fetchClient from '../../utils/fetchClient';
import { EndpointInfo } from './accessControl.types';
import { EndpointCard } from './EndpointCard';

interface Props {
  host: string;
  apiId: string;
  apiVersion: string;
  apiVersionId: string;
  instanceApiId?: string;
  onHasAccess?: (v: boolean) => void;
}

export default function AccessControlStep({ host, apiId, apiVersion, apiVersionId, instanceApiId, onHasAccess }: Props) {
  const [endpoints, setEndpoints] = useState<EndpointInfo[]>([]);
  const [loading, setLoading] = useState(!!(host && instanceApiId));
  const [error, setError] = useState<string | null>(null);

  // Load endpoints: from selected gateway tools when instanceApiId exists,
  // otherwise from API version endpoints for standalone MCP servers.
  useEffect(() => {
    if (!host || !apiVersionId) return;
    let cancelled = false;
    setLoading(true);

    if (instanceApiId) {
      const cmd = {
        host: 'lightapi.net', service: 'instance', action: 'getInstanceApiMcpTool', version: '0.1.0',
        data: { hostId: host, instanceApiId, apiVersionId },
      };

      fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)))
        .then((data) => {
          if (cancelled) return;
          const raw: any[] = Array.isArray(data) ? data : (Array.isArray(data?.endpoints) ? data.endpoints : []);
          const selected = raw.filter((e) => e.selected === true);
          setEndpoints(selected.map((e) => ({
            value: e.endpointId ?? e.value,
            label: e.name ?? e.endpoint ?? e.label ?? e.endpointId ?? '',
            endpoint: e.endpoint ?? '',
            description: e.description ?? e.endpointDesc,
          })));
        })
        .catch(() => { if (!cancelled) setError('Failed to load tools.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      const cmd = {
        host: 'lightapi.net', service: 'service', action: 'getApiEndpoint', version: '0.1.0',
        data: {
          hostId: host,
          offset: 0,
          limit: 500,
          active: true,
          sorting: '[]',
          globalFilter: '',
          filters: JSON.stringify([{ id: 'apiVersionId', value: apiVersionId }]),
        },
      };

      fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)))
        .then((data) => {
          if (cancelled) return;
          const raw: any[] = Array.isArray(data) ? data : (Array.isArray(data?.endpoints) ? data.endpoints : []);
          setEndpoints(raw.map((e) => ({
            value: e.endpointId ?? e.value,
            label: e.endpoint ?? e.name ?? e.label ?? e.endpointId ?? '',
            endpoint: e.endpoint ?? '',
            description: e.endpointDesc ?? e.description,
          })));
        })
        .catch(() => { if (!cancelled) setError('Failed to load API endpoints.'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    return () => { cancelled = true; };
  }, [host, instanceApiId, apiVersionId]);

  // Only check for existing RBAC once we know there are configured tools
  useEffect(() => {
    if (!host || !apiVersionId || !onHasAccess || loading || endpoints.length === 0) return;
    const cmd = {
      host: 'lightapi.net', service: 'role', action: 'queryRolePermission', version: '0.1.0',
      data: { hostId: host, offset: 0, limit: 1, active: true, filters: JSON.stringify([{ id: 'apiVersionId', value: apiVersionId }]), sorting: '[]', globalFilter: '' },
    };
    fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)))
      .then((data) => { if ((data?.rolePermissions ?? []).length > 0) onHasAccess(true); })
      .catch(() => {});
  }, [host, apiVersionId, onHasAccess, loading, endpoints.length]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Stack spacing={2}>
      <Alert severity="info" icon={<LockOpenIcon />} sx={{ '& .MuiAlert-message': { fontSize: '0.85rem' } }}>
        Configure access control per tool. Add a <strong>rule</strong> first (it defines the enforcement mechanism),
        then assign which <strong>roles, groups, positions or attributes</strong> the rule applies to.
        Both are optional — skip this step to allow all authenticated users full access.
      </Alert>

      {error && <Alert severity="warning">{error}</Alert>}

      {endpoints.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 4 }}>
          No tools found for this API version.
        </Typography>
      ) : (
        endpoints.map((ep) => (
          <EndpointCard
            key={ep.value}
            host={host} apiId={apiId} apiVersion={apiVersion} apiVersionId={apiVersionId}
            endpointId={ep.value} endpointLabel={ep.label} endpoint={ep.endpoint} endpointDescription={ep.description}
            onHasAccess={onHasAccess}
          />
        ))
      )}

    </Stack>
  );
}
