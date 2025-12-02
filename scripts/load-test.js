#!/usr/bin/env node
/**
 * Load Test - Simula usuarios concurrentes
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8080';
const SCENARIOS = {
  smoke: { users: 10, duration: 60 },
  load: { users: 50, duration: 120 },
  stress: { users: 100, duration: 180 }
};

class LoadTester {
  constructor() {
    this.stats = {
      requests: 0,
      successes: 0,
      errors: 0,
      latencies: [],
      startTime: null
    };
    this.running = false;
    this.tokens = new Map();
  }

  async request(method, path, body = null, token = null) {
    const url = new URL(path, BASE_URL);
    const start = Date.now();
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
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
          const latency = Date.now() - start;
          this.stats.requests++;
          this.stats.latencies.push(latency);
          
          if (res.statusCode >= 200 && res.statusCode < 400) {
            this.stats.successes++;
            try {
              resolve({ status: res.statusCode, data: JSON.parse(data), latency });
            } catch {
              resolve({ status: res.statusCode, data, latency });
            }
          } else {
            this.stats.errors++;
            resolve({ status: res.statusCode, error: data, latency });
          }
        });
      });

      req.on('error', (err) => {
        this.stats.requests++;
        this.stats.errors++;
        reject(err);
      });

      req.setTimeout(10000, () => {
        this.stats.requests++;
        this.stats.errors++;
        req.destroy();
        reject(new Error('Timeout'));
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async login(userId) {
    if (this.tokens.has(userId)) return this.tokens.get(userId);
    
    const res = await this.request('POST', '/api/login', {
      dni: `user${userId}`,
      pin: '1234'
    });
    
    if (res.data?.token) {
      this.tokens.set(userId, res.data.token);
      return res.data.token;
    }
    return null;
  }

  async simulateUser(userId) {
    while (this.running) {
      try {
        // Login si no tiene token
        const token = await this.login(userId);
        if (!token) {
          await this.sleep(1000);
          continue;
        }

        // Flujo típico de usuario
        // 1. Listar pacientes
        await this.request('GET', '/api/patients', null, token);
        await this.sleep(100);

        // 2. Listar sesiones
        await this.request('GET', '/api/sessions', null, token);
        await this.sleep(100);

        // 3. Health check
        await this.request('GET', '/health');
        
        // Pausa entre ciclos
        await this.sleep(500 + Math.random() * 500);
      } catch (err) {
        // Continuar en caso de error
        await this.sleep(1000);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculatePercentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * p);
    return sorted[idx] || 0;
  }

  printStats() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rps = (this.stats.requests / elapsed).toFixed(1);
    const errorRate = ((this.stats.errors / this.stats.requests) * 100).toFixed(2);
    
    const p50 = this.calculatePercentile(this.stats.latencies, 0.5);
    const p95 = this.calculatePercentile(this.stats.latencies, 0.95);
    const p99 = this.calculatePercentile(this.stats.latencies, 0.99);
    
    console.log(`   Requests: ${this.stats.requests} | RPS: ${rps} | Errors: ${errorRate}% | p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms`);
  }

  async run(scenario) {
    const config = SCENARIOS[scenario];
    if (!config) {
      console.error(`Escenario no válido: ${scenario}`);
      console.log(`Disponibles: ${Object.keys(SCENARIOS).join(', ')}`);
      process.exit(1);
    }

    console.log('🚀 AIRA Load Test');
    console.log('=================\n');
    console.log(`Escenario: ${scenario}`);
    console.log(`Usuarios: ${config.users}`);
    console.log(`Duración: ${config.duration}s`);
    console.log(`URL: ${BASE_URL}\n`);

    // Verificar servidor
    try {
      await this.request('GET', '/health');
      console.log('✅ Servidor respondiendo\n');
    } catch (err) {
      console.error('❌ Servidor no disponible:', err.message);
      process.exit(1);
    }

    this.running = true;
    this.stats.startTime = Date.now();

    // Iniciar usuarios virtuales
    console.log(`🏃 Iniciando ${config.users} usuarios virtuales...\n`);
    const users = [];
    for (let i = 1; i <= config.users; i++) {
      users.push(this.simulateUser(i));
      // Escalonar inicio
      if (i % 10 === 0) await this.sleep(100);
    }

    // Mostrar progreso
    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - this.stats.startTime) / 1000);
      process.stdout.write(`\r⏱️  ${elapsed}s/${config.duration}s `);
      this.printStats();
    }, 5000);

    // Esperar duración
    await this.sleep(config.duration * 1000);
    
    this.running = false;
    clearInterval(interval);

    // Esperar a que terminen los usuarios
    await this.sleep(2000);

    // Resultados finales
    console.log('\n\n📊 RESULTADOS FINALES');
    console.log('=====================');
    
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rps = (this.stats.requests / elapsed).toFixed(1);
    const errorRate = ((this.stats.errors / this.stats.requests) * 100).toFixed(2);
    
    const latencies = this.stats.latencies.sort((a, b) => a - b);
    const p50 = this.calculatePercentile(latencies, 0.5);
    const p95 = this.calculatePercentile(latencies, 0.95);
    const p99 = this.calculatePercentile(latencies, 0.99);
    const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b) / latencies.length) : 0;

    console.log(`\nMétricas:`);
    console.log(`   Total requests: ${this.stats.requests}`);
    console.log(`   Successes: ${this.stats.successes}`);
    console.log(`   Errors: ${this.stats.errors} (${errorRate}%)`);
    console.log(`   RPS: ${rps}`);
    console.log(`\nLatencias:`);
    console.log(`   Promedio: ${avg}ms`);
    console.log(`   P50: ${p50}ms`);
    console.log(`   P95: ${p95}ms`);
    console.log(`   P99: ${p99}ms`);

    // Evaluación
    console.log('\n📋 Evaluación:');
    // RPS esperado: ~3 requests/ciclo/user con 700ms delay promedio = ~4.3 RPS/user
    const expectedMinRps = config.users * 2; // 2 RPS por usuario es conservador
    const checks = [
      { name: `RPS > ${expectedMinRps} (${config.users} users × 2)`, pass: parseFloat(rps) > expectedMinRps },
      { name: 'Errores < 1%', pass: parseFloat(errorRate) < 1 },
      { name: 'P95 < 500ms', pass: p95 < 500 },
      { name: 'P99 < 1000ms', pass: p99 < 1000 }
    ];

    for (const check of checks) {
      console.log(`   ${check.pass ? '✅' : '❌'} ${check.name}`);
    }

    const passed = checks.filter(c => c.pass).length;
    console.log(`\n${passed === checks.length ? '✅ PASSED' : '❌ FAILED'} (${passed}/${checks.length})`);
    
    process.exit(passed === checks.length ? 0 : 1);
  }
}

// Main
const scenario = process.argv[2] || 'smoke';
const tester = new LoadTester();
tester.run(scenario).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

