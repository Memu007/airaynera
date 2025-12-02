const axios = require('axios');

const BASE_URL = 'http://localhost:8080/api/whatsapp';

async function testAgents() {
    console.log('🤖 Starting Agent Verification...');

    try {
        // 0. Create Test Patient (Seed Data)
        console.log('\n🌱 Seeding Test Patient...');
        const seedPatient = {
            name: 'María González',
            email: 'maria.gonzalez@test.com',
            phone: '+5491145678901',
            dni: '12345678',
            insurance: 'OSDE',
            habilitado: true
        };
        
        try {
            await axios.post('http://localhost:8080/api/patients', seedPatient);
            console.log('✅ Test Patient Seeded');
        } catch (e) {
            console.log('ℹ️ Patient might already exist, continuing...');
        }

        // 1. Test Patient Recognition
        console.log('\n🔍 Testing Patient Recognition Agent...');
        const recognitionRes = await axios.post(`${BASE_URL}/recognize-patient`, {
            phoneNumber: '+5491145678901', // Matches mock/seed data
            aiAnalysis: {
                patientIdentified: true,
                patientName: 'María González',
                confidence: 0.95,
                sessionType: 'individual'
            },
            transcription: 'Hola, soy María González. Vengo para mi sesión de terapia.'
        });
        
        if (recognitionRes.data.success && recognitionRes.data.patient) {
            console.log('✅ Patient Recognition: PASSED');
            console.log(`   Identified: ${recognitionRes.data.patient.name} (ID: ${recognitionRes.data.patient.id})`);
        } else {
            console.error('❌ Patient Recognition: FAILED');
            console.error(recognitionRes.data);
            // Don't proceed if patient not found, as next steps depend on it
            throw new Error('Patient recognition failed, cannot proceed with session creation.');
        }

        // 2. Test Session Creation
        console.log('\n📝 Testing Session Creation Agent...');
        const sessionRes = await axios.post(`${BASE_URL}/create-session`, {
            patientData: recognitionRes.data.patient,
            sessionData: { type: 'individual' },
            transcription: 'Esta es una sesión de prueba generada por el agente de verificación.',
            audioInfo: { duration: 120, messageId: 'msg_123', mimeType: 'audio/ogg', timestamp: Date.now() }
        });

        if (sessionRes.data.success && sessionRes.data.sessionId) {
            console.log('✅ Session Creation: PASSED');
            console.log(`   Session ID: ${sessionRes.data.sessionId}`);
        } else {
            console.error('❌ Session Creation: FAILED');
            console.error(sessionRes.data);
        }

        // 3. Test Session Saving (AI Analysis)
        console.log('\n💾 Testing Session Save Agent...');
        const saveRes = await axios.post(`${BASE_URL}/save-session`, {
            sessionId: sessionRes.data.sessionId,
            aiSummary: {
                summary: 'El paciente muestra progreso en la verificación de agentes.',
                emotionalState: { intensity: 8 },
                recommendations: ['Continuar con pruebas automatizadas'],
                requiresFollowUp: false
            }
        });

        if (saveRes.data.success) {
            console.log('✅ Session Save: PASSED');
            console.log('   Session updated with AI summary.');
        } else {
            console.error('❌ Session Save: FAILED');
            console.error(saveRes.data);
        }

        console.log('\n🎉 All Agent Tests Completed Successfully!');

    } catch (error) {
        console.error('\n❌ Agent Verification Failed:', error.message);
        if (error.code) console.error('   Code:', error.code);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Response Data:', error.response.data);
        } else if (error.request) {
            console.error('   No response received. Request details:', error.request._currentUrl);
        } else {
            console.error('   Error details:', error);
        }
    }
}

testAgents();
