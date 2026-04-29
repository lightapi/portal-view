import { useState } from 'react';
import { Box, Collapse, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export interface CollapsibleCardProps {
  /** Content rendered in the header row, to the right of the expand/collapse chevron. */
  header: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /**
   * Called after the open state toggles, with the new open value.
   * Use for side effects like lazy data loading.
   */
  onToggle?: (isOpen: boolean) => void;
  sx?: SxProps<Theme>;
  /** Extra sx applied to the header bar. Use to override bgcolor, py, etc. */
  headerSx?: SxProps<Theme>;
}

export default function CollapsibleCard({
  header,
  children,
  defaultOpen = true,
  onToggle,
  sx,
  headerSx,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        borderColor: (t) => alpha(t.palette.divider, 0.7),
        ...sx,
      }}
    >
      <Box
        onClick={handleToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          bgcolor: (t) =>
            t.palette.mode === 'dark'
              ? alpha(t.palette.common.white, 0.03)
              : alpha(t.palette.common.black, 0.02),
          '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.03) },
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: open ? 1 : 0,
          borderColor: 'divider',
          ...headerSx,
        }}
      >
        <Box sx={{ color: 'text.secondary', display: 'flex', flexShrink: 0 }}>
          {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </Box>
        {header}
      </Box>

      <Collapse in={open}>
        {children}
      </Collapse>
    </Paper>
  );
}
