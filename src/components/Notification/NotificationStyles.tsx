import { styled, Theme } from '@mui/material/styles';
import { Box } from '@mui/material';

interface StyledProps {
  variant?: "contained" | "rounded";
  shadowless?: boolean;
  colorName?: string;
  notificationType?: string;
  theme?: Theme;
}

export const NotificationRoot = styled(Box, {
  shouldForwardProp: (prop) => !['variant', 'shadowless', 'colorName', 'notificationType'].includes(prop as string),
})<StyledProps>(({ theme, variant, colorName, shadowless }: { theme: Theme; variant?: string; colorName?: string; shadowless?: boolean }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2),
  width: '100%',
  borderRadius: variant === 'rounded' ? theme.spacing(1) : 0,
  ...(variant === 'contained' && {
    backgroundColor: colorName && (theme.palette as any)[colorName] 
      ? (theme.palette as any)[colorName].main 
      : theme.palette.primary.main,
    color: 'white',
  }),
  ...(!shadowless && {
    boxShadow: theme.shadows[3],
  }),
  marginBottom: theme.spacing(1),
}));

export const IconContainer = styled(Box, {
  shouldForwardProp: (prop) => !['variant', 'colorName', 'notificationType'].includes(prop as string),
})<StyledProps>(({ theme, variant, colorName, notificationType }: { theme: Theme; variant?: string; colorName?: string; notificationType?: string }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 45,
  minWidth: 45,
  height: 45,
  borderRadius: variant === 'rounded' ? theme.spacing(1) : '50%',
  marginRight: theme.spacing(2),
  backgroundColor: variant === 'contained' 
    ? 'rgba(255, 255, 255, 0.3)' 
    : (notificationType === 'report' ? theme.palette.primary.main : theme.palette.secondary.main),
  color: variant === 'contained' ? 'white' : 'inherit',
}));

export const MessageContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
});

export const ExtraButton = styled('div')(({ theme }: { theme: Theme }) => ({
  marginLeft: 'auto',
  paddingLeft: theme.spacing(1),
}));
