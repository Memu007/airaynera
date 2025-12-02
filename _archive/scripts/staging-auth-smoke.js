#!/usr/bin/env node
const axios = require('axios');

async function main() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const client = axios.create({ baseURL: baseUrl, timeout: 5000, validateStatus: () => true });

  const steps = [];
  function ok(step, cond, extra = {}) {
    steps.push({ step, ok: !!cond, ...extra });
    if (!cond) throw new Error(step + ' failed');
  }

  // 1) 401 sin token
  const r401 = await client.get('/api/pacientes');
  ok('401 without token', r401.status === 401, { status: r401.status });

  // 2) Obtener token demo
  const tokRes = await client.post('/api/auth/demo-token');
  ok('issue demo token', tokRes.status === 200 && tokRes.data && tokRes.data.token);
  const token = tokRes.data.token;

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // 3) 200 pacientes con token
  const r200 = await client.get('/api/pacientes', auth);
  ok('200 pacientes with token', r200.status === 200 && Array.isArray(r200.data));

  // 4) admin ping 200
  const rAdmin = await client.get('/api/admin/ping', auth);
  ok('admin ping', rAdmin.status === 200 && rAdmin.data && rAdmin.data.ok === true);

  // 5) metrics
  const rMetrics = await client.get('/metrics');
  ok('metrics present', rMetrics.status === 200 && typeof rMetrics.data.totalRequests === 'number');

  console.log('SMOKE OK:', steps);
  process.exit(0);
}

main().catch((e) => { console.error('SMOKE FAILED:', e.message); process.exit(1); });


