import { io, Socket } from 'socket.io-client';
import { store } from '../../../app/store';
import { ChatMessage, UserTypingEvent } from '../types';

let socket: Socket | null = null;

export function getChatSocket(): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  const token = store.getState().auth.accessToken;

  if (socket) {
    // If socket exists but disconnected, update token and reconnect
    if (token) {
      socket.auth = { token };
      socket.connect();
    }
    return socket;
  }

  socket = io({
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  });

  socket.on('connect', () => {
    // Connected to chat socket
  });

  socket.on('connect_error', (err) => {
    console.warn('Chat Socket connection error:', err.message);
  });

  return socket;
}

export function disconnectChatSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinChatRoom(
  roomId: string
): Promise<{ success?: boolean; onlineUsers?: string[] }> {
  return new Promise((resolve) => {
    const s = getChatSocket();
    s.emit('room:join', { roomId }, (response: any) => {
      resolve(response || { success: true });
    });
  });
}

export function leaveChatRoom(roomId: string): void {
  if (socket && socket.connected) {
    socket.emit('room:leave', { roomId });
  }
}

export function sendChatMessage(
  roomId: string,
  content: string,
  attachments?: any[],
  replyTo?: { messageId: string; senderName: string; snippet: string }
): Promise<{ success?: boolean; message?: ChatMessage; error?: string }> {
  return new Promise((resolve) => {
    const s = getChatSocket();
    s.emit('message:send', { roomId, content, attachments, replyTo }, (response: any) => {
      resolve(response);
    });
  });
}

export function sendTypingStatus(roomId: string, isTyping: boolean): void {
  if (socket && socket.connected) {
    socket.emit('message:typing', { roomId, isTyping });
  }
}

export function sendReaction(messageId: string, roomId: string, emoji: string): void {
  if (socket && socket.connected) {
    socket.emit('message:react', { messageId, roomId, emoji });
  }
}

export function sendEditMessage(messageId: string, roomId: string, content: string): void {
  if (socket && socket.connected) {
    socket.emit('message:edit', { messageId, roomId, content });
  }
}

export function sendDeleteMessage(messageId: string, roomId: string): void {
  if (socket && socket.connected) {
    socket.emit('message:delete', { messageId, roomId });
  }
}

export function subscribeToChatEvents(handlers: {
  onNewMessage?: (msg: ChatMessage) => void;
  onMessageUpdated?: (msg: ChatMessage) => void;
  onMessageDeleted?: (data: { messageId: string; roomId: string }) => void;
  onTyping?: (data: UserTypingEvent) => void;
  onPresence?: (data: { roomId: string; onlineUsers: string[] }) => void;
}): () => void {
  const s = getChatSocket();

  const handleNew = (msg: ChatMessage) => handlers.onNewMessage?.(msg);
  const handleUpdated = (msg: ChatMessage) => handlers.onMessageUpdated?.(msg);
  const handleDeleted = (data: any) => handlers.onMessageDeleted?.(data);
  const handleTyping = (data: UserTypingEvent) => handlers.onTyping?.(data);
  const handlePresence = (data: any) => handlers.onPresence?.(data);

  s.on('message:new', handleNew);
  s.on('message:updated', handleUpdated);
  s.on('message:deleted', handleDeleted);
  s.on('user:typing', handleTyping);
  s.on('room:presence', handlePresence);

  return () => {
    s.off('message:new', handleNew);
    s.off('message:updated', handleUpdated);
    s.off('message:deleted', handleDeleted);
    s.off('user:typing', handleTyping);
    s.off('room:presence', handlePresence);
  };
}
