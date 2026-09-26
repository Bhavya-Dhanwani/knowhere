import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import createApp from '../app.js';
import env from '../shared/config/env.config.js';
import ChatRoom, { IChatRoom } from '../shared/models/room.model.js';
import * as svc from '../community/community.service.js';
import { signAccessToken } from '@lms/shared';

const COURSE = '507f1f77bcf86cd799439050';
const ROOM = '507f1f77bcf86cd799439060';

const token = (userId: string, role: string) =>
  signAccessToken({ userId, role, email: `${userId}@example.com`, name: userId });

const member = (userId: string, role: 'admin' | 'trainer' | 'trainee') =>
  jest
    .spyOn(svc.memberships, 'memberOf')
    .mockImplementation(async (_c, id) =>
      id === userId ? ({ userId, role, assignedAt: new Date().toISOString() } as never) : null
    );

const room = (over: Partial<IChatRoom> = {}) =>
  ({
    _id: new mongoose.Types.ObjectId(ROOM),
    courseId: COURSE,
    name: 'general',
    kind: 'text',
    visibility: 'public',
    members: [],
    isArchived: false,
    ...over
  }) as unknown as IChatRoom;

describe('course community rules', () => {
  const app = createApp();

  afterEach(() => jest.restoreAllMocks());

  it('GET /health is public', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('rejects unauthenticated community requests', async () => {
    const res = await request(app).get(`/api/chat/communities/${COURSE}`);
    expect(res.status).toBe(401);
  });

  it('blocks users who are not enrolled in the course', async () => {
    jest.spyOn(svc.memberships, 'memberOf').mockResolvedValue(null);
    const res = await request(app)
      .get(`/api/chat/communities/${COURSE}`)
      .set('Authorization', `Bearer ${token('stranger', 'trainee')}`);
    expect(res.status).toBe(403);
  });

  it('derives moderator rights from the course role', async () => {
    member('alex', 'trainee');
    expect((await svc.communityAccess({ userId: 'alex', role: 'trainee' }, COURSE)).moderator).toBe(
      false
    );
    member('sarah', 'trainer');
    expect(
      (await svc.communityAccess({ userId: 'sarah', role: 'trainer' }, COURSE)).moderator
    ).toBe(true);
    // platform admins moderate every community without a membership
    expect((await svc.communityAccess({ userId: 'root', role: 'admin' }, COURSE)).moderator).toBe(
      true
    );
  });

  it('hides private channels from non-members', async () => {
    const priv = room({ visibility: 'private', members: [{ userId: 'sarah' }] as never });
    const student = { courseId: COURSE, role: 'trainee' as const, moderator: false };
    expect(svc.canSeeChannel(priv, { userId: 'alex' }, student)).toBe(false);
    expect(svc.canSeeChannel(priv, { userId: 'sarah' }, student)).toBe(true);
    expect(svc.canSeeChannel(priv, { userId: 'mod' }, { ...student, moderator: true })).toBe(true);
    expect(svc.canSeeChannel(room(), { userId: 'alex' }, student)).toBe(true);
  });

  it('returns 403 for a private channel the user is not in', async () => {
    member('alex', 'trainee');
    jest
      .spyOn(ChatRoom, 'findById')
      .mockResolvedValue(room({ visibility: 'private', members: [] }) as never);
    const res = await request(app)
      .get(`/api/chat/channels/${ROOM}/messages`)
      .set('Authorization', `Bearer ${token('alex', 'trainee')}`);
    expect(res.status).toBe(403);
  });

  it('only lets moderators post announcements', async () => {
    member('alex', 'trainee');
    jest.spyOn(ChatRoom, 'findById').mockResolvedValue(room({ kind: 'announcement' }) as never);
    await expect(
      svc.postMessage({ userId: 'alex', role: 'trainee' }, { roomId: ROOM, content: 'hi all' })
    ).rejects.toThrow(/Only instructors/);
  });

  it('refuses text in voice channels and empty messages', async () => {
    member('alex', 'trainee');
    jest.spyOn(ChatRoom, 'findById').mockResolvedValue(room({ kind: 'voice' }) as never);
    await expect(
      svc.postMessage({ userId: 'alex', role: 'trainee' }, { roomId: ROOM, content: 'hello' })
    ).rejects.toThrow(/Voice channels/);
    await expect(
      svc.postMessage({ userId: 'alex', role: 'trainee' }, { roomId: ROOM, content: '   ' })
    ).rejects.toThrow(/empty/);
  });

  it('only moderators may create channels', async () => {
    member('alex', 'trainee');
    const res = await request(app)
      .post(`/api/chat/communities/${COURSE}/channels`)
      .set('Authorization', `Bearer ${token('alex', 'trainee')}`)
      .send({ name: 'secret', kind: 'text', visibility: 'private' });
    expect(res.status).toBe(403);
  });
});

describe('voice tokens', () => {
  afterEach(() => jest.restoreAllMocks());

  it('issues a LiveKit grant scoped to that one voice channel', async () => {
    member('alex', 'trainee');
    jest.spyOn(ChatRoom, 'findById').mockResolvedValue(room({ kind: 'voice' }) as never);
    Object.assign(env, { LIVEKIT_API_KEY: 'key', LIVEKIT_API_SECRET: 'secret' });
    const { token } = await svc.voiceToken({ userId: 'alex', name: 'Alex' }, ROOM);
    const claims = jwt.verify(token, 'secret') as {
      iss: string;
      sub: string;
      video: { room: string; roomJoin: boolean };
    };
    expect(claims).toMatchObject({
      iss: 'key',
      sub: 'alex',
      video: { room: `voice-${ROOM}`, roomJoin: true }
    });
  });

  it('refuses text channels and non-members', async () => {
    member('alex', 'trainee');
    jest.spyOn(ChatRoom, 'findById').mockResolvedValue(room({ kind: 'text' }) as never);
    await expect(svc.voiceToken({ userId: 'alex' }, ROOM)).rejects.toThrow(/Not a voice channel/);
    jest.spyOn(svc.memberships, 'memberOf').mockResolvedValue(null);
    jest.spyOn(ChatRoom, 'findById').mockResolvedValue(room({ kind: 'voice' }) as never);
    await expect(svc.voiceToken({ userId: 'stranger' }, ROOM)).rejects.toThrow(/Join this course/);
  });
});
