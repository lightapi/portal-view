import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

interface StyledProps {
  variant?: "contained" | "rounded";
  shadowless?: boolean;
  colorName?: string;
  notificationType?: string;
}

export const NotificationRoot = styled(Box, {
  shouldForwardProp: (prop) => !['variant', 'shadowless', 'colorName', 'notificationType'].includes(prop as string),
})<StyledProps>(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2),
  width: '100%',
}));

export const IconContainer = styled(Box, {
  shouldForwardProp: (prop) => !['variant', 'colorName', 'notificationType'].includes(prop as string),
})<StyledProps>(({ theme, notificationType }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  minWidth: 40,
  height: 40,
  borderRadius: '50%',
  marginRight: theme.spacing(2),
  backgroundColor: notificationType === 'report' ? theme.palette.primary.main : theme.palette.secondary.main,
  color: 'white',
}));

export const MessageContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
});

export const ExtraButton = styled('div')(({ theme }) => ({
  marginLeft: 'auto',
  paddingLeft: theme.spacing(1),
}));
