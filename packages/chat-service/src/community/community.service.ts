// Course communities: every course gets its own set of channels. Access follows course
// enrolment in user-service; course admins/trainers (and platform admins) moderate.
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import {
  createMembershipClient,
  CourseRole,
  ForbiddenError,
  NotFoundError,
  BadRequestError
} from '@lms/shared';
import env from '../shared/config/env.config.js';
import ChatRoom, { IChatRoom, ChannelKind } from '../shared/models/room.model.js';
import ChatMessage, { IChatMessage, IAttachment } from '../shared/models/message.model.js';
import ReadState from '../shared/models/readState.model.js';
import Notification, { NotificationType } from '../shared/models/notification.model.js';

export const memberships = createMembershipClient({
  userServiceUrl: env.USER_SERVICE_URL,
  service: 'chat-service'
});

export interface Actor {
  userId: string;
  name?: string;
  role?: string;
}

export interface CommunityAccess {
  courseId: string;
  role: CourseRole;
  moderator: boolean;
}

const DEFAULT_CHANNELS: { name: string; kind: ChannelKind; description: string }[] = [
  { name: 'general', kind: 'text', description: 'Say hi and talk about anything course related.' },
  { name: 'announcements', kind: 'announcement', description: 'Updates from your instructors.' },
  {
    name: 'course-discussion',
    kind: 'text',
    description: 'Questions and discussion about the material.'
  },
  { name: 'study-room', kind: 'voice', description: 'Drop in to talk it through.' }
];

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'channel';

export async function communityAccess(actor: Actor, courseId: string): Promise<CommunityAccess> {
  if (actor.role === 'admin') return { courseId, role: 'admin', moderator: true };
  const member = await memberships.memberOf(courseId, actor.userId);
  if (!member) throw new ForbiddenError('Join this course to access its community.');
  return { courseId, role: member.role, moderator: member.role !== 'trainee' };
}

export function canSeeChannel(room: IChatRoom, actor: Actor, access: CommunityAccess) {
  return (
    room.visibility === 'public' ||
    access.moderator ||
    room.members.some((m) => m.userId === actor.userId)
  );
}

// loads a channel and checks the actor may read it
export async function channelAccess(actor: Actor, roomId: string) {
  if (!mongoose.isValidObjectId(roomId)) throw new NotFoundError('Channel not found');
  const room = await ChatRoom.findById(roomId);
  if (!room || room.isArchived || !room.courseId) throw new NotFoundError('Channel not found');
  const access = await communityAccess(actor, room.courseId);
  if (!canSeeChannel(room, actor, access)) throw new ForbiddenError('This channel is private.');
  return { room, access };
}

// first visit to a community creates its default channels
async function ensureDefaultChannels(courseId: string, creatorId: string) {
  if (await ChatRoom.exists({ courseId, type: 'course' })) return;
  await ChatRoom.insertMany(
    DEFAULT_CHANNELS.map((c, i) => ({
      ...c,
      slug: `${courseId}-${c.name}`,
      type: 'course',
      courseId,
      visibility: 'public',
      position: i,
      creatorId
    })),
    { ordered: false }
  ).catch(() => undefined); // a concurrent first visit may have created them already
}

export async function listChannels(actor: Actor, courseId: string) {
  const access = await communityAccess(actor, courseId);
  await ensureDefaultChannels(courseId, actor.userId);

  const rooms = (
    await ChatRoom.find({ courseId, type: 'course', isArchived: false }).sort({
      position: 1,
      createdAt: 1
    })
  ).filter((r) => canSeeChannel(r, actor, access));
  const reads = new Map(
    (
      await ReadState.find({
        userId: actor.userId,
        roomId: { $in: rooms.map((r) => String(r._id)) }
      })
    ).map((r) => [r.roomId, r.lastReadAt])
  );

  // one aggregation for every channel: messages from others newer than my last read of it
  const text = rooms.filter((r) => r.kind !== 'voice');
  const counts = new Map<string, number>();
  if (text.length) {
    const grouped = await ChatMessage.aggregate<{ _id: string; n: number }>([
      {
        $match: {
          deletedAt: null,
          'sender.userId': { $ne: actor.userId },
          $or: text.map((r) => ({
            roomId: String(r._id),
            createdAt: { $gt: reads.get(String(r._id)) || new Date(0) }
          }))
        }
      },
      { $group: { _id: '$roomId', n: { $sum: 1 } } }
    ]);
    for (const g of grouped) counts.set(g._id, g.n);
  }
  const channels = rooms.map((r) => ({ ...r.toObject(), unread: counts.get(String(r._id)) || 0 }));
  return { access, channels };
}

