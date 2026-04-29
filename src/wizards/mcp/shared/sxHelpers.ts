import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Common sx for a selectable left-border row:
 * - 3px primary left border when selected, transparent otherwise
 * - Tinted background when selected
 * - Hover tint
 * - Smooth transition
 *
 * Spread this into a Box sx prop and add layout-specific properties on top.
 */
export function selectableRowSx(selected: boolean): SxProps<Theme> {
  return {
    cursor: 'pointer',
    borderLeft: '3px solid',
    borderColor: selected ? 'primary.main' : 'transparent',
    bgcolor: selected ? (t: Theme) => alpha(t.palette.primary.main, 0.07) : 'transparent',
    transition: 'background-color 0.15s, border-color 0.15s',
    '&:hover': { bgcolor: (t: Theme) => alpha(t.palette.primary.main, 0.04) },
  };
}
