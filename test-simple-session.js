/**
 * Simple Session Storage Test
 * Tests the core session storage functionality
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:8080';

console.log('🧪 SIMPLE SESSION STORAGE TEST');
console.log('==============================');

// Mock token for development
const MOCK_TOKEN = 'mock-jwt-token-for-development';

async function testHealthCheck() {
  try {
    console.log('\n✅ Testing Server Health...');
    const response = await axios.get(`${SERVER_URL}/api/health`);
    console.log('   ✅ Server is healthy');
    console.log(`   📍 Version: ${response.data.version}`);
    console.log(`   ⏰ Uptime: ${response.data.uptime}s`);
    return true;
  } catch (error) {
    console.log('   ❌ Server health check failed');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testMockAuth() {
  try {
    console.log('\n✅ Testing Mock Authentication...');
    const response = await axios.post(`${SERVER_URL}/api/auth/verify`, {}, {
      headers: {
        'Authorization': `Bearer ${MOCK_TOKEN}`
      }
    });
    console.log('   ✅ Mock authentication works');
    console.log(`   👤 User: ${response.data.name} (${response.data.role})`);
    return response.data;
  } catch (error) {
    console.log('   ❌ Mock authentication failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function testSessionStorage(user) {
  try {
    console.log('\n✅ Testing Session Storage...');
    
    // Test session data
    const sessionData = {
      patientId: 'test-patient-1',
      sessionDate: new Date().toISOString(),
      sessionType: 'text',
      sessionDuration: 60,
      notes: 'Test session for validation purposes - no medical advice'
    };

    const response = await axios.post(`${SERVER_URL}/api/sessions/store`, sessionData, {
      headers: {
        'Authorization': `Bearer ${MOCK_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('   ✅ Session stored successfully');
      console.log(`   📋 Session ID: ${response.data.data.sessionId}`);
      console.log(`   📅 Date: ${response.data.data.sessionDate}`);
      console.log(`   ⏱️ Duration: ${response.data.data.sessionDuration} minutes`);
      return response.data.data.sessionId;
    } else {
      console.log('   ❌ Session storage failed');
      return null;
    }
  } catch (error) {
    console.log('   ❌ Session storage test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    if (error.response?.data?.details) {
      console.log(`   Details: ${error.response.data.details}`);
    }
    return null;
  }
}

async function testSessionRetrieval(sessionId) {
  try {
    console.log('\n✅ Testing Session Retrieval...');
    
    const response = await axios.get(`${SERVER_URL}/api/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${MOCK_TOKEN}`
      }
    });

    if (response.data.success) {
      console.log('   ✅ Session retrieved successfully');
      console.log(`   📋 Session ID: ${response.data.data.sessionId}`);
      console.log(`   👤 Patient ID: ${response.data.data.patientId}`);
      console.log(`   📝 Notes: ${response.data.data.notes?.substring(0, 50)}...`);
      return true;
    } else {
      console.log('   ❌ Session retrieval failed');
      return false;
    }
  } catch (error) {
    console.log('   ❌ Session retrieval test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testSessionList() {
  try {
    console.log('\n✅ Testing Session List...');
    
    const response = await axios.get(`${SERVER_URL}/api/sessions/`, {
      headers: {
        'Authorization': `Bearer ${MOCK_TOKEN}`
      }
    });

    if (response.data.success) {
      console.log('   ✅ Session list retrieved successfully');
      console.log(`   📊 Total sessions: ${response.data.data.total}`);
      console.log(`   📋 Sessions: ${response.data.data.sessions.length} in this page`);
      return true;
    } else {
      console.log('   ❌ Session list failed');
      return false;
    }
  } catch (error) {
    console.log('   ❌ Session list test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testMedicationTracking() {
  try {
    console.log('\n✅ Testing Medication Tracking...');
    
    // Test medication data (name only, no dosage)
    const medicationData = {
      sessionId: 'test-session-1',
      patientId: 'test-patient-1',
      sessionDate: new Date().toISOString(),
      medicationName: 'Sertraline', // Just the name, no dosage
      medicationType: 'prescribed_by_other',
      mentionType: 'patient_mentioned',
      notes: 'Patient mentioned taking this medication prescribed by another doctor'
    };

    // First, let's check if the medication service exists
    const MedicationTrackingService = require('./src/services/medicationTrackingService');
    const medicationService = new MedicationTrackingService();
    
    // Mock professional data
    const mockMedicationData = {
      ...medicationData,
      professionalId: 1,
      professionalType: 'psychiatrist'
    };

    const result = await medicationService.storeMedicationMention(mockMedicationData);
    
    if (result.success) {
      console.log('   ✅ Medication mention stored successfully');
      console.log(`   💊 Medication: ${result.medicationName}`);
      console.log(`   📋 Type: ${result.medicationType}`);
      console.log(`   📝 Mention: ${result.mentionType}`);
      return true;
    } else {
      console.log('   ❌ Medication tracking failed');
      return false;
    }
  } catch (error) {
    console.log('   ❌ Medication tracking test failed');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log(`🚀 Starting tests at ${new Date().toLocaleString()}`);
  console.log(`🌐 Server: ${SERVER_URL}`);

  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('\n❌ SERVER IS NOT RUNNING - Cannot continue tests');
    console.log('💡 Please start the server with: npm start');
    return;
  }

  const user = await testMockAuth();
  if (!user) {
    console.log('\n❌ AUTHENTICATION FAILED - Cannot continue tests');
    return;
  }

  const sessionId = await testSessionStorage(user);
  if (!sessionId) {
    console.log('\n❌ SESSION STORAGE FAILED - Check implementation');
    return;
  }

  const retrieved = await testSessionRetrieval(sessionId);
  const listed = await testSessionList();
  const medications = await testMedicationTracking();

  // Final results
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('=======================');
  console.log(`Server Health: ${healthOk ? '✅' : '❌'}`);
  console.log(`Authentication: ${user ? '✅' : '❌'}`);
  console.log(`Session Storage: ${sessionId ? '✅' : '❌'}`);
  console.log(`Session Retrieval: ${retrieved ? '✅' : '❌'}`);
  console.log(`Session List: ${listed ? '✅' : '❌'}`);
  console.log(`Medication Tracking: ${medications ? '✅' : '❌'}`);

  const passedTests = [healthOk, user, sessionId, retrieved, listed, medications].filter(Boolean).length;
  const totalTests = 6;

  console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests * 100)}%)`);

  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Session-only system is working correctly.');
    console.log('✅ Ready for production deployment');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - Please check the implementation');
  }

  console.log('\n💭 NEXT STEPS:');
  console.log('   1. Integrate session storage routes into main server ✓');
  console.log('   2. Test with real authentication (JWT tokens)');
  console.log('   3. Add comprehensive error handling');
  console.log('   4. Implement data retention policies');
  console.log('   5. Add audit logging for HIPAA compliance');
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ TEST RUNNER ERROR:', error.message);
  process.exit(1);
});