export async function createChannel(
  actor: Actor,
  courseId: string,
  input: {
    name: string;
    description?: string;
    kind?: ChannelKind;
    visibility?: 'public' | 'private';
    memberIds?: string[];
  }
) {
  const access = await communityAccess(actor, courseId);
  if (!access.moderator) throw new ForbiddenError('Only course moderators can create channels.');

  const members = await memberships.members(courseId);
  const valid = new Set(members.map((m) => m.userId));
  const memberIds = [...new Set([actor.userId, ...(input.memberIds || [])])].filter(
    (id) => id === actor.userId || valid.has(id)
  );
  const count = await ChatRoom.countDocuments({ courseId, type: 'course' });

  return await ChatRoom.create({
    name: slugify(input.name),
    slug: `${courseId}-${slugify(input.name)}-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    description: input.description?.trim() || '',
    type: 'course',
    courseId,
    kind: input.kind || 'text',
    visibility: input.visibility || 'public',
    position: count,
    creatorId: actor.userId,
    members:
      input.visibility === 'private'
        ? memberIds.map((userId) => ({
            userId,
            role: userId === actor.userId ? 'owner' : 'member',
            joinedAt: new Date(),
            lastReadAt: new Date()
          }))
        : []
  });
}

export async function updateChannel(
  actor: Actor,
  roomId: string,
  input: {
    name?: string;
    description?: string;
    visibility?: 'public' | 'private';
    kind?: ChannelKind;
  }
) {
  const { room, access } = await channelAccess(actor, roomId);
  if (!access.moderator) throw new ForbiddenError('Only course moderators can edit channels.');
  if (input.name) room.name = slugify(input.name);
  if (input.description !== undefined) room.description = input.description.trim();
  if (input.kind) room.kind = input.kind;
  if (input.visibility) {
    room.visibility = input.visibility;
    if (input.visibility === 'private' && !room.members.some((m) => m.userId === actor.userId)) {
      room.members.push({
        userId: actor.userId,
        role: 'owner',
        joinedAt: new Date(),
        lastReadAt: new Date()
      });
    }
  }
  return await room.save();
}

export async function archiveChannel(actor: Actor, roomId: string) {
  const { room, access } = await channelAccess(actor, roomId);
  if (!access.moderator) throw new ForbiddenError('Only course moderators can delete channels.');
  room.isArchived = true;
  await room.save();
  return room;
}

export async function setChannelMember(actor: Actor, roomId: string, userId: string, add: boolean) {
  const { room, access } = await channelAccess(actor, roomId);
  if (!access.moderator)
    throw new ForbiddenError('Only course moderators can manage channel members.');
  if (room.visibility !== 'private')
    throw new BadRequestError('Public channels include every course member.');
  if (add) {
    if (!(await memberships.memberOf(room.courseId!, userId))) {
      throw new BadRequestError('That person is not enrolled in this course.');
    }
    if (!room.members.some((m) => m.userId === userId)) {
      room.members.push({ userId, role: 'member', joinedAt: new Date(), lastReadAt: new Date() });
    }
  } else {
    room.members = room.members.filter((m) => m.userId !== userId);
  }
  return await room.save();
}

export async function communityMembers(actor: Actor, courseId: string) {
  await communityAccess(actor, courseId);
  const members = await memberships.members(courseId);
  const profiles = new Map(
    (await memberships.profiles(members.map((m) => m.userId))).map((p) => [p.userId, p])
  );
  return members.map((m) => ({
    userId: m.userId,
    role: m.role,
    name: profiles.get(m.userId)?.name || 'Member',
    avatar: profiles.get(m.userId)?.avatar || '',
    bio: profiles.get(m.userId)?.bio || ''
  }));
}

export async function markRead(actor: Actor, roomId: string) {
  await channelAccess(actor, roomId);
  await ReadState.updateOne(
    { userId: actor.userId, roomId },
    { $set: { lastReadAt: new Date() } },
    { upsert: true }
  );
}

export async function listMessages(actor: Actor, roomId: string, beforeId?: string, limit = 50) {
  await channelAccess(actor, roomId);
  const query: Record<string, unknown> = {
    roomId,
    deletedAt: null,
    'replyTo.messageId': { $exists: false }
  };
  if (beforeId && mongoose.isValidObjectId(beforeId)) {
    const before = await ChatMessage.findById(beforeId);
    if (before) query.createdAt = { $lt: before.createdAt };
  }
  const messages = await ChatMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100));
  return messages.reverse();
}

export async function threadOf(actor: Actor, messageId: string) {
  const root = mongoose.isValidObjectId(messageId) ? await ChatMessage.findById(messageId) : null;
  if (!root) throw new NotFoundError('Message not found');
  await channelAccess(actor, root.roomId);
  const replies = await ChatMessage.find({ 'replyTo.messageId': messageId, deletedAt: null }).sort({
    createdAt: 1
  });
  return { root, replies };
}

export async function searchMessages(actor: Actor, courseId: string, q: string) {
  const { channels } = await listChannels(actor, courseId);
  if (!q.trim()) return [];
  const escaped = q
    .trim()
    .slice(0, 100)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return await ChatMessage.find({
    roomId: { $in: channels.map((c) => String(c._id)) },
    deletedAt: null,
    content: { $regex: escaped, $options: 'i' }
  })
    .sort({ createdAt: -1 })
    .limit(50);
}

// Creates the message and returns who should be notified; callers broadcast.
export async function postMessage(
  actor: Actor,
  input: {
    roomId: string;
    content?: string;
    attachments?: IAttachment[];
    replyToId?: string;
    mentions?: string[];
  }
) {
  const { room, access } = await channelAccess(actor, input.roomId);
  const content = (input.content || '').trim();
  const attachments = (input.attachments || []).slice(0, 10);
  if (!content && !attachments.length) throw new BadRequestError('Message is empty.');
  if (content.length > 4000)
    throw new BadRequestError('Message is too long (4000 characters max).');
  if (room.kind === 'voice') throw new BadRequestError('Voice channels have no text chat.');
  if (room.kind === 'announcement' && !access.moderator && !input.replyToId) {
    throw new ForbiddenError('Only instructors can post announcements.');
  }
  // attachments must be files uploaded to this course's community
  for (const a of attachments) {
    const fileId = a.url.split('/').pop() || '';
    const file = mongoose.isValidObjectId(fileId)
      ? await files()
          .find({ _id: new mongoose.Types.ObjectId(fileId) })
          .next()
      : null;
    if (!file || file.metadata?.courseId !== room.courseId)
      throw new BadRequestError('Unknown attachment.');
  }

  let parent: IChatMessage | null = null;
  if (input.replyToId) {
    parent = mongoose.isValidObjectId(input.replyToId)
      ? await ChatMessage.findById(input.replyToId)
      : null;
    if (!parent || parent.roomId !== input.roomId || parent.deletedAt) {
      throw new BadRequestError('The message you are replying to is gone.');
    }
  }

  const members = await memberships.members(room.courseId!);
  const enrolled = new Set(members.map((m) => m.userId));
  const mentions = [...new Set(input.mentions || [])].filter(
    (id) => enrolled.has(id) && id !== actor.userId
  );

  const message = await ChatMessage.create({
    roomId: input.roomId,
    sender: { userId: actor.userId, name: actor.name || 'Member', avatar: '', role: access.role },
    content,
    attachments,
    mentions,
    ...(parent && {
      replyTo: {
        messageId: String(parent._id),
        senderName: parent.sender.name,
        snippet: parent.content.slice(0, 120)
      }
    })
  });
  if (parent) await ChatMessage.updateOne({ _id: parent._id }, { $inc: { replyCount: 1 } });

  room.lastMessage = {
    messageId: String(message._id),
    content: content.slice(0, 100) || 'Sent an attachment',
    senderId: actor.userId,
    senderName: actor.name || 'Member',
    createdAt: message.createdAt
  };
  await room.save();

  // who hears about it
  const notify = new Map<string, NotificationType>();
  if (room.kind === 'announcement' && !parent) {
    members.forEach((m) => m.userId !== actor.userId && notify.set(m.userId, 'announcement'));
  }
  if (parent && parent.sender.userId !== actor.userId) notify.set(parent.sender.userId, 'reply');
  mentions.forEach((id) => notify.set(id, 'mention'));
  // private channels only notify people who can see them
  if (room.visibility === 'private') {
    const allowed = new Set(room.members.map((m) => m.userId));
    const mods = new Set(members.filter((m) => m.role !== 'trainee').map((m) => m.userId));
    [...notify.keys()].forEach((id) => !allowed.has(id) && !mods.has(id) && notify.delete(id));
  }

  const notifications = notify.size
    ? await Notification.insertMany(
        [...notify].map(([userId, type]) => ({
          userId,
          type,
          courseId: room.courseId!,
          roomId: input.roomId,
          messageId: String(message._id),
          actorName: actor.name || 'Member',
          text: `${type === 'mention' ? 'mentioned you in' : type === 'reply' ? 'replied in' : 'posted in'} #${room.name}: ${content.slice(0, 80) || 'an attachment'}`
        }))
      )
    : [];

  return { room, message, parent, notifications };
}

