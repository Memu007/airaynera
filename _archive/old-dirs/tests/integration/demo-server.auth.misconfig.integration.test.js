const request = require('supertest');

describe('Demo server - auth misconfiguration branches', () => {
  let app;
  beforeAll(() => {
    delete process.env.JWT_SECRET;
    process.env.REQUIRE_AUTH = 'true';
    app = require('../../server-demo-funcional');
  });

  it('returns server misconfigured when auth required but secret missing', async () => {
    const res = await request(app).get('/api/pacientes');
    expect(res.status).toBe(500);
    expect(res.body && res.body.error).toBe('SERVER_AUTH_MISCONFIGURED');
  });

  it('returns 400 on demo token emission when secret missing', async () => {
    const tok = await request(app).post('/api/auth/demo-token');
    expect(tok.status).toBe(400);
    expect(tok.body && tok.body.error).toBe('JWT_SECRET_NOT_SET');
  });
});


