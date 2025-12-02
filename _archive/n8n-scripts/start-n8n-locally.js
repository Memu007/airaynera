#!/usr/bin/env node

/**
 * 🏥 AIRA Medical System - n8n Local Setup
 *
 * Script para iniciar n8n localmente y configurar el workflow de AIRA
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class N8NLocalSetup {
    constructor() {
        this.n8nProcess = null;
        this.n8nPort = 5678;
        this.workspaceDir = '/Users/Emi/Downloads/beiabot/beiabot-master';
    }

    async startN8N() {
        console.log('🏥 AIRA Medical System - n8n Local Setup');
        console.log('🔧 Starting n8n service locally...');
        console.log('');

        try {
            // 1. Verificar que el workflow existe
            const workflowPath = path.join(this.workspaceDir, 'workflow_data', 'aira-session-optimization.json');
            if (!fs.existsSync(workflowPath)) {
                throw new Error('Workflow file not found. Please run n8n-workflow-builder.js first.');
            }

            console.log('✅ Workflow file found');

            // 2. Iniciar n8n
            console.log('🚀 Starting n8n service...');
            await this.startN8NService();

            // 3. Esperar a que n8n esté listo
            console.log('⏳ Waiting for n8n to be ready...');
            await this.waitForN8NReady();

            // 4. Mostrar información de acceso
            this.showAccessInfo();

            console.log('✅ n8n is ready for AIRA integration!');
            console.log('');
            console.log('📋 Next steps:');
            console.log('1. Open http://localhost:5678 in your browser');
            console.log('2. Login with admin@aira-medical.com / aira_secure_2025');
            console.log('3. Import workflow from workflow_data/aira-session-optimization.json');
            console.log('4. Configure Gemini 2.0 API credentials');
            console.log('5. Test the workflow');

        } catch (error) {
            console.error('❌ Failed to start n8n:', error.message);
            throw error;
        }
    }

    async startN8NService() {
        return new Promise((resolve, reject) => {
            const env = {
                ...process.env,
                N8N_HOST: 'localhost',
                N8N_PORT: this.n8nPort,
                N8N_PROTOCOL: 'http',
                N8N_BASIC_AUTH_ACTIVE: 'true',
                N8N_BASIC_AUTH_USER: 'aira_admin',
                N8N_BASIC_AUTH_PASSWORD: 'aira_secure_2025',
                N8N_WEBHOOK_URL: 'http://localhost:5678/',
                N8N_METRICS: 'true',
                N8N_LOG_LEVEL: 'info',
                DB_TYPE: 'sqlite',
                DB_SQLITE_DATABASE: path.join(this.workspaceDir, 'data', 'n8n.db'),
                N8N_DEFAULT_LOCALE: 'es',
                N8N_DEFAULT_USER_EMAIL: 'admin@aira-medical.com',
                N8N_DEFAULT_USER_PASSWORD: 'aira_secure_2025',
                GEMINI_API_KEY: 'AIzaSyBi-JgR5zF2J1xpC9_PuNGT0dgg7_2E1rI',
                AIRA_API_SECRET: 'aira_optimization_secret_2025'
            };

            // Asegurar que el directorio de datos existe
            const dataDir = path.join(this.workspaceDir, 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.n8nProcess = spawn('npx', ['-y', 'n8n'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: env,
                cwd: this.workspaceDir
            });

            let stdout = '';
            let stderr = '';

            this.n8nProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;

                // Filtrar mensajes para mostrar solo los importantes
                if (output.includes('n8n ready') ||
                    output.includes('n8n is listening') ||
                    output.includes('Webhook available') ||
                    output.includes('Database initialized') ||
                    output.includes('ERROR')) {
                    process.stdout.write(output);
                }
            });

            this.n8nProcess.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                process.stderr.write(output);
            });

            this.n8nProcess.on('close', (code) => {
                console.log(`n8n process exited with code ${code}`);
            });

            this.n8nProcess.on('error', (error) => {
                console.error('Failed to start n8n:', error);
                reject(error);
            });

            // Resolver después de un tiempo para dar tiempo a que inicie
            setTimeout(() => {
                resolve();
            }, 3000);
        });
    }

    async waitForN8NReady() {
        const maxAttempts = 30;
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const http = require('http');

                const response = await new Promise((resolve, reject) => {
                    const req = http.request({
                        hostname: 'localhost',
                        port: this.n8nPort,
                        path: '/',
                        method: 'GET',
                        timeout: 2000
                    }, (res) => {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers
                        });
                    });

                    req.on('error', reject);
                    req.on('timeout', () => {
                        req.destroy();
                        reject(new Error('Timeout'));
                    });

                    req.end();
                });

                if (response.statusCode === 200) {
                    console.log('✅ n8n is ready!');
                    return;
                }

            } catch (error) {
                // n8n aún no está listo
            }

            attempts++;
            await this.sleep(1000);
        }

        throw new Error('n8n failed to start within timeout period');
    }

    showAccessInfo() {
        console.log('');
        console.log('🎉 n8n Configuration Complete!');
        console.log('================================');
        console.log('');
        console.log('🌐 n8n Web Interface: http://localhost:5678');
        console.log('👤 Login: admin@aira-medical.com');
        console.log('🔑 Password: aira_secure_2025');
        console.log('');
        console.log('📋 Workflow Import:');
        console.log('   1. Go to Workflows → Import from File');
        console.log(`   2. Select: ${path.join(this.workspaceDir, 'workflow_data', 'aira-session-optimization.json')}`);
        console.log('   3. Click "Import"');
        console.log('');
        console.log('🔗 API Credentials Needed:');
        console.log('   • Gemini 2.0 API Key: AIzaSyBi-JgR5zF2J1xpC9_PuNGT0dgg7_2E1rI');
        console.log('   • AIRA API Secret: aira_optimization_secret_2025');
        console.log('');
        console.log('🎯 Workflow URL: http://localhost:5678/webhook/whatsapp');
        console.log('');
        console.log('📱 Test WhatsApp Integration:');
        console.log('   curl -X POST http://localhost:5678/webhook/whatsapp \\');
        console.log('        -H "Content-Type: application/json" \\');
        console.log('        -d \'{"from": "+5491112345678", "body": "Hola, soy María García. Quiero agendar una sesión individual."}\'');
        console.log('');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Detener n8n cuando se termina el proceso
    stopN8N() {
        if (this.n8nProcess) {
            console.log('🛑 Stopping n8n...');
            this.n8nProcess.kill('SIGTERM');
        }
    }
}

// Manejar la terminación del proceso
const setup = new N8NLocalSetup();

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down n8n...');
    setup.stopN8N();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down n8n...');
    setup.stopN8N();
    process.exit(0);
});

// Ejecutar configuración
if (require.main === module) {
    setup.startN8N()
        .then(() => {
            console.log('✅ n8n setup completed successfully!');
            console.log('Press Ctrl+C to stop n8n when you are done testing.');

            // Mantener el proceso corriendo
            return new Promise(() => {});
        })
        .catch((error) => {
            console.error('❌ n8n setup failed:', error);
            process.exit(1);
        });
}

module.exports = N8NLocalSetup;