export async function editMessage(actor: Actor, messageId: string, content: string) {
  const msg = mongoose.isValidObjectId(messageId) ? await ChatMessage.findById(messageId) : null;
  if (!msg || msg.deletedAt) throw new NotFoundError('Message not found');
  await channelAccess(actor, msg.roomId);
  if (msg.sender.userId !== actor.userId)
    throw new ForbiddenError('You can only edit your own messages.');
  if (!content.trim()) throw new BadRequestError('Message is empty.');
  msg.content = content.trim().slice(0, 4000);
  msg.isEdited = true;
  return await msg.save();
}

export async function deleteMessage(actor: Actor, messageId: string) {
  const msg = mongoose.isValidObjectId(messageId) ? await ChatMessage.findById(messageId) : null;
  if (!msg || msg.deletedAt) throw new NotFoundError('Message not found');
  const { access } = await channelAccess(actor, msg.roomId);
  if (msg.sender.userId !== actor.userId && !access.moderator) {
    throw new ForbiddenError('You can only delete your own messages.');
  }
  msg.deletedAt = new Date();
  msg.content = '';
  msg.attachments = [];
  await msg.save();
  if (msg.replyTo?.messageId)
    await ChatMessage.updateOne({ _id: msg.replyTo.messageId }, { $inc: { replyCount: -1 } });
  return msg;
}

