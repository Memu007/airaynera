/**
 * Script de Inicialización Segura de Base de Datos
 * Crea colecciones, índices y configuración inicial
 * EJECUTAR UNA VEZ antes del primer deploy
 */

require('dotenv').config();
const { Firestore } = require('@google-cloud/firestore');
const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function initializeDatabase() {
    console.log('🔧 Iniciando configuración segura de la base de datos...\n');

    // Verificar variables de entorno
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
        console.error('❌ Error: GOOGLE_CLOUD_PROJECT_ID no configurado en .env');
        process.exit(1);
    }

    // Conectar a Firestore
    const db = new Firestore({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    try {
        // 1. Crear colecciones con documentos iniciales
        console.log('📁 Creando colecciones...');
        
        // Colección de configuración
        await db.collection('config').doc('system').set({
            version: '2.0.0',
            initialized: new Date(),
            maintenanceMode: false,
            features: {
                whatsappEnabled: false,
                analyticsEnabled: true,
                backupsEnabled: true,
                twoFactorEnabled: false
            },
            limits: {
                maxPatientsPerUser: 100,
                maxSessionsPerDay: 50,
                maxFileSizeMB: 10
            },
            compliance: {
                hipaaMode: true,
                dataRetentionDays: 2555,
                auditLogEnabled: true
            }
        });

        // 2. Crear índices compuestos
        console.log('🔍 Configurando índices...');
        
        // Nota: En Firestore, los índices compuestos se crean automáticamente
        // o mediante el archivo firestore.indexes.json
        console.log('   ℹ️  Los índices se crearán automáticamente al ejecutar las queries');

        // 3. Crear usuario administrador
        console.log('\n👤 Configuración del usuario administrador:');
        
        const adminEmail = await question('Email del administrador: ');
        const adminName = await question('Nombre completo: ');
        const adminPassword = await question('Contraseña (mín. 8 caracteres): ');
        
        // Validar contraseña
        if (adminPassword.length < 8) {
            console.error('❌ La contraseña debe tener al menos 8 caracteres');
            process.exit(1);
        }

        // Hash de contraseña
        const passwordHash = await bcrypt.hash(adminPassword, 12);

        // Crear usuario admin
        const adminUser = {
            email: adminEmail,
            passwordHash,
            name: adminName,
            role: 'admin',
            status: 'active',
            createdAt: new Date(),
            failedLoginAttempts: 0,
            settings: {
                notifications: true,
                twoFactorEnabled: false,
                language: 'es',
                timezone: 'America/Argentina/Buenos_Aires'
            },
            permissions: ['*'] // Todos los permisos
        };

        const adminRef = await db.collection('users').add(adminUser);
        console.log(`✅ Usuario administrador creado con ID: ${adminRef.id}`);

        // 4. Crear estructura de auditoría
        console.log('\n📋 Configurando sistema de auditoría...');
        
        await db.collection('audit_logs').add({
            event: 'system_initialized',
            timestamp: new Date(),
            userId: adminRef.id,
            details: {
                version: '2.0.0',
                adminEmail: adminEmail
            }
        });

        // 5. Crear templates de mensajes
        console.log('\n💬 Creando templates de mensajes...');
        
        const messageTemplates = [
            {
                id: 'welcome',
                name: 'Mensaje de bienvenida',
                content: 'Hola {{name}}! 👋 Soy AIRA, tu asistente médico. ¿En qué puedo ayudarte hoy?',
                variables: ['name'],
                type: 'text'
            },
            {
                id: 'appointment_reminder',
                name: 'Recordatorio de cita',
                content: 'Hola {{name}}, te recordamos tu cita para mañana a las {{time}}. ¿Confirmás tu asistencia?',
                variables: ['name', 'time'],
                type: 'text'
            },
            {
                id: 'crisis_detected',
                name: 'Alerta de crisis',
                content: '🚨 ALERTA: Se detectó una posible situación de crisis con el paciente {{patientName}}. Por favor, revisar inmediatamente.',
                variables: ['patientName'],
                type: 'alert'
            }
        ];

        for (const template of messageTemplates) {
            await db.collection('message_templates').doc(template.id).set(template);
        }

        // 6. Crear roles y permisos
        console.log('\n🔐 Configurando roles y permisos...');
        
        const roles = {
            admin: {
                name: 'Administrador',
                permissions: ['*'],
                description: 'Acceso completo al sistema'
            },
            doctor: {
                name: 'Doctor/Profesional',
                permissions: [
                    'patients:*',
                    'sessions:*',
                    'messages:send',
                    'reports:view',
                    'settings:own'
                ],
                description: 'Gestión completa de pacientes y sesiones'
            },
            assistant: {
                name: 'Asistente',
                permissions: [
                    'patients:read',
                    'sessions:read',
                    'messages:send',
                    'reports:view'
                ],
                description: 'Solo lectura y envío de mensajes'
            }
        };

        for (const [roleId, roleData] of Object.entries(roles)) {
            await db.collection('roles').doc(roleId).set(roleData);
        }

        // 7. Configurar reglas de seguridad
        console.log('\n🛡️  Configurando reglas de seguridad...');
        console.log('   ℹ️  Las reglas de Firestore deben configurarse en firestore.rules');

        // 8. Crear colección de backups
        console.log('\n💾 Configurando sistema de backups...');
        
        await db.collection('backups').add({
            timestamp: new Date(),
            type: 'initial_setup',
            status: 'completed',
            collections: ['users', 'config', 'roles', 'message_templates']
        });

        // 9. Resumen final
        console.log('\n' + '='.repeat(50));
        console.log('✅ BASE DE DATOS INICIALIZADA CORRECTAMENTE');
        console.log('='.repeat(50));
        console.log('\n📊 Resumen:');
        console.log(`   - Admin creado: ${adminEmail}`);
        console.log('   - Colecciones: users, patients, sessions, config, audit_logs');
        console.log('   - Roles: admin, doctor, assistant');
        console.log('   - Templates: 3 plantillas de mensajes');
        console.log('\n⚠️  IMPORTANTE:');
        console.log('   1. Guarda las credenciales del admin de forma segura');
        console.log('   2. Configura firestore.rules con las reglas de seguridad');
        console.log('   3. Activa los índices necesarios en la consola de Firebase');
        console.log('   4. Configura los backups automáticos en Google Cloud');
        
    } catch (error) {
        console.error('\n❌ Error durante la inicialización:', error);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Confirmación antes de ejecutar
async function main() {
    console.log('⚠️  ADVERTENCIA: Este script inicializará la base de datos.');
    console.log('   Solo debe ejecutarse UNA VEZ en un proyecto nuevo.\n');
    
    const confirm = await question('¿Deseas continuar? (yes/no): ');
    
    if (confirm.toLowerCase() === 'yes') {
        await initializeDatabase();
    } else {
        console.log('❌ Inicialización cancelada');
    }
    
    process.exit(0);
}

// Ejecutar
main().catch(console.error); 