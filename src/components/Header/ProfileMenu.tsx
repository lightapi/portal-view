import { useState } from "react";
import { Person as AccountIcon } from "@mui/icons-material";
import { IconButton, Menu, MenuItem, Typography, Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import type { IPublicClientApplication } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import {
  changePassword,
  getOrders,
  getPayment,
  getProfile,
  userHost,
  createOrg,
  signOut,
  signUp,
  updateRoles,
  useUserDispatch,
  useUserState,
} from "../../contexts/UserContext";
import { config, isSsoEnabled } from "../../../config";
import { loginRequest } from "../../authConfig";

function ProfileMenuContent({
  msalInstance,
}: {
  msalInstance?: IPublicClientApplication;
}) {
  const theme = useTheme();
  const [profileMenu, setProfileMenu] = useState<null | HTMLElement>(null);
  const userDispatch = useUserDispatch();
  const { isAuthenticated, userId, email, roles } = useUserState();
  const navigate = useNavigate();

  const signIn = async () => {
    if (isSsoEnabled) {
      if (!msalInstance) {
        console.error("MSAL instance unavailable while SSO is enabled");
        return;
      }

      const normalizedBasePath =
        config.basePath && config.basePath !== "/"
          ? config.basePath.replace(/\/$/, "")
          : "";
      const msalRedirectUri =
        config.redirectUri ||
        `${window.location.origin}${normalizedBasePath}/redirect`;

      try {
        await msalInstance.loginRedirect({
          ...loginRequest,
          redirectUri: msalRedirectUri,
        });
        return;
      } catch (error) {
        console.error("Login error:", error);
        return;
      }
    }

    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem("portal_auth_state", state);

    const defaultUrl = `https://locsignin.lightapi.net?client_id=f7d42348-c647-4efb-a52d-4c5787421e72&user_type=C&state=${state}`;
    const signInUrl = config.signInUrl
      ? `${config.signInUrl}&user_type=C&state=${state}`
      : defaultUrl;
    window.location.href = signInUrl;
  };

  const handleMenuClose = () => {
    setProfileMenu(null);
  };

  const handleMenuItemClick = (action: any, ...extraArgs: any[]) => {
    action(userDispatch, navigate, userId, ...extraArgs);
    handleMenuClose();
  };

  return (
    <>
      <IconButton
        aria-haspopup="true"
        color="inherit"
        aria-controls="profile-menu"
        onClick={(e: React.MouseEvent<HTMLElement>) => setProfileMenu(e.currentTarget)}
        size="large"
        sx={{ ml: 2, p: 0.5 }}
      >
        <AccountIcon sx={{ fontSize: 28, color: (theme.palette as any).custom?.darkBlue }} />
      </IconButton>
      <Menu
        id="profile-menu"
        open={Boolean(profileMenu)}
        anchorEl={profileMenu}
        onClose={handleMenuClose}
        sx={{ mt: 7 }}
        PaperProps={{ sx: { minWidth: 265 } }}
        disableAutoFocusItem
      >
        {isAuthenticated ? (
          <div>
            <Box sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
              <Typography variant="h6" fontWeight="medium">
                {email}
              </Typography>
            </Box>
            <MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
              onClick={() => handleMenuItemClick(getProfile)}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Profile
            </MenuItem>
            <MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
              onClick={() => handleMenuItemClick(getPayment)}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Payment
            </MenuItem>
            {roles?.includes("admin") && (
              <MenuItem
                sx={{
                  color: 'text.hint',
                  '&:hover, &:focus': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                  },
                }}
                onClick={() => handleMenuItemClick(updateRoles)}
              >
                <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Update Roles
              </MenuItem>
            )}
            <MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
              onClick={() => handleMenuItemClick(getOrders)}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Orders
            </MenuItem>
            <MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
              onClick={() => handleMenuItemClick(userHost)}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Switch Host
            </MenuItem>
            <MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
              onClick={() => handleMenuItemClick(createOrg)}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Claim Org
            </MenuItem>
            <MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Tasks
            </MenuItem>
            <MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Messages
            </MenuItem>
            <MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Notifications
            </MenuItem>
            <Box sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
              <Typography
                sx={{ fontSize: 16, textDecoration: 'none', cursor: 'pointer' }}
                color="primary"
                onClick={() => handleMenuItemClick(changePassword)}
              >
                Change Password
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
              <Typography
                sx={{ fontSize: 16, textDecoration: 'none', cursor: 'pointer' }}
                color="primary"
                onClick={() => handleMenuItemClick(signOut, msalInstance)}
              >
                Sign Out
              </Typography>
            </Box>
          </div>
        ) : (
          <div>
            <Box sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
              <Typography
                sx={{ fontSize: 16, textDecoration: 'none', cursor: 'pointer' }}
                color="primary"
                onClick={signIn}
              >
                Sign In
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
              <Typography
                sx={{ fontSize: 16, textDecoration: 'none', cursor: 'pointer' }}
                color="primary"
                onClick={() => handleMenuItemClick(signUp)}
              >
                Sign Up
              </Typography>
            </Box>
          </div>
        )}
      </Menu>
    </>
  );
}

function ProfileMenuWithMsal() {
  const { instance } = useMsal();
  return <ProfileMenuContent msalInstance={instance} />;
}

export default function ProfileMenu() {
  return isSsoEnabled ? <ProfileMenuWithMsal /> : <ProfileMenuContent />;
}
