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
  overflowY: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  overflowY: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: theme.spacing(11),
  [theme.breakpoints.down('md')]: {
    width: drawerWidth,
  },
});

export const StyledDrawer = styled(MuiDrawer, { shouldForwardProp: (prop: string) => prop !== 'open' })(
  ({ theme, open }: { theme: Theme; open?: boolean }) => ({
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

export const DrawerToolbar = styled('div')(({ theme }: { theme: Theme }) => ({
  ...theme.mixins.toolbar,
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}));

export const MobileBackButtonWrapper = styled('div')(({ theme }: { theme: Theme }) => ({
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
  shouldForwardProp: (prop: string) => prop !== 'collapse',
})<HeaderIconProps>(({ collapse }: { collapse?: boolean }) => ({
  color: collapse ? 'white' : 'rgba(255, 255, 255, 0.35)',
}));

export const SidebarTopSection = styled(Box)(({ theme }: { theme: Theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  background: `linear-gradient(135deg, ${(theme.palette as any).custom?.darkBlue || theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
  color: '#fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
  position: 'relative',
  zIndex: 1,
}));

export const SidebarListWrapper = styled(Box)(() => ({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
}));

export const SidebarFooter = styled(Box)(({ theme }: { theme: Theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: (theme.palette as any).custom?.lightGrey || theme.palette.background.default,
  color: (theme.palette as any).custom?.darkBlue || theme.palette.primary.main,
  padding: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
}));
