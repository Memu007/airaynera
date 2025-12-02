const request = require('supertest');
process.env.USE_PERSISTENCE = 'true';
process.env.DATA_DIR = __dirname + '/tmpdata';

const fs = require('fs');
const path = require('path');

describe('Demo server - persistence enabled', () => {
  let app;
  beforeAll(() => {
    // clean temp data dir
    const dir = process.env.DATA_DIR;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
    app = require('../../server-demo-funcional');
  });

  it('creates patient with encrypted fields and lists it', async () => {
    const res = await request(app).post('/api/pacientes').send({ name: 'Persist X', dni: '12345678', phone: '1199999999' });
    expect(res.status).toBe(201);
    const list = await request(app).get('/api/pacientes');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    const found = list.body.find(p => p.name === 'Persist X');
    expect(found).toBeTruthy();
  });

  it('adds and updates a session', async () => {
    const p = await request(app).post('/api/pacientes').send({ name: 'P2' });
    const sid = await request(app).post('/api/sesiones').send({ pacienteId: String(p.body.id), notas: 'nota' });
    expect(sid.status).toBe(200);
    const up = await request(app).put(`/api/sesiones/${sid.body.id}`).send({ mood_assessment: 5 });
    expect(up.status).toBe(200);
    const all = await request(app).get('/api/sesiones');
    expect(all.status).toBe(200);
    expect(all.body.some(s => String(s.id) === String(sid.body.id))).toBe(true);
  });
});


