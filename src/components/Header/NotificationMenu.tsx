import {
  Build as ManageIcon,
  NotificationsNone as NotificationsIcon,
} from "@mui/icons-material";
import {
  Fab,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Box,
} from "@mui/material"; // Import Box from MUI
import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { useUserState } from "../../contexts/UserContext";
import { useApiGet } from "../../hooks/useApiGet";
import Notification from "../Notification/Notification";
import { Badge } from "../Wrappers/Wrappers"; // Assuming Badge is still needed

export default function NotificationMenu(props) {
  var [notificationsMenu, setNotificationsMenu] = useState(null);
  var [isNotificationsUnread, setIsNotificationsUnread] = useState(true);
  // var classes = props.classes; // No more classes prop needed with sx
  const navigate = useNavigate();
  var { host, userId } = useUserState();
  const cmd = {
    host: "lightapi.net",
    service: "user",
    action: "getNotification",
    version: "0.1.0",
    data: { limit: 10, offset: 0, hostId: host, userId },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};
  const { isLoading, data, error } = useApiGet({ url, headers });

  const notificationDetail = () => {
    navigate("/app/notificationDetail", { state: { data } });
  };

  let wait;
  if (isLoading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else if (error) {
    wait = (
      <div>
        <p style={{ color: "red" }}>
          Error fetching notifications: {error.message || "Unknown error"}
        </p>
      </div>
    );
  } else if (data && data.length > 0) {
    wait = (
      <React.Fragment>
        <IconButton
          color="inherit"
          aria-haspopup="true"
          aria-controls="notifications-menu" // Corrected id to match aria-controls
          onClick={(e) => {
            setNotificationsMenu(e.currentTarget);
            setIsNotificationsUnread(false);
          }}
          sx={{
            // Using sx prop for styling
            marginRight: "10px", // Example spacing - adjust as needed
          }}
          size="large"
        >
          <Badge
            badgeContent={isNotificationsUnread ? data.length : null}
            color="warning"
          >
            <NotificationsIcon
              sx={{
                // Styling the icon with sx prop
                fontSize: "2rem", // Example icon size - adjust as needed
              }}
            />
          </Badge>
        </IconButton>
        <Menu
          id="notifications-menu"
          open={Boolean(notificationsMenu)}
          anchorEl={notificationsMenu}
          onClose={() => setNotificationsMenu(null)}
          sx={{
            // Styling the Menu with sx prop
            marginTop: "5px", // Example menu position adjustment - adjust as needed
          }}
          disableAutoFocusItem
        >
          <Fab
            variant="extended"
            color="primary"
            aria-label="Notification Detail"
            onClick={notificationDetail}
            sx={{
              // Styling the Fab with sx prop
              marginBottom: "10px", // Example spacing
              marginRight: "auto",
              marginLeft: "auto",
              display: "block",
            }}
          >
            Notification Detail
            <ManageIcon
              sx={{
                // Styling the ManageIcon within Fab with sx prop
                marginLeft: "5px", // Example icon spacing
              }}
            />
          </Fab>
          {data.map((notification, index) => (
            <MenuItem
              key={index}
              onClick={() => setNotificationsMenu(null)}
              sx={{
                // Styling the MenuItem with sx prop
                padding: "8px 16px", // Example padding
              }}
            >
              <Notification {...notification} typographyVariant="inherit" />
            </MenuItem>
          ))}
        </Menu>
      </React.Fragment>
    );
  } else {
    wait = null; // Or you can render a default state if needed when no data and no error
  }
  return <Box>{wait}</Box>; // Using Box from MUI instead of a plain div for better styling consistency if needed
}
