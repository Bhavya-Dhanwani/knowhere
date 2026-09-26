import { Server, Socket } from 'socket.io';
import { addOnlineUser, removeOnlineUser } from '../shared/redis/redis.client.js';
import logger from '../shared/config/logger.config.js';
import { SocketUser } from './socket.auth.js';
import * as svc from '../community/community.service.js';
import { onlineUsers } from './socket.server.js';

type Ack = (res: { ok: boolean; error?: string; [k: string]: unknown }) => void;

// Voice media flows through LiveKit (SFU); this socket layer only keeps the roster that the
// sidebar shows. The roster lives on socket.data, and fetchSockets() goes through the Redis
// adapter, so it is complete no matter which chat pod each participant is connected to.
interface VoiceSeat {
  roomId: string;
  courseId: string;
  userId: string;
  name: string;
  muted: boolean;
}
async function voiceList(io: Server, roomId: string) {
  const sockets = await io.in(`voice:${roomId}`).fetchSockets();
  return sockets
    .map((s) => ({ socketId: s.id, ...(s.data.voice as VoiceSeat | undefined) }))
    .filter((p) => p.userId)
    .map(({ socketId, userId, name, muted }) => ({ socketId, userId, name, muted }));
}

export function registerSocketHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as SocketUser;
  const actor: svc.Actor = { userId: user.userId, name: user.name, role: user.role };
  const courses = new Set<string>();

  socket.join(`user:${user.userId}`);

  const safe =
    <T>(fn: (data: T, ack: Ack) => Promise<void>) =>
    async (data: T, ack?: Ack) => {
      const reply: Ack = typeof ack === 'function' ? ack : () => undefined;
      try {
        await fn(data || ({} as T), reply);
      } catch (err) {
        reply({ ok: false, error: err instanceof Error ? err.message : 'Something went wrong' });
      }
    };

  const broadcastPresence = async (courseId: string) =>
    io
      .to(`course:${courseId}`)
      .emit('presence', { courseId, onlineUserIds: await onlineUsers(courseId) });

  // ------------------------------------------------------------ community & channels
  socket.on(
    'community:join',
    safe<{ courseId: string }>(async ({ courseId }, ack) => {
      const access = await svc.communityAccess(actor, courseId);
      await socket.join(`course:${courseId}`);
      courses.add(courseId);
      await addOnlineUser(`course:${courseId}`, `${user.userId}:${socket.id}`);
      await broadcastPresence(courseId);
      ack({ ok: true, access });
    })
  );

  socket.on(
    'community:leave',
    safe<{ courseId: string }>(async ({ courseId }, ack) => {
      await socket.leave(`course:${courseId}`);
      courses.delete(courseId);
      await removeOnlineUser(`course:${courseId}`, `${user.userId}:${socket.id}`);
      await broadcastPresence(courseId);
      ack({ ok: true });
    })
  );

  socket.on(
    'channel:join',
    safe<{ roomId: string }>(async ({ roomId }, ack) => {
      const { room } = await svc.channelAccess(actor, roomId);
      await socket.join(`room:${roomId}`);
      ack({ ok: true });
    })
  );

  socket.on(
    'channel:leave',
    safe<{ roomId: string }>(async ({ roomId }, ack) => {
      await socket.leave(`room:${roomId}`);
      ack({ ok: true });
    })
  );

  // ------------------------------------------------------------------ messages
  socket.on(
    'message:send',
    safe<{
      roomId: string;
      content?: string;
      attachments?: never[];
      replyToId?: string;
      mentions?: string[];
    }>(async (data, ack) => {
      const { room, message, parent, notifications } = await svc.postMessage(actor, data);
      io.to(`room:${room._id}`).emit('message:new', message);
      if (parent) {
        parent.replyCount += 1;
        io.to(`room:${room._id}`).emit('message:updated', parent);
      }
      io.to(`course:${room.courseId}`).emit('channel:activity', {
        courseId: room.courseId,
        roomId: String(room._id),
        senderId: user.userId,
        isReply: Boolean(parent)
      });
      for (const n of notifications) io.to(`user:${n.userId}`).emit('notification:new', n);
      ack({ ok: true, message });
    })
  );

  socket.on('message:typing', (data: { roomId: string; isTyping: boolean }) => {
    if (!data?.roomId || !socket.rooms.has(`room:${data.roomId}`)) return;
    socket.to(`room:${data.roomId}`).emit('user:typing', {
      roomId: data.roomId,
      userId: user.userId,
      userName: user.name,
      isTyping: Boolean(data.isTyping)
    });
  });

  // -------------------------------------------------------------------- voice
  const seat = () => socket.data.voice as VoiceSeat | undefined;
  const broadcastRoster = async (roomId: string, courseId: string) =>
    io
      .to(`course:${courseId}`)
      .emit('voice:participants', { roomId, participants: await voiceList(io, roomId) });

  const leaveVoice = async () => {
    const current = seat();
    if (!current) return;
    socket.data.voice = undefined;
    await socket.leave(`voice:${current.roomId}`);
    await broadcastRoster(current.roomId, current.courseId);
  };

  socket.on(
    'voice:join',
    safe<{ roomId: string }>(async ({ roomId }, ack) => {
      const { room } = await svc.channelAccess(actor, roomId);
      if (room.kind !== 'voice') throw new Error('Not a voice channel.');
      await leaveVoice();
      socket.data.voice = {
        roomId,
        courseId: room.courseId!,
        userId: user.userId,
        name: user.name,
        muted: false
      };
      await socket.join(`voice:${roomId}`);
      await broadcastRoster(roomId, room.courseId!);
      ack({ ok: true });
    })
  );

  socket.on(
    'voice:leave',
    safe(async (_d, ack) => {
      await leaveVoice();
      ack({ ok: true });
    })
  );

  socket.on('voice:mute', async (data: { muted: boolean }) => {
    const current = seat();
    if (!current) return;
    current.muted = Boolean(data?.muted);
    await broadcastRoster(current.roomId, current.courseId);
  });

  // -------------------------------------------------------------- disconnect
  socket.on('disconnecting', async () => {
    try {
      await leaveVoice();
      for (const courseId of courses) {
        await removeOnlineUser(`course:${courseId}`, `${user.userId}:${socket.id}`);
        await broadcastPresence(courseId);
      }
    } catch (err) {
      logger.error({ err }, 'Error during socket disconnect cleanup');
    }
  });
}
