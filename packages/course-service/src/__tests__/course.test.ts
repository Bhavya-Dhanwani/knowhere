import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import createApp from '../app.js';
import CourseDao from '../shared/dao/course.dao.js';
import SubmoduleDao from '../shared/dao/submodule.dao.js';
import ContentItemDao from '../shared/dao/contentItem.dao.js';
import ModuleDao from '../shared/dao/module.dao.js';
import externalContentService from '../services/externalContent.service.js';
import env from '../shared/config/env.config.js';

describe('Course Service Integration & Content Attach Tests', () => {
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

  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { authorized: true, role: 'trainer' } })
    } as any);
    jest.spyOn(ModuleDao.prototype, 'findModuleById').mockResolvedValue({
      _id: '507f1f77bcf86cd799439033',
      courseId: '507f1f77bcf86cd799439011'
    } as any);
    jest.spyOn(SubmoduleDao.prototype, 'findSubmoduleById').mockResolvedValue({
      _id: '507f1f77bcf86cd799439022',
      moduleId: '507f1f77bcf86cd799439033'
    } as any);
    jest.spyOn(ContentItemDao.prototype, 'findContentItemById').mockResolvedValue({
      _id: '507f1f77bcf86cd799439044',
      submoduleId: '507f1f77bcf86cd799439022',
      type: 'video',
      ref_id: '507f1f77bcf86cd799439055',
      title: 'Intro Video',
      max_score: 0,
      order: 1,
      toObject: function () {
        return this;
      }
    } as any);
  });

  describe('Course Endpoints', () => {
    it('POST /api/courses creates course when trainer', async () => {
      jest.spyOn(CourseDao.prototype, 'createCourse').mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        title: 'TypeScript Masterclass',
        description: 'Advanced TypeScript',
        instructorId: 'trainer-1',
        tags: ['typescript', 'backend'],
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return this;
        }
      } as any);

      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'TypeScript Masterclass',
          description: 'Advanced TypeScript',
          tags: ['typescript', 'backend']
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('TypeScript Masterclass');
    });

    it('POST /api/courses rejects trainee with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({
          title: 'Hacked Course',
          description: 'Illegal course'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Submodule and Content Attachment Endpoints', () => {
    it('POST /api/submodules/:id/content-items validates ref_id and stores denormalized metadata', async () => {
      jest.spyOn(SubmoduleDao.prototype, 'findSubmoduleById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439022',
        title: 'Introduction Submodule',
        moduleId: '507f1f77bcf86cd799439033'
      } as any);

      jest.spyOn(externalContentService, 'validateAndFetchReference').mockResolvedValue({
        title: 'Intro Video',
        max_score: 0
      });

      jest.spyOn(ContentItemDao.prototype, 'createContentItem').mockResolvedValue({
        _id: '507f1f77bcf86cd799439044',
        submoduleId: '507f1f77bcf86cd799439022',
        type: 'video',
        ref_id: '507f1f77bcf86cd799439055',
        title: 'Intro Video',
        max_score: 0,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return this;
        }
      } as any);

      const res = await request(app)
        .post('/api/submodules/507f1f77bcf86cd799439022/content-items')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          type: 'video',
          ref_id: '507f1f77bcf86cd799439055',
          order: 1
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Intro Video');
    });

    it('GET /api/submodules/:id/content-items performs cheap list query without cross-module calls', async () => {
      jest.spyOn(ContentItemDao.prototype, 'listContentItemsBySubmoduleId').mockResolvedValue([
        {
          _id: '507f1f77bcf86cd799439044',
          submoduleId: '507f1f77bcf86cd799439022',
          type: 'video',
          ref_id: '507f1f77bcf86cd799439055',
          title: 'Intro Video',
          max_score: 0,
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          toObject: function () {
            return this;
          }
        }
      ] as any);

      const res = await request(app)
        .get('/api/submodules/507f1f77bcf86cd799439022/content-items')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Intro Video');
    });

    it('GET /api/content-items/:id triggers detail fetch for clicked item', async () => {
      jest.spyOn(ContentItemDao.prototype, 'findContentItemById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439044',
        submoduleId: '507f1f77bcf86cd799439022',
        type: 'video',
        ref_id: '507f1f77bcf86cd799439055',
        title: 'Intro Video',
        max_score: 0,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return this;
        }
      } as any);

      jest.spyOn(externalContentService, 'fetchItemDetail').mockResolvedValue({
        playback_url: 'https://cdn.example.com/hls/master.m3u8',
        duration_seconds: 420
      });

      const res = await request(app)
        .get('/api/content-items/507f1f77bcf86cd799439044')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.details).toHaveProperty('playback_url');
    });

    it('POST /api/submodules/:id/content-items allows trainer to set custom marks', async () => {
      jest.spyOn(SubmoduleDao.prototype, 'findSubmoduleById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439022',
        title: 'Introduction Submodule',
        moduleId: '507f1f77bcf86cd799439033'
      } as any);

      jest.spyOn(externalContentService, 'validateAndFetchReference').mockResolvedValue({
        title: 'Important Video',
        max_score: 0
      });

      jest
        .spyOn(ContentItemDao.prototype, 'createContentItem')
        .mockImplementation(async (data: any) => {
          return {
            _id: '507f1f77bcf86cd799439044',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            toObject: function () {
              return this;
            }
          } as any;
        });

      const res = await request(app)
        .post('/api/submodules/507f1f77bcf86cd799439022/content-items')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          type: 'video',
          ref_id: '507f1f77bcf86cd799439055',
          max_score: 15,
          order: 1
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.max_score).toBe(15);
    });

    it('PUT /api/content-items/:id allows trainer to update item max_score', async () => {
      jest.spyOn(ContentItemDao.prototype, 'updateContentItemById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439044',
        submoduleId: '507f1f77bcf86cd799439022',
        type: 'video',
        ref_id: '507f1f77bcf86cd799439055',
        title: 'Updated Title',
        max_score: 25,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return this;
        }
      } as any);

      const res = await request(app)
        .put('/api/content-items/507f1f77bcf86cd799439044')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          max_score: 25,
          title: 'Updated Title'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.max_score).toBe(25);
    });
  });

  describe('Student Progress & Course Marks Reward', () => {
    it('POST /api/courses/:courseId/content-items/:itemId/complete awards marks to student account', async () => {
      jest.spyOn(CourseDao.prototype, 'findCourseById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        title: 'TypeScript Masterclass'
      } as any);

      jest.spyOn(ContentItemDao.prototype, 'findContentItemById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439044',
        submoduleId: '507f1f77bcf86cd799439022',
        type: 'video',
        max_score: 10
      } as any);

      jest.spyOn(SubmoduleDao.prototype, 'findSubmoduleById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439022',
        moduleId: '507f1f77bcf86cd799439033'
      } as any);

      const { default: CourseProgressDao } = await import('../shared/dao/courseProgress.dao.js');
      const { default: ModuleDao } = await import('../shared/dao/module.dao.js');

      jest.spyOn(CourseProgressDao.prototype, 'recordCompletion').mockResolvedValue({
        courseId: '507f1f77bcf86cd799439011',
        userId: 'trainee-1',
        totalScoreEarned: 10,
        completedItems: [
          {
            contentItemId: '507f1f77bcf86cd799439044',
            type: 'video',
            scoreEarned: 10,
            maxScore: 10,
            completedAt: new Date()
          }
        ]
      } as any);

      jest.spyOn(ModuleDao.prototype, 'findModulesByCourseId').mockResolvedValue([]);

      const res = await request(app)
        .post(
          '/api/courses/507f1f77bcf86cd799439011/content-items/507f1f77bcf86cd799439044/complete'
        )
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scoreAwarded).toBe(10);
      expect(res.body.data.totalScoreEarned).toBe(10);
    });

    it('GET /api/courses/:courseId/my-progress returns student course score', async () => {
      const { default: CourseProgressDao } = await import('../shared/dao/courseProgress.dao.js');
      const { default: ModuleDao } = await import('../shared/dao/module.dao.js');

      jest.spyOn(CourseProgressDao.prototype, 'findProgress').mockResolvedValue({
        courseId: '507f1f77bcf86cd799439011',
        userId: 'trainee-1',
        totalScoreEarned: 25,
        completedItems: [
          {
            contentItemId: 'item-1',
            type: 'video',
            scoreEarned: 25,
            maxScore: 25,
            completedAt: new Date()
          }
        ]
      } as any);

      jest.spyOn(ModuleDao.prototype, 'findModulesByCourseId').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/courses/507f1f77bcf86cd799439011/my-progress')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalScoreEarned).toBe(25);
    });
  });
});
