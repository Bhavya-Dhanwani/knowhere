import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import createApp from '../app.js';
import QuestionDao from '../shared/dao/question.dao.js';
import AttemptDao from '../shared/dao/attempt.dao.js';
import { getQuestionById } from '../services/questionExport.service.js';
import env from '../shared/config/env.config.js';

describe('MCQ Service Questions & 3-Strike Attempt Tests', () => {
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
    it('creates MCQ question for trainer with options and correct_option_id', async () => {
      jest.spyOn(QuestionDao.prototype, 'createQuestion').mockResolvedValue({
        _id: '507f1f77bcf86cd799439077',
        title: 'JavaScript Event Loop',
        stem: 'What is the microtask queue priority?',
        options: [
          { id: 'opt-1', text: 'Higher than macrotask' },
          { id: 'opt-2', text: 'Lower than macrotask' }
        ],
        correct_option_id: 'opt-1',
        max_score: 2,
        explanation: 'Promises run before setTimeout callbacks',
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
          title: 'JavaScript Event Loop',
          stem: 'What is the microtask queue priority?',
          options: [
            { id: 'opt-1', text: 'Higher than macrotask' },
            { id: 'opt-2', text: 'Lower than macrotask' }
          ],
          correct_option_id: 'opt-1',
          max_score: 2,
          explanation: 'Promises run before setTimeout callbacks'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.correct_option_id).toBe('opt-1');
    });

    it('rejects trainee creating question with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({
          title: 'Hacked question',
          stem: 'Invalid',
          options: [
            { id: '1', text: 'A' },
            { id: '2', text: 'B' }
          ],
          correct_option_id: '1'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/questions/:id/display', () => {
    it('returns question stripped of correct_option_id for trainee display', async () => {
      jest.spyOn(QuestionDao.prototype, 'findQuestionForDisplay').mockResolvedValue({
        _id: '507f1f77bcf86cd799439077',
        title: 'JavaScript Event Loop',
        stem: 'What is the microtask queue priority?',
        options: [
          { id: 'opt-1', text: 'Higher than macrotask' },
          { id: 'opt-2', text: 'Lower than macrotask' }
        ],
        max_score: 2,
        creatorId: 'trainer-1',
        createdAt: new Date()
      } as any);

      const res = await request(app)
        .get('/api/questions/507f1f77bcf86cd799439077/display')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.correct_option_id).toBeUndefined();
      expect(res.body.data.options).toHaveLength(2);
    });

    it('exports getQuestionById for cross-module course-service calls', async () => {
      jest.spyOn(QuestionDao.prototype, 'findQuestionForDisplay').mockResolvedValue({
        _id: '507f1f77bcf86cd799439077',
        title: 'JavaScript Event Loop',
        stem: 'What is the microtask queue priority?',
        options: [
          { id: 'opt-1', text: 'Higher than macrotask' },
          { id: 'opt-2', text: 'Lower than macrotask' }
        ],
        max_score: 2,
        creatorId: 'trainer-1',
        createdAt: new Date()
      } as any);

      const exported = await getQuestionById('507f1f77bcf86cd799439077');
      expect(exported).not.toBeNull();
      expect(exported?.title).toBe('JavaScript Event Loop');
      expect(exported?.max_score).toBe(2);
    });
  });

  describe('POST /api/questions/:id/submit (Strict 3-Strike Logic)', () => {
    const mockQuestion = {
      _id: '507f1f77bcf86cd799439077',
      title: 'JavaScript Event Loop',
      correct_option_id: 'opt-1',
      max_score: 2,
      explanation: 'Promises run first'
    };

    it('allows 1st attempt and computes score', async () => {
      jest.spyOn(QuestionDao.prototype, 'findQuestionById').mockResolvedValue(mockQuestion as any);
      jest.spyOn(AttemptDao.prototype, 'getAttemptCount').mockResolvedValue(0);
      jest.spyOn(AttemptDao.prototype, 'createAttempt').mockResolvedValue({
        _id: 'attempt-1',
        attemptNumber: 1
      } as any);

      const res = await request(app)
        .post('/api/questions/507f1f77bcf86cd799439077/submit')
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({ selected_option_id: 'opt-1' });

      expect(res.status).toBe(200);
      expect(res.body.data.attemptNumber).toBe(1);
      expect(res.body.data.attemptsRemaining).toBe(2);
      expect(res.body.data.isCorrect).toBe(true);
      expect(res.body.data.scoreAwarded).toBe(2);
    });

    it('strictly rejects 4th attempt with 403 Forbidden', async () => {
      jest.spyOn(QuestionDao.prototype, 'findQuestionById').mockResolvedValue(mockQuestion as any);
      // Already 3 attempts recorded
      jest.spyOn(AttemptDao.prototype, 'getAttemptCount').mockResolvedValue(3);

      const res = await request(app)
        .post('/api/questions/507f1f77bcf86cd799439077/submit')
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({ selected_option_id: 'opt-2' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Maximum attempt limit');
    });
  });
});
