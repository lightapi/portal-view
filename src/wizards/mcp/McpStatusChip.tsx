import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import SettingsIcon from '@mui/icons-material/Settings';
import { apiIconColor as _apiIconColor } from './shared/statusConstants';
import ToolChipList from './shared/ToolChipList';
import type { McpStatus } from './listTypes';

// Re-export so existing imports from McpStatusChip continue to work.
export const apiIconColor = _apiIconColor;

export function McpProgressTracker({ status }: { status: McpStatus }) {
  if (status.phase === 'loading' || status.phase === 'error' || status.phase === 'no-version') return null;
  const tools = status.phase === 'ready' ? status.tools : [];
  return <ToolChipList tools={tools} maxVisible={5} />;
}

export function ConfigureButton({ onClick }: { onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
          display: 'inline-flex',
          alignItems: 'center',
          overflow: 'hidden',
          cursor: 'pointer',
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: 'divider',
          color: 'text.secondary',
          height: 32,
          px: 0.75,
          maxWidth: 32,
          transition: 'max-width 0.25s ease, background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease',
          '&:hover': {
            maxWidth: 160,
            color: 'primary.main',
            borderColor: 'primary.main',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
          },
          '&:hover .configure-label': {
            opacity: 1,
            transform: 'translateX(0)',
          },
        }}
      >
        <SettingsIcon sx={{ fontSize: 17, flexShrink: 0 }} />
        <Typography
          className="configure-label"
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: '0.72rem',
            whiteSpace: 'nowrap',
            ml: 0.75,
            opacity: 0,
            transform: 'translateX(-6px)',
            transition: 'opacity 0.2s ease 0.05s, transform 0.2s ease 0.05s',
          }}
        >
          Configuration
        </Typography>
      </Box>
  );
}
