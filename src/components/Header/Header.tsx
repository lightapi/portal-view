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
import {
  StyledAppBar,
  StyledToolbar,
  HeaderMenuButton,
  HeaderIcon,
  StyledLink,
  Logotype,
  Grow,
  SearchWrapper,
  SearchIconWrapper,
  StyledInputBase
} from "./HeaderStyles";
import { apiPost } from "../../api/apiPost";

export default function Header(props: any) {
  // global
  var layoutState: any = useLayoutState();
  var layoutDispatch: any = useLayoutDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // local
  var [isSearchOpen, setSearchOpen] = useState(false);
  var { isAuthenticated, host } = useUserState();
  var [domain, setDomain] = useState<string | null>(null);
  var [subDomain, setSubDomain] = useState<string | null>(null);

  var siteDispatch: any = useSiteDispatch();
  const changeFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          }
        })
        .catch(error => {
          console.error("Error during apiPost:", error);
        });
    }
  }, [isAuthenticated, host]);

  const apiPortalText = domain
    ? subDomain
      ? `${subDomain}.${domain} portal`
      : `${domain} portal`
    : "API Portal";
    
  return (
    <StyledAppBar position="fixed">
      <StyledToolbar>
        <HeaderMenuButton
          color="inherit"
          onClick={() => toggleSidebar(layoutDispatch)}
          size="large"
        >
          {layoutState?.isSidebarOpened ? (
            <HeaderIcon as={ArrowBackIcon} />
          ) : (
            <HeaderIcon as={MenuIcon} />
          )}
        </HeaderMenuButton>
        <StyledLink to="/app/dashboard">
          <Logotype variant="h6" weight="medium" size={undefined} colorBrightness={undefined} color={undefined}>
            {apiPortalText}
          </Logotype>
        </StyledLink>
        <Grow />
        <SearchWrapper focused={isSearchOpen}>
          <SearchIconWrapper
            opened={isSearchOpen}
            onClick={() => setSearchOpen(!isSearchOpen)}
          >
            <HeaderIcon as={SearchIcon} />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="Search…"
            onChange={changeFilter}
            closed={!isSearchOpen}
          />
        </SearchWrapper>
        {location.pathname.startsWith("/app/website") ? (
          <HomeMenu {...props} />
        ) : null}
        {location.pathname.startsWith("/app/website") ? (
          <CartMenu {...props} />
        ) : null}
        {isAuthenticated ? (
          <NotificationMenu {...props} />
        ) : null}
        {isAuthenticated ? <MailMenu {...props} /> : null}
        <ProfileMenu />
      </StyledToolbar>
    </StyledAppBar>
  );
}
