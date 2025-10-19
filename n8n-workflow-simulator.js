/**
 * 🏥 AIRA Medical System - n8n Workflow Simulator
 *
 * Simulador completo del workflow n8n para pruebas de estrés sin necesidad de Docker
 */

const http = require('http');
const url = require('url');

class N8NWorkflowSimulator {
    constructor() {
        this.port = 5678;
        this.airaBaseUrl = 'http://localhost:8082';
        this.geminiApiKey = 'AIzaSyBi-JgR5zF2J1xpC9_PuNGT0dgg7_2E1rI';
        this.server = null;
        this.workflowStats = {
            executions: 0,
            successful: 0,
            failed: 0,
            whatsappMessages: 0,
            patientRecognitions: 0,
            sessionsCreated: 0
        };
    }

    async start() {
        console.log('🏥 AIRA Medical System - n8n Workflow Simulator');
        console.log('🔧 Starting n8n workflow simulation service...');
        console.log('');

        try {
            // 1. Verificar AIRA API está activa
            await this.checkAIRAHealth();

            // 2. Iniciar servidor simulador de n8n
            await this.startSimulatorServer();

            // 3. Mostrar información de uso
            this.showUsageInfo();

            console.log('✅ n8n Workflow Simulator is ready!');
            console.log('');

        } catch (error) {
            console.error('❌ Failed to start simulator:', error.message);
            throw error;
        }
    }

    async checkAIRAHealth() {
        return new Promise((resolve, reject) => {
            http.get('http://localhost:8082/api/health', (res) => {
                if (res.statusCode === 200) {
                    console.log('✅ AIRA API: Connected and healthy');
                    resolve();
                } else {
                    reject(new Error('AIRA API not responding correctly'));
                }
            }).on('error', reject);
        });
    }

