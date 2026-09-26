import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import createApp from '../app.js';
import ResourceDao from '../shared/dao/resource.dao.js';
import s3Service from '../services/s3.service.js';
import { getResourceById } from '../services/resourceExport.service.js';
import env from '../shared/config/env.config.js';
import { signAccessToken } from '@lms/shared';

describe('Media Service Resource Management', () => {
  const app = createApp();

  const trainerToken = signAccessToken({
    userId: 'trainer-1',
    role: 'trainer',
    email: 'trainer@example.com',
    name: 'Trainer One'
  });

  const traineeToken = signAccessToken({
    userId: 'trainee-1',
    role: 'trainee',
    email: 'trainee@example.com',
    name: 'Trainee One'
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/resources/upload-url', () => {
    it('generates presigned upload URL and pending resource record for trainer', async () => {
      jest
        .spyOn(s3Service, 'generateUploadUrl')
        .mockResolvedValue('https://s3.amazonaws.com/presigned-put-url');

      jest.spyOn(ResourceDao.prototype, 'createResource').mockResolvedValue({
        _id: '507f1f77bcf86cd799439066',
        title: 'Docker Masterclass',
        type: 'video',
        ownerId: 'trainer-1',
        s3Key: 'raw/video/trainer-1/test.mp4',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return this;
        }
      } as any);

      const res = await request(app)
        .post('/api/resources/upload-url')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'Docker Masterclass',
          type: 'video',
          contentType: 'video/mp4'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uploadUrl');
      expect(res.body.data.resource.status).toBe('pending');
    });

    it('rejects upload URL request from trainee with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/resources/upload-url')
        .set('Authorization', `Bearer ${traineeToken}`)
        .send({
          title: 'Illegal upload',
          type: 'video',
          contentType: 'video/mp4'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/resources/:id & Cross-Module Export', () => {
    it('retrieves resource by id', async () => {
      jest.spyOn(ResourceDao.prototype, 'findResourceById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439066',
        title: 'Docker Masterclass',
        type: 'video',
        ownerId: 'trainer-1',
        s3Key: 'raw/video/trainer-1/test.mp4',
        playbackUrl: 'https://cdn.example.com/hls/master.m3u8',
        durationSeconds: 360,
        status: 'ready',
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return this;
        }
      } as any);

      const res = await request(app)
        .get('/api/resources/507f1f77bcf86cd799439066')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.playbackUrl).toBe('https://cdn.example.com/hls/master.m3u8');
    });

    it('exports getResourceById for direct cross-module calls', async () => {
      jest.spyOn(ResourceDao.prototype, 'findResourceById').mockResolvedValue({
        _id: '507f1f77bcf86cd799439066',
        title: 'Docker Masterclass',
        type: 'video',
        ownerId: 'trainer-1',
        playbackUrl: 'https://cdn.example.com/hls/master.m3u8',
        durationSeconds: 360,
        status: 'ready',
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return this;
        }
      } as any);

      const exported = await getResourceById('507f1f77bcf86cd799439066');
      expect(exported).not.toBeNull();
      expect(exported?.title).toBe('Docker Masterclass');
    });
  });
});
