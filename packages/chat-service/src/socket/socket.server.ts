import { Server } from 'socket.io';
import { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import env from '../shared/config/env.config.js';
import logger from '../shared/config/logger.config.js';
import { initRedisClients, getOnlineUsers } from '../shared/redis/redis.client.js';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketHandlers } from './socket.handlers.js';

let io: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: true
    },
    path: '/socket.io',
    transports: ['websocket', 'polling']
  });

  // Redis adapter fans events out across chat pods
  const { pubClient, subClient } = initRedisClients();
  if (pubClient && subClient) {
    try {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Attached Redis Adapter to Socket.IO for multi-pod pub/sub');
    } catch (err) {
      logger.warn({ err }, 'Failed to attach Redis Adapter; using in-memory adapter');
    }
  }

  io.use(socketAuthMiddleware);
  io.on('connection', (socket) => registerSocketHandlers(io!, socket));
  logger.info('Socket.IO chat server initialized');
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO has not been initialized yet.');
  return io;
}

// socket rooms: `user:<id>` (notifications), `course:<id>` (community-wide), `room:<id>` (channel)
export const emitToChannel = (roomId: string, event: string, payload: unknown) =>
  io?.to(`room:${roomId}`).emit(event, payload);
export const emitToCourse = (courseId: string, event: string, payload: unknown) =>
  io?.to(`course:${courseId}`).emit(event, payload);
export const emitToUsers = (userIds: string[], event: string, payload: unknown) =>
  userIds.length && io?.to(userIds.map((id) => `user:${id}`)).emit(event, payload);

// presence entries are `${userId}:${socketId}` so a user with two tabs stays online until both close
export async function onlineUsers(courseId: string): Promise<string[]> {
  return [...new Set((await getOnlineUsers(`course:${courseId}`)).map((e) => e.split(':')[0]))];
}
