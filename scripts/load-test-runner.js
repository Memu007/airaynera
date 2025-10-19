/**
 * 🏥 AIRA LOAD TEST RUNNER - 2000 USERS AUDIT
 *
 * Lead Performance Engineer: Automated load testing execution
 * Progressive testing from 100 → 2000 concurrent users
 *
 * Test Execution Order:
 * 1. Baseline Performance (100 users)
 * 2. Normal Daily Load (2000 users over 12h)
 * 3. Peak Hour Stress (1500 users in 1h)
 * 4. Worst Case Scenario (2500 users)
 * 5. Voice Processing Load (200 concurrent)
 * 6. Endurance Test (500 users for 24h)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const performanceMonitor = require('./performance-monitor');

class LoadTestRunner {
    constructor() {
        this.testResults = {};
        this.currentTest = null;
        this.testStartTime = null;
        this.monitor = performanceMonitor;
        this.reportsDir = path.join(__dirname, '../reports');
        this.ensureReportsDirectory();
    }

    ensureReportsDirectory() {
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    async runFullAudit() {
        console.log('🏥 AIRA PERFORMANCE AUDIT - 2000 USERS');
        console.log('═'.repeat(60));
        console.log('Starting comprehensive load testing...');
        console.log('');

        const testSuite = [
            { name: 'baseline', description: 'Baseline Performance (100 users)', duration: '15m' },
            { name: 'normal_daily', description: 'Normal Daily Load (2000 users, 12h)', duration: '12h' },
            { name: 'peak_hour', description: 'Peak Hour Stress (1500 users, 1h)', duration: '1h' },
            { name: 'worst_case', description: 'Worst Case Scenario (2500 users)', duration: '25m' },
            { name: 'voice_processing', description: 'Voice Processing Load (200 concurrent)', duration: '17m' },
            { name: 'endurance', description: 'Endurance Test (500 users, 24h)', duration: '24h' }
        ];

        for (const test of testSuite) {
            console.log(`🎯 Starting: ${test.description}`);
            console.log(`⏱️ Expected duration: ${test.duration}`);
            console.log('');

            try {
                const result = await this.runTest(test);
                this.testResults[test.name] = result;

                console.log(`✅ Completed: ${test.description}`);
                console.log(`📊 Peak Load: ${result.peakLoad} users`);
                console.log(`⚡ Avg Response Time: ${result.avgResponseTime}ms`);
                console.log(`❌ Error Rate: ${(result.errorRate * 100).toFixed(2)}%`);
                console.log('');

                // Wait between tests to allow system recovery
                if (testSuite.indexOf(test) < testSuite.length - 1) {
                    console.log('⏸️ Waiting 5 minutes before next test...');
                    await this.sleep(5 * 60 * 1000);
                    console.log('');
                }

            } catch (error) {
                console.error(`❌ Failed: ${test.description}`);
                console.error(`Error: ${error.message}`);
                this.testResults[test.name] = { error: error.message };
            }
        }

        console.log('🏁 Full audit completed. Generating final report...');
        await this.generateComprehensiveReport();
    }

    async runTest(testConfig) {
        const testStart = Date.now();
        this.currentTest = testConfig.name;
        this.testStartTime = testStart;

        // Start performance monitoring
        console.log('📊 Starting performance monitoring...');
        this.monitor.startMonitoring(2000); // Monitor every 2 seconds

        try {
            // Run k6 test
            const result = await this.executeK6Test(testConfig);

            // Stop monitoring
            this.monitor.stopMonitoring();

            const testDuration = Date.now() - testStart;

            return {
                ...result,
                testDuration,
                testConfig,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.monitor.stopMonitoring();
            throw error;
        }
    }

    async executeK6Test(testConfig) {
        return new Promise((resolve, reject) => {
            const k6Args = [
                'run',
                '--env', `TEST_TYPE=${testConfig.name}`,
                '--env', `BASE_URL=http://localhost:8082`,
                '--out', 'json=results.json',
                'tests/performance/aira-2000-users-load-test.js'
            ];

            console.log('🚀 Executing k6 command...');
            console.log(`Command: k6 ${k6Args.join(' ')}`);

            const k6Process = spawn('k6', k6Args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: path.join(__dirname, '..')
            });

            let output = '';
            let errorOutput = '';

            k6Process.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                process.stdout.write(text);
            });

            k6Process.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                process.stderr.write(text);
            });

            k6Process.on('close', async (code) => {
                console.log(`\nk6 process exited with code: ${code}`);

                if (code === 0) {
                    try {
                        const results = await this.parseK6Results();
                        resolve(results);
                    } catch (parseError) {
                        reject(new Error(`Failed to parse k6 results: ${parseError.message}`));
                    }
                } else {
                    reject(new Error(`k6 test failed with exit code ${code}: ${errorOutput}`));
                }
            });

            k6Process.on('error', (error) => {
                reject(new Error(`Failed to start k6: ${error.message}`));
            });

            // Handle process timeout (safety net)
            const timeout = setTimeout(() => {
                k6Process.kill('SIGTERM');
                reject(new Error('Test timed out after 24 hours'));
            }, 24 * 60 * 60 * 1000); // 24 hour timeout

            k6Process.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }

    async parseK6Results() {
        const resultsFile = path.join(__dirname, '../results.json');

        if (!fs.existsSync(resultsFile)) {
            throw new Error('k6 results file not found');
        }

        try {
            const rawData = fs.readFileSync(resultsFile, 'utf8');
            const lines = rawData.trim().split('\n');

            const metrics = {
                httpRequests: { total: 0, failed: 0, responseTimes: [] },
                customMetrics: {},
                vus: { max: 0 },
                timestamps: []
            };

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    metrics.timestamps.push(data.timestamp);

                    if (data.metric === 'http_reqs') {
                        metrics.httpRequests.total += data.value;
                    }

                    if (data.metric === 'http_req_failed') {
                        metrics.httpRequests.failed += data.value;
                    }

                    if (data.metric === 'http_req_duration' && data.data && data.data.samples) {
                        metrics.httpRequests.responseTimes.push(...data.data.samples);
                    }

                    if (data.metric === 'vus') {
                        metrics.vus.max = Math.max(metrics.vus.max, data.value);
                    }

                    // Custom healthcare metrics
                    if (data.metric.startsWith('patient_lookup_time')) {
                        if (!metrics.customMetrics.patientLookupTime) {
                            metrics.customMetrics.patientLookupTime = [];
                        }
                        if (data.data && data.data.samples) {
                            metrics.customMetrics.patientLookupTime.push(...data.data.samples);
                        }
                    }

                    if (data.metric.startsWith('session_creation_time')) {
                        if (!metrics.customMetrics.sessionCreationTime) {
                            metrics.customMetrics.sessionCreationTime = [];
                        }
                        if (data.data && data.data.samples) {
                            metrics.customMetrics.sessionCreationTime.push(...data.data.samples);
                        }
                    }

                    if (data.metric.startsWith('voice_processing_time')) {
                        if (!metrics.customMetrics.voiceProcessingTime) {
                            metrics.customMetrics.voiceProcessingTime = [];
                        }
                        if (data.data && data.data.samples) {
                            metrics.customMetrics.voiceProcessingTime.push(...data.data.samples);
                        }
                    }

                } catch (parseError) {
                    // Skip malformed lines
                    continue;
                }
            }

            // Calculate statistics
            const responseTimes = metrics.httpRequests.responseTimes.sort((a, b) => a - b);
            const errorRate = metrics.httpRequests.total > 0 ? metrics.httpRequests.failed / metrics.httpRequests.total : 0;

            const avgResponseTime = responseTimes.length > 0 ?
                Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;

            const p95ResponseTime = responseTimes.length > 0 ?
                responseTimes[Math.floor(responseTimes.length * 0.95)] : 0;

            const p99ResponseTime = responseTimes.length > 0 ?
                responseTimes[Math.floor(responseTimes.length * 0.99)] : 0;

            // Calculate custom metrics statistics
            const customStats = {};
            Object.entries(metrics.customMetrics).forEach(([metric, values]) => {
                const sorted = values.sort((a, b) => a - b);
                customStats[metric] = {
                    avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
                    p95: sorted[Math.floor(sorted.length * 0.95)],
                    p99: sorted[Math.floor(sorted.length * 0.99)],
                    min: sorted[0],
                    max: sorted[sorted.length - 1]
                };
            });

            // Clean up results file
            try {
                fs.unlinkSync(resultsFile);
            } catch (error) {
                // Ignore cleanup errors
            }

            return {
                totalRequests: metrics.httpRequests.total,
                failedRequests: metrics.httpRequests.failed,
                errorRate,
                avgResponseTime,
                p95ResponseTime,
                p99ResponseTime,
                peakLoad: metrics.vus.max,
                customMetrics: customStats,
                testDuration: metrics.timestamps.length > 0 ?
                    metrics.timestamps[metrics.timestamps.length - 1] - metrics.timestamps[0] : 0
            };

        } catch (error) {
            throw new Error(`Failed to parse results file: ${error.message}`);
        }
    }

    async generateComprehensiveReport() {
        const report = {
            timestamp: new Date().toISOString(),
            auditName: 'AIRA 2000 Users Performance Audit',
            systemInfo: this.getSystemInfo(),
            testSuite: this.getTestSuiteInfo(),
            results: this.testResults,
            summary: this.generateSummary(),
            recommendations: this.generateRecommendations(),
            bottlenecks: this.identifyBottlenecks(),
            scalabilityAssessment: this.assessScalability()
        };

        const reportPath = path.join(this.reportsDir, `aira-performance-audit-${Date.now()}.json`);
        const htmlReportPath = path.join(this.reportsDir, `aira-performance-audit-${Date.now()}.html`);

        try {
            // JSON Report
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            console.log(`📊 Comprehensive report saved: ${reportPath}`);

            // HTML Report
            const htmlReport = this.generateHTMLReport(report);
            fs.writeFileSync(htmlReportPath, htmlReport);
            console.log(`🌐 HTML report saved: ${htmlReportPath}`);

            return { jsonPath: reportPath, htmlPath: htmlReportPath };

        } catch (error) {
            console.error('Failed to generate comprehensive report:', error.message);
            throw error;
        }
    }

    getSystemInfo() {
        const os = require('os');
        return {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
            nodeVersion: process.version,
            hostname: os.hostname()
        };
    }

    getTestSuiteInfo() {
        return {
            targetUsers: 2000,
            targetResponseTime: 500, // ms
            targetErrorRate: 0.1, // 10%
            testDate: new Date().toISOString(),
            environment: 'staging', // Should be configurable
            baseUrl: 'http://localhost:8082'
        };
    }

    generateSummary() {
        const successfulTests = Object.entries(this.testResults).filter(([name, result]) => !result.error);
        const failedTests = Object.entries(this.testResults).filter(([name, result]) => result.error);

        const allResponseTimes = successfulTests.flatMap(([name, result]) => [result.avgResponseTime, result.p95ResponseTime]);
        const allErrorRates = successfulTests.map(([name, result]) => result.errorRate);
        const allPeakLoads = successfulTests.map(([name, result]) => result.peakLoad);

        return {
            totalTests: Object.keys(this.testResults).length,
            successfulTests: successfulTests.length,
            failedTests: failedTests.length,
            maxLoadAchieved: Math.max(...allPeakLoads),
            avgResponseTime: Math.round(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length),
            maxErrorRate: Math.max(...allErrorRates),
            canHandle2000Users: allPeakLoads.some(load => load >= 2000),
            meetsPerformanceTargets: allResponseTimes.every(rt => rt < 500),
            meetsReliabilityTargets: allErrorRates.every(er => er < 0.1)
        };
    }

    generateRecommendations() {
        const recommendations = [];
        const summary = this.generateSummary();

        if (!summary.canHandle2000Users) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Scalability',
                issue: 'System cannot handle target 2000 concurrent users',
                recommendation: 'Implement horizontal scaling with load balancer and multiple Node.js instances'
            });
        }

        if (!summary.meetsPerformanceTargets) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Performance',
                issue: 'Response times exceed 500ms target',
                recommendation: 'Optimize database queries, implement caching, and consider CDN for static assets'
            });
        }

        if (!summary.meetsReliabilityTargets) {
            recommendations.push({
                priority: 'CRITICAL',
                category: 'Reliability',
                issue: 'Error rate exceeds 10% target',
                recommendation: 'Review error handling, implement circuit breakers for external APIs, and add monitoring'
            });
        }

        // Healthcare-specific recommendations
        const voiceProcessingTimes = Object.values(this.testResults)
            .filter(result => result.customMetrics && result.customMetrics.voiceProcessingTime)
            .map(result => result.customMetrics.voiceProcessingTime.avg);

        if (voiceProcessingTimes.some(time => time > 30000)) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Healthcare UX',
                issue: 'Voice processing exceeds 30 second target',
                recommendation: 'Implement voice file compression, optimize AI processing pipeline, and add progress indicators'
            });
        }

        // Add infrastructure recommendations
        recommendations.push({
            priority: 'MEDIUM',
            category: 'Infrastructure',
            issue: 'Monitoring gaps identified',
            recommendation: 'Implement comprehensive APM solution with distributed tracing and healthcare-specific metrics'
        });

        recommendations.push({
            priority: 'LOW',
            category: 'Optimization',
            issue: 'Performance optimization opportunities',
            recommendation: 'Implement Redis caching for frequent patient lookups and session data'
        });

        return recommendations.sort((a, b) => {
            const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    identifyBottlenecks() {
        const bottlenecks = [];

        Object.entries(this.testResults).forEach(([testName, result]) => {
            if (result.error) return;

            // Check for response time bottlenecks
            if (result.avgResponseTime > 500) {
                bottlenecks.push({
                    test: testName,
                    type: 'Response Time',
                    severity: result.avgResponseTime > 1000 ? 'HIGH' : 'MEDIUM',
                    value: `${result.avgResponseTime}ms`,
                    threshold: '500ms'
                });
            }

            // Check for error rate bottlenecks
            if (result.errorRate > 0.1) {
                bottlenecks.push({
                    test: testName,
                    type: 'Error Rate',
                    severity: result.errorRate > 0.2 ? 'HIGH' : 'MEDIUM',
                    value: `${(result.errorRate * 100).toFixed(2)}%`,
                    threshold: '10%'
                });
            }

            // Check for healthcare-specific bottlenecks
            if (result.customMetrics) {
                if (result.customMetrics.patientLookupTime && result.customMetrics.patientLookupTime.p95 > 300) {
                    bottlenecks.push({
                        test: testName,
                        type: 'Patient Lookup',
                        severity: 'HIGH',
                        value: `${result.customMetrics.patientLookupTime.p95}ms`,
                        threshold: '300ms'
                    });
                }

                if (result.customMetrics.voiceProcessingTime && result.customMetrics.voiceProcessingTime.p95 > 30000) {
                    bottlenecks.push({
                        test: testName,
                        type: 'Voice Processing',
                        severity: 'CRITICAL',
                        value: `${result.customMetrics.voiceProcessingTime.p95}ms`,
                        threshold: '30000ms'
                    });
                }
            }
        });

        return bottlenecks;
    }

    assessScalability() {
        const summary = this.generateSummary();
        const bottlenecks = this.identifyBottlenecks();

        let scalabilityScore = 100;

        // Deduct points for failed targets
        if (!summary.canHandle2000Users) scalabilityScore -= 40;
        if (!summary.meetsPerformanceTargets) scalabilityScore -= 30;
        if (!summary.meetsReliabilityTargets) scalabilityScore -= 20;

        // Deduct points for bottlenecks
        bottlenecks.forEach(bottleneck => {
            if (bottleneck.severity === 'CRITICAL') scalabilityScore -= 15;
            else if (bottleneck.severity === 'HIGH') scalabilityScore -= 10;
            else if (bottleneck.severity === 'MEDIUM') scalabilityScore -= 5;
        });

        scalabilityScore = Math.max(0, scalabilityScore);

        let readinessLevel;
        if (scalabilityScore >= 90) readinessLevel = 'PRODUCTION READY';
        else if (scalabilityScore >= 70) readinessLevel = 'NEEDS OPTIMIZATION';
        else if (scalabilityScore >= 50) readinessLevel = 'REQUIRES IMPROVEMENTS';
        else readinessLevel = 'NOT READY FOR PRODUCTION';

        return {
            score: scalabilityScore,
            readinessLevel,
            maxSustainableUsers: summary.maxLoadAchieved,
            recommendedInfrastructure: this.getInfrastructureRecommendations(scalabilityScore),
            nextSteps: this.getNextSteps(scalabilityScore)
        };
    }

    getInfrastructureRecommendations(score) {
        if (score >= 90) {
            return {
                nodes: '2-3 Node.js instances with load balancer',
                database: 'Firestore with read replicas',
                caching: 'Redis for session management',
                monitoring: 'APM solution with healthcare metrics'
            };
        } else if (score >= 70) {
            return {
                nodes: '3-5 Node.js instances with auto-scaling',
                database: 'Firestore with connection pooling',
                caching: 'Redis + CDN for static assets',
                monitoring: 'Comprehensive monitoring + alerting'
            };
        } else {
            return {
                nodes: '5+ Node.js instances with microservices architecture',
                database: 'Distributed database with sharding',
                caching: 'Multi-layer caching strategy',
                monitoring: 'Full observability stack with distributed tracing'
            };
        }
    }

    getNextSteps(score) {
        if (score >= 90) {
            return [
                'Deploy to production with monitoring',
                'Set up automated scaling policies',
                'Implement healthcare compliance monitoring',
                'Schedule regular performance audits'
            ];
        } else if (score >= 70) {
            return [
                'Optimize database queries and add indexes',
                'Implement comprehensive caching strategy',
                'Add circuit breakers for external APIs',
                'Performance testing with healthcare-specific workloads'
            ];
        } else {
            return [
                'Redesign architecture for horizontal scaling',
                'Implement microservices for critical components',
                'Add comprehensive error handling and recovery',
                'Full performance audit with healthcare workflows'
            ];
        }
    }

    generateHTMLReport(report) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIRA Performance Audit Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007acc; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007acc; }
        .metric-label { color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .status-pass { color: #28a745; }
        .status-fail { color: #dc3545; }
        .status-warning { color: #ffc107; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .priority-critical { color: #dc3545; font-weight: bold; }
        .priority-high { color: #fd7e14; font-weight: bold; }
        .priority-medium { color: #ffc107; }
        .priority-low { color: #28a745; }
        .score-circle { width: 120px; height: 120px; border-radius: 50%; margin: 20px auto; display: flex; align-items: center; justify-content: center; font-size: 2em; font-weight: bold; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 AIRA Medical System</h1>
            <h2>Performance Audit Report - 2000 Users</h2>
            <p>Generated: ${report.timestamp}</p>
        </div>

        <div class="section">
            <h2>Executive Summary</h2>
            <div class="summary">
                <div class="metric-card">
                    <div class="metric-value">${report.summary.maxLoadAchieved}</div>
                    <div class="metric-label">Max Users Tested</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${report.summary.avgResponseTime}ms</div>
                    <div class="metric-label">Avg Response Time</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${(report.summary.maxErrorRate * 100).toFixed(2)}%</div>
                    <div class="metric-label">Max Error Rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value ${report.summary.canHandle2000Users ? 'status-pass' : 'status-fail'}">${report.summary.canHandle2000Users ? 'YES' : 'NO'}</div>
                    <div class="metric-label">Can Handle 2000 Users</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Scalability Assessment</h2>
            <div class="score-circle" style="background-color: ${this.getScoreColor(report.scalabilityAssessment.score)}">
                ${report.scalabilityAssessment.score}%
            </div>
            <h3 style="text-align: center; margin-top: 10px;">${report.scalabilityAssessment.readinessLevel}</h3>
            <p><strong>Max Sustainable Users:</strong> ${report.scalabilityAssessment.maxSustainableUsers}</p>
        </div>

        <div class="section">
            <h2>Test Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Test</th>
                        <th>Peak Load</th>
                        <th>Avg Response</th>
                        <th>P95 Response</th>
                        <th>Error Rate</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(report.results).map(([name, result]) => `
                        <tr>
                            <td>${name}</td>
                            <td>${result.peakLoad || 'N/A'}</td>
                            <td>${result.avgResponseTime || 'N/A'}ms</td>
                            <td>${result.p95ResponseTime || 'N/A'}ms</td>
                            <td>${result.errorRate ? (result.errorRate * 100).toFixed(2) + '%' : 'N/A'}</td>
                            <td class="${result.error ? 'status-fail' : 'status-pass'}">${result.error ? 'FAILED' : 'PASSED'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Identified Bottlenecks</h2>
            ${report.bottlenecks.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>Test</th>
                            <th>Type</th>
                            <th>Severity</th>
                            <th>Value</th>
                            <th>Threshold</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.bottlenecks.map(bottleneck => `
                            <tr>
                                <td>${bottleneck.test}</td>
                                <td>${bottleneck.type}</td>
                                <td class="priority-${bottleneck.severity.toLowerCase()}">${bottleneck.severity}</td>
                                <td>${bottleneck.value}</td>
                                <td>${bottleneck.threshold}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p>No critical bottlenecks identified.</p>'}
        </div>

        <div class="section">
            <h2>Recommendations</h2>
            <table>
                <thead>
                    <tr>
                        <th>Priority</th>
                        <th>Category</th>
                        <th>Issue</th>
                        <th>Recommendation</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.recommendations.map(rec => `
                        <tr>
                            <td class="priority-${rec.priority.toLowerCase()}">${rec.priority}</td>
                            <td>${rec.category}</td>
                            <td>${rec.issue}</td>
                            <td>${rec.recommendation}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Infrastructure Recommendations</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                ${Object.entries(report.scalabilityAssessment.recommendedInfrastructure).map(([key, value]) => `
                    <p><strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${value}</p>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <h2>Next Steps</h2>
            <ul>
                ${report.scalabilityAssessment.nextSteps.map(step => `<li>${step}</li>`).join('')}
            </ul>
        </div>
    </div>
</body>
</html>`;
    }

    getScoreColor(score) {
        if (score >= 90) return '#28a745';
        if (score >= 70) return '#ffc107';
        if (score >= 50) return '#fd7e14';
        return '#dc3545';
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in other modules
module.exports = LoadTestRunner;

// Auto-run if executed directly
if (require.main === module) {
    const runner = new LoadTestRunner();

    console.log('🏥 AIRA LOAD TEST RUNNER');
    console.log('Performance Audit for 2000 Concurrent Users');
    console.log('═'.repeat(60));

    // Check if k6 is installed
    const { spawn } = require('child_process');
    const k6Check = spawn('k6', ['version'], { stdio: 'pipe' });

    k6Check.on('close', (code) => {
        if (code !== 0) {
            console.error('❌ k6 is not installed. Please install k6 first:');
            console.error('   macOS: brew install k6');
            console.error('   Ubuntu: sudo apt-get install k6');
            console.error('   Or visit: https://k6.io/docs/getting-started/installation/');
            process.exit(1);
        }

        // Start the audit
        runner.runFullAudit().catch(error => {
            console.error('❌ Audit failed:', error.message);
            process.exit(1);
        });
    });
}