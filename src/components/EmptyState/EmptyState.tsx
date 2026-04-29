import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface EmptyStateProps {
  /** Icon element, e.g. <SearchOffIcon sx={{ fontSize: 52, opacity: 0.18 }} /> */
  icon: React.ReactNode;
  title: string;
  description?: string;
  /** Optional action element, e.g. a Button */
  action?: React.ReactNode;
  /** Vertical padding (MUI spacing units). Default: 6 */
  py?: number;
  sx?: SxProps<Theme>;
}

/**
 * Centred empty-state layout: icon → title → optional description → optional action.
 * Generic — no domain-specific logic.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  py = 6,
  sx,
}: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: 'center', py, ...sx }}>
      <Box sx={{ display: 'block', mx: 'auto', mb: 1.5 }}>{icon}</Box>
      <Typography variant="body1" fontWeight={500} gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: action ? 2 : 0 }}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}
