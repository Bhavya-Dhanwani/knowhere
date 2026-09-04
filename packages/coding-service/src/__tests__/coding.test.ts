import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import createApp from '../app.js';
import CodingQuestionDao from '../shared/dao/question.dao.js';
import CodingSubmissionDao from '../shared/dao/submission.dao.js';
import { getQuestionById } from '../services/codingExport.service.js';
import env from '../shared/config/env.config.js';

describe('Coding Service Questions & Unlimited Submissions', () => {
  const app = createApp();

  const trainerToken = jwt.sign(
    { userId: 'trainer-1', role: 'trainer', email: 'trainer@example.com', name: 'Trainer One' },
    env.ACCESS_TOKEN_SECRET
  );

  const traineeToken = jwt.sign(
    { userId: 'trainee-1', role: 'trainee', email: 'trainee@example.com', name: 'Trainee One' },
    env.ACCESS_TOKEN_SECRET
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/questions', () => {
    it('creates coding problem with testcases for trainer', async () => {
      jest.spyOn(CodingQuestionDao.prototype, 'createQuestion').mockResolvedValue({
        _id: '507f1f77bcf86cd799439088',
        title: 'Two Sum',
        description: 'Find two indices that sum up to target',
        starterCode: new Map([['javascript', 'function twoSum(nums, target) {}']]),
        testCases: [
          { input: '[2,7,11,15], 9', expectedOutput: '[0,1]', isHidden: false },
          { input: '[3,2,4], 6', expectedOutput: '[1,2]', isHidden: true }
        ],
        timeLimitMs: 1000,
        memoryLimitMb: 128,
        max_score: 10,
        creatorId: 'trainer-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return this;
        }
      } as any);

      const res = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'Two Sum',
          description: 'Find two indices that sum up to target',
          testCases: [
            { input: '[2,7,11,15], 9', expectedOutput: '[0,1]', isHidden: false },
            { input: '[3,2,4], 6', expectedOutput: '[1,2]', isHidden: true }
          ],
          max_score: 10
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Two Sum');
    });

    it('rejects trainee from creating questions with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({
          title: 'Illegal problem',
          description: 'Test',
          testCases: [{ input: '1', expectedOutput: '1' }]
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/questions/:id/display (Strips hidden test cases)', () => {
    it('returns question with hidden test cases stripped', async () => {
      jest.spyOn(CodingQuestionDao.prototype, 'findQuestionForDisplay').mockResolvedValue({
        _id: '507f1f77bcf86cd799439088',
        title: 'Two Sum',
        description: 'Find two indices that sum up to target',
        testCases: [{ input: '[2,7,11,15], 9', expectedOutput: '[0,1]' }],
        max_score: 10,
        creatorId: 'trainer-1',
        createdAt: new Date()
      } as any);

      const res = await request(app)
        .get('/api/questions/507f1f77bcf86cd799439088/display')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sampleTestCases).toHaveLength(1);
    });

    it('exports getQuestionById for course-service aggregations', async () => {
      jest.spyOn(CodingQuestionDao.prototype, 'findQuestionForDisplay').mockResolvedValue({
        _id: '507f1f77bcf86cd799439088',
        title: 'Two Sum',
        description: 'Find two indices',
        testCases: [{ input: 'a', expectedOutput: 'b' }],
        max_score: 10,
        creatorId: 'trainer-1',
        createdAt: new Date()
      } as any);

      const exported = await getQuestionById('507f1f77bcf86cd799439088');
      expect(exported).not.toBeNull();
      expect(exported.title).toBe('Two Sum');
      expect(exported.max_score).toBe(10);
    });
  });

  describe('POST /api/questions/:id/submit (Unlimited Attempts Queued)', () => {
    it('allows submission and returns queued status', async () => {
      jest.spyOn(CodingQuestionDao.prototype, 'findQuestionById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439088',
        title: 'Two Sum',
        testCases: [{ input: '1', expectedOutput: '2' }]
      } as any);

      jest.spyOn(CodingSubmissionDao.prototype, 'createSubmission').mockResolvedValue({
        _id: '507f1f77bcf86cd799439099',
        questionId: '507f1f77bcf86cd799439088',
        userId: 'trainee-1',
        language: 'javascript',
        code: 'return [0,1];',
        status: 'queued',
        totalTestCases: 1,
        scoreAwarded: 0,
        passedTestCases: 0,
        createdAt: new Date(),
        toObject: function () {
          return this;
        }
      } as any);

      const res = await request(app)
        .post('/api/questions/507f1f77bcf86cd799439088/submit')
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({
          language: 'javascript',
          code: 'return [0,1];'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('queued');
    });
  });
});
