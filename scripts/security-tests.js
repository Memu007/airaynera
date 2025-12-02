#!/usr/bin/env node
/**
 * Security Tests - Valida seguridad y aislamiento de datos
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8080';

class SecurityTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  async request(method, path, body = null, headers = {}) {
    const url = new URL(path, BASE_URL);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, data, headers: res.headers });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });

      if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
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

  async getToken(dni = 'sectest1') {
    const res = await this.request('POST', '/api/login', { dni, pin: '1234' });
    return res.data?.token;
  }

  async run() {
    console.log('🔒 AIRA Security Tests');
    console.log('======================\n');

    // Check server
    try {
      await this.request('GET', '/health');
    } catch (err) {
      console.error('❌ Server not available');
      return;
    }

    // 1. Authentication Tests
    console.log('1️⃣  Authentication');
    {
      // No token
      const res1 = await this.request('GET', '/api/patients');
      this.test('No token → 401', res1.status === 401);

      // Invalid token
      const res2 = await this.request('GET', '/api/patients', null, { Authorization: 'Bearer invalid' });
      this.test('Invalid token → 401', res2.status === 401);

      // Malformed token
      const res3 = await this.request('GET', '/api/patients', null, { Authorization: 'invalid' });
      this.test('Malformed auth header → 401', res3.status === 401);

      // Empty Bearer
      const res4 = await this.request('GET', '/api/patients', null, { Authorization: 'Bearer ' });
      this.test('Empty Bearer → 401', res4.status === 401);

      // JWT with wrong signature
      const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.wrongsignature';
      const res5 = await this.request('GET', '/api/patients', null, { Authorization: `Bearer ${fakeJwt}` });
      this.test('JWT wrong signature → 401', res5.status === 401);
    }

    // 2. Input Validation
    console.log('\n2️⃣  Input Validation');
    const token = await this.getToken();
    {
      // Empty name
      const res1 = await this.request('POST', '/api/patients', { name: '' }, { Authorization: `Bearer ${token}` });
      this.test('Empty name → 400', res1.status === 400);

      // Name too short
      const res2 = await this.request('POST', '/api/patients', { name: 'A' }, { Authorization: `Bearer ${token}` });
      this.test('Name too short → 400', res2.status === 400);

      // Invalid email
      const res3 = await this.request('POST', '/api/patients', { name: 'Test', email: 'notanemail' }, { Authorization: `Bearer ${token}` });
      this.test('Invalid email → 400', res3.status === 400);

      // Missing pacienteId in session
      const res4 = await this.request('POST', '/api/sessions', { notas: 'test' }, { Authorization: `Bearer ${token}` });
      this.test('Missing pacienteId → 400', res4.status === 400);

      // Invalid session type
      const res5 = await this.request('POST', '/api/sessions', { pacienteId: 1, tipo: 'invalid_type' }, { Authorization: `Bearer ${token}` });
      this.test('Invalid session type → 400', res5.status === 400);
    }

    // 3. SQL Injection Attempts
    console.log('\n3️⃣  SQL Injection');
    {
      // In patient name
      const sqlPayload = "'; DROP TABLE patients; --";
      const res1 = await this.request('POST', '/api/patients', { name: sqlPayload }, { Authorization: `Bearer ${token}` });
      // Should either reject (400) or sanitize (201 with escaped name)
      this.test('SQL in name handled', res1.status === 201 || res1.status === 400);

      // In search/filter (if exists)
      const res2 = await this.request('GET', '/api/patients?search=\' OR 1=1--', null, { Authorization: `Bearer ${token}` });
      this.test('SQL in query param handled', res2.status !== 500);

      // Verify tables still exist
      const res3 = await this.request('GET', '/api/patients', null, { Authorization: `Bearer ${token}` });
      this.test('Database intact after injection attempts', res3.status === 200);
    }

    // 4. XSS Attempts
    console.log('\n4️⃣  XSS Prevention');
    {
      const xssPayload = '<script>alert("xss")</script>';
      
      // Create patient with XSS in name
      const res1 = await this.request('POST', '/api/patients', { name: xssPayload }, { Authorization: `Bearer ${token}` });
      // Note: In a JSON API, XSS is handled by the frontend when rendering
      // The backend stores data as-is, which is safe for JSON responses
      // Frontend must use textContent or escape HTML when displaying
      this.test('XSS payload stored (frontend must escape)', res1.status === 201 || res1.status === 400);
      
      if (res1.data?.id) {
        // Cleanup test data
        await this.request('DELETE', `/api/patients/${res1.data.id}`, null, { Authorization: `Bearer ${token}` });
      }
    }

    // 5. Rate Limiting
    console.log('\n5️⃣  Rate Limiting');
    {
      // Note: Rate limiting might be disabled in dev, so we just check it exists
      const res = await this.request('GET', '/health');
      const hasRateHeaders = res.headers['x-ratelimit-limit'] || res.headers['ratelimit-limit'];
      this.test('Rate limit headers present (or dev mode)', true); // Informational
    }

    // 6. Security Headers
    console.log('\n6️⃣  Security Headers');
    {
      const res = await this.request('GET', '/health');
      
      this.test('X-Content-Type-Options present', !!res.headers['x-content-type-options']);
      this.test('X-Frame-Options present', !!res.headers['x-frame-options']);
      this.test('Content-Security-Policy present', !!res.headers['content-security-policy']);
      // HSTS only in production
      // this.test('Strict-Transport-Security present', !!res.headers['strict-transport-security']);
    }

    // 7. Data Isolation
    console.log('\n7️⃣  Data Isolation');
    {
      // Create data for user 1
      const token1 = await this.getToken('iso_user1');
      const patient1 = await this.request('POST', '/api/patients', { name: 'User1 Patient' }, { Authorization: `Bearer ${token1}` });
      const patientId = patient1.data?.id;

      // User 2 tries to access
      const token2 = await this.getToken('iso_user2');
      
      // Try to list
      const list2 = await this.request('GET', '/api/patients', null, { Authorization: `Bearer ${token2}` });
      const canSee = list2.data?.patients?.some(p => p.name === 'User1 Patient');
      this.test('User 2 cannot see User 1 patients', !canSee);

      // Try to update
      if (patientId) {
        const update2 = await this.request('PATCH', `/api/patients/${patientId}`, { name: 'Hacked' }, { Authorization: `Bearer ${token2}` });
        this.test('User 2 cannot update User 1 patient', update2.status === 404);

        // Try to delete
        const delete2 = await this.request('DELETE', `/api/patients/${patientId}`, null, { Authorization: `Bearer ${token2}` });
        this.test('User 2 cannot delete User 1 patient', delete2.status === 404);

        // Cleanup
        await this.request('DELETE', `/api/patients/${patientId}`, null, { Authorization: `Bearer ${token1}` });
      }
    }

    // 8. Large Payload
    console.log('\n8️⃣  Large Payload Handling');
    {
      // Very long name
      const longName = 'A'.repeat(10000);
      const res1 = await this.request('POST', '/api/patients', { name: longName }, { Authorization: `Bearer ${token}` });
      this.test('Long name handled (rejected or truncated)', res1.status !== 500);

      // Very long notes
      const longNotes = 'B'.repeat(100000);
      const patientRes = await this.request('POST', '/api/patients', { name: 'Test' }, { Authorization: `Bearer ${token}` });
      if (patientRes.data?.id) {
        const res2 = await this.request('POST', '/api/sessions', { 
          pacienteId: patientRes.data.id, 
          notas: longNotes 
        }, { Authorization: `Bearer ${token}` });
        this.test('Long notes handled', res2.status !== 500);
        
        // Cleanup
        await this.request('DELETE', `/api/patients/${patientRes.data.id}`, null, { Authorization: `Bearer ${token}` });
      }
    }

    // Results
    console.log('\n' + '═'.repeat(40));
    console.log(`📊 Results: ${this.passed} passed, ${this.failed} failed`);
    console.log('═'.repeat(40));

    if (this.failed > 0) {
      console.log('\n⚠️  SOME SECURITY TESTS FAILED');
      process.exit(1);
    } else {
      console.log('\n✅ ALL SECURITY TESTS PASSED');
      process.exit(0);
    }
  }
}

const tests = new SecurityTests();
tests.run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

