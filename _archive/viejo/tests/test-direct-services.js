/**
 * Direct Session Storage Test
 * Tests session storage and medication tracking functionality directly
 */

// Load environment variables from .env file
require('dotenv').config();

const SessionStorageService = require('./src/services/sessionStorageService');
const MedicationTrackingService = require('./src/services/medicationTrackingService');

console.log('🧪 DIRECT SESSION STORAGE TEST');
console.log('==============================');

async function testSessionStorageService() {
  try {
    console.log('\n✅ Testing Session Storage Service...');
    
    const sessionService = new SessionStorageService();
    
    // Test session data
    const sessionData = {
      sessionId: 'test-session-001',
      professionalId: 'professional-001',
      professionalType: 'psychologist',
      patientId: 'patient-001',
      sessionDate: new Date().toISOString(),
      sessionType: 'text',
      sessionDuration: 60,
      notes: 'Test session for validation - no medical advice content',
      audioFile: null
    };

    // Store session
    console.log('   📝 Storing session...');
    const storedSession = await sessionService.storeSession(sessionData);
    
    if (storedSession && storedSession.sessionId) {
      console.log('   ✅ Session stored successfully');
      console.log(`   📋 Session ID: ${storedSession.sessionId}`);
      console.log(`   👤 Patient ID: ${storedSession.patientId}`);
      console.log(`   📅 Date: ${storedSession.sessionDate}`);
      
      // Retrieve session
      console.log('   📖 Retrieving session...');
      const retrievedSession = await sessionService.retrieveSession(
        storedSession.sessionId, 
        sessionData.professionalId
      );
      
      if (retrievedSession) {
        console.log('   ✅ Session retrieved successfully');
        console.log(`   📝 Notes: ${retrievedSession.notes?.substring(0, 50)}...`);
        return storedSession.sessionId;
      } else {
        console.log('   ❌ Session retrieval failed');
        return null;
      }
    } else {
      console.log('   ❌ Session storage failed');
      return null;
    }
    
  } catch (error) {
    console.log('   ❌ Session storage service error:', error.message);
    return null;
  }
}

async function testMedicationTrackingService() {
  try {
    console.log('\n✅ Testing Medication Tracking Service...');
    
    const medicationService = new MedicationTrackingService();
    
    // Test medication data (name only, no dosage)
    const medicationData = {
      sessionId: 'test-session-001',
      professionalId: 'professional-001',
      professionalType: 'psychiatrist',
      patientId: 'patient-001',
      sessionDate: new Date().toISOString(),
      medicationName: 'Sertraline', // Just the name, no dosage
      medicationType: 'prescribed_by_other',
      mentionType: 'patient_mentioned',
      notes: 'Patient mentioned taking this medication prescribed by another professional - no advice given'
    };

    console.log('   💊 Storing medication mention...');
    const result = await medicationService.storeMedicationMention(medicationData);
    
    if (result && result.success) {
      console.log('   ✅ Medication mention stored successfully');
      console.log(`   💊 Medication: ${result.medicationName}`);
      console.log(`   📋 Type: ${result.medicationType}`);
      console.log(`   📝 Mention: ${result.mentionType}`);
      console.log(`   🆔 ID: ${result.medicationId}`);
      
      // Get medication stats
      console.log('   📊 Getting medication stats...');
      const stats = await medicationService.getMedicationStats(medicationData.professionalId);
      
      if (stats && stats.success) {
        console.log('   ✅ Medication stats retrieved successfully');
        console.log(`   📈 Total mentions: ${stats.stats.totalMentions}`);
        console.log(`   👥 Unique patients: ${stats.stats.uniquePatients}`);
      } else {
        console.log('   ❌ Medication stats retrieval failed');
      }
      
      return true;
    } else {
      console.log('   ❌ Medication tracking failed');
      console.log('   Details:', result);
      return false;
    }
    
  } catch (error) {
    console.log('   ❌ Medication tracking service error:', error.message);
    console.log('   Stack:', error.stack);
    return false;
  }
}

async function testValidation() {
  try {
    console.log('\n✅ Testing Validation Against Medical Advice...');
    
    // Test data that should pass validation
    const validSessionData = {
      sessionId: 'test-session-002',
      professionalId: 'professional-001',
      professionalType: 'psychologist',
      patientId: 'patient-002',
      sessionDate: new Date().toISOString(),
      sessionType: 'text',
      sessionDuration: 45,
      notes: 'Patient expressed feelings about work stress - no medical advice provided'
    };

    // Test data that should fail validation
    const invalidSessionData = {
      ...validSessionData,
      notes: 'You should take this medication twice daily for anxiety - this is medical advice'
    };

    const sessionService = new SessionStorageService();
    
    console.log('   📝 Testing valid session data...');
    const validResult = await sessionService.storeSession(validSessionData);
    if (validResult && validResult.sessionId) {
      console.log('   ✅ Valid session data accepted');
    } else {
      console.log('   ❌ Valid session data rejected');
    }
    
    console.log('   🚫 Testing invalid session data (medical advice)...');
    try {
      const invalidResult = await sessionService.storeSession(invalidSessionData);
      console.log('   ❌ INVALID: Medical advice was not detected and rejected');
      return false;
    } catch (error) {
      if (error.message.includes('medical advice detected')) {
        console.log('   ✅ Medical advice correctly detected and rejected');
        return true;
      } else {
        console.log('   ⚠️  Different error detected:', error.message);
        return false;
      }
    }
    
  } catch (error) {
    console.log('   ❌ Validation test error:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log(`🚀 Starting direct service tests at ${new Date().toLocaleString()}`);

  const sessionId = await testSessionStorageService();
  const medications = await testMedicationTrackingService();
  const validation = await testValidation();

  // Final results
  console.log('\n📊 DIRECT TEST RESULTS SUMMARY');
  console.log('=================================');
  console.log(`Session Storage: ${sessionId ? '✅' : '❌'}`);
  console.log(`Medication Tracking: ${medications ? '✅' : '❌'}`);
  console.log(`Validation: ${validation ? '✅' : '❌'}`);

  const passedTests = [sessionId, medications, validation].filter(Boolean).length;
  const totalTests = 3;

  console.log(`\n🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests * 100)}%)`);

  if (passedTests === totalTests) {
    console.log('\n🎉 ALL DIRECT TESTS PASSED! Core services are working correctly.');
    console.log('✅ Session-only functionality verified');
    console.log('✅ Ready for server integration testing');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - Please check implementation');
  }

  console.log('\n💭 NEXT STEPS:');
  console.log('   1. Fix server startup issues (authentication/routes)');
  console.log('   2. Test complete API integration');
  console.log('   3. Add comprehensive error handling');
  console.log('   4. Implement data retention policies');
  console.log('   5. Add audit logging for HIPAA compliance');
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ TEST RUNNER ERROR:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});