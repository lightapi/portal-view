import { Box, Button, Chip, CircularProgress, Divider, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import { useNavigate } from 'react-router-dom';
import CollapsibleCard from '../../../components/CollapsibleCard';
import GatewayServerRow from './GatewayServerRow';
import type { GatewayServer } from './GatewayServerRow';
import { envColor } from '../shared/statusConstants';

export interface GatewayRow {
  instanceId: string;
  instanceName: string;
  instanceDesc?: string;
  serviceId?: string;
  envTag?: string;
  region?: string;
  servers: GatewayServer[];
  loading: boolean;
}

interface GatewayCardProps {
  gateway: GatewayRow;
  navigate: ReturnType<typeof useNavigate>;
}

export default function GatewayCard({ gateway, navigate }: GatewayCardProps) {
  const totalTools = gateway.servers.reduce(
    (sum, s) => sum + (s.mcpStatus.phase === 'ready' ? s.mcpStatus.toolCount : 0), 0,
  );

  const header = (
    <>
      {/* Gateway icon bubble */}
      <Box
        sx={{
          width: 36, height: 36, borderRadius: 1.5,
          bgcolor: 'primary.main',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <RouterOutlinedIcon sx={{ color: '#fff', fontSize: 20 }} />
      </Box>

      {/* Name + env + region */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {gateway.instanceName}
          </Typography>
          {gateway.envTag && (
            <Chip
              label={gateway.envTag.toUpperCase()}
              size="small"
              sx={{
                height: 18, fontSize: '0.65rem', fontWeight: 700,
                bgcolor: (t) => alpha(envColor(gateway.envTag), 0.12),
                color: envColor(gateway.envTag), border: 'none',
              }}
            />
          )}
          {gateway.region && (
            <Chip
              label={gateway.region.toUpperCase()}
              size="small"
              sx={{
                height: 18, fontSize: '0.65rem', fontWeight: 700,
                bgcolor: (t) => alpha(t.palette.text.secondary, 0.1),
                color: 'text.secondary', border: 'none',
              }}
            />
          )}
        </Box>
        {gateway.instanceDesc && (
          <Typography variant="caption" color="text.secondary" noWrap display="block">{gateway.instanceDesc}</Typography>
        )}
        {gateway.serviceId && (
          <Typography variant="caption" color="text.disabled" noWrap display="block" sx={{ fontFamily: 'monospace' }}>{gateway.serviceId}</Typography>
        )}
      </Box>

      {/* Summary stats */}
      {!gateway.loading ? (
        <Box sx={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
          <Tooltip title="MCP servers on this gateway">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <HubOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {gateway.servers.length}
              </Typography>
            </Box>
          </Tooltip>
          <Tooltip title="Total tools configured">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TuneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {totalTools}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      ) : (
        <CircularProgress size={16} sx={{ flexShrink: 0 }} />
      )}
    </>
  );

  return (
    <CollapsibleCard
      header={header}
      sx={{ transition: 'box-shadow 0.15s', '&:hover': { boxShadow: (t) => `0 2px 12px ${alpha(t.palette.primary.main, 0.08)}` } }}
    >
      {gateway.loading ? (
        <Stack divider={<Divider />}>
          {[0, 1].map((i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25 }}>
              <Skeleton variant="rounded" width={30} height={30} sx={{ borderRadius: 1.25, flexShrink: 0 }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width={160} height={14} />
                <Skeleton width={80} height={12} sx={{ mt: 0.5 }} />
              </Box>
              <Skeleton variant="rounded" width={80} height={22} />
            </Box>
          ))}
        </Stack>
      ) : gateway.servers.length === 0 ? (
        <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
          <HubOutlinedIcon sx={{ fontSize: 36, opacity: 0.15, display: 'block', mx: 'auto', mb: 1 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            No MCP servers onboarded yet
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate(`/app/mcp/wizard?flow=onboard&instanceId=${gateway.instanceId}`)}
            sx={{ mt: 0.5 }}
          >
            Onboard a server
          </Button>
        </Box>
      ) : (
        <Stack divider={<Divider />}>
          {gateway.servers.map((s) => (
            <GatewayServerRow key={s.instanceApiId} server={s} instanceId={gateway.instanceId} navigate={navigate} />
          ))}
        </Stack>
      )}
    </CollapsibleCard>
  );
}
