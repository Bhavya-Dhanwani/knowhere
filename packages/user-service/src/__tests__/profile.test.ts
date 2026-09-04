import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import createApp from '../app.js';
import UserProfileDao from '../shared/dao/userProfile.dao.js';
import env from '../shared/config/env.config.js';

describe('Profile Module Integration & Authorization Tests', () => {
  const app = createApp();

  const traineeToken = jwt.sign(
    { userId: 'trainee-1', role: 'trainee', email: 'trainee@example.com', name: 'Trainee One' },
    env.ACCESS_TOKEN_SECRET
  );

  const intruderToken = jwt.sign(
    { userId: 'trainee-2', role: 'trainee', email: 'intruder@example.com', name: 'Intruder' },
    env.ACCESS_TOKEN_SECRET
  );

  const adminToken = jwt.sign(
    { userId: 'admin-1', role: 'admin', email: 'admin@example.com', name: 'Admin One' },
    env.ACCESS_TOKEN_SECRET
  );

  beforeEach(() => {
    jest
      .spyOn(UserProfileDao.prototype, 'findProfileByUserId')
      .mockImplementation(async (userId: string) => {
        if (userId === 'trainee-1') {
          return {
            userId: 'trainee-1',
            name: 'Trainee One',
            email: 'trainee@example.com',
            bio: 'Bio text',
            toObject: () => ({
              userId: 'trainee-1',
              name: 'Trainee One',
              email: 'trainee@example.com',
              bio: 'Bio text'
            })
          } as any;
        }
        return null;
      });

    jest
      .spyOn(UserProfileDao.prototype, 'upsertProfile')
      .mockImplementation(async (userId: string, updateData: any) => {
        return {
          userId,
          name: updateData.name || 'Updated Name',
          email: updateData.email || 'user@example.com',
          bio: updateData.bio || '',
          toObject: () => ({
            userId,
            name: updateData.name || 'Updated Name',
            email: updateData.email || 'user@example.com',
            bio: updateData.bio || ''
          })
        } as any;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /api/profiles/:userId should return 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/profiles/trainee-1');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/profiles/:userId should return profile for authenticated user', async () => {
    const res = await request(app)
      .get('/api/profiles/trainee-1')
      .set('Authorization', `Bearer ${traineeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe('trainee-1');
  });

  it('PUT /api/profiles/:userId allows owner to update profile', async () => {
    const res = await request(app)
      .put('/api/profiles/trainee-1')
      .set('Authorization', `Bearer ${traineeToken}`)
      .send({ name: 'Trainee Updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Trainee Updated');
  });

  it('PUT /api/profiles/:userId rejects non-admin updating another profile with 403 Forbidden', async () => {
    const res = await request(app)
      .put('/api/profiles/trainee-1')
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ name: 'Malicious Name' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/profiles/:userId allows admin to update another user profile', async () => {
    const res = await request(app)
      .put('/api/profiles/trainee-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin Overridden Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Admin Overridden Name');
  });
});