    async startSimulatorServer() {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        return new Promise((resolve, reject) => {
            this.server.listen(this.port, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`✅ n8n Simulator listening on port ${this.port}`);
                    resolve();
                }
            });
        });
    }

    async handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const method = req.method;

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            if (parsedUrl.pathname === '/webhook/whatsapp' && method === 'POST') {
                await this.handleWhatsAppWebhook(req, res);
            } else if (parsedUrl.pathname === '/' && method === 'GET') {
                this.sendHomePage(res);
            } else if (parsedUrl.pathname === '/stats' && method === 'GET') {
                this.sendStats(res);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        } catch (error) {
            console.error('Request handling error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    async handleWhatsAppWebhook(req, res) {
        this.workflowStats.executions++;
        this.workflowStats.whatsappMessages++;

        try {
            // Leer body del request
            const body = await this.readRequestBody(req);
            const whatsappData = JSON.parse(body);

            console.log(`📱 WhatsApp Message: ${whatsappData.body} from ${whatsappData.from}`);

            // 1. Simular análisis con Gemini 2.0
            const geminiAnalysis = await this.simulateGeminiAnalysis(whatsappData.body);

            // 2. Verificar reconocimiento de paciente
            if (geminiAnalysis.patientName && geminiAnalysis.patientName !== null) {
                this.workflowStats.patientRecognitions++;
            }

            // 3. Enviar a AIRA API
            const sessionData = {
                professionalId: 1, // ID del profesional por defecto
                patientId: geminiAnalysis.patientName ? `patient_${Date.now()}` : null,
                transcription: whatsappData.body,
                metadata: {
                    confidence: geminiAnalysis.confidence,
                    wordCount: whatsappData.body.split(/\s+/).length,
                    estimatedDuration: Math.ceil(whatsappData.body.split(/\s+/).length * 2.5),
                    detectedPatientName: geminiAnalysis.patientName,
                    source: 'whatsapp',
                    timestamp: new Date().toISOString(),
                    sessionType: geminiAnalysis.sessionType,
                    inputFormat: geminiAnalysis.inputFormat,
                    contentSummary: geminiAnalysis.contentSummary
                }
            };

            const airaResponse = await this.sendToAIRAAPI(sessionData);

            if (airaResponse.success) {
                this.workflowStats.successful++;
                this.workflowStats.sessionsCreated++;

                // 4. Enviar respuesta de éxito
                const response = {
                    success: true,
                    sessionId: airaResponse.sessionId || `session_${Date.now()}`,
                    message: 'Sesión optimizada exitosamente',
                    patientInfo: geminiAnalysis.patientName ? {
                        name: geminiAnalysis.patientName,
                        recognized: true
                    } : {
                        name: 'No reconocido',
                        recognized: false
                    },
                    sessionType: geminiAnalysis.sessionType,
                    optimizationStatus: 'completed',
                    timestamp: new Date().toISOString()
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response, null, 2));

                console.log(`✅ Workflow completed for ${geminiAnalysis.patientName || 'Unknown patient'}`);

            } else {
                throw new Error(airaResponse.error || 'Session creation failed');
            }

        } catch (error) {
            this.workflowStats.failed++;
            console.error(`❌ Workflow failed: ${error.message}`);

            // Enviar respuesta de error
            const errorResponse = {
                success: false,
                error: error.message,
                message: 'No se pudo procesar la solicitud. Por favor, intente nuevamente.',
                requiresManualInput: true,
                timestamp: new Date().toISOString()
            };

            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(errorResponse, null, 2));
        }
    }

    async simulateGeminiAnalysis(message) {
        // Simular tiempo de procesamiento de Gemini (100-300ms)
        await this.sleep(100 + Math.random() * 200);

        // Extraer nombre del paciente
        const nameMatch = message.match(/soy ([^.]+)/i);
        const patientName = nameMatch ? nameMatch[1].trim() : null;

        // Detectar tipo de sesión
        const sessionType = message.includes('pareja') ? 'pareja' :
                           message.includes('familiar') ? 'familiar' : 'individual';

        // Detectar formato (siempre texto en esta simulación)
        const inputFormat = 'texto';

        // Generar resumen del contenido
        const contentSummary = message.substring(0, 50) + '...';

        // Calcular confianza
        const confidence = patientName ? 0.85 + Math.random() * 0.15 : 0.3 + Math.random() * 0.4;

        return {
            patientName,
            sessionType,
            inputFormat,
            contentSummary,
            confidence,
            processingTime: 100 + Math.random() * 200
        };
    }

    async sendToAIRAAPI(sessionData) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(sessionData);

            const options = {
                hostname: 'localhost',
                port: 8082,
                path: '/api/session/create',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Authorization': 'Bearer aira_optimization_secret_2025'
                }
            };

            const req = http.request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        if (res.statusCode === 200 || res.statusCode === 201) {
                            resolve({ success: true, data: response, sessionId: response.sessionId });
                        } else {
                            resolve({ success: false, error: response.error || 'API Error', statusCode: res.statusCode });
                        }
                    } catch (e) {
                        resolve({ success: false, error: 'Invalid response format', statusCode: res.statusCode });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('AIRA API timeout'));
            });

            req.write(postData);
            req.end();
        });
    }

    sendHomePage(res) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>AIRA n8n Workflow Simulator</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: #e8f4fd; padding: 20px; border-radius: 8px; text-align: center; }
        .test-form { background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
        input, button { padding: 10px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; cursor: pointer; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 AIRA Medical System</h1>
            <h2>n8n Workflow Simulator</h2>
            <p>Integration: WhatsApp → Gemini 2.0 → AIRA API → Response</p>
        </div>

        <div class="stats" id="stats">
            <div class="stat-card">
                <h3>🔄 Executions</h3>
                <div class="success" style="font-size: 24px;">${this.workflowStats.executions}</div>
            </div>
            <div class="stat-card">
                <h3>✅ Successful</h3>
                <div class="success" style="font-size: 24px;">${this.workflowStats.successful}</div>
            </div>
            <div class="stat-card">
                <h3>❌ Failed</h3>
                <div class="error" style="font-size: 24px;">${this.workflowStats.failed}</div>
            </div>
            <div class="stat-card">
                <h3>👥 Patients Recognized</h3>
                <div style="font-size: 24px;">${this.workflowStats.patientRecognitions}</div>
            </div>
        </div>

        <div class="test-form">
            <h3>📱 Test WhatsApp Integration</h3>
            <form id="testForm">
                <div>
                    <label>Phone Number:</label><br>
                    <input type="text" id="phoneNumber" value="+5491112345678" placeholder="+5491112345678">
                </div>
                <div>
                    <label>Message:</label><br>
                    <input type="text" id="message" value="Hola, soy María García. Quiero agendar una sesión individual." placeholder="Enter WhatsApp message...">
                </div>
                <div>
                    <button type="submit">🚀 Send to Workflow</button>
                </div>
            </form>
            <div id="result"></div>
        </div>

        <div style="margin-top: 30px;">
            <h3>🔗 API Endpoints</h3>
            <ul>
                <li><strong>WhatsApp Webhook:</strong> <code>POST /webhook/whatsapp</code></li>
                <li><strong>Stats:</strong> <code>GET /stats</code></li>
            </ul>
        </div>

        <div style="margin-top: 30px; text-align: center; color: #666;">
            <p>🤖 Powered by Google Gemini 2.0 Flash</p>
            <p>⚡ Session Loading Optimization Only (No Clinical Analysis)</p>
        </div>
    </div>

    <script>
        document.getElementById('testForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const phoneNumber = document.getElementById('phoneNumber').value;
            const message = document.getElementById('message').value;
            const resultDiv = document.getElementById('result');

            resultDiv.innerHTML = '<p>⏳ Processing...</p>';

            try {
                const response = await fetch('/webhook/whatsapp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: phoneNumber,
                        body: message
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    resultDiv.innerHTML = \`
                        <div class="success">
                            <h4>✅ Success!</h4>
                            <p><strong>Patient:</strong> \${result.patientInfo.name}</p>
                            <p><strong>Session Type:</strong> \${result.sessionType}</p>
                            <p><strong>Session ID:</strong> \${result.sessionId}</p>
                            <p><strong>Status:</strong> \${result.optimizationStatus}</p>
                        </div>
                    \`;
                } else {
                    resultDiv.innerHTML = \`
                        <div class="error">
                            <h4>❌ Error</h4>
                            <p>\${result.error}</p>
                        </div>
                    \`;
                }

                // Actualizar estadísticas
                location.reload();

            } catch (error) {
                resultDiv.innerHTML = \`
                    <div class="error">
                        <h4>❌ Network Error</h4>
                        <p>\${error.message}</p>
                    </div>
                \`;
            }
        });
    </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    sendStats(res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.workflowStats, null, 2));
    }

    readRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    showUsageInfo() {
        console.log('');
        console.log('🎉 n8n Workflow Simulator Ready!');
        console.log('==================================');
        console.log('');
        console.log('🌐 Web Interface: http://localhost:5678');
        console.log('📱 WhatsApp Webhook: http://localhost:5678/webhook/whatsapp');
        console.log('📊 Stats API: http://localhost:5678/stats');
        console.log('');
        console.log('🧪 Test via curl:');
        console.log('curl -X POST http://localhost:5678/webhook/whatsapp \\');
        console.log('     -H "Content-Type: application/json" \\');
        console.log('     -d \'{"from": "+5491112345678", "body": "Hola, soy María García. Quiero agendar una sesión individual."}\'');
        console.log('');
        console.log('🔄 Workflow: WhatsApp → Gemini 2.0 Analysis → AIRA API → Response');
        console.log('⚡ Powered by Google Gemini 2.0 Flash');
        console.log('🚫 Mode: Session Loading Optimization Only (No Clinical Analysis)');
        console.log('');
        console.log('Press Ctrl+C to stop the simulator');
        console.log('');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
        if (this.server) {
            this.server.close();
            console.log('🛑 n8n Workflow Simulator stopped');
        }
    }
}

// Manejar la terminación del proceso
const simulator = new N8NWorkflowSimulator();

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down n8n simulator...');
    simulator.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down n8n simulator...');
    simulator.stop();
    process.exit(0);
});

// Ejecutar simulador
if (require.main === module) {
    simulator.start()
        .then(() => {
            console.log('✅ n8n Workflow Simulator started successfully!');

            // Mantener el proceso corriendo
            return new Promise(() => {});
        })
        .catch((error) => {
            console.error('❌ Failed to start simulator:', error);
            process.exit(1);
        });
}

module.exports = N8NWorkflowSimulator;