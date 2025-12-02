const request = require('supertest');
const app = require('../../server-demo-funcional');

describe('Demo server API', () => {
  it('GET /health ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('CRUD pacientes', async () => {
    // create
    const create = await request(app).post('/api/pacientes').send({ name: 'Test Uno', dni: '123', phone: '111', insurance: 'OSDE' });
    expect(create.status).toBe(201);
    const id = create.body.id;
    // list
    const list = await request(app).get('/api/pacientes');
    expect(list.status).toBe(200);
    expect(list.body.some(p => p.id === id)).toBe(true);
    // update habilitado
    const put = await request(app).put(`/api/pacientes/${id}`).send({ habilitado: false });
    expect(put.status).toBe(200);
    // filter habilitados (default excludes false)
    const list2 = await request(app).get('/api/pacientes');
    expect(list2.body.some(p => p.id === id)).toBe(false);
    const listAll = await request(app).get('/api/pacientes?incluirInhabilitados=true');
    expect(listAll.body.some(p => p.id === id)).toBe(true);
    // delete cascada
    const del = await request(app).delete(`/api/pacientes/${id}`);
    expect(del.status).toBe(200);
  });

  it('CRUD sesiones', async () => {
    // create patient first
    const createP = await request(app).post('/api/pacientes').send({ name: 'Paciente Sesión', dni: '999' });
    const pid = createP.body.id;
    // create session
    const createS = await request(app).post('/api/sesiones').send({ pacienteId: String(pid), notas: 'prueba', mood_assessment: 4 });
    expect(createS.status).toBe(200);
    const sid = createS.body.id;
    // list
    const list = await request(app).get('/api/sesiones');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    // update
    const put = await request(app).put(`/api/sesiones/${sid}`).send({ mood_assessment: 5 });
    expect(put.status).toBe(200);
    // delete
    const del = await request(app).delete(`/api/sesiones/${sid}`);
    expect(del.status).toBe(204);
  });
});


