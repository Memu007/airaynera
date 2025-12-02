const request = require('supertest');
const app = require('../../server-demo-funcional');

describe('Demo server API - extra funcs/routes', () => {
  it('GET /api/usuario 200', async () => {
    const res = await request(app).get('/api/usuario');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email');
  });

  it('GET /api/pacientes/:id 200 and 404', async () => {
    const created = await request(app).post('/api/pacientes').send({ name: 'Func Test', dni: '7777' });
    const id = created.body.id;
    const ok = await request(app).get(`/api/pacientes/${id}`);
    expect(ok.status).toBe(200);
    const nf = await request(app).get('/api/pacientes/xyz');
    expect(nf.status).toBe(404);
  });

  it('Static routes and redirects work', async () => {
    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/landing')).status).toBe(200);
    expect((await request(app).get('/landing-moderna')).status).toBe(200);
    expect((await request(app).get('/demo')).status).toBe(200);
    const redir = await request(app).get('/demo-whatsapp');
    expect([301,302]).toContain(redir.status);
    expect(redir.headers.location).toBe('/demo');
    expect((await request(app).get('/favicon.ico')).status).toBe(200);
  });
});


