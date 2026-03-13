import { styled } from '@mui/material/styles';

export const LayoutRoot = styled('div')(({ theme }) => ({
  display: 'flex',
  maxWidth: '100vw',
  overflowX: 'hidden',
}));

export const MainContent = styled('main')(({ theme }) => ({
  flexGrow: 1,
  width: `calc(100vw - 240px)`,
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
}));

export const FakeToolbar = styled('div')(({ theme }) => ({
  ...theme.mixins.toolbar,
}));