export async function toggleReaction(actor: Actor, messageId: string, emoji: string) {
  const msg = mongoose.isValidObjectId(messageId) ? await ChatMessage.findById(messageId) : null;
  if (!msg || msg.deletedAt) throw new NotFoundError('Message not found');
  await channelAccess(actor, msg.roomId);
  if (!emoji || emoji.length > 16) throw new BadRequestError('Invalid emoji');
  const r = msg.reactions.find((x) => x.emoji === emoji);
  if (!r) msg.reactions.push({ emoji, users: [actor.userId], count: 1 });
  else if (r.users.includes(actor.userId)) {
    r.users = r.users.filter((u) => u !== actor.userId);
    r.count = r.users.length;
    if (!r.count) msg.reactions = msg.reactions.filter((x) => x.emoji !== emoji);
  } else {
    r.users.push(actor.userId);
    r.count = r.users.length;
  }
  return await msg.save();
}

export async function togglePin(actor: Actor, messageId: string) {
  const msg = mongoose.isValidObjectId(messageId) ? await ChatMessage.findById(messageId) : null;
  if (!msg || msg.deletedAt) throw new NotFoundError('Message not found');
  const { room, access } = await channelAccess(actor, msg.roomId);
  if (!access.moderator) throw new ForbiddenError('Only moderators can pin messages.');
  msg.isPinned = !msg.isPinned;
  room.pinnedMessageIds = msg.isPinned
    ? [...room.pinnedMessageIds, String(msg._id)]
    : room.pinnedMessageIds.filter((id) => id !== String(msg._id));
  await room.save();
  return await msg.save();
}

