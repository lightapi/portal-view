import { Box, Tooltip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RouterIcon from '@mui/icons-material/Router';
import TuneIcon from '@mui/icons-material/Tune';
import { selectableRowSx } from '../shared/sxHelpers';
import type { PickerVersionRow, PickerMcpState } from '../listTypes';

/** Tiny icon showing MCP state for a version that is already on a gateway. */
export function McpStateBadge({ state }: { state: PickerMcpState | undefined }) {
  if (!state) return null;
  if (state === 'ready')
    return (
      <Tooltip title="MCP tools configured">
        <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
      </Tooltip>
    );
  if (state === 'no-tools')
    return (
      <Tooltip title="On gateway — no MCP tools selected yet">
        <TuneIcon sx={{ fontSize: 14, color: 'info.main' }} />
      </Tooltip>
    );
  return (
    <Tooltip title="On gateway — MCP not configured">
      <RouterIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
    </Tooltip>
  );
}

interface VersionPickerRowProps {
  version: PickerVersionRow;
  selected: boolean;
  onClick: () => void;
}

/** Selectable version row inside an ApiPickerCard. */
export default function VersionPickerRow({ version, selected, onClick }: VersionPickerRowProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        ...selectableRowSx(selected),
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1,
      }}
    >
      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: 'text.primary', flexShrink: 0 }}>
        v{version.apiVersion}
      </Typography>

      {version.instanceName ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <RouterIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled" noWrap sx={{ fontSize: '0.68rem' }}>
            {version.instanceName}
          </Typography>
        </Box>
      ) : (
        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic', fontSize: '0.68rem' }}>
          Not on a gateway
        </Typography>
      )}

      <Box sx={{ flex: 1 }} />
      <McpStateBadge state={version.mcpState} />
    </Box>
  );
}
