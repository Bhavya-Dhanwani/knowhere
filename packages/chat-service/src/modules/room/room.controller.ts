import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, sendSuccess, NotFoundError, ForbiddenError } from '@lms/shared';
import ChatRoomDao from '../../shared/dao/room.dao.js';
import { getOnlineUsers } from '../../shared/redis/redis.client.js';

export class RoomController {
  private roomDao: ChatRoomDao;

  constructor() {
    this.roomDao = new ChatRoomDao();
  }

  listRooms = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const courseId = req.query.courseId as string | undefined;
      const type = req.query.type as string | undefined;

      const rooms = await this.roomDao.findRooms({ userId, courseId, type });
      return sendSuccess(res, rooms);
    } catch (err) {
      next(err);
    }
  };

  createRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { name, description, type, courseId, icon } = req.body;

      const cleanName = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const slug = `${cleanName}-${randomSuffix}`;

      const room = await this.roomDao.createRoom({
        name: name.trim(),
        slug,
        description: description?.trim() || '',
        type: type || 'public',
        courseId: courseId || undefined,
        icon: icon || '',
        creatorId: userId,
        members: [
          {
            userId,
            role: 'owner',
            joinedAt: new Date(),
            lastReadAt: new Date()
          }
        ]
      });

      return sendSuccess(res, room, 201);
    } catch (err) {
      next(err);
    }
  };

  getRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const roomId = Array.isArray(rawId) ? rawId[0] : rawId;

      const room = await this.roomDao.findRoomById(roomId);
      if (!room || room.isArchived) {
        throw new NotFoundError('Chat room not found');
      }

      const onlineUsers = await getOnlineUsers(roomId);

      return sendSuccess(res, {
        room,
        onlineUsers
      });
    } catch (err) {
      next(err);
    }
  };

  updateRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const roomId = Array.isArray(rawId) ? rawId[0] : rawId;
      const userId = req.user!.userId;

      const room = await this.roomDao.findRoomById(roomId);
      if (!room || room.isArchived) {
        throw new NotFoundError('Chat room not found');
      }

      const isOwner = room.creatorId === userId;
      const isPrivileged = req.user?.role === 'admin' || req.user?.role === 'trainer';
      if (!isOwner && !isPrivileged) {
        throw new ForbiddenError('Only the room owner or instructors can update room details');
      }

      const updated = await this.roomDao.updateRoom(roomId, req.body);
      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  };

  deleteRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const roomId = Array.isArray(rawId) ? rawId[0] : rawId;
      const userId = req.user!.userId;

      const room = await this.roomDao.findRoomById(roomId);
      if (!room || room.isArchived) {
        throw new NotFoundError('Chat room not found');
      }

      const isOwner = room.creatorId === userId;
      const isPrivileged = req.user?.role === 'admin';
      if (!isOwner && !isPrivileged) {
        throw new ForbiddenError('Only the room owner or admin can delete this room');
      }

      await this.roomDao.deleteRoom(roomId);
      return sendSuccess(res, { message: 'Room archived successfully' });
    } catch (err) {
      next(err);
    }
  };

  joinRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const roomId = Array.isArray(rawId) ? rawId[0] : rawId;
      const userId = req.user!.userId;

      const room = await this.roomDao.findRoomById(roomId);
      if (!room || room.isArchived) {
        throw new NotFoundError('Chat room not found');
      }

      const updated = await this.roomDao.addMember(roomId, userId, 'member');
      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  };

  leaveRoom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawId = req.params.id;
      const roomId = Array.isArray(rawId) ? rawId[0] : rawId;
      const userId = req.user!.userId;

      const room = await this.roomDao.findRoomById(roomId);
      if (!room || room.isArchived) {
        throw new NotFoundError('Chat room not found');
      }

      const updated = await this.roomDao.removeMember(roomId, userId);
      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  };
}

export default RoomController;
