const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

const API_URL = 'http://localhost:8080/api';
const DB_PATH = path.join(__dirname, '../data/aira.db');

async function testMultiTenancy() {
    console.log('🔒 Testing Multi-Tenancy...');

    // User A Token (ID: 1)
    const tokenA = 'mock-jwt-token-1';
    // User B Token (ID: 2)
    const tokenB = 'mock-jwt-token-2';

    try {
        // 1. User A creates a patient
        console.log('   User A creating patient "Patient A"...');
        const resA = await axios.post(`${API_URL}/patients`, {
            name: 'Patient A',
            email: 'patient.a@example.com',
            dni: '11111111',
            phone: '1111111111'
        }, { headers: { Authorization: `Bearer ${tokenA}` } });
        
        const patientIdA = resA.data.id;
        console.log(`   ✅ Patient A created (ID: ${patientIdA})`);

        // 2. User B lists patients
        console.log('   User B listing patients...');
        const resB = await axios.get(`${API_URL}/patients`, { 
            headers: { Authorization: `Bearer ${tokenB}` } 
        });
        
        const patientsB = resB.data.patients;
        const found = patientsB.find(p => p.id === patientIdA);
        
        if (found) {
            console.error('   ❌ FAIL: User B can see User A\'s patient!');
        } else {
            console.log('   ✅ PASS: User B cannot see User A\'s patient.');
        }

        // 3. User A lists patients
        console.log('   User A listing patients...');
        const resListA = await axios.get(`${API_URL}/patients`, { 
            headers: { Authorization: `Bearer ${tokenA}` } 
        });
        const foundA = resListA.data.patients.find(p => p.id === patientIdA);
        
        if (foundA) {
            console.log('   ✅ PASS: User A can see their own patient.');
        } else {
            console.error('   ❌ FAIL: User A cannot see their own patient!');
        }

    } catch (error) {
        console.error('   ❌ Error during multi-tenancy test:', error.message);
        if (error.response) console.error('      Response:', error.response.data);
    }
}

function testEncryption() {
    console.log('\n🔐 Testing Encryption...');
    
    try {
        const db = new Database(DB_PATH);
        const rows = db.prepare('SELECT name, email, dni FROM patients').all();
        
        if (rows.length === 0) {
            console.log('   ⚠️ No patients found in DB to check.');
            return;
        }

        const patient = rows[0];
        console.log('   Raw DB Record:', patient);

        // Check if name is encrypted (should be a JSON string with 'ct', 'iv', etc. or at least not "Patient A")
        let isEncrypted = false;
        try {
            const parsed = JSON.parse(patient.name);
            if (parsed.ct && parsed.iv) isEncrypted = true;
        } catch (e) {
            // Not JSON, so maybe plain text
        }

        if (isEncrypted) {
            console.log('   ✅ PASS: Name is encrypted in database.');
        } else {
            console.error('   ❌ FAIL: Name is NOT encrypted (stored as plain text).');
        }

    } catch (error) {
        console.error('   ❌ Error checking database:', error.message);
    }
}

async function run() {
    await testMultiTenancy();
    testEncryption();
}

run();
