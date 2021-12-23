import {
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { AppBar, IconButton, InputBase, Toolbar } from '@mui/material';
import classNames from 'classnames';
import React, { useState } from 'react';
// router
import { Link } from 'react-router-dom';
// context
import {
  toggleSidebar,
  useLayoutDispatch,
  useLayoutState,
} from '../../context/LayoutContext';
import { useSiteDispatch } from '../../context/SiteContext';
import { useUserState } from '../../context/UserContext';
// components
import { Typography } from '../Wrappers/Wrappers';
import CartMenu from './CartMenu';
import HomeMenu from './HomeMenu';
import MailMenu from './MailMenu';
import NotificationMenu from './NotificationMenu';
import ProfileMenu from './ProfileMenu';
// styles
import useStyles from './styles';

export default function Header(props) {
  console.log('In Header.js 000 props= ', props);

  // const theme = useTheme();
  const classes = useStyles();

  // global
  var layoutState = useLayoutState();
  var layoutDispatch = useLayoutDispatch();

  // local
  var [isSearchOpen, setSearchOpen] = useState(false);
  var { isAuthenticated } = useUserState();

  var siteDispatch = useSiteDispatch();
  const changeFilter = (e) => {
    siteDispatch({ type: 'UPDATE_FILTER', filter: e.target.value });
  };

  return (
    <AppBar position="fixed" className={classes.appBar}>
      <Toolbar className={classes.toolbar}>
        <IconButton
          color="inherit"
          onClick={() => toggleSidebar(layoutDispatch)}
          className={classNames(
            classes.headerMenuButton,
            classes.headerMenuButtonCollapse
          )}
        >
          {layoutState.isSidebarOpened ? (
            <ArrowBackIcon
              classes={{
                root: classNames(
                  classes.headerIcon,
                  classes.headerIconCollapse
                ),
              }}
            />
          ) : (
            <MenuIcon
              classes={{
                root: classNames(
                  classes.headerIcon,
                  classes.headerIconCollapse
                ),
              }}
            />
          )}
        </IconButton>
        <Link to="/app/dashboard" className={classes.link}>
          <Typography variant="h6" weight="medium" className={classes.logotype}>
            API Portal
          </Typography>
        </Link>
        <div className={classes.grow} />
        <div
          className={classNames(classes.search, {
            [classes.searchFocused]: isSearchOpen,
          })}
        >
          <div
            className={classNames(classes.searchIcon, {
              [classes.searchIconOpened]: isSearchOpen,
            })}
            onClick={() => setSearchOpen(!isSearchOpen)}
          >
            <SearchIcon classes={{ root: classes.headerIcon }} />
          </div>
          <InputBase
            placeholder="Search…"
            onChange={changeFilter}
            classes={{
              root: classes.inputRoot,
              input: classes.inputInput,
            }}
          />
        </div>
        {props.history.location.pathname.startsWith('/app/website') ? (
          <HomeMenu {...props} classes={classes} />
        ) : null}
        {props.history.location.pathname.startsWith('/app/website') ? (
          <CartMenu {...props} classes={classes} />
        ) : null}
        {isAuthenticated ? (
          <NotificationMenu {...props} classes={classes} />
        ) : null}
        {isAuthenticated ? <MailMenu {...props} classes={classes} /> : null}
        <ProfileMenu classes={classes} history={props.history} />
      </Toolbar>
    </AppBar>
  );
}
