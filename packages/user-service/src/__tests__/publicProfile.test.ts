import request from 'supertest';
import { jest } from '@jest/globals';
import { signAccessToken } from '@lms/shared';
import createApp from '../app.js';
import UserProfileDao from '../shared/dao/userProfile.dao.js';
import CourseMembershipDao from '../shared/dao/courseMembership.dao.js';
import { slugify, usernameError } from '../shared/utils/username.util.js';

const doc = (over: Record<string, unknown> = {}) => {
  const data = {
    userId: 'u-alex',
    username: 'alex-rivera',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    phone: '+91 99999 00000',
    role: 'trainee',
    visibility: 'public',
    skills: ['TypeScript'],
    ...over
  };
  return { ...data, toObject: () => data } as never;
};

describe('usernames', () => {
  it('validates and slugifies', () => {
    expect(usernameError('alex-rivera')).toBeNull();
    expect(usernameError('Al')).toMatch(/3-30/);
    expect(usernameError('-alex')).toMatch(/3-30/);
    expect(usernameError('dashboard')).toMatch(/reserved/);
    expect(slugify('Élena Röstova')).toBe('elena-rostova');
    expect(slugify('', 'j.doe@example.com')).toBe('j-doe');
  });
});

describe('shareable profile: GET /api/profiles/u/:username', () => {
  const app = createApp();
  const viewer = signAccessToken({
    userId: 'u-other',
    role: 'trainee',
    email: 'o@x.dev',
    name: 'O'
  });
  const owner = signAccessToken({
    userId: 'u-alex',
    role: 'trainee',
    email: 'alex@example.com',
    name: 'Alex'
  });
  beforeEach(() => {
    jest.spyOn(CourseMembershipDao.prototype, 'findCoursesByUser').mockResolvedValue([] as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows a public profile to anyone, without email or phone', async () => {
    jest.spyOn(UserProfileDao.prototype, 'findProfileByUsername').mockResolvedValue(doc());
    const res = await request(app).get('/api/profiles/u/Alex-Rivera');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      username: 'alex-rivera',
      name: 'Alex Rivera',
      skills: ['TypeScript']
    });
    expect(JSON.stringify(res.body)).not.toMatch(/alex@example.com|99999|u-alex/);
  });

  it('hides private profiles as if they did not exist, except from the owner', async () => {
    jest
      .spyOn(UserProfileDao.prototype, 'findProfileByUsername')
      .mockResolvedValue(doc({ visibility: 'private' }));
    expect((await request(app).get('/api/profiles/u/alex-rivera')).status).toBe(404);
    expect(
      (
        await request(app)
          .get('/api/profiles/u/alex-rivera')
          .set('Authorization', `Bearer ${viewer}`)
      ).status
    ).toBe(404);
    const mine = await request(app)
      .get('/api/profiles/u/alex-rivera')
      .set('Authorization', `Bearer ${owner}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.isOwner).toBe(true);
  });

  it('asks for sign-in on members-only profiles', async () => {
    jest
      .spyOn(UserProfileDao.prototype, 'findProfileByUsername')
      .mockResolvedValue(doc({ visibility: 'members' }));
    expect((await request(app).get('/api/profiles/u/alex-rivera')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/profiles/u/alex-rivera')
          .set('Authorization', `Bearer ${viewer}`)
      ).status
    ).toBe(200);
  });
});

describe('profile editing: PUT /api/profile/me', () => {
  const app = createApp();
  const me = signAccessToken({
    userId: 'u-alex',
    role: 'trainee',
    email: 'alex@example.com',
    name: 'Alex'
  });
  afterEach(() => jest.restoreAllMocks());

  it('refuses script links, reserved and taken usernames', async () => {
    const upsert = jest.spyOn(UserProfileDao.prototype, 'upsertProfile').mockResolvedValue(doc());
    const put = (body: object) =>
      request(app).put('/api/profile/me').set('Authorization', `Bearer ${me}`).send(body);

    expect((await put({ links: [{ label: 'x', url: 'javascript:alert(1)' }] })).status).toBe(400);
    expect((await put({ certificates: [{ name: 'AWS', url: 'data:text/html,hi' }] })).status).toBe(
      400
    );
    expect((await put({ username: 'admin' })).status).toBe(400);

    jest.spyOn(UserProfileDao.prototype, 'usernameTaken').mockResolvedValue(true);
    expect((await put({ username: 'sophia-chen' })).status).toBe(409);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('saves a full professional profile', async () => {
    jest.spyOn(UserProfileDao.prototype, 'usernameTaken').mockResolvedValue(false);
    const upsert = jest.spyOn(UserProfileDao.prototype, 'upsertProfile').mockResolvedValue(doc());
    const res = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${me}`)
      .send({
        username: 'Alex-R',
        headline: 'Full-stack learner',
        skills: ['React', 'react', ' Node '],
        qualifications: [{ degree: 'B.Tech', institution: 'IIT', startYear: 2019, endYear: 2023 }],
        experience: [{ title: 'Intern', organization: 'Acme', startDate: '2023-01', endDate: '' }],
        certificates: [
          { name: 'AWS CCP', issuer: 'AWS', issuedOn: '2024-05', url: 'https://aws.amazon.com/v/1' }
        ],
        links: [{ label: 'GitHub', url: 'https://github.com/alex' }]
      });
    expect(res.status).toBe(200);
    const saved = upsert.mock.calls[0][1] as Record<string, unknown>;
    expect(saved.username).toBe('alex-r');
    expect(saved.skills).toEqual(['React', 'react', 'Node']);
  });
});
