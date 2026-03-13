import { styled, Theme } from '@mui/material/styles';

export const LayoutRoot = styled('div')(({ theme }: { theme: Theme }) => ({
  display: 'flex',
  maxWidth: '100vw',
  overflowX: 'hidden',
}));

export const MainContent = styled('main', {
  shouldForwardProp: (prop: string) => prop !== 'open',
})<{ open?: boolean }>(({ theme, open }: { theme: Theme; open?: boolean }) => ({
  flexGrow: 1,
  width: open ? `calc(100vw - 240px)` : '100vw',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}));

export const FakeToolbar = styled('div')(({ theme }: { theme: Theme }) => ({
  ...theme.mixins.toolbar,
}));