// ------------------------------------------------------------------ files (GridFS)
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const files = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'chatFiles' });

export async function saveFile(
  actor: Actor,
  courseId: string,
  name: string,
  contentType: string,
  data: Buffer
) {
  await communityAccess(actor, courseId);
  if (!data.length) throw new BadRequestError('Empty file.');
  if (data.length > MAX_FILE_BYTES) throw new BadRequestError('Files are limited to 10 MB.');
  const safeName = name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'file';
  const upload = files().openUploadStream(safeName, {
    metadata: { courseId, uploaderId: actor.userId, contentType }
  });
  await new Promise<void>((resolve, reject) =>
    upload.end(data, (err?: Error | null) => (err ? reject(err) : resolve()))
  );
  return {
    url: `/api/chat/files/${upload.id.toString()}`,
    name: safeName,
    sizeBytes: data.length,
    type: contentType.startsWith('image/')
      ? 'image'
      : contentType.startsWith('video/')
        ? 'video'
        : 'file'
  } as IAttachment;
}

export async function openFile(actor: Actor, fileId: string) {
  if (!mongoose.isValidObjectId(fileId)) throw new NotFoundError('File not found');
  const _id = new mongoose.Types.ObjectId(fileId);
  const file = await files().find({ _id }).next();
  if (!file) throw new NotFoundError('File not found');
  await communityAccess(actor, String(file.metadata?.courseId));
  return { file, stream: files().openDownloadStream(_id) };
}

// ------------------------------------------------------------------ notifications
export async function listNotifications(actor: Actor) {
  const [items, unread] = await Promise.all([
    Notification.find({ userId: actor.userId }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ userId: actor.userId, readAt: null })
  ]);
  return { items, unread };
}

export async function readNotifications(actor: Actor, ids?: string[]) {
  await Notification.updateMany(
    { userId: actor.userId, readAt: null, ...(ids?.length ? { _id: { $in: ids } } : {}) },
    { $set: { readAt: new Date() } }
  );
}

// LiveKit access token for one voice channel (HS256 JWT signed with the API secret). The grant
// is scoped to that channel's LiveKit room, so it cannot be reused to enter any other call.
export async function voiceToken(actor: Actor, roomId: string, ttlSec = 6 * 3600) {
  const { room } = await channelAccess(actor, roomId);
  if (room.kind !== 'voice') throw new BadRequestError('Not a voice channel.');
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new BadRequestError('Voice is not configured on this server.');
  }
  const token = jwt.sign(
    {
      name: actor.name || actor.userId,
      video: {
        room: `voice-${roomId}`,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false
      }
    },
    env.LIVEKIT_API_SECRET,
    {
      issuer: env.LIVEKIT_API_KEY,
      subject: actor.userId,
      expiresIn: ttlSec,
      notBefore: 0,
      jwtid: actor.userId
    }
  );
  return { url: env.LIVEKIT_URL, token };
}
