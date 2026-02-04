import { useState } from "react";
import { Person as AccountIcon } from "@mui/icons-material";
import { IconButton, Menu, MenuItem, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import classNames from "classnames";
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

export default function ProfileMenu({ classes }) {
  const [profileMenu, setProfileMenu] = useState(null);
  const userDispatch = useUserDispatch();
  const { isAuthenticated, userId, roles } = useUserState();
  const navigate = useNavigate();

  const signIn = () => {
    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('portal_auth_state', state);

    const defaultUrl =
      `https://locsignin.lightapi.net?client_id=f7d42348-c647-4efb-a52d-4c5787421e72&user_type=customer&state=${state}`;
    const signInUrl = import.meta.env.VITE_SIGNIN_URL
      ? `${import.meta.env.VITE_SIGNIN_URL}&user_type=customer&state=${state}`
      : defaultUrl;
    window.location.href = signInUrl;
  };

  const handleMenuClose = () => {
    setProfileMenu(null);
  };

  const handleMenuItemClick = (action) => {
    action(userDispatch, navigate, userId);
    handleMenuClose();
  };

  return (
    <>
      <IconButton
        aria-haspopup="true"
        color="inherit"
        className={classes.headerMenuButton}
        aria-controls="profile-menu"
        onClick={(e) => setProfileMenu(e.currentTarget)}
        size="large"
      >
        <AccountIcon classes={{ root: classes.headerIcon }} />
      </IconButton>
      <Menu
        id="profile-menu"
        open={Boolean(profileMenu)}
        anchorEl={profileMenu}
        onClose={handleMenuClose}
        className={classes.headerMenu}
        classes={{ paper: classes.profileMenu }}
        disableAutoFocusItem
      >
        {isAuthenticated ? (
          <div>
            <div className={classes.profileMenuUser}>
              <Typography variant="h6" fontWeight="medium">
                {userId}
              </Typography>
            </div>
            <MenuItem
              className={classNames(
                classes.profileMenuItem,
                classes.headerMenuItem,
              )}
              onClick={() => handleMenuItemClick(getProfile)}
            >
              <AccountIcon className={classes.profileMenuIcon} /> Profile
            </MenuItem>
            <MenuItem
              className={classNames(
                classes.profileMenuItem,
                classes.headerMenuItem,
              )}
              onClick={() => handleMenuItemClick(getPayment)}
            >
              <AccountIcon className={classes.profileMenuIcon} /> Payment
            </MenuItem>
            {roles.includes("admin") && (
              <MenuItem
                className={classNames(
                  classes.profileMenuItem,
                  classes.headerMenuItem,
                )}
                onClick={() => handleMenuItemClick(updateRoles)}
              >
                <AccountIcon className={classes.profileMenuIcon} /> Update Roles
              </MenuItem>
            )}
            <MenuItem
              className={classNames(
                classes.profileMenuItem,
                classes.headerMenuItem,
              )}
              onClick={() => handleMenuItemClick(getOrders)}
            >
              <AccountIcon className={classes.profileMenuIcon} /> Orders
            </MenuItem>
            <MenuItem
              className={classNames(
                classes.profileMenuItem,
                classes.headerMenuItem,
              )}
              onClick={() => handleMenuItemClick(userHost)}
            >
              <AccountIcon className={classes.profileMenuIcon} /> Switch Host
            </MenuItem>
            <MenuItem
              className={classNames(
                classes.profileMenuItem,
                classes.headerMenuItem,
              )}
              onClick={() => handleMenuItemClick(createOrg)}
            >
              <AccountIcon className={classes.profileMenuIcon} /> Claim Org
            </MenuItem>
            <MenuItem
              className={classNames(
                classes.profileMenuItem,
                classes.headerMenuItem,
              )}
            >
              <AccountIcon className={classes.profileMenuIcon} /> Tasks
            </MenuItem>
            <MenuItem
              className={classNames(
                classes.profileMenuItem,
                classes.headerMenuItem,
              )}
            >
              <AccountIcon className={classes.profileMenuIcon} /> Messages
            </MenuItem>
            <MenuItem
              className={classNames(
                classes.profileMenuItem,
                classes.headerMenuItem,
              )}
            >
              <AccountIcon className={classes.profileMenuIcon} /> Notifications
            </MenuItem>
            <div className={classes.profileMenuUser}>
              <Typography
                className={classes.profileMenuLink}
                color="primary"
                onClick={() => handleMenuItemClick(changePassword)}
              >
                Change Password
              </Typography>
            </div>
            <div className={classes.profileMenuUser}>
              <Typography
                className={classes.profileMenuLink}
                color="primary"
                onClick={() => handleMenuItemClick(signOut)}
              >
                Sign Out
              </Typography>
            </div>
          </div>
        ) : (
          <div>
            <div className={classes.profileMenuUser}>
              <Typography
                className={classes.profileMenuLink}
                color="primary"
                onClick={signIn}
              >
                Sign In
              </Typography>
            </div>
            <div className={classes.profileMenuUser}>
              <Typography
                className={classes.profileMenuLink}
                color="primary"
                onClick={() => handleMenuItemClick(signUp)}
              >
                Sign Up
              </Typography>
            </div>
          </div>
        )}
      </Menu>
    </>
  );
}
