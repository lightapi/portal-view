import { Box, Chip, Paper, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export interface ChoiceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  /** Extra content rendered below the description (e.g. an "Opened in new tab" badge). */
  badge?: React.ReactNode;
  disabled?: boolean;
  /** Tooltip text shown when the card is disabled. */
  disabledReason?: string;
  /** When true, renders a "Coming soon" chip below the description. */
  comingSoon?: boolean;
}

export default function ChoiceCard({
  icon,
  title,
  description,
  selected,
  onClick,
  badge,
  disabled,
  disabledReason,
  comingSoon,
}: ChoiceCardProps) {
  const card = (
    <Paper
      variant="outlined"
      onClick={disabled ? undefined : onClick}
      sx={{
        flex: 1,
        p: 5,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        borderRadius: 3,
        borderWidth: 2,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: (t) => selected ? alpha(t.palette.primary.main, 0.06) : 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s, background-color 0.2s, transform 0.15s, box-shadow 0.2s',
        transform: selected ? 'translateY(-3px)' : 'none',
        boxShadow: selected
          ? (t) => `0 6px 24px ${alpha(t.palette.primary.main, 0.18)}`
          : 'none',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
          transform: 'translateY(-3px)',
          boxShadow: (t) => `0 6px 24px ${alpha(t.palette.primary.main, 0.12)}`,
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          bgcolor: selected ? 'primary.main' : 'transparent',
          transition: 'background-color 0.2s',
        },
      }}
    >
      {selected && (
        <CheckCircleIcon
          sx={{ position: 'absolute', top: 14, right: 14, fontSize: 22, color: 'primary.main' }}
        />
      )}

      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
          bgcolor: (t) => selected
            ? alpha(t.palette.primary.main, 0.12)
            : alpha(t.palette.text.secondary, 0.08),
          color: selected ? 'primary.main' : 'text.secondary',
          transition: 'background-color 0.2s, color 0.2s, transform 0.2s',
          transform: selected ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        {icon}
      </Box>

      <Typography variant="h6" fontWeight={700} gutterBottom>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{description}</Typography>
      {comingSoon && (
        <Chip
          label="Coming soon"
          size="small"
          sx={{ mt: 2, fontWeight: 600, fontSize: '0.7rem', bgcolor: 'action.selected', color: 'text.secondary' }}
        />
      )}
      {badge && <Box sx={{ mt: 2 }}>{badge}</Box>}
    </Paper>
  );

  if (disabled && disabledReason) {
    return <Tooltip title={disabledReason} placement="top"><span style={{ flex: 1 }}>{card}</span></Tooltip>;
  }
  return card;
}
