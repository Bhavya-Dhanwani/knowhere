import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../shared/config/env.config.js';
import logger from '../shared/config/logger.config.js';
import { verifyAccessToken } from '@lms/shared';

export interface SocketUser {
  userId: string;
  name: string;
  role: string;
  email?: string;
  avatar?: string;
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  try {
    const authHeader =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      socket.handshake.query?.token;

    if (!authHeader) {
      return next(new Error('Authentication error: Missing token'));
    }

    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : (authHeader as string);

    const decoded = verifyAccessToken(token);

    const userId = (decoded.userId || decoded._id || decoded.id || decoded.sub) as string;
    if (!userId) {
      return next(new Error('Authentication error: Invalid token payload'));
    }

    const socketUser: SocketUser = {
      userId: userId.toString(),
      name: (decoded.name as string) || 'Anonymous',
      role: (decoded.role as string) || 'trainee',
      email: decoded.email as string | undefined,
      avatar: (decoded.avatar as string) || ''
    };

    socket.data.user = socketUser;
    next();
  } catch (err) {
    logger.warn({ err }, 'WebSocket authentication failed');
    next(new Error('Authentication error: Invalid or expired token'));
  }
}
