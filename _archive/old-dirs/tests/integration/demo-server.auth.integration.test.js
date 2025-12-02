const request = require('supertest');

describe('Demo server - auth optional/required', () => {
  let app;
  beforeAll(() => {
    process.env.JWT_SECRET = 'secretsecretsecretsecretsecretsecret12';
    process.env.REQUIRE_AUTH = 'true';
    app = require('../../server-demo-funcional');
  });

  it('rejects without token', async () => {
    const res = await request(app).get('/api/pacientes');
    expect(res.status).toBe(401);
  });

  it('accepts with demo token', async () => {
    const tok = await request(app).post('/api/auth/demo-token');
    expect(tok.status).toBe(200);
    const token = tok.body.token;
    const ok = await request(app).get('/api/pacientes').set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body)).toBe(true);
  });
});


