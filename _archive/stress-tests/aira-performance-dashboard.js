/**
 * 🏥 AIRA PERFORMANCE MONITORING DASHBOARD
 * Real-time monitoring for 2000 concurrent users
 * Healthcare system performance metrics
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

class PerformanceDashboard {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.metrics = {
            system: {
                cpu: [],
                memory: [],
                disk: [],
                network: []
            },
            application: {
                responseTime: [],
                requestRate: [],
                errorRate: [],
                activeConnections: 0
            },
            healthcare: {
                sessionsPerMinute: [],
                voiceProcessingTime: [],
                patientLookups: [],
                crisisDetections: 0,
                whatsappResponseTime: []
            },
            database: {
                queryTime: [],
                connectionPool: [],
                readOperations: 0,
                writeOperations: 0
            },
            external: {
                firebaseLatency: [],
                geminiLatency: [],
                whatsappLatency: []
            }
        };

        this.thresholds = {
            cpu: 80,
            memory: 85,
            responseTime: 500,
            errorRate: 0.05,
            sessionCreationTime: 1000,
            patientLookupTime: 300,
            voiceProcessingTime: 30000
        };

        this.alerts = [];
        this.startMonitoring();
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupRoutes() {
        // Serve dashboard HTML
        this.app.get('/', (req, res) => {
            res.send(this.generateDashboardHTML());
        });

        // API endpoints for metrics
        this.app.get('/api/metrics', (req, res) => {
            res.json(this.getCurrentMetrics());
        });

        this.app.get('/api/alerts', (req, res) => {
            res.json(this.alerts.slice(-50)); // Last 50 alerts
        });

        this.app.post('/api/metric', (req, res) => {
            this.recordMetric(req.body);
            res.json({ success: true });
        });

        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                activeConnections: this.metrics.application.activeConnections
            });
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log(`Dashboard client connected: ${socket.id}`);
            this.metrics.application.activeConnections++;

            // Send current metrics on connection
            socket.emit('metrics', this.getCurrentMetrics());

            socket.on('disconnect', () => {
                console.log(`Dashboard client disconnected: ${socket.id}`);
                this.metrics.application.activeConnections--;
            });
        });
    }

    startMonitoring() {
        // System metrics collection
        setInterval(() => {
            this.collectSystemMetrics();
            this.checkThresholds();
            this.broadcastMetrics();
        }, 5000);

        // Cleanup old data
        setInterval(() => {
            this.cleanupOldData();
        }, 60000);

        // Log metrics to file
        setInterval(() => {
            this.logMetrics();
        }, 30000);
    }

    collectSystemMetrics() {
        const timestamp = Date.now();
        
        // CPU Usage
        const cpuUsage = process.cpuUsage();
        const cpuPercent = this.calculateCPUPercent(cpuUsage);
        
        // Memory Usage
        const memUsage = process.memoryUsage();
        const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        // Store metrics
        this.metrics.system.cpu.push({ timestamp, value: cpuPercent });
        this.metrics.system.memory.push({ timestamp, value: memoryPercent });

        // Keep only recent data
        Object.keys(this.metrics.system).forEach(key => {
            if (this.metrics.system[key].length > 1000) {
                this.metrics.system[key] = this.metrics.system[key].slice(-1000);
            }
        });
    }

    calculateCPUPercent(cpuUsage) {
        // Simple CPU calculation
        const total = cpuUsage.user + cpuUsage.system;
        return Math.min(100, total / 1000000); // Convert to percentage
    }

    recordMetric(data) {
        const timestamp = Date.now();
        
        switch (data.type) {
            case 'response_time':
                this.metrics.application.responseTime.push({ timestamp, value: data.value });
                break;
            case 'error':
                this.metrics.application.errorRate.push({ timestamp, value: 1 });
                break;
            case 'session_created':
                this.metrics.healthcare.sessionsPerMinute.push({ timestamp, value: 1 });
                this.metrics.database.writeOperations++;
                break;
            case 'patient_lookup':
                this.metrics.healthcare.patientLookups.push({ timestamp, value: data.value });
                this.metrics.database.readOperations++;
                break;
            case 'voice_processing':
                this.metrics.healthcare.voiceProcessingTime.push({ timestamp, value: data.value });
                break;
            case 'crisis_detected':
                this.metrics.healthcare.crisisDetections++;
                break;
            case 'database_query':
                this.metrics.database.queryTime.push({ timestamp, value: data.value });
                break;
            case 'firebase_latency':
                this.metrics.external.firebaseLatency.push({ timestamp, value: data.value });
                break;
            case 'gemini_latency':
                this.metrics.external.geminiLatency.push({ timestamp, value: data.value });
                break;
            case 'whatsapp_latency':
                this.metrics.external.whatsappLatency.push({ timestamp, value: data.value });
                break;
        }

        // Check immediate thresholds
        this.checkMetricThreshold(data.type, data.value);
    }

    checkThresholds() {
        const current = this.getCurrentMetrics();
        
        // System thresholds
        if (current.system.cpu > this.thresholds.cpu) {
            this.triggerAlert('CPU_HIGH', current.system.cpu, this.thresholds.cpu);
        }
        
        if (current.system.memory > this.thresholds.memory) {
            this.triggerAlert('MEMORY_HIGH', current.system.memory, this.thresholds.memory);
        }
        
        // Application thresholds
        if (current.application.avgResponseTime > this.thresholds.responseTime) {
            this.triggerAlert('RESPONSE_TIME_HIGH', current.application.avgResponseTime, this.thresholds.responseTime);
        }
        
        if (current.application.errorRate > this.thresholds.errorRate) {
            this.triggerAlert('ERROR_RATE_HIGH', current.application.errorRate, this.thresholds.errorRate);
        }
    }

    checkMetricThreshold(type, value) {
        let threshold, alertType;
        
        switch (type) {
            case 'patient_lookup':
                threshold = this.thresholds.patientLookupTime;
                alertType = 'PATIENT_LOOKUP_SLOW';
                break;
            case 'voice_processing':
                threshold = this.thresholds.voiceProcessingTime;
                alertType = 'VOICE_PROCESSING_SLOW';
                break;
            case 'session_created':
                threshold = this.thresholds.sessionCreationTime;
                alertType = 'SESSION_CREATION_SLOW';
                break;
        }

        if (threshold && value > threshold) {
            this.triggerAlert(alertType, value, threshold);
        }
    }

    triggerAlert(type, value, threshold) {
        const alert = {
            id: Date.now(),
            type,
            value,
            threshold,
            severity: this.getAlertSeverity(value, threshold),
            message: this.getAlertMessage(type, value, threshold),
            timestamp: new Date().toISOString()
        };

        this.alerts.push(alert);
        console.log(`🚨 ALERT: ${alert.message}`);

        // Keep only recent alerts
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }

        // Broadcast alert to dashboard
        this.io.emit('alert', alert);
    }

    getAlertSeverity(value, threshold) {
        const ratio = value / threshold;
        if (ratio > 2) return 'critical';
        if (ratio > 1.5) return 'high';
        if (ratio > 1.2) return 'medium';
        return 'low';
    }

    getAlertMessage(type, value, threshold) {
        const messages = {
            CPU_HIGH: `CPU usage critical: ${value.toFixed(1)}% > ${threshold}%`,
            MEMORY_HIGH: `Memory usage critical: ${value.toFixed(1)}% > ${threshold}%`,
            RESPONSE_TIME_HIGH: `Response time too high: ${value}ms > ${threshold}ms`,
            ERROR_RATE_HIGH: `Error rate too high: ${(value * 100).toFixed(2)}% > ${(threshold * 100).toFixed(2)}%`,
            PATIENT_LOOKUP_SLOW: `Patient lookup slow: ${value}ms > ${threshold}ms`,
            VOICE_PROCESSING_SLOW: `Voice processing slow: ${value}ms > ${threshold}ms`,
            SESSION_CREATION_SLOW: `Session creation slow: ${value}ms > ${threshold}ms`
        };

        return messages[type] || `Threshold exceeded: ${value} > ${threshold}`;
    }

    getCurrentMetrics() {
        const now = Date.now();
        const last5min = now - 5 * 60 * 1000;
        
        // Calculate recent metrics
        const recentResponseTimes = this.metrics.application.responseTime
            .filter(m => m.timestamp > last5min)
            .map(m => m.value);
        
        const recentErrors = this.metrics.application.errorRate
            .filter(m => m.timestamp > last5min)
            .length;

        const recentRequests = this.metrics.application.responseTime
            .filter(m => m.timestamp > last5min)
            .length;

        return {
            timestamp: new Date().toISOString(),
            system: {
                cpu: this.getLatestValue('system.cpu'),
                memory: this.getLatestValue('system.memory'),
                status: this.getSystemStatus()
            },
            application: {
                avgResponseTime: recentResponseTimes.length > 0 ? 
                    Math.round(recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length) : 0,
                p95ResponseTime: this.calculatePercentile(recentResponseTimes, 95),
                errorRate: recentRequests > 0 ? recentErrors / recentRequests : 0,
                requestRate: recentRequests / (5 * 60), // requests per second
                activeConnections: this.metrics.application.activeConnections
            },
            healthcare: {
                sessionsPerMinute: this.metrics.healthcare.sessionsPerMinute
                    .filter(m => m.timestamp > last5min).length / 5,
                avgVoiceProcessingTime: this.getAverageValue('healthcare.voiceProcessingTime'),
                avgPatientLookupTime: this.getAverageValue('healthcare.patientLookups'),
                crisisDetections: this.metrics.healthcare.crisisDetections,
                whatsappResponseTime: this.getAverageValue('healthcare.whatsappResponseTime')
            },
            database: {
                avgQueryTime: this.getAverageValue('database.queryTime'),
                readOperations: this.metrics.database.readOperations,
                writeOperations: this.metrics.database.writeOperations
            },
            external: {
                avgFirebaseLatency: this.getAverageValue('external.firebaseLatency'),
                avgGeminiLatency: this.getAverageValue('external.geminiLatency'),
                avgWhatsAppLatency: this.getAverageValue('external.whatsappLatency')
            },
            alerts: {
                recent: this.alerts.filter(a => Date.now() - new Date(a.timestamp).getTime() < 300000),
                critical: this.alerts.filter(a => 
                    a.severity === 'critical' && 
                    Date.now() - new Date(a.timestamp).getTime() < 60000
                )
            }
        };
    }

    getLatestValue(metricPath) {
        const [category, metric] = metricPath.split('.');
        const data = this.metrics[category]?.[metric];
        return data && data.length > 0 ? data[data.length - 1].value : 0;
    }

    getAverageValue(metricPath) {
        const [category, metric] = metricPath.split('.');
        const data = this.metrics[category]?.[metric];
        if (!data || data.length === 0) return 0;

        const recent = data.slice(-10);
        const sum = recent.reduce((acc, item) => acc + item.value, 0);
        return Math.round(sum / recent.length);
    }

    calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        const sorted = values.sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index] || 0;
    }

    getSystemStatus() {
        const cpu = this.getLatestValue('system.cpu');
        const memory = this.getLatestValue('system.memory');
        
        if (cpu > 90 || memory > 90) return 'critical';
        if (cpu > 70 || memory > 80) return 'warning';
        return 'healthy';
    }

    broadcastMetrics() {
        const metrics = this.getCurrentMetrics();
        this.io.emit('metrics', metrics);
    }

    cleanupOldData() {
        const cutoff = Date.now() - 60 * 60 * 1000; // Keep 1 hour of data
        
        Object.keys(this.metrics).forEach(category => {
            if (Array.isArray(this.metrics[category])) {
                this.metrics[category] = this.metrics[category].filter(
                    item => item.timestamp > cutoff
                );
            } else if (typeof this.metrics[category] === 'object') {
                Object.keys(this.metrics[category]).forEach(metric => {
                    if (Array.isArray(this.metrics[category][metric])) {
                        this.metrics[category][metric] = this.metrics[category][metric].filter(
                            item => item.timestamp > cutoff
                        );
                    }
                });
            }
        });

        // Clean alerts
        const alertCutoff = Date.now() - 24 * 60 * 60 * 1000; // Keep 24 hours of alerts
        this.alerts = this.alerts.filter(alert => 
            new Date(alert.timestamp).getTime() > alertCutoff
        );
    }

    logMetrics() {
        const metrics = this.getCurrentMetrics();
        const logEntry = {
            timestamp: metrics.timestamp,
            system: {
                cpu: metrics.system.cpu,
                memory: metrics.system.memory,
                status: metrics.system.status
            },
            application: {
                avgResponseTime: metrics.application.avgResponseTime,
                errorRate: metrics.application.errorRate,
                requestRate: metrics.application.requestRate
            },
            healthcare: {
                sessionsPerMinute: metrics.healthcare.sessionsPerMinute,
                crisisDetections: metrics.healthcare.crisisDetections
            }
        };

        const logLine = JSON.stringify(logEntry) + '\n';
        
        try {
            const logPath = path.join(__dirname, 'logs', 'performance-dashboard.log');
            fs.writeFileSync(logPath, logLine, { flag: 'a' });
        } catch (error) {
            console.error('Failed to log metrics:', error.message);
        }
    }

    generateDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIRA Performance Dashboard</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; text-align: center; }
        .container { max-width: 1400px; margin: 0 auto; padding: 1rem; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin: 2rem 0; }
        .metric-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-title { font-size: 0.9rem; color: #666; margin-bottom: 0.5rem; }
        .metric-value { font-size: 2rem; font-weight: bold; margin: 0; }
        .metric-value.healthy { color: #28a745; }
        .metric-value.warning { color: #ffc107; }
        .metric-value.critical { color: #dc3545; }
        .chart-container { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 1rem 0; }
        .chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1rem; }
        .alert { background: #dc3545; color: white; padding: 1rem; margin: 0.5rem 0; border-radius: 4px; }
        .alert.warning { background: #ffc107; color: #000; }
        .status-indicator { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 0.5rem; }
        .status-indicator.healthy { background: #28a745; }
        .status-indicator.warning { background: #ffc107; }
        .status-indicator.critical { background: #dc3545; }
        .loading { text-align: center; padding: 2rem; color: #666; }
        .section-title { margin: 2rem 0 1rem 0; color: #333; font-size: 1.5rem; border-bottom: 2px solid #667eea; padding-bottom: 0.5rem; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏥 AIRA Performance Dashboard</h1>
        <p>Real-time monitoring for 2000 concurrent users</p>
    </div>

    <div class="container">
        <div id="loading" class="loading">Connecting to monitoring system...</div>
        
        <div id="dashboard" style="display: none;">
            <h2 class="section-title">System Health</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-title">CPU Usage</div>
                    <div id="cpu-value" class="metric-value">--</div>
                    <div><span id="cpu-status" class="status-indicator"></span><span id="cpu-percent">--</span></div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">Memory Usage</div>
                    <div id="memory-value" class="metric-value">--</div>
                    <div><span id="memory-status" class="status-indicator"></span><span id="memory-percent">--</span></div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">System Status</div>
                    <div id="system-status" class="metric-value">--</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">Active Connections</div>
                    <div id="connections-value" class="metric-value">--</div>
                </div>
            </div>

            <h2 class="section-title">Application Performance</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-title">Avg Response Time</div>
                    <div id="response-time-value" class="metric-value">--</div>
                    <div>ms</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">Error Rate</div>
                    <div id="error-rate-value" class="metric-value">--</div>
                    <div>%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">Request Rate</div>
                    <div id="request-rate-value" class="metric-value">--</div>
                    <div>req/s</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">P95 Response Time</div>
                    <div id="p95-response-time-value" class="metric-value">--</div>
                    <div>ms</div>
                </div>
            </div>

            <h2 class="section-title">Healthcare Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-title">Sessions/Min</div>
                    <div id="sessions-per-min-value" class="metric-value">--</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">Patient Lookup Time</div>
                    <div id="patient-lookup-time-value" class="metric-value">--</div>
                    <div>ms</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">Voice Processing Time</div>
                    <div id="voice-processing-time-value" class="metric-value">--</div>
                    <div>ms</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">Crisis Detections</div>
                    <div id="crisis-detections-value" class="metric-value">--</div>
                </div>
            </div>

            <h2 class="section-title">Recent Alerts</h2>
            <div id="alerts-container"></div>

            <h2 class="section-title">Performance Charts</h2>
            <div class="chart-grid">
                <div class="chart-container">
                    <h3>Response Time Trend</h3>
                    <canvas id="response-time-chart"></canvas>
                </div>
                <div class="chart-container">
                    <h3>System Resources</h3>
                    <canvas id="system-resources-chart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        let responseTimeChart, systemResourcesChart;

        // Initialize charts
        function initCharts() {
            const chartOptions = {
                responsive: true,
                scales: {
                    x: { type: 'time', time: { unit: 'second' } },
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: { display: true }
                }
            };

            // Response Time Chart
            const responseTimeCtx = document.getElementById('response-time-chart').getContext('2d');
            responseTimeChart = new Chart(responseTimeCtx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: chartOptions
            });

            // System Resources Chart
            const systemResourcesCtx = document.getElementById('system-resources-chart').getContext('2d');
            systemResourcesChart = new Chart(systemResourcesCtx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'CPU %',
                        data: [],
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Memory %',
                        data: [],
                        borderColor: '#ffc107',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        tension: 0.4
                    }]
                },
                options: chartOptions
            });
        }

        // Update dashboard with metrics
        function updateDashboard(metrics) {
            // System Health
            updateMetric('cpu-value', metrics.system.cpu.toFixed(1), 'cpu-value');
            updateStatus('cpu-status', 'cpu-percent', metrics.system.cpu, 70, 90);
            
            updateMetric('memory-value', metrics.system.memory.toFixed(1), 'memory-value');
            updateStatus('memory-status', 'memory-percent', metrics.system.memory, 70, 90);
            
            document.getElementById('system-status').textContent = metrics.system.status.toUpperCase();
            document.getElementById('system-status').className = \`metric-value \${metrics.system.status}\`;
            
            document.getElementById('connections-value').textContent = metrics.application.activeConnections;

            // Application Performance
            updateMetric('response-time-value', metrics.application.avgResponseTime, 'response-time-value', 500);
            updateMetric('error-rate-value', (metrics.application.errorRate * 100).toFixed(2), 'error-rate-value', 5);
            updateMetric('request-rate-value', metrics.application.requestRate.toFixed(1), 'request-rate-value');
            updateMetric('p95-response-time-value', metrics.application.p95ResponseTime, 'p95-response-time-value', 1000);

            // Healthcare Metrics
            updateMetric('sessions-per-min-value', metrics.healthcare.sessionsPerMinute.toFixed(1), 'sessions-per-min-value');
            updateMetric('patient-lookup-time-value', metrics.healthcare.avgPatientLookupTime, 'patient-lookup-time-value', 300);
            updateMetric('voice-processing-time-value', metrics.healthcare.avgVoiceProcessingTime, 'voice-processing-time-value', 30000);
            updateMetric('crisis-detections-value', metrics.healthcare.crisisDetections, 'crisis-detections-value');

            // Update alerts
            updateAlerts(metrics.alerts.recent);

            // Update charts
            updateCharts(metrics);
        }

        function updateMetric(elementId, value, statusClass = null, warningThreshold = null, criticalThreshold = null) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value;
                if (statusClass && warningThreshold) {
                    const numValue = parseFloat(value);
                    if (numValue > criticalThreshold) {
                        element.className = 'metric-value critical';
                    } else if (numValue > warningThreshold) {
                        element.className = 'metric-value warning';
                    } else {
                        element.className = 'metric-value healthy';
                    }
                }
            }
        }

        function updateStatus(statusId, textId, value, warningThreshold, criticalThreshold) {
            const statusElement = document.getElementById(statusId);
            const textElement = document.getElementById(textId);
            
            if (statusElement && textElement) {
                textElement.textContent = value.toFixed(1) + '%';
                
                if (value > criticalThreshold) {
                    statusElement.className = 'status-indicator critical';
                } else if (value > warningThreshold) {
                    statusElement.className = 'status-indicator warning';
                } else {
                    statusElement.className = 'status-indicator healthy';
                }
            }
        }

        function updateAlerts(alerts) {
            const container = document.getElementById('alerts-container');
            if (!container) return;

            container.innerHTML = '';
            
            if (alerts.length === 0) {
                container.innerHTML = '<p>No recent alerts</p>';
                return;
            }

            alerts.slice(0, 5).forEach(alert => {
                const alertDiv = document.createElement('div');
                alertDiv.className = alert.severity === 'critical' ? 'alert' : 'alert warning';
                alertDiv.innerHTML = \`
                    <strong>\${alert.type.replace(/_/g, ' ').toUpperCase()}</strong>: 
                    \${alert.message} 
                    <small>(\${new Date(alert.timestamp).toLocaleString()})</small>
                \`;
                container.appendChild(alertDiv);
            });
        }

        function updateCharts(metrics) {
            const now = new Date();
            
            // Update response time chart
            if (responseTimeChart && metrics.application.avgResponseTime > 0) {
                responseTimeChart.data.datasets[0].data.push({
                    x: now,
                    y: metrics.application.avgResponseTime
                });
                
                // Keep only last 50 data points
                if (responseTimeChart.data.datasets[0].data.length > 50) {
                    responseTimeChart.data.datasets[0].data.shift();
                }
                
                responseTimeChart.update('none');
            }

            // Update system resources chart
            if (systemResourcesChart) {
                systemResourcesChart.data.datasets[0].data.push({
                    x: now,
                    y: metrics.system.cpu
                });
                
                systemResourcesChart.data.datasets[1].data.push({
                    x: now,
                    y: metrics.system.memory
                });
                
                // Keep only last 50 data points
                if (systemResourcesChart.data.datasets[0].data.length > 50) {
                    systemResourcesChart.data.datasets[0].data.shift();
                    systemResourcesChart.data.datasets[1].data.shift();
                }
                
                systemResourcesChart.update('none');
            }
        }

        // Socket event handlers
        socket.on('connect', () => {
            console.log('Connected to performance monitoring');
            document.getElementById('loading').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            initCharts();
        });

        socket.on('metrics', (metrics) => {
            updateDashboard(metrics);
        });

        socket.on('alert', (alert) => {
            console.log('New alert:', alert);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from performance monitoring');
        });
    </script>
</body>
</html>
        `;
    }

    start(port = 3000) {
        this.server.listen(port, () => {
            console.log(`🏥 AIRA Performance Dashboard running on port ${port}`);
            console.log(`📊 Open http://localhost:${port} to view real-time metrics`);
            console.log(`🔌 Monitoring system health for 2000 concurrent users`);
        });
    }
}

// Auto-start if run directly
if (require.main === module) {
    // Ensure logs directory exists
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    const dashboard = new PerformanceDashboard();
    const PORT = process.env.PORT || 3000;
    dashboard.start(PORT);
}

module.exports = PerformanceDashboard;