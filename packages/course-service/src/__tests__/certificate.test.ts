import request from 'supertest';
import { jest } from '@jest/globals';
import { signAccessToken } from '@lms/shared';
import createApp from '../app.js';
import CourseDao from '../shared/dao/course.dao.js';
import ModuleDao from '../shared/dao/module.dao.js';
import SubmoduleDao from '../shared/dao/submodule.dao.js';
import ResourceDao from '../shared/dao/resource.dao.js';
import McqDao from '../shared/dao/mcq.dao.js';
import CodeQuestionDao from '../shared/dao/codeQuestion.dao.js';
import CourseProgressDao from '../shared/dao/courseProgress.dao.js';
import Certificate, { ICertificate } from '../shared/models/certificate.model.js';
import { memberships } from '../services/access.service.js';
import { CODE_RE, newCode } from '../modules/certificate/certificate.controller.js';
import { ICourseDocument } from '../shared/models/course.model.js';
import { IModuleDocument } from '../shared/models/module.model.js';
import { ISubmoduleDocument } from '../shared/models/submodule.model.js';
import { ICourseProgress } from '../shared/models/courseProgress.model.js';

const COURSE_ID = '507f1f77bcf86cd799439050';
const SIGNATURE = 'data:image/png;base64,iVBORw0KGgo=';
const app = createApp();
const token = signAccessToken({ userId: 'trainee-1', role: 'trainee', name: 'Asha Rao' });

// a published course with two items; trainee-1 is enrolled and has finished `doneIds`
function course(doneIds: string[], signed = true) {
  jest.spyOn(memberships, 'memberOf').mockResolvedValue({
    userId: 'trainee-1',
    role: 'trainee',
    assignedAt: '2026-01-01T00:00:00Z'
  });
  jest.spyOn(CourseDao.prototype, 'findCourseById').mockResolvedValue({
    _id: COURSE_ID,
    title: 'Distributed Systems',
    status: 'published',
    instructorId: 'admin-1',
    createdAt: new Date('2026-01-01'),
    certificate: signed ? { signerName: 'Priya Admin', signature: SIGNATURE } : undefined,
    modules: [{ moduleId: 'm1', order: 1, releasePolicy: { releaseAt: new Date('2026-01-01') } }]
  } as unknown as ICourseDocument);
  jest.spyOn(ModuleDao.prototype, 'findModulesByIds').mockResolvedValue([
    {
      _id: 'm1',
      title: 'M',
      description: '',
      durationDays: 7,
      progressRequirement: 70,
      submoduleIds: ['s1']
    }
  ] as unknown as IModuleDocument[]);
  jest.spyOn(SubmoduleDao.prototype, 'findSubmodulesByIds').mockResolvedValue([
    {
      _id: 's1',
      title: 'S',
      description: '',
      content: [
        { _id: 'c1', type: 'resource', order: 1, resourceId: 'r1' },
        { _id: 'c2', type: 'resource', order: 2, resourceId: 'r2' }
      ]
    }
  ] as unknown as ISubmoduleDocument[]);
  jest.spyOn(ResourceDao.prototype, 'findResourcesByIds').mockResolvedValue([]);
  jest.spyOn(McqDao.prototype, 'findMcqsByIds').mockResolvedValue([]);
  jest.spyOn(CodeQuestionDao.prototype, 'findQuestionsByIds').mockResolvedValue([]);
  jest.spyOn(CourseProgressDao.prototype, 'findProgress').mockResolvedValue({
    totalScoreEarned: 0,
    completedItems: doneIds.map((id) => ({
      contentItemId: { toString: () => id },
      completedAt: new Date('2026-03-01')
    }))
  } as unknown as ICourseProgress);
  jest.spyOn(Certificate, 'findOne').mockResolvedValue(null);
}

afterEach(() => jest.restoreAllMocks());

