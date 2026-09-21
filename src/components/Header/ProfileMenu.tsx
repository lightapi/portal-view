import { useState } from "react";
import { Person as AccountIcon } from "@mui/icons-material";
import { IconButton, Menu, MenuItem, ListSubheader } from "@mui/material";
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
import { hasAnyRole } from "../../utils/ownershipScope";
import { isSsoEnabled } from "../../../config";
import { signIn } from "../../utils/signIn";
import { ActionDisplayToggle } from '../PortalActions/ActionDisplayToggle';

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

  const handleSignIn = () => signIn(msalInstance);

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
        aria-label="Account menu"
        aria-expanded={Boolean(profileMenu)}
        aria-controls={profileMenu ? 'profile-menu' : undefined}
        onClick={(e: React.MouseEvent<HTMLElement>) => setProfileMenu(e.currentTarget)}
        size="large"
        sx={{ ml: 0, p: 0.5 }}
      >
        <AccountIcon sx={{ fontSize: 28, color: (theme.palette as any).custom?.darkBlue }} />
      </IconButton>
      <Menu
        id="profile-menu"
        open={Boolean(profileMenu)}
        anchorEl={profileMenu}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{}}
        PaperProps={{ sx: { minWidth: 265 } }}
      >
        {isAuthenticated && (<ListSubheader>{email}</ListSubheader>)}
        {isAuthenticated && (<MenuItem
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
            </MenuItem>)}
        {isAuthenticated && (<MenuItem
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
            </MenuItem>)}
        {isAuthenticated && (hasAnyRole(roles, ["admin", "host-admin"]) && (
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
            ))}
        {isAuthenticated && (<MenuItem
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
            </MenuItem>)}
        {isAuthenticated && (<MenuItem
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
            </MenuItem>)}
        {isAuthenticated && (<MenuItem
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
            </MenuItem>)}
        {isAuthenticated && (<MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Tasks
            </MenuItem>)}
        {isAuthenticated && (<MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Messages
            </MenuItem>)}
        {isAuthenticated && (<MenuItem
              sx={{
                color: 'text.hint',
                '&:hover, &:focus': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
            >
              <AccountIcon sx={{ mr: 2, color: 'text.hint' }} /> Notifications
            </MenuItem>)}
        {isAuthenticated && (<MenuItem onClick={() => handleMenuItemClick(changePassword)}>Change Password</MenuItem>)}
        {isAuthenticated && (<MenuItem onClick={() => handleMenuItemClick(signOut, msalInstance)}>Sign Out</MenuItem>)}
        {!isAuthenticated && (<MenuItem onClick={handleSignIn}>Sign In</MenuItem>)}
        {!isAuthenticated && (<MenuItem onClick={() => handleMenuItemClick(signUp)}>Sign Up</MenuItem>)}
        <ActionDisplayToggle />
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
