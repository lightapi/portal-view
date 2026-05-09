import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplyIcon from '@mui/icons-material/Reply';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserState } from '../../contexts/UserContext';
import TaskActionPanel from '../../tasks/TaskActionPanel';
import { buildTaskAwareRoute, contextFromSearchParams, mergeTaskContext } from '../../tasks/taskUtils';
import fetchClient from '../../utils/fetchClient';
import {
  buildPrivateMessageQueryUrl,
  displayPrivateUserLabel,
  privateMessageElapsedMs,
  PRIVATE_MESSAGES_CHANGED_EVENT,
  type PrivateConversation,
  type PrivateConversationListResponse,
  type PrivateMessage,
  type PrivateMessageListResponse,
} from '../../utils/privateMessages';
import { timeConversion } from '../../utils';
import UserAvatar from '../UserAvatar/UserAvatar';

const CONVERSATION_LIMIT = 25;
const MESSAGE_LIMIT = 50;

function replySubject(subject?: string) {
  const trimmed = subject?.trim();
  if (!trimmed) return '';
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

function displayTime(value?: string) {
  const elapsedMs = privateMessageElapsedMs(value);
  return elapsedMs === null ? 'Recent' : timeConversion(elapsedMs);
}

export default function Messages() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { host, userId } = useUserState();
  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState(searchParams.get('conversationId') || '');
  const [totalConversations, setTotalConversations] = useState(0);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const taskContext = useMemo(
    () => mergeTaskContext(
      contextFromSearchParams(searchParams),
      { userId: userId ?? '', accountSection: 'messages' },
    ),
    [searchParams, userId],
  );

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.conversationId === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  const loadConversations = useCallback(async () => {
    if (!host || !userId) {
      setConversations([]);
      setTotalConversations(0);
      setConversationError('Sign in to view private messages.');
      return;
    }

    try {
      setLoadingConversations(true);
      setConversationError(null);
      const response = await fetchClient(buildPrivateMessageQueryUrl('getPrivateConversations', {
        hostId: host,
        userId,
        offset: 0,
        limit: CONVERSATION_LIMIT,
      })) as PrivateConversationListResponse;
      const nextConversations = Array.isArray(response.conversations) ? response.conversations : [];
      setConversations(nextConversations);
      setTotalConversations(Number(response.total || nextConversations.length));
    } catch (error) {
      setConversations([]);
      setTotalConversations(0);
      setConversationError('Unable to load conversations.');
      console.error(error);
    } finally {
      setLoadingConversations(false);
    }
  }, [host, userId]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!host || !userId) return;

    try {
      await fetchClient(buildPrivateMessageQueryUrl('markPrivateConversationRead', { hostId: host, userId, conversationId }));
      setConversations((current) => current.map((conversation) => (
        conversation.conversationId === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )));
      window.dispatchEvent(new CustomEvent(PRIVATE_MESSAGES_CHANGED_EVENT));
    } catch (error) {
      console.error(error);
    }
  }, [host, userId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!host || !userId || !conversationId) {
      setMessages([]);
      return;
    }

    try {
      setLoadingMessages(true);
      setMessageError(null);
      const response = await fetchClient(buildPrivateMessageQueryUrl('getPrivateConversationMessages', {
        hostId: host,
        userId,
        conversationId,
        offset: 0,
        limit: MESSAGE_LIMIT,
      })) as PrivateMessageListResponse;
      const nextMessages = Array.isArray(response.messages) ? response.messages : [];
      setMessages(nextMessages);
      const unreadCount = conversations.find((conversation) => conversation.conversationId === conversationId)?.unreadCount || 0;
      if (unreadCount > 0) {
        await markConversationRead(conversationId);
        setMessages(nextMessages.map((message) => ({ ...message, read: true })));
      }
    } catch (error) {
      setMessages([]);
      setMessageError('Unable to load conversation messages.');
      console.error(error);
    } finally {
      setLoadingMessages(false);
    }
  }, [conversations, host, markConversationRead, userId]);

  useEffect(() => {
    setSelectedConversationId(searchParams.get('conversationId') || '');
  }, [searchParams]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].conversationId);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    loadMessages(selectedConversationId);
  }, [loadMessages, selectedConversationId]);

  const openConversation = (conversation: PrivateConversation) => {
    const route = `/app/messages?conversationId=${encodeURIComponent(conversation.conversationId)}`;
    setSelectedConversationId(conversation.conversationId);
    navigate(buildTaskAwareRoute(route, searchParams, mergeTaskContext(taskContext, {
      conversationId: conversation.conversationId,
      toUserId: conversation.otherUserId,
    })), { replace: true });
  };

  const sendMessage = () => {
    navigate(buildTaskAwareRoute('/app/form/privateMessage', searchParams, taskContext));
  };

  const replyToConversation = (subject?: string) => {
    if (!selectedConversation) return;

    const nextContext = mergeTaskContext(taskContext, {
      conversationId: selectedConversation.conversationId,
      toUserId: selectedConversation.otherUserId,
    });
    navigate(buildTaskAwareRoute('/app/form/privateMessage', searchParams, nextContext), {
      state: {
        data: {
          conversationId: selectedConversation.conversationId,
          toUserId: selectedConversation.otherUserId,
          subject: replySubject(subject),
        },
      },
    });
  };

  const deleteMessage = async (messageId: string) => {
    if (!host || !userId || !messageId) return;

    try {
      setActionPending(true);
      await fetchClient(buildPrivateMessageQueryUrl('deletePrivateMessage', { hostId: host, userId, messageId }));
      setMessages((current) => current.filter((message) => message.messageId !== messageId));
      await loadConversations();
      window.dispatchEvent(new CustomEvent(PRIVATE_MESSAGES_CHANGED_EVENT));
    } catch (error) {
      setMessageError('Unable to delete the message.');
      console.error(error);
    } finally {
      setActionPending(false);
    }
  };

  const hideConversation = async () => {
    if (!host || !userId || !selectedConversationId) return;
    if (!window.confirm('Hide this conversation from your inbox?')) return;

    try {
      setActionPending(true);
      await fetchClient(buildPrivateMessageQueryUrl('hidePrivateConversation', { hostId: host, userId, conversationId: selectedConversationId }));
      setConversations((current) => current.filter((conversation) => conversation.conversationId !== selectedConversationId));
      setMessages([]);
      setSelectedConversationId('');
      window.dispatchEvent(new CustomEvent(PRIVATE_MESSAGES_CHANGED_EVENT));
    } catch (error) {
      setMessageError('Unable to hide the conversation.');
      console.error(error);
    } finally {
      setActionPending(false);
    }
  };

  const refresh = () => {
    loadConversations();
    if (selectedConversationId) loadMessages(selectedConversationId);
  };

  const selectedUserLabel = selectedConversation
    ? displayPrivateUserLabel(selectedConversation.otherUserLabel, selectedConversation.otherUserId)
    : '';

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h4" component="h2">
            Private Messages
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {totalConversations} conversation{totalConversations === 1 ? '' : 's'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            onClick={refresh}
            startIcon={<RefreshIcon />}
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
          <Button
            onClick={sendMessage}
            startIcon={<ReplyIcon />}
            variant="contained"
            sx={{ textTransform: 'none' }}
          >
            New Message
          </Button>
        </Stack>
      </Stack>

      <TaskActionPanel
        title="Account Tasks"
        context={taskContext}
        taskIds={['manage-my-account']}
        maxActions={1}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
        <Paper sx={{ width: { xs: '100%', md: 360 }, minHeight: 420, overflow: 'hidden' }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Inbox
            </Typography>
            {conversationError ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                {conversationError}
              </Alert>
            ) : null}
          </Box>
          <Divider />
          {loadingConversations ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : conversations.length > 0 ? (
            <List disablePadding>
              {conversations.map((conversation) => {
                const userLabel = displayPrivateUserLabel(conversation.otherUserLabel, conversation.otherUserId);
                const selected = conversation.conversationId === selectedConversationId;
                return (
                  <ListItemButton
                    key={conversation.conversationId}
                    selected={selected}
                    onClick={() => openConversation(conversation)}
                    sx={{ alignItems: 'flex-start', gap: 1.5, py: 1.25 }}
                  >
                    <UserAvatar color={selected ? 'secondary' : 'primary'} name={userLabel} />
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                            {userLabel}
                          </Typography>
                          {conversation.unreadCount ? (
                            <Typography color="secondary" variant="caption" sx={{ fontWeight: 700 }}>
                              {conversation.unreadCount}
                            </Typography>
                          ) : null}
                        </Stack>
                      }
                      secondary={
                        <Box sx={{ display: 'grid', gap: 0.25 }}>
                          <Typography variant="caption" color="text.secondary">
                            {displayTime(conversation.lastMessageTs)}
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
            <Typography color="text.secondary" variant="body2" sx={{ p: 2 }}>
              Your inbox is empty.
            </Typography>
          )}
        </Paper>

        <Paper sx={{ flex: 1, minHeight: 420, overflow: 'hidden' }}>
          {selectedConversation ? (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                sx={{ p: 2 }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                  <UserAvatar color="primary" name={selectedUserLabel} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                      {selectedUserLabel}
                    </Typography>
                    <Typography color="text.secondary" variant="body2" noWrap>
                      {selectedConversation.otherUserId}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    disabled={actionPending}
                    onClick={() => replyToConversation(messages[messages.length - 1]?.subject)}
                    startIcon={<ReplyIcon />}
                    variant="contained"
                    sx={{ textTransform: 'none' }}
                  >
                    Reply
                  </Button>
                  <Tooltip title="Hide conversation">
                    <span>
                      <IconButton disabled={actionPending} onClick={hideConversation} color="inherit">
                        <VisibilityOffIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
              <Divider />
              {messageError ? (
                <Alert severity="error" sx={{ m: 2 }}>
                  {messageError}
                </Alert>
              ) : null}
              {loadingMessages ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : messages.length > 0 ? (
                <Box sx={{ display: 'grid', gap: 1.5, p: 2 }}>
                  {messages.map((message) => {
                    const fromLabel = displayPrivateUserLabel(message.fromUserLabel, message.fromUserId);
                    const mine = message.fromUserId === userId;
                    return (
                      <Box
                        key={message.messageId}
                        sx={{
                          justifySelf: mine ? 'end' : 'start',
                          maxWidth: 'min(680px, 100%)',
                          width: 'fit-content',
                          border: '1px solid',
                          borderColor: mine ? 'primary.light' : 'divider',
                          borderRadius: 1,
                          bgcolor: mine ? 'background.default' : 'background.paper',
                          p: 1.5,
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {fromLabel}
                            </Typography>
                            <Typography color="text.secondary" variant="caption">
                              {displayTime(message.sendTs)}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Reply">
                              <IconButton size="small" onClick={() => replyToConversation(message.subject)}>
                                <ReplyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete message">
                              <span>
                                <IconButton
                                  color="inherit"
                                  disabled={actionPending}
                                  size="small"
                                  onClick={() => deleteMessage(message.messageId)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </Stack>
                        {message.subject ? (
                          <Typography variant="subtitle2" sx={{ mt: 1 }}>
                            {message.subject}
                          </Typography>
                        ) : null}
                        <Typography sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} variant="body2">
                          {message.content || ''}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography color="text.secondary" variant="body2" sx={{ p: 2 }}>
                  No visible messages in this conversation.
                </Typography>
              )}
            </>
          ) : (
            <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 420, p: 3, textAlign: 'center' }}>
              <Box>
                <Typography variant="h6">
                  No conversation selected
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Select a conversation from the inbox or start a new message.
                </Typography>
              </Box>
            </Box>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
