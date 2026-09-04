import request from 'supertest';
import createApp from '../app.js';

describe('Media Service Health Checks', () => {
  const app = createApp();

  it('GET /health should return 200 OK with status ok (K8s probe)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/health should return 200 OK with UP status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('status', 'UP');
    expect(res.body.data).toHaveProperty('service', 'mediaService');
  });
});
