import { Redis } from 'ioredis';
import env from '../config/env.config.js';
import logger from '../config/logger.config.js';

let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let isRedisConnected = false;

// In-memory fallback for presence if Redis is offline during local test
const memoryPresence = new Map<string, Set<string>>();

export function initRedisClients(): { pubClient: Redis | null; subClient: Redis | null } {
  if (pubClient && subClient) {
    return { pubClient, subClient };
  }

  try {
    pubClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 200, 3000)
    });

    subClient = pubClient.duplicate();

    pubClient.on('connect', () => {
      isRedisConnected = true;
      logger.info('Redis Pub Client connected');
    });

    pubClient.on('error', (err) => {
      isRedisConnected = false;
      logger.warn({ err: err.message }, 'Redis Pub Client error, running with fallback');
    });

    subClient.on('connect', () => {
      logger.info('Redis Sub Client connected');
    });

    subClient.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis Sub Client error, running with fallback');
    });

    // Try connecting in background
    Promise.all([pubClient.connect(), subClient.connect()]).catch(() => {
      logger.info('Redis not available; falling back to in-memory pub/sub & presence.');
    });
  } catch (error) {
    logger.warn({ err: error }, 'Could not initialize Redis client, using in-memory fallback');
  }

  return { pubClient, subClient };
}

export async function addOnlineUser(roomId: string, userId: string): Promise<void> {
  if (isRedisConnected && pubClient) {
    try {
      await pubClient.sadd(`room:${roomId}:online`, userId);
      return;
    } catch {
      // Fallback below
    }
  }

  if (!memoryPresence.has(roomId)) {
    memoryPresence.set(roomId, new Set());
  }
  memoryPresence.get(roomId)!.add(userId);
}

export async function removeOnlineUser(roomId: string, userId: string): Promise<void> {
  if (isRedisConnected && pubClient) {
    try {
      await pubClient.srem(`room:${roomId}:online`, userId);
      return;
    } catch {
      // Fallback below
    }
  }

  if (memoryPresence.has(roomId)) {
    memoryPresence.get(roomId)!.delete(userId);
  }
}

export async function getOnlineUsers(roomId: string): Promise<string[]> {
  if (isRedisConnected && pubClient) {
    try {
      return await pubClient.smembers(`room:${roomId}:online`);
    } catch {
      // Fallback below
    }
  }

  if (memoryPresence.has(roomId)) {
    return Array.from(memoryPresence.get(roomId)!);
  }
  return [];
}
