import { styled, Theme, CSSObject } from '@mui/material/styles';
import { Drawer as MuiDrawer, Box, IconButton } from '@mui/material';

const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: theme.spacing(11),
  [theme.breakpoints.down('md')]: {
    width: drawerWidth,
  },
});

export const StyledDrawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

export const DrawerToolbar = styled('div')(({ theme }) => ({
  ...theme.mixins.toolbar,
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}));

export const MobileBackButtonWrapper = styled('div')(({ theme }) => ({
  marginTop: theme.spacing(0.5),
  marginLeft: theme.spacing(3),
  [theme.breakpoints.only('sm')]: {
    marginTop: theme.spacing(0.625),
  },
  [theme.breakpoints.up('md')]: {
    display: 'none',
  },
}));

interface HeaderIconProps {
  collapse?: boolean;
}

export const SidebarIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'collapse',
})<HeaderIconProps>(({ collapse }) => ({
  color: collapse ? 'white' : 'rgba(255, 255, 255, 0.35)',
}));

export const SidebarListWrapper = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(6),
}));
