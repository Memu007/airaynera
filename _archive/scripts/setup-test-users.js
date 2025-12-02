/**
 * 🧪 SETUP TEST USERS - AIRA Medical System
 * Script para crear usuarios de prueba seguros para desarrollo
 * Versión 2.0 - Production Ready
 */

require('dotenv').config();
const { Firestore } = require('@google-cloud/firestore');
const UserService = require('../services/userService');

// Configuración de la base de datos
const db = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'aira-medical-system',
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

/**
 * Función principal para configurar usuarios de prueba
 */
async function setupTestUsers() {
    console.log('🚀 Starting test users setup...\n');

    try {
        // Inicializar servicio de usuarios
        const userService = new UserService(db);

        // Crear usuarios de prueba
        console.log('📝 Creating test users...\n');
        const results = await userService.createTestUsers();

        // Mostrar resultados
        console.log('\n📊 RESULTS SUMMARY:');
        console.log('=====================================\n');

        const created = results.filter(r => r.status === 'created');
        const existing = results.filter(r => r.status === 'already_exists');
        const errors = results.filter(r => r.status === 'error');

        if (created.length > 0) {
            console.log('✅ SUCCESSFULLY CREATED USERS:');
            created.forEach(user => {
                console.log(`   👤 ${user.name} (${user.role})`);
                console.log(`      📧 Email: ${user.email}`);
                console.log(`      🔑 DNI: ${user.dni}`);
                console.log(`      🔐 Password: ${user.password}`);
                console.log(`      🎭 Role: ${user.role}`);
                console.log('');
            });
        }

        if (existing.length > 0) {
            console.log('⚠️  ALREADY EXISTING USERS:');
            existing.forEach(user => {
                console.log(`   👤 ${user.name} (${user.dni})`);
            });
            console.log('');
        }

        if (errors.length > 0) {
            console.log('❌ ERRORS:');
            errors.forEach(user => {
                console.log(`   ❌ ${user.name} (${user.dni}): ${user.error}`);
            });
            console.log('');
        }

        // Instructions de login
        console.log('🔐 LOGIN INSTRUCTIONS:');
        console.log('=====================================\n');
        
        const availableUsers = [...created, ...existing];
        if (availableUsers.length > 0) {
            console.log('Use these credentials to test the authentication system:\n');
            
            availableUsers.forEach(user => {
                if (user.status !== 'error') {
                    console.log(`${user.role.toUpperCase()} USER:`);
                    console.log(`   User ID: ${user.dni}`);
                    if (user.password) {
                        console.log(`   Password: ${user.password}`);
                    } else {
                        console.log(`   Password: [Existing user - check database]`);
                    }
                    console.log(`   Role: ${user.role}`);
                    console.log('');
                }
            });
        }

        // API Usage Examples
        console.log('🌐 API USAGE EXAMPLES:');
        console.log('=====================================\n');
        
        console.log('1. LOGIN:');
        console.log('   POST /api/auth/login');
        console.log('   {\n     "userId": "admin123",\n     "password": "[admin_password]"\n   }');
        console.log('');
        
        console.log('2. REFRESH TOKEN:');
        console.log('   POST /api/auth/refresh');
        console.log('   {\n     "refreshToken": "[refresh_token_from_login]"\n   }');
        console.log('');
        
        console.log('3. GET USER INFO:');
        console.log('   GET /api/auth/me');
        console.log('   Authorization: Bearer [access_token]');
        console.log('');
        
        console.log('4. LOGOUT:');
        console.log('   POST /api/auth/logout');
        console.log('   Authorization: Bearer [access_token]');
        console.log('   {\n     "refreshToken": "[refresh_token]"\n   }');
        console.log('');

        // Security notes
        console.log('🔒 SECURITY NOTES:');
        console.log('=====================================\n');
        console.log('⚠️  These are TEST users only - DO NOT use in production!');
        console.log('⚠️  Passwords are generated securely but shown here for testing only');
        console.log('⚠️  In production, users would create their own secure passwords');
        console.log('⚠️  Rate limiting and security measures are fully active');
        console.log('');

        console.log('✅ Test users setup completed successfully!');
        console.log(`📊 Created: ${created.length}, Existing: ${existing.length}, Errors: ${errors.length}`);

    } catch (error) {
        console.error('❌ Error setting up test users:', error);
        process.exit(1);
    }
}

/**
 * Función para verificar usuarios existentes
 */
async function verifyExistingUsers() {
    console.log('🔍 Verifying existing users...\n');

    try {
        const professionalsSnapshot = await db.collection('professionals').get();
        
        console.log(`📊 Found ${professionalsSnapshot.size} professionals in database:\n`);

        if (professionalsSnapshot.size === 0) {
            console.log('No professionals found. Database appears to be empty.\n');
            return;
        }

        professionalsSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`👤 ${data.nombre} (${doc.id})`);
            console.log(`   📧 Email: ${data.email}`);
            console.log(`   🎭 Role: ${data.role || 'professional'}`);
            console.log(`   🏥 Specialty: ${data.especialidad || 'Not specified'}`);
            console.log(`   ✅ Status: ${data.status || 'unknown'}`);
            console.log(`   📅 Created: ${data.created_at?.toDate()?.toLocaleDateString() || 'Unknown'}`);
            console.log(`   🔐 Has Password: ${data.password_hash ? 'Yes' : 'No'}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error verifying existing users:', error);
    }
}

/**
 * Función para limpiar usuarios de prueba
 */
async function cleanupTestUsers() {
    console.log('🧹 Cleaning up test users...\n');

    const testUserIds = [
        'admin123',
        'psych001', 
        'psych002',
        'psych003'
    ];

    try {
        let deletedCount = 0;

        for (const userId of testUserIds) {
            const docRef = db.collection('professionals').doc(userId);
            const doc = await docRef.get();
            
            if (doc.exists) {
                await docRef.delete();
                
                // Also clean up password history
                const historySnapshot = await db.collection('password_history')
                    .where('user_id', '==', userId)
                    .get();
                
                for (const historyDoc of historySnapshot.docs) {
                    await historyDoc.ref.delete();
                }
                
                console.log(`🗑️  Deleted test user: ${userId}`);
                deletedCount++;
            } else {
                console.log(`⚠️  Test user not found: ${userId}`);
            }
        }

        console.log(`\n✅ Cleanup completed. Deleted ${deletedCount} test users.`);

    } catch (error) {
        console.error('❌ Error cleaning up test users:', error);
    }
}

// Command line interface
const command = process.argv[2];

switch (command) {
    case 'setup':
        setupTestUsers();
        break;
    case 'verify':
        verifyExistingUsers();
        break;
    case 'cleanup':
        cleanupTestUsers();
        break;
    default:
        console.log('🧪 AIRA Medical System - Test Users Setup\n');
        console.log('Usage: node setup-test-users.js [command]\n');
        console.log('Commands:');
        console.log('  setup    - Create test users for development');
        console.log('  verify   - List existing users in database');
        console.log('  cleanup  - Remove test users from database\n');
        console.log('Examples:');
        console.log('  node setup-test-users.js setup');
        console.log('  node setup-test-users.js verify');
        console.log('  node setup-test-users.js cleanup');
        break;
}

module.exports = {
    setupTestUsers,
    verifyExistingUsers,
    cleanupTestUsers
};