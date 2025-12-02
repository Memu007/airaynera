const request = require('supertest');

describe('RBAC admin endpoint', () => {
  let app;
  beforeAll(() => {
    process.env.JWT_SECRET = 'secretsecretsecretsecretsecretsecret12';
    process.env.REQUIRE_AUTH = 'true';
    app = require('../../server-demo-funcional');
  });

  it('forbids non-admin role', async () => {
    const { issueDemoToken } = require('../../middleware/auth');
    const userToken = issueDemoToken({ sub: 'u1', role: 'user' }, '1h');
    const res = await request(app).get('/api/admin/ping').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('allows admin role', async () => {
    const { issueDemoToken } = require('../../middleware/auth');
    const adminToken = issueDemoToken({ sub: 'a1', role: 'admin' }, '1h');
    const res = await request(app).get('/api/admin/ping').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
  });
});


