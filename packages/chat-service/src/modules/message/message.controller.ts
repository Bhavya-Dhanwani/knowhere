import { Response, NextFunction } from 'express';
import {
  AuthenticatedRequest,
  sendSuccess,
  NotFoundError,
  ForbiddenError,
  BadRequestError
} from '@lms/shared';
import ChatMessageDao from '../../shared/dao/message.dao.js';
import ChatRoomDao from '../../shared/dao/room.dao.js';
import { getIO } from '../../socket/socket.server.js';

export class MessageController {
  private messageDao: ChatMessageDao;
  private roomDao: ChatRoomDao;

  constructor() {
    this.messageDao = new ChatMessageDao();
    this.roomDao = new ChatRoomDao();
  }

  getMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawRoomId = req.params.roomId;
      const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;
      const limit = Number(req.query.limit) || 50;
      const beforeId = req.query.beforeId as string | undefined;

      const room = await this.roomDao.findRoomById(roomId);
      if (!room || room.isArchived) {
        throw new NotFoundError('Chat room not found');
      }

      const messages = await this.messageDao.getRoomMessages(roomId, limit, beforeId);
      return sendSuccess(res, messages);
    } catch (err) {
      next(err);
    }
  };

  getPinnedMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawRoomId = req.params.roomId;
      const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;

      const pinned = await this.messageDao.getPinnedMessages(roomId);
      return sendSuccess(res, pinned);
    } catch (err) {
      next(err);
    }
  };

  sendMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawRoomId = req.params.roomId;
      const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;
      const user = req.user!;
      const { content, attachments, replyTo } = req.body;

      const room = await this.roomDao.findRoomById(roomId);
      if (!room || room.isArchived) {
        throw new NotFoundError('Chat room not found');
      }

      const newMsg = await this.messageDao.createMessage({
        roomId,
        sender: {
          userId: user.userId,
          name: user.name || 'Anonymous',
          avatar: '',
          role: user.role || 'trainee'
        },
        content: content.trim(),
        attachments: attachments || [],
        replyTo: replyTo || undefined
      });

      await this.roomDao.updateLastMessage(roomId, {
        messageId: newMsg._id.toString(),
        content: newMsg.content.slice(0, 100),
        senderId: user.userId,
        senderName: user.name || 'Anonymous',
        createdAt: newMsg.createdAt
      });

      // Attempt real-time socket broadcast
      try {
        const io = getIO();
        io.to(`room:${roomId}`).emit('message:new', newMsg);
      } catch {
        // Socket may not be active in pure HTTP test runs
      }

      return sendSuccess(res, newMsg, 201);
    } catch (err) {
      next(err);
    }
  };

  editMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.messageId;
      const messageId = Array.isArray(rawId) ? rawId[0] : rawId;
      const userId = req.user!.userId;
      const { content } = req.body;

      const updated = await this.messageDao.editMessage(messageId, userId, content.trim());
      if (!updated) {
        throw new ForbiddenError('Message not found or you do not have permission to edit it');
      }

      try {
        const io = getIO();
        io.to(`room:${updated.roomId}`).emit('message:updated', updated);
      } catch {}

      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  };

  deleteMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.messageId;
      const messageId = Array.isArray(rawId) ? rawId[0] : rawId;
      const userId = req.user!.userId;
      const isPrivileged = req.user?.role === 'admin' || req.user?.role === 'trainer';

      const deleted = await this.messageDao.deleteMessage(messageId, userId, isPrivileged);
      if (!deleted) {
        throw new ForbiddenError('Message not found or you do not have permission to delete it');
      }

      try {
        const io = getIO();
        io.to(`room:${deleted.roomId}`).emit('message:deleted', {
          messageId: deleted._id.toString(),
          roomId: deleted.roomId
        });
      } catch {}

      return sendSuccess(res, { message: 'Message deleted successfully' });
    } catch (err) {
      next(err);
    }
  };

  toggleReaction = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.messageId;
      const messageId = Array.isArray(rawId) ? rawId[0] : rawId;
      const userId = req.user!.userId;
      const { emoji } = req.body;

      if (!emoji) {
        throw new BadRequestError('Emoji is required');
      }

      const updated = await this.messageDao.toggleReaction(messageId, userId, emoji);
      if (!updated) {
        throw new NotFoundError('Message not found');
      }

      try {
        const io = getIO();
        io.to(`room:${updated.roomId}`).emit('message:updated', updated);
      } catch {}

      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  };
}

export default MessageController;
