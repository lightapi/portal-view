import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import { toolColor } from './statusConstants';

interface ToolChipListProps {
  tools: string[];
  /** Max chips to show before collapsing into "+N more". Default: 5 */
  maxVisible?: number;
  /** Chip height in px. Default: 22 */
  chipHeight?: number;
  /** Font size for chip label. Default: '0.68rem' */
  fontSize?: string;
}

/**
 * Renders a row of colored monospace chips for tool names.
 * Overflowing tools are summarised as a "+N more" chip.
 * Shows a "No tools configured" hint when the list is empty.
 */
export default function ToolChipList({
  tools,
  maxVisible = 5,
  chipHeight = 22,
  fontSize = '0.68rem',
}: ToolChipListProps) {
  if (tools.length === 0) {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
        <HubOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic' }}>
          No tools configured
        </Typography>
      </Box>
    );
  }

  const visible = tools.slice(0, maxVisible);
  const overflow = tools.length - visible.length;

  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
      {visible.map((name) => {
        const bg = toolColor(name);
        return (
          <Tooltip key={name} title={name}>
            <Chip
              label={name}
              size="small"
              sx={{
                height: chipHeight,
                fontSize,
                fontFamily: 'monospace',
                fontWeight: 600,
                maxWidth: 200,
                bgcolor: alpha(bg, 0.12),
                color: bg,
                border: `1px solid ${alpha(bg, 0.3)}`,
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
            />
          </Tooltip>
        );
      })}
      {overflow > 0 && (
        <Chip
          label={`+${overflow} more`}
          size="small"
          variant="outlined"
          sx={{ height: chipHeight, fontSize, color: 'text.secondary', borderColor: 'divider' }}
        />
      )}
    </Stack>
  );
}
