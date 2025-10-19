const request = require('supertest');
const app = require('../../server-demo-funcional');

describe('Demo server API - error branches', () => {
  it('POST /api/pacientes 400 when name missing', async () => {
    const res = await request(app).post('/api/pacientes').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('PUT /api/pacientes/:id 404 when not found', async () => {
    const res = await request(app).put('/api/pacientes/does-not-exist').send({ habilitado: false });
    expect(res.status).toBe(404);
  });

  it('POST /api/sesiones 400 when pacienteId missing', async () => {
    const res = await request(app).post('/api/sesiones').send({ notas: 'x' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/sesiones/:id 404 when not found', async () => {
    const res = await request(app).put('/api/sesiones/99999').send({ mood_assessment: 5 });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/sesiones/:id 404 when not found', async () => {
    const res = await request(app).delete('/api/sesiones/abc');
    expect(res.status).toBe(404);
  });
});


