import express, { NextFunction, Request, Response } from 'express';
import { authMiddleware, sendSuccess, AuthenticatedRequest, BadRequestError } from '@lms/shared';
import * as svc from './community.service.js';
import { emitToChannel, emitToCourse, emitToUsers, onlineUsers } from '../socket/socket.server.js';

const router = express.Router();
router.use(authMiddleware);

type Handler = (req: AuthenticatedRequest, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  fn(req as AuthenticatedRequest, res).catch(next);
const actor = (req: AuthenticatedRequest): svc.Actor => ({
  userId: req.user!.userId,
  name: req.user!.name,
  role: req.user!.role
});
const p = (v: string | string[]) => (Array.isArray(v) ? v[0] : v);

// ------------------------------------------------------------------ community
// @route GET /api/chat/communities/:courseId — course community: your access, visible channels with unread counts, who is online
router.get(
  '/communities/:courseId',
  h(async (req, res) => {
    const courseId = p(req.params.courseId);
    const { access, channels } = await svc.listChannels(actor(req), courseId);
    sendSuccess(res, { access, channels, onlineUserIds: await onlineUsers(courseId) });
  })
);

// @route GET /api/chat/communities/:courseId/members — community members with profiles and course roles
router.get(
  '/communities/:courseId/members',
  h(async (req, res) => {
    const courseId = p(req.params.courseId);
    const members = await svc.communityMembers(actor(req), courseId);
    const online = new Set(await onlineUsers(courseId));
    sendSuccess(
      res,
      members.map((m) => ({ ...m, online: online.has(m.userId) }))
    );
  })
);

// @route GET /api/chat/communities/:courseId/search — search messages in the channels you can see (?q=)
router.get(
  '/communities/:courseId/search',
  h(async (req, res) =>
    sendSuccess(
      res,
      await svc.searchMessages(actor(req), p(req.params.courseId), String(req.query.q || ''))
    )
  )
);

// @route POST /api/chat/communities/:courseId/channels — create a text, announcement or voice channel (moderators)
router.post(
  '/communities/:courseId/channels',
  h(async (req, res) => {
    if (!req.body?.name || String(req.body.name).trim().length < 2)
      throw new BadRequestError('Channel name is required.');
    const room = await svc.createChannel(actor(req), p(req.params.courseId), req.body);
    emitToCourse(room.courseId!, 'channel:changed', { courseId: room.courseId });
    sendSuccess(res, room, 201);
  })
);

// raw upload: body is the file, name in ?name=, type from Content-Type
// @route POST /api/chat/communities/:courseId/files — upload a file or image to share in the community (raw body, ?name=, max 10MB)
router.post(
  '/communities/:courseId/files',
  express.raw({ type: () => true, limit: svc.MAX_FILE_BYTES }),
  h(async (req, res) => {
    const file = await svc.saveFile(
      actor(req),
      p(req.params.courseId),
      String(req.query.name || 'file'),
      String(req.headers['content-type'] || 'application/octet-stream'),
      req.body as Buffer
    );
    sendSuccess(res, file, 201);
  })
);

// @route GET /api/chat/files/:id — download a community file (members only)
router.get(
  '/files/:id',
  h(async (req, res) => {
    const { file, stream } = await svc.openFile(actor(req), p(req.params.id));
    res.setHeader('Content-Type', String(file.metadata?.contentType || 'application/octet-stream'));
    res.setHeader('Content-Length', String(file.length));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.pipe(res);
  })
);

// ------------------------------------------------------------------ channels
// @route PUT /api/chat/channels/:id — rename, describe or change a channel's visibility (moderators)
router.put(
  '/channels/:id',
  h(async (req, res) => {
    const room = await svc.updateChannel(actor(req), p(req.params.id), req.body || {});
    emitToCourse(room.courseId!, 'channel:changed', { courseId: room.courseId });
    sendSuccess(res, room);
  })
);

// @route DELETE /api/chat/channels/:id — archive a channel (moderators)
router.delete(
  '/channels/:id',
  h(async (req, res) => {
    const room = await svc.archiveChannel(actor(req), p(req.params.id));
    emitToCourse(room.courseId!, 'channel:changed', { courseId: room.courseId });
    sendSuccess(res, { id: room._id });
  })
);

// @route POST /api/chat/channels/:id/members — add a member to a private channel (moderators)
router.post(
  '/channels/:id/members',
  h(async (req, res) => {
    const room = await svc.setChannelMember(
      actor(req),
      p(req.params.id),
      String(req.body?.userId),
      true
    );
    emitToCourse(room.courseId!, 'channel:changed', { courseId: room.courseId });
    sendSuccess(res, room);
  })
);

// @route DELETE /api/chat/channels/:id/members/:userId — remove a member from a private channel (moderators)
router.delete(
  '/channels/:id/members/:userId',
  h(async (req, res) => {
    const room = await svc.setChannelMember(
      actor(req),
      p(req.params.id),
      p(req.params.userId),
      false
    );
    emitToCourse(room.courseId!, 'channel:changed', { courseId: room.courseId });
    sendSuccess(res, room);
  })
);

// @route GET /api/chat/channels/:id/messages — channel messages, newest page first (?before= for older)
router.get(
  '/channels/:id/messages',
  h(async (req, res) =>
    sendSuccess(
      res,
      await svc.listMessages(
        actor(req),
        p(req.params.id),
        req.query.before ? String(req.query.before) : undefined
      )
    )
  )
);

// @route POST /api/chat/channels/:id/read — mark a channel read
router.post(
  '/channels/:id/read',
  h(async (req, res) => {
    await svc.markRead(actor(req), p(req.params.id));
    sendSuccess(res, { ok: true });
  })
);

// ------------------------------------------------------------------ messages
// @route GET /api/chat/messages/:id/thread — a message and its thread replies
router.get(
  '/messages/:id/thread',
  h(async (req, res) => sendSuccess(res, await svc.threadOf(actor(req), p(req.params.id))))
);

// @route PUT /api/chat/messages/:id — edit your own message
router.put(
  '/messages/:id',
  h(async (req, res) => {
    const msg = await svc.editMessage(
      actor(req),
      p(req.params.id),
      String(req.body?.content || '')
    );
    emitToChannel(msg.roomId, 'message:updated', msg);
    sendSuccess(res, msg);
  })
);

// @route DELETE /api/chat/messages/:id — delete a message (author or moderator)
router.delete(
  '/messages/:id',
  h(async (req, res) => {
    const msg = await svc.deleteMessage(actor(req), p(req.params.id));
    emitToChannel(msg.roomId, 'message:deleted', {
      messageId: String(msg._id),
      roomId: msg.roomId,
      parentId: msg.replyTo?.messageId
    });
    sendSuccess(res, { id: msg._id });
  })
);

// @route POST /api/chat/messages/:id/react — toggle an emoji reaction
router.post(
  '/messages/:id/react',
  h(async (req, res) => {
    const msg = await svc.toggleReaction(
      actor(req),
      p(req.params.id),
      String(req.body?.emoji || '')
    );
    emitToChannel(msg.roomId, 'message:updated', msg);
    sendSuccess(res, msg);
  })
);

// @route POST /api/chat/messages/:id/pin — pin or unpin a message (moderators)
router.post(
  '/messages/:id/pin',
  h(async (req, res) => {
    const msg = await svc.togglePin(actor(req), p(req.params.id));
    emitToChannel(msg.roomId, 'message:updated', msg);
    sendSuccess(res, msg);
  })
);

// ------------------------------------------------------------------ voice
// @route POST /api/chat/channels/:id/voice-token — LiveKit access token scoped to one voice channel
router.post(
  '/channels/:id/voice-token',
  h(async (req, res) => sendSuccess(res, await svc.voiceToken(actor(req), p(req.params.id))))
);

// ------------------------------------------------------------------ notifications
// @route GET /api/chat/notifications — your mention, reply and announcement notifications
router.get(
  '/notifications',
  h(async (req, res) => sendSuccess(res, await svc.listNotifications(actor(req))))
);

// @route POST /api/chat/notifications/read — mark notifications read (all, or ids[])
router.post(
  '/notifications/read',
  h(async (req, res) => {
    await svc.readNotifications(actor(req), req.body?.ids);
    emitToUsers([req.user!.userId], 'notification:read', {});
    sendSuccess(res, { ok: true });
  })
);

export default router;
