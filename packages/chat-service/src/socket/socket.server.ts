import { Server } from 'socket.io';
import { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import env from '../shared/config/env.config.js';
import logger from '../shared/config/logger.config.js';
import { initRedisClients } from '../shared/redis/redis.client.js';
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

  // Attach Redis adapter for horizontal scaling if available
  const { pubClient, subClient } = initRedisClients();
  if (pubClient && subClient) {
    try {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Attached Redis Adapter to Socket.IO for multi-pod pub/sub');
    } catch (err) {
      logger.warn(
        { err },
        'Failed to attach Redis Adapter to Socket.IO; using default memory adapter'
      );
    }
  }

  // Authentication middleware
  io.use(socketAuthMiddleware);

  // Connection handler
  io.on('connection', (socket) => {
    registerSocketHandlers(io!, socket);
  });

  logger.info('Socket.IO chat server initialized successfully');
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO has not been initialized yet.');
  }
  return io;
}
