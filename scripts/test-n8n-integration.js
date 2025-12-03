/**
 * Test de integración n8n → Backend AIRA
 * 
 * Simula lo que el workflow de n8n enviaría al backend.
 * 
 * Uso:
 *   N8N_SERVICE_TOKEN=tu_token node scripts/test-n8n-integration.js
 * 
 * O sin token (solo funciona en dev):
 *   node scripts/test-n8n-integration.js
 */

const BASE_URL = process.env.AIRA_URL || 'https://aira-final.onrender.com';
const TOKEN = process.env.N8N_SERVICE_TOKEN || '';

async function makeRequest(endpoint, body) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`\n📡 POST ${url}`);
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (TOKEN) {
    headers['X-N8N-Token'] = TOKEN;
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

// ===== TESTS =====

async function testRecognizePatient() {
  console.log('\n' + '='.repeat(50));
  console.log('TEST 1: Reconocer paciente por teléfono');
  console.log('='.repeat(50));
  
  const result = await makeRequest('/api/whatsapp/recognize-patient', {
    phoneNumber: '+5491155551234',
    transcription: 'Hoy el paciente Juan reportó mejora en su estado de ánimo.',
    aiAnalysis: {
      patientIdentified: true,
      patientName: 'Juan Pérez',
      intent: 'new_session',
      summary: 'Paciente reporta mejora'
    }
  });
  
  console.log(`📊 Status: ${result.status}`);
  console.log(`📦 Response:`, JSON.stringify(result.data || result.error, null, 2));
  
  return result;
}

async function testCreateSession() {
  console.log('\n' + '='.repeat(50));
  console.log('TEST 2: Crear sesión clínica');
  console.log('='.repeat(50));
  
  const result = await makeRequest('/api/whatsapp/create-session', {
    patientData: {
      id: 1,
      name: 'Juan Pérez'
    },
    sessionData: {
      type: 'individual',
      summary: 'Sesión de seguimiento'
    },
    transcription: 'El paciente mostró avances significativos esta semana.',
    audioInfo: {
      duration: 300 // 5 minutos
    }
  });
  
  console.log(`📊 Status: ${result.status}`);
  console.log(`📦 Response:`, JSON.stringify(result.data || result.error, null, 2));
  
  return result;
}

async function testHealthCheck() {
  console.log('\n' + '='.repeat(50));
  console.log('TEST 0: Health Check del servidor');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log(`📊 Status: ${response.status}`);
    console.log(`📦 Response:`, JSON.stringify(data, null, 2));
    return { status: response.status, data };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { status: 0, error: error.message };
  }
}

// ===== MAIN =====

async function main() {
  console.log('🚀 Test de integración n8n → AIRA Backend');
  console.log(`🌐 URL: ${BASE_URL}`);
  console.log(`🔑 Token: ${TOKEN ? '***' + TOKEN.slice(-8) : '(no configurado)'}`);
  
  // Test 0: Verificar que el servidor está vivo
  const health = await testHealthCheck();
  if (health.status !== 200) {
    console.log('\n❌ El servidor no responde. Abortando tests.');
    process.exit(1);
  }
  
  // Test 1: Reconocer paciente
  const recognize = await testRecognizePatient();
  
  // Test 2: Crear sesión
  const session = await testCreateSession();
  
  // Resumen
  console.log('\n' + '='.repeat(50));
  console.log('📋 RESUMEN');
  console.log('='.repeat(50));
  console.log(`Health Check: ${health.status === 200 ? '✅' : '❌'}`);
  console.log(`Recognize Patient: ${recognize.status === 200 ? '✅' : '❌'} (${recognize.status})`);
  console.log(`Create Session: ${session.status === 200 ? '✅' : '❌'} (${session.status})`);
  
  const allPassed = health.status === 200 && recognize.status === 200 && session.status === 200;
  console.log(`\n${allPassed ? '✅ Todos los tests pasaron' : '⚠️ Algunos tests fallaron'}`);
  
  process.exit(allPassed ? 0 : 1);
}

main();
