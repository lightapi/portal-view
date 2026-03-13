import {
  Build as ManageIcon,
  MailOutline as MailIcon,
  Send as SendIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { Fab, IconButton, Menu, MenuItem, Box, useTheme, CircularProgress } from "@mui/material";
import React, { useEffect, useState } from "react";
import fetchClient from "../../utils/fetchClient";
import { useUserState } from "../../contexts/UserContext";
import { useInterval } from "../../hooks/useInterval";
import { timeConversion } from "../../utils";
import UserAvatar from "../UserAvatar/UserAvatar";
import { Badge, Typography } from "../Wrappers/Wrappers";

export default function MailMenu(props: any) {
  const [mailMenu, setMailMenu] = useState<null | HTMLElement>(null);
  const [isMailsUnread, setIsMailsUnread] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const navigate = useNavigate();
  const { email } = useUserState();

  const cmd = {
    host: "lightapi.net",
    service: "user",
    action: "getPrivateMessage",
    version: "0.1.0",
    data: { email },
  };

  const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));

  const queryMessageFn = async (url: string) => {
    try {
      setLoading(true);
      const data = await fetchClient(url);
      setMessages(data || []);
      setLoading(false);
    } catch (e) {
      console.log(e);
      setMessages([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    queryMessageFn(url);
  }, []);

  useInterval(() => {
    queryMessageFn(url);
  }, 600000);

  const sendMessage = () => {
    navigate("/app/form/privateMessage");
  };

  const manageMessages = () => {
    navigate("/app/messages", {
      state: { data: messages },
    });
  };

  let wait;
  if (loading) {
    wait = (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress />
      </Box>
    );
  } else {
    wait = (
      <>
        <IconButton
          color="inherit"
          aria-haspopup="true"
          aria-controls="mail-menu"
          onClick={(e) => {
            setMailMenu(e.currentTarget);
            setIsMailsUnread(false);
          }}
          sx={{ ml: 2, p: 0.5 }}
          size="large"
        >
          <Badge
            badgeContent={isMailsUnread ? messages.length : null}
            color="secondary"
          >
            <MailIcon sx={{ fontSize: 28, color: (theme.palette as any).custom?.darkBlue }} />
          </Badge>
        </IconButton>
        <Menu
          id="mail-menu"
          open={Boolean(mailMenu)}
          anchorEl={mailMenu}
          onClose={() => setMailMenu(null)}
          sx={{ mt: 7 }}
          PaperProps={{ sx: { minWidth: 265 } }}
          disableAutoFocusItem
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
            <Typography variant="h4" weight="medium">
              New Messages
            </Typography>
            <Typography
              component="a"
              color="secondary"
              sx={{ fontSize: 16, textDecoration: 'none', cursor: 'pointer' }}
            >
              {messages.length} New Messages
            </Typography>
          </Box>
          {messages.map((message, index) => (
            <MenuItem key={index} sx={{
              height: 'auto',
              display: 'flex',
              alignItems: 'center',
              '&:hover, &:focus': {
                backgroundColor: (theme.palette as any).background.light,
              },
            }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2 }}>
                <UserAvatar color="primary" name={message.fromId} />
                <Typography size="sm" color="text" colorBrightness="secondary">
                  {timeConversion(new Date().getTime() - message.timestamp)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography weight="medium" gutterBottom>
                  {message.fromId} - {message.subject}
                </Typography>
                <Typography color="text" colorBrightness="secondary">
                  {message.content}
                </Typography>
              </Box>
            </MenuItem>
          ))}
          <Box sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
            <Fab
              variant="extended"
              color="primary"
              aria-label="Add"
              onClick={sendMessage}
              sx={{ mb: 2, textTransform: 'none' }}
            >
              Send New Message
              <SendIcon sx={{ ml: 2 }} />
            </Fab>
            <Fab
              variant="extended"
              color="primary"
              aria-label="Add"
              onClick={manageMessages}
              sx={{ mb: 2, textTransform: 'none' }}
            >
              Manage Messages
              <ManageIcon sx={{ ml: 2 }} />
            </Fab>
          </Box>
        </Menu>
      </>
    );
  }
  return <div>{wait}</div>;
}
