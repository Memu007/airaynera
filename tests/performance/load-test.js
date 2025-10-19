import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métricas personalizadas
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Configuración de prueba
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
    errors: ['rate<0.1'],             // Custom error rate under 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8082';

// Datos de prueba
const testPatients = [
  { name: 'Load Test Patient 1', dni: '10000001', email: 'load1@test.com' },
  { name: 'Load Test Patient 2', dni: '10000002', email: 'load2@test.com' },
  { name: 'Load Test Patient 3', dni: '10000003', email: 'load3@test.com' },
];

// Función de autenticación
function authenticate() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'testpassword'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => JSON.parse(r.body).token !== undefined,
  });

  return JSON.parse(loginRes.body).token;
}

// Función para crear paciente
function createPatient(token, patientData) {
  const res = http.post(`${BASE_URL}/api/patients`, JSON.stringify(patientData), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  check(res, {
    'patient created': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(res.status !== 201);
  responseTime.add(res.timings.duration);

  return JSON.parse(res.body).data;
}

// Función para obtener pacientes
function getPatients(token, page = 1) {
  const res = http.get(`${BASE_URL}/api/patients?page=${page}&limit=10`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  check(res, {
    'patients retrieved': (r) => r.status === 200,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);

  return JSON.parse(res.body);
}

// Función para obtener paciente por ID
function getPatientById(token, id) {
  const res = http.get(`${BASE_URL}/api/patients/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  check(res, {
    'patient retrieved': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);
}

// Función para actualizar paciente
function updatePatient(token, id, data) {
  const res = http.put(`${BASE_URL}/api/patients/${id}`, JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  check(res, {
    'patient updated': (r) => r.status === 200,
    'response time < 400ms': (r) => r.timings.duration < 400,
  });

  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);
}

// Función para eliminar paciente
function deletePatient(token, id) {
  const res = http.del(`${BASE_URL}/api/patients/${id}`, null, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  check(res, {
    'patient deleted': (r) => r.status === 200,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);
}

// Función para probar endpoints de autenticación
function testAuthEndpoints() {
  group('Authentication', function() {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: 'test@example.com',
      password: 'testpassword'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

    check(loginRes, {
      'login successful': (r) => r.status === 200,
      'login response time < 500ms': (r) => r.timings.duration < 500,
    });

    const registerRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      email: `loadtest${Date.now()}@test.com`,
      password: 'testpassword',
      name: 'Load Test User'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

    check(registerRes, {
      'registration successful': (r) => r.status === 201,
      'registration response time < 800ms': (r) => r.timings.duration < 800,
    });
  });
}

// Función para probar endpoints de pacientes
function testPatientEndpoints(token) {
  group('Patient CRUD Operations', function() {
    // Crear pacientes
    const createdPatients = [];
    testPatients.forEach((patient, index) => {
      const created = createPatient(token, {
        ...patient,
        dni: `${Date.now()}${index}`,
        email: `load${Date.now()}${index}@test.com`
      });
      if (created) createdPatients.push(created);
    });

    sleep(1);

    // Listar pacientes
    const patientsList = getPatients(token);
    if (patientsList.data && patientsList.data.length > 0) {
      const randomPatient = patientsList.data[Math.floor(Math.random() * patientsList.data.length)];
      
      // Obtener paciente específico
      getPatientById(token, randomPatient.id);
      
      // Actualizar paciente
      updatePatient(token, randomPatient.id, {
        name: 'Updated Load Test',
        phone: '+54 9 11 9999 9999'
      });
      
      sleep(0.5);
      
      // Eliminar paciente (opcional en load test)
      // deletePatient(token, randomPatient.id);
    }
  });
}

// Función para probar endpoints de sesiones
function testSessionEndpoints(token) {
  group('Session Operations', function() {
    // Crear sesión
    const sessionData = {
      patientId: 'test-patient-id',
      date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      duration: 60,
      type: 'consulta'
    };

    const createRes = http.post(`${BASE_URL}/api/sessions`, JSON.stringify(sessionData), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    check(createRes, {
      'session created': (r) => r.status === 201,
      'session creation time < 600ms': (r) => r.timings.duration < 600,
    });

    // Listar sesiones
    const sessionsRes = http.get(`${BASE_URL}/api/sessions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    check(sessionsRes, {
      'sessions retrieved': (r) => r.status === 200,
      'sessions retrieval time < 400ms': (r) => r.timings.duration < 400,
    });
  });
}

// Función principal de prueba
export default function() {
  // Autenticación
  const token = authenticate();
  if (!token) {
    console.error('Failed to authenticate');
    return;
  }

  // Ejecutar pruebas
  testAuthEndpoints();
  
  if (token) {
    testPatientEndpoints(token);
    testSessionEndpoints(token);
  }

  sleep(1);
}

// Configuración de pruebas de humo
export function smokeTest() {
  return {
    vus: 1,
    duration: '30s',
    thresholds: {
      http_req_duration: ['p(95)<1000'],
      http_req_failed: ['rate<0.1'],
    },
  };
}

// Configuración de pruebas de estrés
export function stressTest() {
  return {
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '5m', target: 300 },
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<2000'],
      http_req_failed: ['rate<0.2'],
    },
  };
}

// Configuración de pruebas de pico
export function spikeTest() {
  return {
    stages: [
      { duration: '30s', target: 10 },
      { duration: '30s', target: 500 }, // Spike
      { duration: '30s', target: 10 },
      { duration: '30s', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<3000'],
      http_req_failed: ['rate<0.3'],
    },
  };
}

// Configuración de pruebas de resistencia
export function enduranceTest() {
  return {
    stages: [
      { duration: '2m', target: 50 },
      { duration: '30m', target: 50 }, // Long duration
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<1000'],
      http_req_failed: ['rate<0.05'],
    },
  };
}

// Setup y teardown
export function setup() {
  console.log('Starting load test...');
  return { baseUrl: BASE_URL };
}

export function teardown(data) {
  console.log('Load test completed');
}
