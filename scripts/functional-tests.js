#!/usr/bin/env node
/**
 * Functional Tests - Valida flujos CRUD completos
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8080';

class FunctionalTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.token = null;
    this.token2 = null;
  }

  async request(method, path, body = null, token = null) {
    const url = new URL(path, BASE_URL);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  test(name, condition) {
    if (condition) {
      console.log(`   ✅ ${name}`);
      this.passed++;
    } else {
      console.log(`   ❌ ${name}`);
      this.failed++;
    }
    return condition;
  }

  async run() {
    console.log('🧪 AIRA Functional Tests');
    console.log('========================\n');

    // 1. Health Check
    console.log('1️⃣  Health Check');
    try {
      const res = await this.request('GET', '/health');
      this.test('GET /health returns 200', res.status === 200);
      this.test('Response has status field', res.data?.status === 'ok');
    } catch (err) {
      this.test('Server responding', false);
      console.error('   Server not available. Start with: npm run dev');
      return;
    }

    // 2. Login Flow
    console.log('\n2️⃣  Login Flow');
    {
      // Login con credenciales de demo
      const res = await this.request('POST', '/api/login', { dni: 'test1', pin: '1234' });
      this.test('Login returns 200', res.status === 200);
      this.test('Login returns token', !!res.data?.token);
      this.test('Login returns user', !!res.data?.user);
      this.token = res.data?.token;

      // Login segundo usuario
      const res2 = await this.request('POST', '/api/login', { dni: 'test2', pin: '1234' });
      this.token2 = res2.data?.token;
      this.test('Second user can login', !!res2.data?.token);

      // Login con PIN incorrecto
      const resBad = await this.request('POST', '/api/login', { dni: 'test1', pin: 'wrongpin' });
      this.test('Wrong PIN returns 401', resBad.status === 401);
    }

    // 3. Token Validation
    console.log('\n3️⃣  Token Validation');
    {
      // Token válido
      const res = await this.request('POST', '/api/auth/verify', null, this.token);
      this.test('Valid token accepted', res.status === 200);

      // Sin token
      const resNoToken = await this.request('GET', '/api/patients');
      this.test('No token returns 401', resNoToken.status === 401);

      // Token inválido
      const resBadToken = await this.request('GET', '/api/patients', null, 'invalid-token');
      this.test('Invalid token returns 401', resBadToken.status === 401);
    }

    // 4. CRUD Patients
    console.log('\n4️⃣  CRUD Patients');
    let patientId;
    {
      // Create
      const createRes = await this.request('POST', '/api/patients', {
        name: 'Test Patient',
        dni: '11111111',
        email: 'test@test.com'
      }, this.token);
      this.test('Create patient returns 201', createRes.status === 201);
      this.test('Created patient has id', !!createRes.data?.id);
      patientId = createRes.data?.id;

      // Read (list)
      const listRes = await this.request('GET', '/api/patients', null, this.token);
      this.test('List patients returns 200', listRes.status === 200);
      this.test('List returns array', Array.isArray(listRes.data?.patients));
      this.test('List contains created patient', listRes.data?.patients?.some(p => p.id === patientId));

      // Update
      const updateRes = await this.request('PATCH', `/api/patients/${patientId}`, {
        name: 'Updated Patient'
      }, this.token);
      this.test('Update patient returns 200', updateRes.status === 200);
      this.test('Name was updated', updateRes.data?.name === 'Updated Patient');

      // Validation
      const invalidRes = await this.request('POST', '/api/patients', {
        dni: '22222222'  // Missing name
      }, this.token);
      this.test('Missing name returns 400', invalidRes.status === 400);
    }

    // 5. CRUD Sessions
    console.log('\n5️⃣  CRUD Sessions');
    let sessionId;
    {
      // Create
      const createRes = await this.request('POST', '/api/sessions', {
        pacienteId: patientId,
        notas: 'Test session notes',
        tipo: 'individual',
        duracion: 45
      }, this.token);
      this.test('Create session returns 201', createRes.status === 201);
      this.test('Created session has id', !!createRes.data?.id);
      sessionId = createRes.data?.id;

      // Read (list)
      const listRes = await this.request('GET', '/api/sessions', null, this.token);
      this.test('List sessions returns 200', listRes.status === 200);
      this.test('List returns array', Array.isArray(listRes.data?.sessions));

      // Update
      const updateRes = await this.request('PATCH', `/api/sessions/${sessionId}`, {
        notas: 'Updated notes'
      }, this.token);
      this.test('Update session returns 200', updateRes.status === 200);

      // Invalid patient
      const invalidRes = await this.request('POST', '/api/sessions', {
        pacienteId: 999999,
        notas: 'Test'
      }, this.token);
      this.test('Invalid pacienteId returns 500', invalidRes.status === 500);
    }

    // 6. Data Isolation (Security)
    console.log('\n6️⃣  Data Isolation');
    {
      // User 2 should not see User 1's patients
      const listRes = await this.request('GET', '/api/patients', null, this.token2);
      const hasPatient = listRes.data?.patients?.some(p => p.id === patientId);
      this.test('User 2 cannot see User 1 patients', !hasPatient);

      // User 2 cannot update User 1's patient
      const updateRes = await this.request('PATCH', `/api/patients/${patientId}`, {
        name: 'Hacked!'
      }, this.token2);
      this.test('User 2 cannot update User 1 patient', updateRes.status === 404);

      // User 2 cannot delete User 1's patient
      const deleteRes = await this.request('DELETE', `/api/patients/${patientId}`, null, this.token2);
      this.test('User 2 cannot delete User 1 patient', deleteRes.status === 404);
    }

    // 7. Cleanup
    console.log('\n7️⃣  Cleanup');
    {
      // Delete session
      const delSession = await this.request('DELETE', `/api/sessions/${sessionId}`, null, this.token);
      this.test('Delete session returns 200', delSession.status === 200);

      // Delete patient
      const delPatient = await this.request('DELETE', `/api/patients/${patientId}`, null, this.token);
      this.test('Delete patient returns 200', delPatient.status === 200);

      // Verify deleted
      const listRes = await this.request('GET', '/api/patients', null, this.token);
      const stillExists = listRes.data?.patients?.some(p => p.id === patientId);
      this.test('Patient actually deleted', !stillExists);
    }

    // Results
    console.log('\n' + '═'.repeat(40));
    console.log(`📊 Results: ${this.passed} passed, ${this.failed} failed`);
    console.log('═'.repeat(40));

    if (this.failed > 0) {
      console.log('\n❌ SOME TESTS FAILED');
      process.exit(1);
    } else {
      console.log('\n✅ ALL TESTS PASSED');
      process.exit(0);
    }
  }
}

const tests = new FunctionalTests();
tests.run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});












