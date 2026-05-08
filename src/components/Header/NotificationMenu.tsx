import {
  Build as ManageIcon,
  NotificationsNone as NotificationsIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserState } from '../../contexts/UserContext';
import { useInterval } from '../../hooks/useInterval';
import fetchClient from '../../utils/fetchClient';
import { Badge } from '../Wrappers/Wrappers';

type CountResponse = {
  count?: number;
};

const NOTIFICATION_FAILURES_READ_EVENT = 'portal:notification-failures-read';

const buildQueryUrl = (action: string, data: Record<string, unknown>) => {
  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action,
    version: '0.1.0',
    data,
  };

  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
};

export default function NotificationMenu({ openAbove = false }: { openAbove?: boolean }) {
  const [notificationsMenu, setNotificationsMenu] = useState<null | HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuUnreadCount, setMenuUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const hasLoadedCountRef = useRef(false);
  const navigate = useNavigate();
  const theme = useTheme();
  const { host, userId } = useUserState();

  const queryUnreadCount = useCallback(async () => {
    if (!host || !userId) {
      setUnreadCount(0);
      setIsLoading(false);
      hasLoadedCountRef.current = false;
      return;
    }

    const isInitialLoad = !hasLoadedCountRef.current;
    try {
      if (isInitialLoad) setIsLoading(true);
      const response = await fetchClient(buildQueryUrl('getUnreadNotificationCount', { hostId: host, userId })) as CountResponse;
      setUnreadCount(Number(response.count || 0));
      setIsError(false);
    } catch (error) {
      setUnreadCount(0);
      setIsError(true);
      console.error(error);
    } finally {
      hasLoadedCountRef.current = true;
      setIsLoading(false);
    }
  }, [host, userId]);

  const markFailuresRead = useCallback(async () => {
    if (!host || !userId) return;

    try {
      await fetchClient(buildQueryUrl('markFailureNotificationsRead', { hostId: host, userId }));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent(NOTIFICATION_FAILURES_READ_EVENT));
    } catch (error) {
      console.error(error);
    }
  }, [host, userId]);

  useEffect(() => {
    hasLoadedCountRef.current = false;
    setUnreadCount(0);
    setMenuUnreadCount(0);
    setIsError(false);
  }, [host, userId]);

  useEffect(() => {
    queryUnreadCount();
  }, [queryUnreadCount]);

  useInterval(() => {
    queryUnreadCount();
  }, host && userId ? 60000 : null);

  useEffect(() => {
    const handleFailuresRead = () => {
      setUnreadCount(0);
      setMenuUnreadCount(0);
    };

    window.addEventListener(NOTIFICATION_FAILURES_READ_EVENT, handleFailuresRead);
    return () => window.removeEventListener(NOTIFICATION_FAILURES_READ_EVENT, handleFailuresRead);
  }, []);

  const openMenu = (event: MouseEvent<HTMLElement>) => {
    setNotificationsMenu(event.currentTarget);
    setMenuUnreadCount(unreadCount);
    if (unreadCount > 0) {
      markFailuresRead();
    }
  };

  const closeMenu = () => {
    setNotificationsMenu(null);
  };

  const openNotificationPage = () => {
    closeMenu();
    navigate('/app/notification');
  };

  return (
    <Box>
      <IconButton
        color="inherit"
        aria-haspopup="true"
        aria-controls="notifications-menu"
        onClick={openMenu}
        sx={{ ml: 1, p: 0.5 }}
        size="large"
      >
        <Badge
          badgeContent={unreadCount > 0 ? unreadCount : null}
          color="error"
        >
          {isLoading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <NotificationsIcon
              sx={{
                color: unreadCount > 0 ? theme.palette.error.main : (theme.palette as any).custom?.darkBlue,
                fontSize: 28,
              }}
            />
          )}
        </Badge>
      </IconButton>
      <Menu
        id="notifications-menu"
        open={Boolean(notificationsMenu)}
        anchorEl={notificationsMenu}
        onClose={closeMenu}
        anchorOrigin={openAbove ? { vertical: 'top', horizontal: 'left' } : { vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={openAbove ? { vertical: 'bottom', horizontal: 'left' } : { vertical: 'top', horizontal: 'left' }}
        sx={openAbove ? {} : { mt: 7 }}
        PaperProps={{ sx: { minWidth: 280 } }}
        disableAutoFocusItem
      >
        <Box sx={{ display: 'grid', gap: 1, p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Notifications
          </Typography>
          <Typography color={menuUnreadCount > 0 ? 'error' : 'text.secondary'} variant="body2">
            {menuUnreadCount > 0
              ? `${menuUnreadCount} unread failure${menuUnreadCount === 1 ? '' : 's'}`
              : 'No unread failures'}
          </Typography>
          {isError ? (
            <Typography color="error" variant="body2">
              Unable to load notification count
            </Typography>
          ) : null}
        </Box>
        <MenuItem disableRipple sx={{ '&:hover': { backgroundColor: 'transparent' } }}>
          <Button
            fullWidth
            onClick={openNotificationPage}
            startIcon={<ManageIcon />}
            variant="contained"
            sx={{ textTransform: 'none' }}
          >
            Open Notifications
          </Button>
        </MenuItem>
      </Menu>
    </Box>
  );
}
