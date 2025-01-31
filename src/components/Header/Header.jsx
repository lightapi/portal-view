import {
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { AppBar, IconButton, InputBase, Toolbar } from "@mui/material";
import classNames from "classnames";
import { useState, useEffect } from "react";
// router
import { Link, useNavigate, useLocation } from "react-router-dom";
// context
import {
  toggleSidebar,
  useLayoutDispatch,
  useLayoutState,
} from "../../contexts/LayoutContext";
import { useSiteDispatch } from "../../contexts/SiteContext";
import { useUserState } from "../../contexts/UserContext";
// components
import { Typography } from "../Wrappers/Wrappers";
import CartMenu from "./CartMenu";
import HomeMenu from "./HomeMenu";
import MailMenu from "./MailMenu";
import NotificationMenu from "./NotificationMenu";
import ProfileMenu from "./ProfileMenu";
// styles
import useStyles from "./styles";
import { apiPost } from "../../api/apiPost";

export default function Header(props) {
  // const theme = useTheme();
  const classes = useStyles();

  // global
  var layoutState = useLayoutState();
  var layoutDispatch = useLayoutDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // local
  var [isSearchOpen, setSearchOpen] = useState(false);
  var { isAuthenticated, host } = useUserState();
  var [domain, setDomain] = useState(null);
  var [subDomain, setSubDomain] = useState(null);

  var siteDispatch = useSiteDispatch();
  const changeFilter = (e) => {
    siteDispatch({ type: "UPDATE_FILTER", filter: e.target.value });
  };

  // Fetch host domain and subdomain after login
  useEffect(() => {
    if (isAuthenticated && host) {
      const cmd = {
        host: "lightapi.net",
        service: "host",
        action: "getHostById",
        version: "0.1.0",
        data: { hostId: host },
      };

      const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
      const headers = {};

      // Use apiPost directly
      apiPost({ url, headers, body: cmd })
        .then(result => {
          if (result.data) {
            setDomain(result.data.domain);
            if (result.data.subDomain) {
              setSubDomain(result.data.subDomain);
            }
          } else if (result.error) {
            console.error("Error fetching host info:", result.error);
            // Handle error appropriately, e.g., display error message to user
          }
        })
        .catch(error => {
          console.error("Error during apiPost:", error);
          // Handle network errors or exceptions during the API call
        });
    }
  }, [isAuthenticated, host]); // Dependency on isAuthenticated and host to trigger effect after login

  const apiPortalText = domain
    ? subDomain
      ? `${subDomain}.${domain} portal` // Concatenate subdomain.domain if both exist
      : `${domain} portal`             // Use just domain if subdomain is missing
    : "API Portal";  
  return (
    <AppBar position="fixed" className={classes.appBar}>
      <Toolbar className={classes.toolbar}>
        <IconButton
          color="inherit"
          onClick={() => toggleSidebar(layoutDispatch)}
          className={classNames(
            classes.headerMenuButton,
            classes.headerMenuButtonCollapse,
          )}
          size="large"
        >
          {layoutState.isSidebarOpened ? (
            <ArrowBackIcon
              classes={{
                root: classNames(
                  classes.headerIcon,
                  classes.headerIconCollapse,
                ),
              }}
            />
          ) : (
            <MenuIcon
              classes={{
                root: classNames(
                  classes.headerIcon,
                  classes.headerIconCollapse,
                ),
              }}
            />
          )}
        </IconButton>
        <Link to="/app/dashboard" className={classes.link}>
          <Typography variant="h6" weight="medium" className={classes.logotype}>
            {apiPortalText}
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
            className={classNames({
              [classes.searchBarClosed]: !isSearchOpen,
            })}
          />
        </div>
        {location.pathname.startsWith("/app/website") ? (
          <HomeMenu {...props} classes={classes} />
        ) : null}
        {location.pathname.startsWith("/app/website") ? (
          <CartMenu {...props} classes={classes} />
        ) : null}
        {isAuthenticated ? (
          <NotificationMenu {...props} classes={classes} />
        ) : null}
        {isAuthenticated ? <MailMenu {...props} classes={classes} /> : null}
        <ProfileMenu classes={classes} navigate={navigate} />
      </Toolbar>
    </AppBar>
  );
}
