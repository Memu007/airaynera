/**
 * EXHAUSTIVE API TESTING - AIRA Medical Bot
 * Test all session storage functionality end-to-end
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:8080';
const MOCK_TOKEN = 'mock-jwt-token-for-development';

console.log('🧪 EXHAUSTIVE API TESTING');
console.log('=========================');

let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

function logTest(name, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name} - ${details}`);
  }
  testResults.details.push({ name, passed, details });
}

async function testHealthCheck() {
  try {
    const response = await axios.get(`${SERVER_URL}/api/health`);
    logTest('Health Check', response.status === 200 && response.data.status === 'healthy');
    return response.data;
  } catch (error) {
    logTest('Health Check', false, error.message);
    return null;
  }
}

async function testMockAuth() {
  try {
    const response = await axios.post(`${SERVER_URL}/api/auth/verify`, {}, {
      headers: { 'Authorization': `Bearer ${MOCK_TOKEN}` }
    });
    const success = response.status === 200 && response.data.sub === 'professional-001';
    logTest('Mock Authentication', success);
    return success ? response.data : null;
  } catch (error) {
    logTest('Mock Authentication', false, error.response?.data?.error || error.message);
    return null;
  }
}

async function testSessionStorage() {
  try {
    const sessionData = {
      patientId: 'test-patient-001',
      sessionDate: new Date().toISOString(),
      sessionType: 'text',
      sessionDuration: 60,
      notes: 'Test session - patient discussed work stress, no medical advice provided'
    };

    const response = await axios.post(`${SERVER_URL}/api/sessions/store`, sessionData);
    const success = response.status === 201 && response.data.success;
    logTest('Session Storage', success);
    
    if (success) {
      console.log(`   📋 Session ID: ${response.data.data.sessionId}`);
      return response.data.data.sessionId;
    }
    return null;
  } catch (error) {
    logTest('Session Storage', false, error.response?.data?.error || error.message);
    return null;
  }
}

async function testSessionRetrieval(sessionId) {
  try {
    const response = await axios.get(`${SERVER_URL}/api/sessions/${sessionId}`);
    const success = response.status === 200 && response.data.success;
    logTest('Session Retrieval', success);
    
    if (success) {
      console.log(`   📝 Retrieved: ${response.data.data.notes?.substring(0, 50)}...`);
    }
    return success;
  } catch (error) {
    logTest('Session Retrieval', false, error.response?.data?.error || error.message);
    return false;
  }
}

async function testMedicalAdviceValidation() {
  try {
    // This should fail - medical advice detected
    const invalidSessionData = {
      patientId: 'test-patient-002',
      sessionDate: new Date().toISOString(),
      sessionType: 'text',
      sessionDuration: 30,
      notes: 'El paciente debe tomar 50mg de sertraline dos veces al día para tratar la ansiedad'
    };

    const response = await axios.post(`${SERVER_URL}/api/sessions/store`, invalidSessionData);
    
    // If it succeeds, that's bad - validation failed
    logTest('Medical Advice Validation', false, 'Medical advice was not detected');
    return false;
  } catch (error) {
    // We expect this to fail due to validation
    const success = error.response?.status === 500 && 
                   error.response?.data?.error === 'STORAGE_ERROR' &&
                   error.response?.data?.message.includes('medical advice');
    
    logTest('Medical Advice Validation', success, 
            success ? 'Medical advice correctly detected' : 'Medical advice not properly detected');
    return success;
  }
}

async function testConcurrentSessions() {
  try {
    const promises = [];
    
    // Create 5 concurrent sessions
    for (let i = 0; i < 5; i++) {
      const sessionData = {
        patientId: `test-patient-${i + 3}`,
        sessionDate: new Date().toISOString(),
        sessionType: 'text',
        sessionDuration: 45 + (i * 5),
        notes: `Concurrent test session ${i + 1} - discussing various topics`
      };
      
      promises.push(axios.post(`${SERVER_URL}/api/sessions/store`, sessionData));
    }
    
    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    logTest('Concurrent Sessions', successCount === 5, 
            `Only ${successCount}/5 sessions stored successfully`);
    
    return successCount === 5;
  } catch (error) {
    logTest('Concurrent Sessions', false, error.message);
    return false;
  }
}

async function testLargeSessionData() {
  try {
    const largeNotes = 'Test session '.repeat(1000) + ' - large data test';
    
    const sessionData = {
      patientId: 'test-patient-large',
      sessionDate: new Date().toISOString(),
      sessionType: 'text',
      sessionDuration: 120,
      notes: largeNotes
    };

    const response = await axios.post(`${SERVER_URL}/api/sessions/store`, sessionData);
    const success = response.status === 201 && response.data.success;
    logTest('Large Session Data', success, `Notes length: ${largeNotes.length} chars`);
    
    return success;
  } catch (error) {
    logTest('Large Session Data', false, error.response?.data?.error || error.message);
    return false;
  }
}

async function testSpecialCharacters() {
  try {
    const specialNotes = 'Session with special characters: ñáéíóú ß 中文 العربية русский';
    
    const sessionData = {
      patientId: 'test-patient-special',
      sessionDate: new Date().toISOString(),
      sessionType: 'text',
      sessionDuration: 30,
      notes: specialNotes
    };

    const response = await axios.post(`${SERVER_URL}/api/sessions/store`, sessionData);
    const success = response.status === 201 && response.data.success;
    logTest('Special Characters', success);
    
    return success;
  } catch (error) {
    logTest('Special Characters', false, error.response?.data?.error || error.message);
    return false;
  }
}

async function testDateFormats() {
  try {
    const isoDate = new Date().toISOString();
    const sessionData = {
      patientId: 'test-patient-dates',
      sessionDate: isoDate,
      sessionType: 'text',
      sessionDuration: 60,
      notes: 'Testing various date formats'
    };

    const response = await axios.post(`${SERVER_URL}/api/sessions/store`, sessionData);
    const success = response.status === 201 && response.data.success;
    logTest('Date Format Handling', success, `ISO Date: ${isoDate}`);
    
    return success;
  } catch (error) {
    logTest('Date Format Handling', false, error.response?.data?.error || error.message);
    return false;
  }
}

async function runExhaustiveTests() {
  console.log(`🚀 Starting exhaustive API tests at ${new Date().toLocaleString()}`);
  console.log(`🌐 Server: ${SERVER_URL}`);

  // Run all tests
  const healthData = await testHealthCheck();
  const authData = await testMockAuth();
  
  if (!healthData || !authData) {
    console.log('\n❌ CRITICAL: Server health or auth failed - cannot continue');
    return;
  }

  const sessionId = await testSessionStorage();
  
  if (sessionId) {
    await testSessionRetrieval(sessionId);
  }

  await testMedicalAdviceValidation();
  await testConcurrentSessions();
  await testLargeSessionData();
  await testSpecialCharacters();
  await testDateFormats();

  // Results summary
  console.log('\n📊 EXHAUSTIVE TEST RESULTS');
  console.log('==========================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${Math.round(testResults.passed/testResults.total * 100)}%`);

  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System is ready for production.');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - Review failed tests:');
    testResults.details.filter(t => !t.passed).forEach(test => {
      console.log(`   • ${test.name}: ${test.details}`);
    });
  }

  console.log('\n💭 NEXT STEPS:');
  console.log('   1. Fix any failed tests');
  console.log('   2. Investigate n8n WhatsApp integration');
  console.log('   3. Implement message handling workflow');
  console.log('   4. Deploy to production environment');
}

// Run tests
runExhaustiveTests().catch(error => {
  console.error('❌ TEST RUNNER ERROR:', error.message);
  process.exit(1);
});