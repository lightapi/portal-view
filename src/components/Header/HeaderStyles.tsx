import { styled, alpha } from '@mui/material/styles';
import { AppBar, Toolbar, IconButton, InputBase, Box } from '@mui/material';
import { Link } from 'react-router-dom';
import { Typography } from '../Wrappers/Wrappers';

export const StyledAppBar = styled(AppBar)(({ theme }) => ({
  width: '100vw',
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  backgroundColor: (theme.palette as any).custom?.lightGrey || theme.palette.background.default,
  color: (theme.palette as any).custom?.darkBlue || theme.palette.primary.main,
}));

export const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
}));

export const StyledLink = styled(Link)({
  textDecoration: 'none',
});

export const Logotype = styled(Typography)(({ theme }) => ({
  color: (theme.palette as any).custom?.darkBlue || theme.palette.primary.main,
  marginLeft: theme.spacing(2.5),
  marginRight: theme.spacing(2.5),
  fontWeight: 500,
  fontSize: 18,
  whiteSpace: 'nowrap',
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

export const Grow = styled('div')({
  flexGrow: 1,
});

export const SearchWrapper = styled('div', {
  shouldForwardProp: (prop) => prop !== 'focused',
})<{ focused?: boolean }>(({ theme, focused }) => ({
  position: 'relative',
  borderRadius: 25,
  paddingLeft: theme.spacing(2.5),
  width: 36,
  transition: theme.transitions.create(['background-color', 'width']),
  '&:hover': {
    cursor: 'pointer',
  },
  ...(focused && {
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: 250,
    },
    border: '2px solid lightGrey',
    borderRadius: 4,
  }),
}));

export const SearchIconWrapper = styled('div', {
  shouldForwardProp: (prop) => prop !== 'opened',
})<{ opened?: boolean }>(({ theme, opened }) => ({
  width: 36,
  right: 0,
  height: '100%',
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: theme.transitions.create('right'),
  '&:hover': {
    cursor: 'pointer',
  },
  ...(opened && {
    right: theme.spacing(1.25),
  }),
}));

export const StyledInputBase = styled(InputBase, {
  shouldForwardProp: (prop) => prop !== 'closed',
})<{ closed?: boolean }>(({ theme, closed }) => ({
  color: 'inherit',
  width: 'auto',
  '& .MuiInputBase-input': {
    height: 36,
    padding: 0,
    paddingRight: 36 + theme.spacing(1.25),
    width: '100%',
  },
  ...(closed && {
    display: 'none !important',
  }),
}));

export const HeaderMenuButton = styled(IconButton)(({ theme }) => ({
  marginLeft: theme.spacing(2),
  padding: theme.spacing(0.5),
  marginRight: theme.spacing(2), // from headerMenuButtonCollapse
}));

export const HeaderIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed?: boolean }>(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 28,
  color: 'inherit',
}));