describe('certificates', () => {
  it('codes are random and well-formed', () => {
    const a = newCode();
    expect(CODE_RE.test(a)).toBe(true);
    expect(newCode()).not.toBe(a);
  });

  it('refuses a certificate until every item is completed', async () => {
    course(['c1']);
    const create = jest.spyOn(Certificate, 'create');
    const res = await request(app)
      .post(`/api/courses/${COURSE_ID}/certificate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/1\/2/);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses when the course has no signature', async () => {
    course(['c1', 'c2'], false);
    const res = await request(app)
      .post(`/api/courses/${COURSE_ID}/certificate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/signature/);
  });

  it('issues a certificate snapshotting learner, course and signer', async () => {
    course(['c1', 'c2']);
    const create = jest
      .spyOn(Certificate, 'create')
      .mockImplementation(async (doc) => ({ ...(doc as object), createdAt: new Date() }) as never);
    const res = await request(app)
      .post(`/api/courses/${COURSE_ID}/certificate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    const saved = create.mock.calls[0][0] as unknown as ICertificate;
    expect(saved).toMatchObject({
      userId: 'trainee-1',
      learnerName: 'Asha Rao',
      courseTitle: 'Distributed Systems',
      signerName: 'Priya Admin',
      signature: SIGNATURE
    });
    expect(CODE_RE.test(res.body.data.code)).toBe(true);
    expect(res.body.data.userId).toBeUndefined();
  });

  it('verifies a code publicly, without exposing the user id', async () => {
    jest.spyOn(Certificate, 'findOne').mockResolvedValue({
      code: '9F2C-41AB-07DE-66B3',
      userId: 'trainee-1',
      learnerName: 'Asha Rao',
      courseTitle: 'Distributed Systems',
      signerName: 'Priya Admin',
      signature: SIGNATURE,
      percentage: 91,
      completedAt: new Date(),
      createdAt: new Date()
    } as unknown as ICertificate);
    const ok = await request(app).get('/api/courses/certificates/verify/9f2c-41ab-07de-66b3');
    expect(ok.status).toBe(200);
    expect(ok.body.data.learnerName).toBe('Asha Rao');
    expect(ok.body.data.userId).toBeUndefined();

    const bad = await request(app).get('/api/courses/certificates/verify/not-a-code');
    expect(bad.status).toBe(404);
  });

  it('refuses to create a course without a signer, or with a non-PNG signature', async () => {
    const admin = signAccessToken({ userId: 'admin-1', role: 'admin', name: 'Priya Admin' });
    const post = (body: object) =>
      request(app).post('/api/course').set('Authorization', `Bearer ${admin}`).send(body);
    expect((await post({ title: 'New course' })).status).toBe(400);
    expect(
      (
        await post({
          title: 'New course',
          certificate: { signerName: 'Priya', signature: 'javascript:1' }
        })
      ).status
    ).toBe(400);
  });

  it('staff issue certificates in bulk: skips holders, nameless and non-learners', async () => {
    course(['c1', 'c2']);
    jest.spyOn(memberships, 'members').mockResolvedValue([
      { userId: 'trainee-1', role: 'trainee' },
      { userId: 'trainee-2', role: 'trainee' },
      { userId: 'trainee-3', role: 'trainee' },
      { userId: 'admin-1', role: 'admin' }
    ]);
    jest.spyOn(memberships, 'profiles').mockResolvedValue([
      { userId: 'trainee-1', name: 'Asha Rao' },
      { userId: 'trainee-2', name: 'Ravi Kumar' },
      { userId: 'trainee-3', name: ' ' }
    ]);
    jest.spyOn(CourseProgressDao.prototype, 'listGradesByCourse').mockResolvedValue([]);
    jest
      .spyOn(Certificate, 'find')
      .mockResolvedValue([
        { userId: 'trainee-2', code: 'AAAA-BBBB-CCCC-DDDD', createdAt: new Date() }
      ] as never);
    const create = jest
      .spyOn(Certificate, 'create')
      .mockImplementation(async (doc) => ({ ...(doc as object), createdAt: new Date() }) as never);
    const admin = signAccessToken({ userId: 'admin-1', role: 'admin', name: 'Priya Admin' });

    const res = await request(app)
      .post(`/api/courses/${COURSE_ID}/certificates/issue`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ userIds: ['trainee-1', 'trainee-2', 'trainee-3', 'admin-1'] });

    expect(res.status).toBe(200);
    expect(res.body.data.issued).toEqual(['trainee-1']);
    expect(res.body.data.skipped.map((s: { userId: string }) => s.userId).sort()).toEqual([
      'admin-1',
      'trainee-2',
      'trainee-3'
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      learnerName: 'Asha Rao',
      signerName: 'Priya Admin'
    });
  });

  it('trainees cannot bulk-issue', async () => {
    const res = await request(app)
      .post(`/api/courses/${COURSE_ID}/certificates/issue`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userIds: ['trainee-1'] });
    expect(res.status).toBe(403);
  });
});
