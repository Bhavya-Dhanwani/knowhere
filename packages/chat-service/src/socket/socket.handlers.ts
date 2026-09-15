import { Server, Socket } from 'socket.io';
import ChatRoomDao from '../shared/dao/room.dao.js';
import ChatMessageDao from '../shared/dao/message.dao.js';
import { addOnlineUser, removeOnlineUser, getOnlineUsers } from '../shared/redis/redis.client.js';
import logger from '../shared/config/logger.config.js';
import { SocketUser } from './socket.auth.js';

const roomDao = new ChatRoomDao();
const messageDao = new ChatMessageDao();

export function registerSocketHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as SocketUser;
  logger.info(`Socket connected: ${socket.id} (User: ${user.name} / ${user.userId})`);

  // Track rooms this socket has joined for cleanup on disconnect
  const joinedRooms = new Set<string>();

  // 1. Join Room
  socket.on('room:join', async (data: { roomId: string }, callback?: Function) => {
    try {
      const { roomId } = data;
      if (!roomId) return;

      const room = await roomDao.findRoomById(roomId);
      if (!room) {
        if (callback) callback({ error: 'Room not found' });
        return;
      }

      await socket.join(`room:${roomId}`);
      joinedRooms.add(roomId);

      // Add to presence
      await addOnlineUser(roomId, user.userId);
      const onlineUsers = await getOnlineUsers(roomId);

      // Broadcast presence update to everyone in the room
      io.to(`room:${roomId}`).emit('room:presence', {
        roomId,
        onlineUsers
      });

      logger.debug(`User ${user.userId} joined room ${roomId}`);
      if (callback) callback({ success: true, roomId, onlineUsers });
    } catch (err) {
      logger.error({ err }, 'Error in room:join');
      if (callback) callback({ error: 'Failed to join room' });
    }
  });

  // 2. Leave Room
  socket.on('room:leave', async (data: { roomId: string }, callback?: Function) => {
    try {
      const { roomId } = data;
      if (!roomId) return;

      socket.leave(`room:${roomId}`);
      joinedRooms.delete(roomId);

      await removeOnlineUser(roomId, user.userId);
      const onlineUsers = await getOnlineUsers(roomId);

      io.to(`room:${roomId}`).emit('room:presence', {
        roomId,
        onlineUsers
      });

      if (callback) callback({ success: true });
    } catch (err) {
      logger.error({ err }, 'Error in room:leave');
      if (callback) callback({ error: 'Failed to leave room' });
    }
  });

  // 3. Send Message
  socket.on(
    'message:send',
    async (
      data: {
        roomId: string;
        content: string;
        attachments?: any[];
        replyTo?: { messageId: string; senderName: string; snippet: string };
      },
      callback?: Function
    ) => {
      try {
        const { roomId, content, attachments, replyTo } = data;
        if (!roomId || !content?.trim()) {
          if (callback) callback({ error: 'Room ID and message content are required' });
          return;
        }

        const room = await roomDao.findRoomById(roomId);
        if (!room) {
          if (callback) callback({ error: 'Room not found' });
          return;
        }

        const newMsg = await messageDao.createMessage({
          roomId,
          sender: {
            userId: user.userId,
            name: user.name,
            avatar: user.avatar || '',
            role: user.role
          },
          content: content.trim(),
          attachments: attachments || [],
          replyTo: replyTo || undefined
        });

        // Update room's lastMessage
        await roomDao.updateLastMessage(roomId, {
          messageId: newMsg._id.toString(),
          content: newMsg.content.slice(0, 100),
          senderId: user.userId,
          senderName: user.name,
          createdAt: newMsg.createdAt
        });

        // Broadcast to all participants in this room
        io.to(`room:${roomId}`).emit('message:new', newMsg);

        if (callback) callback({ success: true, message: newMsg });
      } catch (err) {
        logger.error({ err }, 'Error in message:send');
        if (callback) callback({ error: 'Failed to send message' });
      }
    }
  );

  // 4. Ephemeral Typing Indicator
  socket.on('message:typing', (data: { roomId: string; isTyping: boolean }) => {
    const { roomId, isTyping } = data;
    if (!roomId) return;

    // Broadcast to others in the room (do not echo to sender)
    socket.to(`room:${roomId}`).emit('user:typing', {
      roomId,
      userId: user.userId,
      userName: user.name,
      isTyping
    });
  });

  // 5. Toggle Reaction
  socket.on(
    'message:react',
    async (data: { messageId: string; roomId: string; emoji: string }, callback?: Function) => {
      try {
        const { messageId, roomId, emoji } = data;
        if (!messageId || !roomId || !emoji) return;

        const updatedMsg = await messageDao.toggleReaction(messageId, user.userId, emoji);
        if (updatedMsg) {
          io.to(`room:${roomId}`).emit('message:updated', updatedMsg);
          if (callback) callback({ success: true, message: updatedMsg });
        }
      } catch (err) {
        logger.error({ err }, 'Error in message:react');
        if (callback) callback({ error: 'Failed to react to message' });
      }
    }
  );

  // 6. Edit Message
  socket.on(
    'message:edit',
    async (data: { messageId: string; roomId: string; content: string }, callback?: Function) => {
      try {
        const { messageId, roomId, content } = data;
        if (!messageId || !roomId || !content?.trim()) return;

        const updatedMsg = await messageDao.editMessage(messageId, user.userId, content.trim());
        if (updatedMsg) {
          io.to(`room:${roomId}`).emit('message:updated', updatedMsg);
          if (callback) callback({ success: true, message: updatedMsg });
        } else {
          if (callback) callback({ error: 'Cannot edit this message' });
        }
      } catch (err) {
        logger.error({ err }, 'Error in message:edit');
        if (callback) callback({ error: 'Failed to edit message' });
      }
    }
  );

  // 7. Delete Message
  socket.on(
    'message:delete',
    async (data: { messageId: string; roomId: string }, callback?: Function) => {
      try {
        const { messageId, roomId } = data;
        if (!messageId || !roomId) return;

        const isPrivileged = user.role === 'admin' || user.role === 'trainer';
        const deletedMsg = await messageDao.deleteMessage(messageId, user.userId, isPrivileged);

        if (deletedMsg) {
          io.to(`room:${roomId}`).emit('message:deleted', { messageId, roomId });
          if (callback) callback({ success: true });
        } else {
          if (callback) callback({ error: 'Cannot delete this message' });
        }
      } catch (err) {
        logger.error({ err }, 'Error in message:delete');
        if (callback) callback({ error: 'Failed to delete message' });
      }
    }
  );

  // 8. Pin/Unpin Message
  socket.on(
    'message:pin',
    async (data: { messageId: string; roomId: string }, callback?: Function) => {
      try {
        const { messageId, roomId } = data;
        if (!messageId || !roomId) return;

        const { isPinned } = await roomDao.togglePinMessage(roomId, messageId);
        const updatedMsg = await messageDao.setPinnedStatus(messageId, isPinned);

        if (updatedMsg) {
          io.to(`room:${roomId}`).emit('message:updated', updatedMsg);
          if (callback) callback({ success: true, isPinned });
        }
      } catch (err) {
        logger.error({ err }, 'Error in message:pin');
        if (callback) callback({ error: 'Failed to pin message' });
      }
    }
  );

  // 9. Disconnect Cleanup
  socket.on('disconnecting', async () => {
    try {
      for (const roomId of joinedRooms) {
        await removeOnlineUser(roomId, user.userId);
        const onlineUsers = await getOnlineUsers(roomId);

        socket.to(`room:${roomId}`).emit('room:presence', {
          roomId,
          onlineUsers
        });
      }
      logger.debug(`Socket ${socket.id} disconnected, cleaned up ${joinedRooms.size} rooms.`);
    } catch (err) {
      logger.error({ err }, 'Error during socket disconnect cleanup');
    }
  });
}
