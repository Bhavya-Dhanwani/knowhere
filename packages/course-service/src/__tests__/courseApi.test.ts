import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import createApp from '../app.js';
import env from '../shared/config/env.config.js';
import CourseDao from '../shared/dao/course.dao.js';
import ModuleDao from '../shared/dao/module.dao.js';
import SubmoduleDao from '../shared/dao/submodule.dao.js';
import ResourceDao from '../shared/dao/resource.dao.js';
import McqDao from '../shared/dao/mcq.dao.js';
import McqAttemptDao from '../shared/dao/mcqAttempt.dao.js';
import CodeQuestionDao from '../shared/dao/codeQuestion.dao.js';
import { ICourseDocument } from '../shared/models/course.model.js';
import { IResourceDocument } from '../shared/models/resource.model.js';
import { IMcqDocument } from '../shared/models/mcq.model.js';
import { ICodingQuestionDocument } from '../shared/models/codeQuestion.model.js';
import { ISubmoduleDocument } from '../shared/models/submodule.model.js';
import { IModuleDocument } from '../shared/models/module.model.js';
import { IMcqAttemptDocument } from '../shared/models/mcqAttempt.model.js';

describe('Course API Endpoints (/api/course/...) Integration Tests', () => {
  const app = createApp();

  const trainerToken = jwt.sign(
    { userId: 'trainer-1', role: 'trainer', email: 'trainer@knowhere.dev', name: 'Trainer One' },
    env.ACCESS_TOKEN_SECRET
  );

  const traineeToken = jwt.sign(
    { userId: 'trainee-1', role: 'trainee', email: 'trainee@knowhere.dev', name: 'Trainee One' },
    env.ACCESS_TOKEN_SECRET
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Security & Authorization Guarantees', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/course/upload-resource').send({});
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects trainee from content authoring with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/course/upload-resource')
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({
          fileName: 'lecture.mp4',
          mimeType: 'video/mp4',
          fileSize: 1048576,
          resourceType: 'video',
          courseId: '507f1f77bcf86cd799439011'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('1. POST /api/course/upload-resource', () => {
    it('generates presigned upload URL and saves resource with PENDING_UPLOAD status', async () => {
      jest.spyOn(CourseDao.prototype, 'findCourseById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        instructorId: 'trainer-1'
      } as unknown as ICourseDocument);

      jest.spyOn(ResourceDao.prototype, 'createResource').mockResolvedValue({
        _id: '507f1f77bcf86cd799439033',
        fileName: 'javascript-basics.mp4',
        mimeType: 'video/mp4',
        fileSizeBytes: 52428800,
        resourceType: 'video',
        s3Key: 'courses/507f1f77bcf86cd799439011/resources/test.mp4',
        status: 'PENDING_UPLOAD'
      } as unknown as IResourceDocument);

      const res = await request(app)
        .post('/api/course/upload-resource')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          fileName: 'javascript-basics.mp4',
          mimeType: 'video/mp4',
          fileSize: 52428800,
          resourceType: 'video',
          courseId: '507f1f77bcf86cd799439011'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resourceId).toBe('507f1f77bcf86cd799439033');
      expect(res.body.data.status).toBe('PENDING_UPLOAD');
      expect(res.body.data.uploadUrl).toBeDefined();
      expect(res.body.data.expiresIn).toBe(900);
    });
  });

  describe('2. POST /api/course/mcq', () => {
    it('creates MCQ with exactly 4 options and valid correctOptionIndex', async () => {
      jest.spyOn(McqDao.prototype, 'createMcq').mockResolvedValue({
        _id: 'mcq-123'
      } as unknown as IMcqDocument);

      const res = await request(app)
        .post('/api/course/mcq')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          question: 'What is the time complexity of binary search?',
          options: [
            { text: 'O(n)' },
            { text: 'O(log n)' },
            { text: 'O(n log n)' },
            { text: 'O(1)' }
          ],
          correctOptionIndex: 1,
          explanation: 'Binary search halves search space each iteration.',
          difficulty: 'easy',
          tags: ['dsa', 'algorithms']
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mcqId).toBe('mcq-123');
    });

    it('rejects MCQ with invalid option count or invalid correctOptionIndex', async () => {
      const res = await request(app)
        .post('/api/course/mcq')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          question: 'Invalid question?',
          options: [{ text: 'Opt 1' }, { text: 'Opt 2' }],
          correctOptionIndex: 5,
          explanation: 'invalid'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. POST /api/course/code-question', () => {
    it('creates coding question with public examples and AI test case generation', async () => {
      jest.spyOn(CodeQuestionDao.prototype, 'createQuestion').mockResolvedValue({
        _id: 'code-q-1'
      } as unknown as ICodingQuestionDocument);

      const res = await request(app)
        .post('/api/course/code-question')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'Two Sum',
          description: 'Find two indices that sum to target.',
          constraints: ['2 <= nums.length <= 10000'],
          inputFormat: 'nums array, integer target',
          outputFormat: 'two indices',
          examples: [
            { input: '[2,7,11,15], target = 9', output: '[0,1]', explanation: '2 + 7 = 9' }
          ],
          difficulty: 'easy',
          supportedLanguages: ['javascript', 'python'],
          testCaseGeneration: {
            enabled: true,
            requestedCount: 5
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.questionId).toBe('code-q-1');
      expect(res.body.data.publicExampleCount).toBe(1);
    });
  });

  describe('4. POST /api/course/submodule', () => {
    it('creates ordered submodule with content sequence', async () => {
      jest.spyOn(CourseDao.prototype, 'findCourseById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439011'
      } as unknown as ICourseDocument);

      jest.spyOn(SubmoduleDao.prototype, 'createSubmodule').mockResolvedValue({
        _id: 'submod-456'
      } as unknown as ISubmoduleDocument);

      const res = await request(app)
        .post('/api/course/submodule')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'Introduction to JavaScript',
          description: 'Learn JS fundamentals',
          courseId: '507f1f77bcf86cd799439011',
          content: [
            { type: 'video', resourceId: '507f1f77bcf86cd799439001', order: 1 },
            { type: 'mcq', contentId: '507f1f77bcf86cd799439002', order: 2 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.submoduleId).toBe('submod-456');
    });
  });

  describe('5. POST /api/course/module', () => {
    it('creates module with relative durationDays and release policy', async () => {
      jest.spyOn(SubmoduleDao.prototype, 'findSubmodulesByIds').mockResolvedValue([]);
      jest.spyOn(ModuleDao.prototype, 'createModule').mockResolvedValue({
        _id: 'mod-789'
      } as unknown as IModuleDocument);

      const res = await request(app)
        .post('/api/course/module')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'JavaScript Fundamentals',
          description: 'Master core concepts',
          submoduleIds: [],
          durationDays: 7,
          releasePolicy: {
            type: 'immediate'
          },
          progressRequirement: 70
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.moduleId).toBe('mod-789');
    });
  });

  describe('6. POST /api/course', () => {
    it('creates course with default draft status and progression settings', async () => {
      jest.spyOn(CourseDao.prototype, 'createCourse').mockResolvedValue({
        _id: 'course-new-1',
        status: 'draft'
      } as unknown as ICourseDocument);

      const res = await request(app)
        .post('/api/course')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'Full Stack Web Development',
          description: 'Become a fullstack engineer',
          modules: [],
          status: 'draft',
          settings: {
            allowLateEnrollment: true,
            defaultModuleDurationDays: 7,
            progressionThreshold: 70
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.courseId).toBe('course-new-1');
      expect(res.body.data.status).toBe('draft');
    });
  });

  describe('7. POST /api/course/add-module', () => {
    it('links module to course preserving order and scheduling policy', async () => {
      jest.spyOn(CourseDao.prototype, 'findCourseById').mockResolvedValue({
        _id: 'course-1',
        modules: []
      } as unknown as ICourseDocument);

      jest.spyOn(ModuleDao.prototype, 'findModuleById').mockResolvedValue({
        _id: 'mod-1'
      } as unknown as IModuleDocument);

      jest
        .spyOn(CourseDao.prototype, 'addModuleToCourse')
        .mockResolvedValue({} as unknown as ICourseDocument);

      const res = await request(app)
        .post('/api/course/add-module')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          courseId: '507f1f77bcf86cd799439011',
          moduleId: '507f1f77bcf86cd799439022',
          order: 1,
          releasePolicy: {
            type: 'scheduled',
            releaseAt: '2026-08-08T00:00:00Z',
            allowLateJoinerCatchUp: true
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBe(1);
    });
  });

  describe('8. GET /api/course/mcq/:id', () => {
    it('returns ONLY question and 4 options, STRIPPING correct answer and explanation', async () => {
      jest.spyOn(McqDao.prototype, 'findMcqById').mockResolvedValue({
        _id: 'mcq-1',
        question: 'What is the time complexity of binary search?',
        options: [
          { id: 'option_0', text: 'O(n)' },
          { id: 'option_1', text: 'O(log n)' },
          { id: 'option_2', text: 'O(n log n)' },
          { id: 'option_3', text: 'O(1)' }
        ],
        correctOptionIndex: 1,
        explanation: 'Confidential explanation'
      } as unknown as IMcqDocument);

      const res = await request(app)
        .get('/api/course/mcq/mcq-1')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.question).toBe('What is the time complexity of binary search?');
      expect(res.body.options).toHaveLength(4);
      expect(res.body.options[1].id).toBe('option_1');

      // CRITICAL SECURITY ASSERTIONS
      expect(res.body.correctOptionIndex).toBeUndefined();
      expect(res.body.explanation).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('Confidential explanation');
    });
  });

  describe('9. GET /api/course/video/:id', () => {
    it('supports HTTP byte-range request returning 206 Partial Content', async () => {
      jest.spyOn(ResourceDao.prototype, 'findResourceById').mockResolvedValue({
        _id: 'vid-1',
        resourceType: 'video',
        fileName: 'lesson.mp4',
        fileSizeBytes: 1048576,
        mimeType: 'video/mp4',
        s3Key: 'courses/c1/resources/vid.mp4',
        status: 'READY'
      } as unknown as IResourceDocument);

      const res = await request(app)
        .get('/api/course/video/vid-1')
        .set('Authorization', `Bearer ${traineeToken}`)
        .set('Range', 'bytes=0-1023');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 0-1023/1048576');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.headers['content-length']).toBe('1024');
    });

    it('returns 416 Range Not Satisfiable when requested range is invalid', async () => {
      jest.spyOn(ResourceDao.prototype, 'findResourceById').mockResolvedValue({
        _id: 'vid-1',
        resourceType: 'video',
        fileSizeBytes: 1048576,
        mimeType: 'video/mp4',
        status: 'READY'
      } as unknown as IResourceDocument);

      const res = await request(app)
        .get('/api/course/video/vid-1')
        .set('Authorization', `Bearer ${traineeToken}`)
        .set('Range', 'bytes=2000000-3000000');

      expect(res.status).toBe(416);
      expect(res.headers['content-range']).toContain('bytes */1048576');
    });
  });

  describe('10. GET /api/course/resource/:id', () => {
    it('returns short-lived presigned download URL for non-video resources', async () => {
      jest.spyOn(ResourceDao.prototype, 'findResourceById').mockResolvedValue({
        _id: 'doc-1',
        resourceType: 'pdf',
        fileName: 'javascript-notes.pdf',
        mimeType: 'application/pdf',
        s3Key: 'courses/c1/resources/doc.pdf',
        status: 'READY'
      } as unknown as IResourceDocument);

      const res = await request(app)
        .get('/api/course/resource/doc-1')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fileName).toBe('javascript-notes.pdf');
      expect(res.body.data.mimeType).toBe('application/pdf');
      expect(res.body.data.downloadUrl).toBeDefined();
      expect(res.body.data.expiresIn).toBe(300);
    });
  });

  describe('11. POST /api/course/chk-mcq', () => {
    it('evaluates correct answer accurately and records attempt', async () => {
      jest.spyOn(McqDao.prototype, 'findMcqById').mockResolvedValue({
        _id: 'mcq-1',
        options: [
          { id: 'option_0', text: 'O(n)' },
          { id: 'option_1', text: 'O(log n)' },
          { id: 'option_2', text: 'O(n log n)' },
          { id: 'option_3', text: 'O(1)' }
        ],
        correctOptionIndex: 1
      } as unknown as IMcqDocument);

      jest.spyOn(McqAttemptDao.prototype, 'getAttemptCount').mockResolvedValue(0);
      jest
        .spyOn(McqAttemptDao.prototype, 'recordAttempt')
        .mockResolvedValue({} as unknown as IMcqAttemptDocument);

      const res = await request(app)
        .post('/api/course/chk-mcq')
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({
          mcqId: 'mcq-1',
          selectedOptionId: 'option_1'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isCorrect).toBe(true);
    });

    it('evaluates incorrect answer accurately without revealing correct option', async () => {
      jest.spyOn(McqDao.prototype, 'findMcqById').mockResolvedValue({
        _id: 'mcq-1',
        options: [
          { id: 'option_0', text: 'O(n)' },
          { id: 'option_1', text: 'O(log n)' },
          { id: 'option_2', text: 'O(n log n)' },
          { id: 'option_3', text: 'O(1)' }
        ],
        correctOptionIndex: 1,
        explanation: 'Secret answer'
      } as unknown as IMcqDocument);

      jest.spyOn(McqAttemptDao.prototype, 'getAttemptCount').mockResolvedValue(0);
      jest
        .spyOn(McqAttemptDao.prototype, 'recordAttempt')
        .mockResolvedValue({} as unknown as IMcqAttemptDocument);

      const res = await request(app)
        .post('/api/course/chk-mcq')
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({
          mcqId: 'mcq-1',
          selectedOptionId: 'option_0'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isCorrect).toBe(false);
      expect(res.body.data.correctOptionIndex).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('Secret answer');
    });
  });
});
