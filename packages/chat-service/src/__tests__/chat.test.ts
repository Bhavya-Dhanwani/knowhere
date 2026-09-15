import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import createApp from '../app.js';
import ChatRoomDao from '../shared/dao/room.dao.js';
import ChatMessageDao from '../shared/dao/message.dao.js';
import env from '../shared/config/env.config.js';

describe('Chat Service Unit & Integration Tests', () => {
  const app = createApp();

  const userToken = jwt.sign(
    { userId: 'user-123', role: 'trainee', email: 'trainee@example.com', name: 'Alex' },
    env.ACCESS_TOKEN_SECRET
  );

  const trainerToken = jwt.sign(
    { userId: 'trainer-456', role: 'trainer', email: 'trainer@example.com', name: 'Sarah' },
    env.ACCESS_TOKEN_SECRET
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('returns status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /api/chat/rooms', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/chat/rooms').send({ name: 'general' });
      expect(res.status).toBe(401);
    });

    it('creates a new chat room successfully', async () => {
      const mockRoom = {
        _id: 'room-1',
        name: 'General Chat',
        slug: 'general-chat-ab12',
        description: 'Open discussion channel',
        type: 'public',
        creatorId: 'user-123',
        members: [{ userId: 'user-123', role: 'owner' }],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(ChatRoomDao.prototype, 'createRoom').mockResolvedValue(mockRoom as any);

      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'General Chat',
          description: 'Open discussion channel',
          type: 'public'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('General Chat');
    });
  });

  describe('GET /api/chat/rooms', () => {
    it('lists accessible chat rooms', async () => {
      const mockRooms = [
        { _id: 'room-1', name: 'General', type: 'public', members: [] },
        { _id: 'room-2', name: 'Study Group', type: 'private_group', members: [] }
      ];

      jest.spyOn(ChatRoomDao.prototype, 'findRooms').mockResolvedValue(mockRooms as any);

      const res = await request(app)
        .get('/api/chat/rooms')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('POST /api/chat/rooms/:roomId/messages', () => {
    it('sends a new message in a room', async () => {
      const mockRoom = { _id: 'room-1', isArchived: false };
      const mockMessage = {
        _id: 'msg-1',
        roomId: 'room-1',
        sender: { userId: 'user-123', name: 'Alex', role: 'trainee' },
        content: 'Hello everyone!',
        attachments: [],
        reactions: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(ChatRoomDao.prototype, 'findRoomById').mockResolvedValue(mockRoom as any);
      jest.spyOn(ChatRoomDao.prototype, 'updateLastMessage').mockResolvedValue(undefined as any);
      jest.spyOn(ChatMessageDao.prototype, 'createMessage').mockResolvedValue(mockMessage as any);

      const res = await request(app)
        .post('/api/chat/rooms/room-1/messages')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Hello everyone!' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Hello everyone!');
    });
  });

  describe('GET /api/chat/rooms/:roomId/messages', () => {
    it('retrieves messages for a room', async () => {
      const mockRoom = { _id: 'room-1', isArchived: false };
      const mockMessages = [
        { _id: 'msg-1', roomId: 'room-1', content: 'Message 1' },
        { _id: 'msg-2', roomId: 'room-1', content: 'Message 2' }
      ];

      jest.spyOn(ChatRoomDao.prototype, 'findRoomById').mockResolvedValue(mockRoom as any);
      jest
        .spyOn(ChatMessageDao.prototype, 'getRoomMessages')
        .mockResolvedValue(mockMessages as any);

      const res = await request(app)
        .get('/api/chat/rooms/room-1/messages')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('POST /api/chat/messages/:messageId/react', () => {
    it('adds or toggles an emoji reaction', async () => {
      const mockUpdatedMessage = {
        _id: 'msg-1',
        roomId: 'room-1',
        content: 'Awesome update!',
        reactions: [{ emoji: '🚀', users: ['user-123'], count: 1 }]
      };

      jest
        .spyOn(ChatMessageDao.prototype, 'toggleReaction')
        .mockResolvedValue(mockUpdatedMessage as any);

      const res = await request(app)
        .post('/api/chat/messages/msg-1/react')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ emoji: '🚀' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reactions[0].emoji).toBe('🚀');
    });
  });
});
