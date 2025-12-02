/**
 * Rutas de Health Check y Monitoreo - AIRA
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const { Firestore } = require('@google-cloud/firestore');

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Monitoring]
 *     summary: Health check básico
 *     description: Verifica si el servicio está funcionando
 *     responses:
 *       200:
 *         description: Servicio funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Tiempo activo en segundos
 *                 version:
 *                   type: string
 *                   example: "2.0.0"
 */
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require('../../package.json').version,
        node: process.version
    });
});

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     tags: [Monitoring]
 *     summary: Health check detallado
 *     description: Información completa del estado del sistema
 *     responses:
 *       200:
 *         description: Estado detallado del sistema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         responseTime:
 *                           type: number
 *                     external_apis:
 *                       type: object
 *                 system:
 *                   type: object
 *                   properties:
 *                     memory:
 *                       type: object
 *                     cpu:
 *                       type: object
 *                     disk:
 *                       type: object
 */
router.get('/health/detailed', async (req, res) => {
    const healthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require('../../package.json').version,
        environment: process.env.NODE_ENV || 'development',
        services: {},
        system: {}
    };

    try {
        // ===== VERIFICAR BASE DE DATOS =====
        const dbStart = Date.now();
        try {
            if (process.env.MOCK_MODE !== 'true') {
                const db = new Firestore({
                    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
                });
                
                // Test simple de conectividad
                await db.collection('health_check').limit(1).get();
                
                healthCheck.services.database = {
                    status: 'connected',
                    responseTime: Date.now() - dbStart,
                    type: 'Firestore'
                };
            } else {
                healthCheck.services.database = {
                    status: 'mock',
                    responseTime: 1,
                    type: 'Mock'
                };
            }
        } catch (error) {
            healthCheck.services.database = {
                status: 'error',
                error: error.message,
                responseTime: Date.now() - dbStart
            };
            healthCheck.status = 'degraded';
        }

        // ===== VERIFICAR APIs EXTERNAS =====
        const apiStart = Date.now();
        try {
            // Verificar Gemini AI (si está configurado)
            if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'test-gemini-key') {
                const fetch = require('node-fetch');
                const response = await fetch('https://generativelanguage.googleapis.com/v1/models', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`
                    },
                    timeout: 5000
                });

                healthCheck.services.gemini_ai = {
                    status: response.ok ? 'connected' : 'error',
                    responseTime: Date.now() - apiStart,
                    statusCode: response.status
                };
            } else {
                healthCheck.services.gemini_ai = {
                    status: 'not_configured',
                    responseTime: 0
                };
            }
        } catch (error) {
            healthCheck.services.gemini_ai = {
                status: 'error',
                error: error.message,
                responseTime: Date.now() - apiStart
            };
        }

        // ===== INFORMACIÓN DEL SISTEMA =====
        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();

        healthCheck.system = {
            memory: {
                used: Math.round(memUsage.rss / 1024 / 1024), // MB
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
                external: Math.round(memUsage.external / 1024 / 1024), // MB
                systemTotal: Math.round(totalMem / 1024 / 1024), // MB
                systemFree: Math.round(freeMem / 1024 / 1024), // MB
                usage: Math.round(((totalMem - freeMem) / totalMem) * 100) // %
            },
            cpu: {
                arch: os.arch(),
                platform: os.platform(),
                cores: os.cpus().length,
                loadAverage: os.loadavg()
            },
            network: {
                hostname: os.hostname(),
                interfaces: Object.keys(os.networkInterfaces())
            },
            process: {
                pid: process.pid,
                nodeVersion: process.version,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
        };

        // ===== DETERMINAR ESTADO GENERAL =====
        const hasErrors = Object.values(healthCheck.services).some(service => 
            service.status === 'error'
        );
        
        if (hasErrors) {
            healthCheck.status = 'degraded';
        }

        // Verificar uso de memoria crítico
        if (healthCheck.system.memory.usage > 90) {
            healthCheck.status = 'degraded';
            healthCheck.warnings = healthCheck.warnings || [];
            healthCheck.warnings.push('High memory usage detected');
        }

        res.status(healthCheck.status === 'healthy' ? 200 : 503).json(healthCheck);

    } catch (error) {
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     tags: [Monitoring]
 *     summary: Readiness probe
 *     description: Verifica si el servicio está listo para recibir tráfico
 *     responses:
 *       200:
 *         description: Servicio listo
 *       503:
 *         description: Servicio no listo
 */
router.get('/ready', async (req, res) => {
    try {
        // Verificar dependencias críticas
        const checks = [];

        // Check database connection
        if (process.env.MOCK_MODE !== 'true') {
            try {
                const db = new Firestore({
                    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
                });
                await db.collection('health_check').limit(1).get();
                checks.push({ name: 'database', status: 'ready' });
            } catch (error) {
                checks.push({ name: 'database', status: 'not_ready', error: error.message });
            }
        } else {
            checks.push({ name: 'database', status: 'mock' });
        }

        // Check environment variables
        const requiredEnvVars = ['JWT_SECRET', 'NODE_ENV'];
        const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
        
        if (missingEnvVars.length > 0) {
            checks.push({ 
                name: 'environment', 
                status: 'not_ready', 
                missing: missingEnvVars 
            });
        } else {
            checks.push({ name: 'environment', status: 'ready' });
        }

        const allReady = checks.every(check => 
            check.status === 'ready' || check.status === 'mock'
        );

        const status = allReady ? 200 : 503;
        
        res.status(status).json({
            status: allReady ? 'ready' : 'not_ready',
            timestamp: new Date().toISOString(),
            checks
        });

    } catch (error) {
        res.status(503).json({
            status: 'not_ready',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     tags: [Monitoring]
 *     summary: Métricas del sistema
 *     description: Métricas para monitoreo (Prometheus format)
 *     responses:
 *       200:
 *         description: Métricas del sistema
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: |
 *                 # HELP aira_uptime_seconds Tiempo activo del servidor
 *                 # TYPE aira_uptime_seconds counter
 *                 aira_uptime_seconds 3600
 */
router.get('/metrics', (req, res) => {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    const metrics = `
# HELP aira_uptime_seconds Tiempo activo del servidor
# TYPE aira_uptime_seconds counter
aira_uptime_seconds ${process.uptime()}

# HELP aira_memory_usage_bytes Uso de memoria en bytes
# TYPE aira_memory_usage_bytes gauge
aira_memory_usage_bytes{type="rss"} ${memUsage.rss}
aira_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed}
aira_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal}
aira_memory_usage_bytes{type="external"} ${memUsage.external}

# HELP aira_system_memory_bytes Memoria del sistema
# TYPE aira_system_memory_bytes gauge
aira_system_memory_bytes{type="total"} ${totalMem}
aira_system_memory_bytes{type="free"} ${freeMem}

# HELP aira_cpu_cores Número de cores de CPU
# TYPE aira_cpu_cores gauge
aira_cpu_cores ${os.cpus().length}

# HELP aira_load_average Promedio de carga del sistema
# TYPE aira_load_average gauge
aira_load_average{period="1m"} ${os.loadavg()[0]}
aira_load_average{period="5m"} ${os.loadavg()[1]}
aira_load_average{period="15m"} ${os.loadavg()[2]}

# HELP aira_version_info Información de versión
# TYPE aira_version_info gauge
aira_version_info{version="${require('../../package.json').version}",node="${process.version}",env="${process.env.NODE_ENV || 'development'}"} 1
    `.trim();

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
});

module.exports = router; 