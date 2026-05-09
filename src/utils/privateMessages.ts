export type PrivateConversation = {
  conversationId: string;
  otherUserId: string;
  otherUserLabel?: string;
  lastMessageTs?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
};

export type PrivateMessage = {
  messageId: string;
  fromUserId: string;
  fromUserLabel?: string;
  subject?: string;
  content?: string;
  sendTs?: string;
  read?: boolean;
};

export type PrivateConversationListResponse = {
  total?: number;
  conversations?: PrivateConversation[];
};

export type PrivateMessageListResponse = {
  conversationId?: string;
  total?: number;
  messages?: PrivateMessage[];
};

export type PrivateMessageCountResponse = {
  count?: number;
};

export const PRIVATE_MESSAGES_CHANGED_EVENT = 'portal:private-messages-changed';

export const buildPrivateMessageQueryUrl = (action: string, data: Record<string, unknown> = {}) => {
  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action,
    version: '0.1.0',
    data,
  };

  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
};

export const displayPrivateUserLabel = (label?: string, userId?: string) => {
  const value = label?.trim() || userId?.trim();
  return value || 'User';
};

export const privateMessageElapsedMs = (value?: string) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Date.now() - timestamp);
};
