import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import createApp from '../app.js';
import UserProfileDao from '../shared/dao/userProfile.dao.js';
import { accessPublicKey, serviceToken, serviceTokenSecret, signAccessToken } from '@lms/shared';

// Token trust boundaries: only auth-service's RS256 key mints user tokens; service tokens are
// scoped, audience-bound and only accepted on the routes other services actually call.
describe('token trust boundaries', () => {
  const app = createApp();
  const profiles = () =>
    jest.spyOn(UserProfileDao.prototype, 'findProfilesByUserIds').mockResolvedValue([] as never);

  afterEach(() => jest.restoreAllMocks());

  it('accepts a user token signed by auth-service', async () => {
    profiles();
    const token = signAccessToken({ userId: 'u1', role: 'trainee', name: 'U' });
    const res = await request(app)
      .get('/api/profiles?ids=u1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects HS256 forgeries, including one keyed with the public key', async () => {
    for (const secret of [
      accessPublicKey(),
      'super_secret_access_jwt_key_auth_service',
      serviceTokenSecret()
    ]) {
      const forged = jwt.sign({ userId: 'admin', role: 'admin' }, secret, { algorithm: 'HS256' });
      const res = await request(app)
        .get('/api/profiles/me')
        .set('Authorization', `Bearer ${forged}`);
      expect(res.status).toBe(401);
    }
  });

  it('accepts a service token only with the right scope and audience', async () => {
    profiles();
    const ok = await request(app)
      .get('/api/profiles?ids=u1')
      .set('Authorization', `Bearer ${serviceToken('chat-service', ['profiles:read'])}`);
    expect(ok.status).toBe(200);

    const wrongScope = await request(app)
      .get('/api/profiles?ids=u1')
      .set('Authorization', `Bearer ${serviceToken('chat-service', ['memberships:read'])}`);
    expect(wrongScope.status).toBe(401);

    const wrongAudience = jwt.sign(
      { typ: 'service', scope: ['profiles:read'] },
      serviceTokenSecret(),
      {
        subject: 'service:chat-service',
        audience: 'course-service',
        expiresIn: '60s'
      }
    );
    const res = await request(app)
      .get('/api/profiles?ids=u1')
      .set('Authorization', `Bearer ${wrongAudience}`);
    expect(res.status).toBe(401);
  });

  it('never accepts service tokens on user routes', async () => {
    const res = await request(app)
      .get('/api/profiles/me')
      .set(
        'Authorization',
        `Bearer ${serviceToken('course-service', ['profiles:read', 'memberships:write'])}`
      );
    expect(res.status).toBe(401);
  });
});
