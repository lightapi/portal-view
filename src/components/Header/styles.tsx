import { makeStyles } from '@mui/styles';
export default makeStyles((theme) => {
  return {
    link: {
      textDecoration: 'none',
    },
    logotype: {
      color: `${theme.palette.custom.darkBlue} !important`,
      marginLeft: theme.spacing(2.5),
      marginRight: theme.spacing(2.5),
      fontWeight: 500,
      fontSize: 18,
      whiteSpace: 'nowrap',
      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    },
    appBar: {
      width: '100vw',
      zIndex: `${theme.zIndex.drawer + 1} !important`,
      transition: theme.transitions.create(['margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      backgroundColor: `${theme.palette.custom.lightGrey} !important`,
    },
    toolbar: {
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
    },
    hide: {
      display: 'none',
    },
    grow: {
      flexGrow: 1,
    },
    search: {
      position: 'relative',
      borderRadius: 25,
      paddingLeft: theme.spacing(2.5),
      width: 36,
      // backgroundColor: Fade(theme.palette.common.black, 0),
      transition: theme.transitions.create(['background-color', 'width']),
      '&:hover': {
        cursor: 'pointer',
        // backgroundColor: Fade(theme.palette.common.black, 0.08),
      },
    },
    searchFocused: {
      // backgroundColor: Fade(theme.palette.common.black, 0.08),
      width: '100%',
      [theme.breakpoints.up('md')]: {
        width: 250,
      },
      border: '2px solid lightGrey',
      borderRadius: 4,
    },
    searchIcon: {
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
    },
    searchIconOpened: {
      right: theme.spacing(1.25),
    },
    searchBarClosed: {
      display: 'none !important',
    },
    inputRoot: {
      color: 'inherit',
      width: 'auto',
    },
    inputInput: {
      height: 36,
      padding: 0,
      paddingRight: 36 + theme.spacing(1.25),
      width: '100%',
    },
    messageContent: {
      display: 'flex',
      flexDirection: 'column',
    },
    headerMenu: {
      marginTop: theme.spacing(7),
    },
    headerMenuList: {
      display: 'flex',
      flexDirection: 'column',
    },
    headerMenuItem: {
      '&:hover, &:focus': {
        backgroundColor: theme.palette.primary.main,
        color: 'white',
      },
    },
    headerMenuButton: {
      marginLeft: theme.spacing(2),
      padding: theme.spacing(0.5),
    },
    headerMenuButtonCollapse: {
      marginRight: theme.spacing(2),
    },
    headerIcon: {
      fontSize: 28,
      color: `${theme.palette.custom.darkBlue} !important`,
    },
    headerIconCollapse: {
      color: `${theme.palette.custom.darkBlue} !important`,
    },
    profileMenu: {
      minWidth: 265,
    },
    profileMenuUser: {
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
    },
    profileMenuItem: {
      color: theme.palette.text.hint,
    },
    profileMenuIcon: {
      marginRight: theme.spacing(2),
      color: theme.palette.text.hint,
    },
    profileMenuLink: {
      fontSize: 16,
      textDecoration: 'none',
      '&:hover': {
        cursor: 'pointer',
      },
    },
    messageNotification: {
      height: 'auto',
      display: 'flex',
      alignItems: 'center',
      '&:hover, &:focus': {
        backgroundColor: theme.palette.background.light,
      },
    },
    messageNotificationSide: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginRight: theme.spacing(2),
    },
    messageNotificationBodySide: {
      alignItems: 'flex-start',
      marginRight: 0,
    },
    sendMessageButton: {
      margin: theme.spacing(4),
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
      textTransform: 'none',
    },
    sendButtonIcon: {
      marginLeft: theme.spacing(2),
    },
    table: {
      minWidth: 300,
    },
    cartImage: {
      width: '48px',
      height: '48px',
    },
    emptyCart: {
      textAlign: 'center',
    },
  };
});
