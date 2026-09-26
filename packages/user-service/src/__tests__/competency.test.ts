import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import createApp from '../app.js';
import CompetencyDao from '../shared/dao/competency.dao.js';
import env from '../shared/config/env.config.js';
import { signAccessToken } from '@lms/shared';

describe('Competency Module Integration & Authorization Tests', () => {
  const app = createApp();

  const traineeToken = signAccessToken({
    userId: 'trainee-1',
    role: 'trainee',
    email: 'trainee@example.com',
    name: 'Trainee One'
  });

  const adminToken = signAccessToken({
    userId: 'admin-1',
    role: 'admin',
    email: 'admin@example.com',
    name: 'Admin One'
  });

  beforeEach(() => {
    jest.spyOn(CompetencyDao.prototype, 'findCompetenciesByUserId').mockResolvedValue([
      {
        _id: 'comp-1',
        userId: 'trainee-1',
        skill: 'TypeScript',
        level: 'intermediate',
        score: 85,
        verifiedBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: () => ({
          _id: 'comp-1',
          userId: 'trainee-1',
          skill: 'TypeScript',
          level: 'intermediate',
          score: 85,
          verifiedBy: 'admin-1',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      } as any
    ]);

    jest
      .spyOn(CompetencyDao.prototype, 'upsertCompetency')
      .mockImplementation(async (data: any) => {
        return {
          _id: 'comp-new',
          userId: data.userId,
          skill: data.skill,
          level: data.level,
          score: data.score || 0,
          verifiedBy: data.verifiedBy || '',
          createdAt: new Date(),
          updatedAt: new Date(),
          toObject: () => ({
            _id: 'comp-new',
            userId: data.userId,
            skill: data.skill,
            level: data.level,
            score: data.score || 0,
            verifiedBy: data.verifiedBy || '',
            createdAt: new Date(),
            updatedAt: new Date()
          })
        } as any;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /api/competencies/:userId should return competencies for user', async () => {
    const res = await request(app)
      .get('/api/competencies/trainee-1')
      .set('Authorization', `Bearer ${traineeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].skill).toBe('TypeScript');
  });

  it('POST /api/competencies should allow admin to assign competency', async () => {
    const res = await request(app)
      .post('/api/competencies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: 'trainee-1',
        skill: 'Docker',
        level: 'beginner',
        score: 75
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.skill).toBe('Docker');
  });

  it('POST /api/competencies should reject trainee with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/competencies')
      .set('Authorization', `Bearer ${traineeToken}`)
      .send({
        userId: 'trainee-1',
        skill: 'Docker',
        level: 'beginner'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/competencies should reject invalid body with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/competencies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: 'trainee-1'
        // missing skill and level
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
