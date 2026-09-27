import request from 'supertest';
import { jest } from '@jest/globals';
import { signAccessToken } from '@lms/shared';
import createApp from '../app.js';
import { sessionsOf, unionRanges, videoStats } from '../services/behaviour.service.js';
import { memberships } from '../services/access.service.js';
import UserActivity from '../shared/models/userActivity.model.js';
import CourseDao from '../shared/dao/course.dao.js';
import { ICourseDocument } from '../shared/models/course.model.js';
import { coachChat } from '../services/coach.service.js';

describe('behaviour aggregation', () => {
  it('merges watch ranges', () => {
    expect(
      unionRanges([
        [10, 20],
        [0, 5],
        [15, 30],
        [40, 40]
      ])
    ).toEqual([
      [0, 5],
      [10, 30]
    ]);
  });

  it('measures coverage, repeats and skips of a video', () => {
    const v = videoStats({
      duration: 100,
      // watched 0-40, went back and rewatched 20-40, then jumped from 40 to 90 and finished
      watches: [{ ranges: [[0, 40]] }, { ranges: [[20, 40]], rate: 1.5 }, { ranges: [[90, 100]] }],
      seeks: [
        { from: 40, to: 20 },
        { from: 40, to: 90 }
      ],
      pauses: 2,
      ended: true
    });
    expect(v.uniqueSec).toBe(50);
    expect(v.coveragePct).toBe(50);
    expect(v.repeatSec).toBe(20);
    expect(v.rewatched).toEqual([[20, 40]]);
    expect(v.skips).toBe(1);
    expect(v.skipped).toEqual([[40, 90]]);
    expect(v.skippedSec).toBe(50);
    expect(v.rewinds).toBe(1);
    expect(v.avgRate).toBeCloseTo(1.17, 2);
  });

  it('splits study sessions on 30 minute gaps', () => {
    const m = 60_000;
    expect(sessionsOf([0, 5 * m, 20 * m, 90 * m, 100 * m])).toHaveLength(2);
  });
});

describe('coach API', () => {
  const app = createApp();
  const COURSE = '507f1f77bcf86cd799439050';
  const trainee = signAccessToken({
    userId: 'trainee-1',
    role: 'trainee',
    email: 't@x.dev',
    name: 'T'
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps only known events for courses the caller belongs to', async () => {
    jest
      .spyOn(memberships, 'memberOf')
      .mockImplementation(async (courseId) =>
        courseId === COURSE ? { userId: 'trainee-1', role: 'trainee' } : null
      );
    jest.spyOn(CourseDao.prototype, 'findCourseById').mockResolvedValue({
      _id: '507f1f77bcf86cd799439099',
      instructorId: 'someone-else'
    } as unknown as ICourseDocument);
    const insert = jest.spyOn(UserActivity, 'insertMany').mockResolvedValue([] as never);

    const res = await request(app)
      .post('/api/course/coach/activity')
      .set('Authorization', `Bearer ${trainee}`)
      .send({
        events: [
          { type: 'VIDEO_WATCH', courseId: COURSE, itemId: 'i1', data: { ranges: [[0, 10]] } },
          { type: 'COURSE_COMPLETED', courseId: COURSE },
          { type: 'ITEM_DWELL', courseId: '507f1f77bcf86cd799439099', itemId: 'i2' }
        ]
      });
    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(1);
    const saved = insert.mock.calls[0][0] as { eventType: string; userId: string }[];
    expect(saved).toEqual([
      expect.objectContaining({ eventType: 'VIDEO_WATCH', userId: 'trainee-1' })
    ]);
  });

  it('never lets a trainee coach on someone else', async () => {
    jest.spyOn(CourseDao.prototype, 'findCourseById').mockResolvedValue({
      _id: COURSE,
      instructorId: 'someone-else'
    } as unknown as ICourseDocument);
    jest.spyOn(memberships, 'memberOf').mockResolvedValue(null);
    await expect(
      coachChat(
        { userId: 'trainee-1', role: 'trainee' },
        { courseId: COURSE, learnerId: 'trainee-2', message: 'how is trainee-2 doing?' }
      )
    ).rejects.toThrow(/not enrolled/);
  });
});
