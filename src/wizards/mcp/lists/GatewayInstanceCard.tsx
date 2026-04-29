import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorageIcon from '@mui/icons-material/Storage';

export type GatewayInstance = {
  hostId: string;
  instanceId: string;
  instanceName?: string;
  productVersionId?: string;
  productId?: string;
  productVersion?: string;
  serviceId?: string;
  serviceDesc?: string;
  environment?: string;
  envTag?: string;
  current?: boolean;
  readonly?: boolean;
  region?: string;
  lob?: string;
  zone?: string;
  resourceName?: string;
  businessName?: string;
  instanceDesc?: string;
  aggregateVersion?: number;
  updateUser?: string;
  updateTs?: string;
  active: boolean;
};

interface CardProps {
  inst: GatewayInstance;
  selected: boolean;
  onSelect: () => void;
}

/** Card-view tile for a single gateway instance in the SelectGatewayStep. */
export function GatewayInstanceCard({ inst, selected, onSelect }: CardProps) {
  return (
    <Box
      onClick={onSelect}
      sx={{
        border: '2px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2, p: 2.5, cursor: 'pointer', position: 'relative',
        bgcolor: (t) => selected ? alpha(t.palette.primary.main, 0.05) : 'background.paper',
        transition: 'border-color 0.15s, background-color 0.15s, box-shadow 0.15s',
        boxShadow: selected ? (t: any) => `0 0 0 3px ${alpha(t.palette.primary.main, 0.15)}` : 1,
        '&:hover': { borderColor: selected ? 'primary.main' : 'primary.light', bgcolor: (t) => alpha(t.palette.primary.main, 0.03) },
      }}
    >
      {selected && (
        <CheckCircleIcon sx={{ position: 'absolute', top: 10, right: 10, color: 'primary.main', fontSize: 20 }} />
      )}
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pr: 3 }}>
          <StorageIcon sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={700} lineHeight={1.3}>
              {inst.instanceName || inst.instanceId}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {inst.instanceId}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {inst.envTag && (
            <Chip label={inst.envTag.toUpperCase()} size="small"
              color={inst.envTag === 'prd' ? 'error' : inst.envTag === 'tst' ? 'warning' : 'default'} variant="outlined" />
          )}
          {inst.region && <Chip label={inst.region.toUpperCase()} size="small" variant="outlined" />}
          {inst.zone && <Chip label={inst.zone} size="small" variant="outlined" />}
          {inst.current && <Chip label="Current" size="small" color="primary" variant="outlined" />}
          {inst.readonly && <Chip label="Read-only" size="small" color="default" variant="outlined" />}
        </Box>

        <Stack spacing={0.5}>
          {inst.environment && (
            <Typography variant="caption" color="text.secondary">
              <Box component="span" fontWeight={600}>Environment: </Box>{inst.environment}
            </Typography>
          )}
          {inst.serviceId && (
            <Typography variant="caption" color="text.secondary">
              <Box component="span" fontWeight={600}>Service: </Box>{inst.serviceId}
            </Typography>
          )}
          {inst.serviceDesc && (
            <Typography variant="caption" color="text.secondary">
              <Box component="span" fontWeight={600}>Service desc: </Box>{inst.serviceDesc}
            </Typography>
          )}
          {inst.productId && (
            <Typography variant="caption" color="text.secondary">
              <Box component="span" fontWeight={600}>Product: </Box>
              {inst.productId}{inst.productVersion ? ` v${inst.productVersion}` : ''}
            </Typography>
          )}
          {inst.lob && (
            <Typography variant="caption" color="text.secondary">
              <Box component="span" fontWeight={600}>LOB: </Box>{inst.lob}
            </Typography>
          )}
        </Stack>

        {inst.instanceDesc && (
          <Typography variant="caption" color="text.secondary"
            sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontStyle: 'italic' }}>
            {inst.instanceDesc}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

/** Row-view item for a single gateway instance in the SelectGatewayStep. */
export function GatewayInstanceRow({ inst, selected, onSelect, showDivider }: CardProps & { showDivider: boolean }) {
  return (
    <Box>
      {showDivider && <Divider />}
      <Box
        onClick={onSelect}
        sx={{
          display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.25, cursor: 'pointer',
          bgcolor: (t) => selected ? alpha(t.palette.primary.main, 0.06) : 'background.paper',
          transition: 'background-color 0.15s',
          '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
        }}
      >
        <CheckCircleIcon sx={{ flexShrink: 0, fontSize: 20, color: selected ? 'primary.main' : 'action.disabled', transition: 'color 0.15s' }} />
        <Typography variant="body2" fontWeight={700} sx={{ minWidth: 160, flexShrink: 0 }} noWrap>
          {inst.instanceName || inst.instanceId}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          {inst.envTag && (
            <Chip label={inst.envTag.toUpperCase()} size="small"
              color={inst.envTag === 'prd' ? 'error' : inst.envTag === 'tst' ? 'warning' : 'default'} variant="outlined" />
          )}
          {inst.region && <Chip label={inst.region.toUpperCase()} size="small" variant="outlined" />}
        </Box>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, fontStyle: inst.instanceDesc ? 'italic' : 'normal' }}>
          {inst.instanceDesc ?? '—'}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0, textAlign: 'right', minWidth: 120 }}>
          {inst.serviceId ?? ''}
        </Typography>
      </Box>
    </Box>
  );
}
