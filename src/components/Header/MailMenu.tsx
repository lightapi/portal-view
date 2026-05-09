import {
  Build as ManageIcon,
  MailOutline as MailIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  Typography,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserState } from '../../contexts/UserContext';
import { useInterval } from '../../hooks/useInterval';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';
import fetchClient from '../../utils/fetchClient';
import {
  buildPrivateMessageQueryUrl,
  displayPrivateUserLabel,
  privateMessageElapsedMs,
  PRIVATE_MESSAGES_CHANGED_EVENT,
  type PrivateConversation,
  type PrivateConversationListResponse,
  type PrivateMessageCountResponse,
} from '../../utils/privateMessages';
import { timeConversion } from '../../utils';
import UserAvatar from '../UserAvatar/UserAvatar';
import { Badge } from '../Wrappers/Wrappers';

const RECENT_CONVERSATION_LIMIT = 5;

export default function MailMenu({ openAbove = false }: { openAbove?: boolean }) {
  const [mailMenu, setMailMenu] = useState<null | HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuUnreadCount, setMenuUnreadCount] = useState(0);
  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isError, setIsError] = useState(false);
  const hasLoadedCountRef = useRef(false);
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { host, userId } = useUserState();
  const taskContext = useMemo(
    () => mergeTaskContext(
      contextFromSearchParams(searchParams),
      { userId: userId ?? '', accountSection: 'messages' },
    ),
    [searchParams, userId],
  );

  const queryUnreadCount = useCallback(async () => {
    if (!host || !userId) {
      setUnreadCount(0);
      setIsLoadingCount(false);
      hasLoadedCountRef.current = false;
      return;
    }

    const isInitialLoad = !hasLoadedCountRef.current;
    try {
      if (isInitialLoad) setIsLoadingCount(true);
      const response = await fetchClient(buildPrivateMessageQueryUrl('getUnreadPrivateMessageCount', { hostId: host, userId })) as PrivateMessageCountResponse;
      setUnreadCount(Number(response.count || 0));
      setIsError(false);
    } catch (error) {
      setUnreadCount(0);
      setIsError(true);
      console.error(error);
    } finally {
      hasLoadedCountRef.current = true;
      setIsLoadingCount(false);
    }
  }, [host, userId]);

  const loadRecentConversations = useCallback(async () => {
    if (!host || !userId) {
      setConversations([]);
      return;
    }

    try {
      setIsLoadingConversations(true);
      const response = await fetchClient(buildPrivateMessageQueryUrl('getPrivateConversations', {
        hostId: host,
        userId,
        offset: 0,
        limit: RECENT_CONVERSATION_LIMIT,
      })) as PrivateConversationListResponse;
      setConversations(Array.isArray(response.conversations) ? response.conversations : []);
      setIsError(false);
    } catch (error) {
      setConversations([]);
      setIsError(true);
      console.error(error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [host, userId]);

  useEffect(() => {
    hasLoadedCountRef.current = false;
    setUnreadCount(0);
    setMenuUnreadCount(0);
    setConversations([]);
    setIsError(false);
  }, [host, userId]);

  useEffect(() => {
    queryUnreadCount();
  }, [queryUnreadCount]);

  useInterval(() => {
    queryUnreadCount();
  }, host && userId ? 60000 : null);

  useEffect(() => {
    const handlePrivateMessagesChanged = () => {
      queryUnreadCount();
      if (mailMenu) loadRecentConversations();
    };

    window.addEventListener(PRIVATE_MESSAGES_CHANGED_EVENT, handlePrivateMessagesChanged);
    return () => window.removeEventListener(PRIVATE_MESSAGES_CHANGED_EVENT, handlePrivateMessagesChanged);
  }, [loadRecentConversations, mailMenu, queryUnreadCount]);

  const closeMenu = () => {
    setMailMenu(null);
  };

  const openMenu = (event: MouseEvent<HTMLElement>) => {
    setMailMenu(event.currentTarget);
    setMenuUnreadCount(unreadCount);
    loadRecentConversations();
  };

  const sendMessage = () => {
    closeMenu();
    navigate(buildTaskAwareRoute('/app/form/privateMessage', searchParams, taskContext));
  };

  const manageMessages = () => {
    closeMenu();
    navigate(buildTaskAwareRoute('/app/messages', searchParams, taskContext));
  };

  const openConversation = (conversation: PrivateConversation) => {
    closeMenu();
    const route = `/app/messages?conversationId=${encodeURIComponent(conversation.conversationId)}`;
    navigate(buildTaskAwareRoute(route, searchParams, mergeTaskContext(taskContext, {
      conversationId: conversation.conversationId,
      toUserId: conversation.otherUserId,
    })));
  };

  return (
    <Box>
      <IconButton
        color="inherit"
        aria-haspopup="true"
        aria-controls="mail-menu"
        onClick={openMenu}
        sx={{ ml: 2, p: 0.5 }}
        size="large"
      >
        <Badge
          badgeContent={unreadCount > 0 ? unreadCount : null}
          color="secondary"
        >
          {isLoadingCount ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <MailIcon
              sx={{
                fontSize: 28,
                color: unreadCount > 0 ? theme.palette.secondary.main : (theme.palette as any).custom?.darkBlue,
              }}
            />
          )}
        </Badge>
      </IconButton>
      <Menu
        id="mail-menu"
        open={Boolean(mailMenu)}
        anchorEl={mailMenu}
        onClose={closeMenu}
        anchorOrigin={openAbove ? { vertical: 'top', horizontal: 'left' } : { vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={openAbove ? { vertical: 'bottom', horizontal: 'left' } : { vertical: 'top', horizontal: 'left' }}
        sx={openAbove ? {} : { mt: 7 }}
        PaperProps={{ sx: { width: 340, maxWidth: 'calc(100vw - 32px)' } }}
        disableAutoFocusItem
      >
        <Box sx={{ display: 'grid', gap: 0.5, p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Messages
          </Typography>
          <Typography color={menuUnreadCount > 0 ? 'secondary' : 'text.secondary'} variant="body2">
            {menuUnreadCount > 0
              ? `${menuUnreadCount} unread message${menuUnreadCount === 1 ? '' : 's'}`
              : 'No unread messages'}
          </Typography>
          {isError ? (
            <Typography color="error" variant="body2">
              Unable to load messages
            </Typography>
          ) : null}
        </Box>
        {isLoadingConversations ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : conversations.length > 0 ? (
          <List dense disablePadding>
            {conversations.map((conversation) => {
              const elapsedMs = privateMessageElapsedMs(conversation.lastMessageTs);
              const userLabel = displayPrivateUserLabel(conversation.otherUserLabel, conversation.otherUserId);
              return (
                <ListItemButton
                  key={conversation.conversationId}
                  onClick={() => openConversation(conversation)}
                  sx={{ alignItems: 'flex-start', gap: 1.5, px: 2, py: 1 }}
                >
                  <UserAvatar color="primary" name={userLabel} />
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                          {userLabel}
                        </Typography>
                        {conversation.unreadCount ? (
                          <Chip
                            color="secondary"
                            label={conversation.unreadCount}
                            size="small"
                            sx={{ height: 20, minWidth: 28 }}
                          />
                        ) : null}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'grid', gap: 0.25 }}>
                        <Typography variant="caption" color="text.secondary">
                          {elapsedMs === null ? 'Recent' : timeConversion(elapsedMs)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {conversation.lastMessagePreview || 'No preview'}
                        </Typography>
                      </Box>
                    }
                    sx={{ minWidth: 0, my: 0 }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        ) : (
          <Typography color="text.secondary" variant="body2" sx={{ px: 2, py: 1 }}>
            No conversations
          </Typography>
        )}
        <Box sx={{ display: 'grid', gap: 1, p: 2 }}>
          <Button
            fullWidth
            onClick={sendMessage}
            startIcon={<SendIcon />}
            variant="contained"
            sx={{ textTransform: 'none' }}
          >
            Send New Message
          </Button>
          <Button
            fullWidth
            onClick={manageMessages}
            startIcon={<ManageIcon />}
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            Open Messages
          </Button>
        </Box>
      </Menu>
    </Box>
  );
}
