import { Box, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
`;

export interface StatusDotColors {
  dot: string;
  text: string;
  /** Override display label (e.g. show 'Registered' instead of 'Inactive') */
  label?: string;
}

/** Default status → color mapping. Pass `statusColors` prop to override or extend. */
export const DEFAULT_STATUS_COLORS: Record<string, StatusDotColors> = {
  active:   { dot: 'success.main', text: 'success.dark' },
  running:  { dot: 'success.main', text: 'success.dark' },
  healthy:  { dot: 'success.main', text: 'success.dark' },
  up:       { dot: 'success.main', text: 'success.dark' },
  inactive: { dot: 'warning.main', text: 'warning.dark', label: 'Registered' },
  stopped:  { dot: 'error.main',   text: 'error.main' },
  down:     { dot: 'error.main',   text: 'error.main' },
  error:    { dot: 'error.main',   text: 'error.main' },
};

interface StatusDotProps {
  status: string | null | undefined;
  /** Override or extend the default color map */
  statusColors?: Record<string, StatusDotColors>;
}

/**
 * Small pulsing colored dot + status label.
 * Renders "Unknown" in grey when status is null/undefined/unrecognised.
 * Generic — suitable for any resource type.
 */
export default function StatusDot({ status, statusColors }: StatusDotProps) {
  const colorMap = statusColors ?? DEFAULT_STATUS_COLORS;

  if (!status) {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'text.disabled', flexShrink: 0 }} />
        <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.disabled' }}>
          Unknown
        </Typography>
      </Box>
    );
  }

  const colors = colorMap[status.toLowerCase()];
  const animate = colors?.dot === 'success.main';

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: colors?.dot ?? 'text.disabled',
          flexShrink: 0,
          animation: animate ? `${pulse} 2.4s ease-in-out infinite` : 'none',
        }}
      />
      <Typography
        variant="caption"
        sx={{ fontSize: '0.75rem', fontWeight: 600, color: colors?.text ?? 'text.secondary' }}
      >
        {colors?.label ?? status.charAt(0).toUpperCase() + status.slice(1)}
      </Typography>
    </Box>
  );
}
