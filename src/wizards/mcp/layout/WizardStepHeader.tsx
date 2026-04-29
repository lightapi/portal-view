import { keyframes } from '@emotion/react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

const stepEnter = keyframes`
  from { opacity: 0; transform: scale(0.88) perspective(500px) rotateX(-10deg); }
  to   { opacity: 1; transform: scale(1)    perspective(500px) rotateX(0deg); }
`;

interface WizardStepHeaderProps {
  title: string;
  description: string;
}

/**
 * Animated step title + description card with a left blue border.
 * Use `key={step}` at the call-site to re-mount and replay the entrance animation.
 */
export default function WizardStepHeader({ title, description }: WizardStepHeaderProps) {
  return (
    <Box
      sx={{
        mt: 3, mb: 3, p: 2.5, borderRadius: 2,
        bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
        borderLeft: '4px solid', borderColor: 'primary.main',
        animation: `${stepEnter} 0.35s cubic-bezier(0.22, 1, 0.36, 1) both`,
      }}
    >
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
    </Box>
  );
}
