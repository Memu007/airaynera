/**
 * 🏥 AIRA PROGRESSIVE LOAD TEST
 * Scalability testing from 100 → 2000 concurrent users
 * Healthcare system specific workload simulation
 */

const http = require('http');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class ProgressiveLoadTest {
    constructor() {
        this.baseUrl = 'http://localhost:8082';
        this.results = [];
        this.isRunning = false;

        // Test stages: 100 → 500 → 1000 → 1500 → 2000 users
        this.testStages = [
            { users: 100, duration: 60000, name: 'Stage 1: 100 Users' },
            { users: 500, duration: 120000, name: 'Stage 2: 500 Users' },
            { users: 1000, duration: 180000, name: 'Stage 3: 1000 Users' },
            { users: 1500, duration: 240000, name: 'Stage 4: 1500 Users' },
            { users: 2000, duration: 300000, name: 'Stage 5: 2000 Users' }
        ];

        this.professionals = this.generateTestProfessionals(2000);
    }

    generateTestProfessionals(count) {
        const surnames = ['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez'];
        const names = ['Ana', 'Carlos', 'María', 'Juan', 'Laura', 'Diego', 'Sofía', 'Martín'];
        const specialties = ['Psicología', 'Psiquiatría', 'Terapia Ocupacional'];

        return Array.from({ length: count }, (_, i) => ({
            dni: `30${String(i + 1).padStart(7, '0')}`,
            pin: '1234',
            name: `Dr. ${surnames[i % surnames.length]} ${names[i % names.length]}`,
            specialty: specialties[i % specialties.length]
        }));
    }

    async makeRequest(method, path, data = null, headers = {}) {
        const startTime = performance.now();

        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: 8082,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };

            if (data) {
                const jsonData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(jsonData);
            }

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    const endTime = performance.now();
                    const responseTime = Math.round(endTime - startTime);
                    resolve({
                        statusCode: res.statusCode,
                        responseTime,
                        success: res.statusCode >= 200 && res.statusCode < 300
                    });
                });
            });

            req.on('error', () => {
                const endTime = performance.now();
                const responseTime = Math.round(endTime - startTime);
                resolve({
                    statusCode: 0,
                    responseTime,
                    success: false
                });
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    async simulateHealthcareWorkload(professional, stageResults, stageStartTime) {
        const operations = [];
        const sessionDuration = Math.random() * 30000 + 20000; // 20-50 seconds
        const userStartTime = Date.now();

        while (Date.now() - userStartTime < sessionDuration && this.isRunning) {
            // Health check (20% of operations)
            if (Math.random() < 0.2) {
                const response = await this.makeRequest('GET', '/health');
                stageResults.totalRequests++;
                stageResults.responseTimes.push(response.responseTime);
                if (response.success) stageResults.successfulRequests++;
                else stageResults.failedRequests++;
            }

            // Authentication simulation (30% of operations)
            if (Math.random() < 0.3) {
                const response = await this.makeRequest('POST', '/api/auth/login', {
                    dni: professional.dni,
                    pin: professional.pin
                });
                stageResults.totalRequests++;
                stageResults.responseTimes.push(response.responseTime);
                if (response.success) stageResults.successfulRequests++;
                else stageResults.failedRequests++;
            }

            // Patient lookup simulation (25% of operations)
            if (Math.random() < 0.25) {
                const searchQuery = ['María', 'Carlos', 'paciente', 'consulta'][Math.floor(Math.random() * 4)];
                const response = await this.makeRequest('GET', `/api/patients?search=${encodeURIComponent(searchQuery)}&limit=10`);
                stageResults.totalRequests++;
                stageResults.responseTimes.push(response.responseTime);
                stageResults.healthcareMetrics.patientLookups.push(response.responseTime);
                if (response.success) stageResults.successfulRequests++;
                else stageResults.failedRequests++;
            }

            // Session creation simulation (15% of operations)
            if (Math.random() < 0.15) {
                const sessionData = {
                    patient_id: `patient_${professional.dni}_${Date.now()}`,
                    observaciones: `Sesión de evaluación psicológica. Paciente presenta síntomas de ansiedad generalizada con difficulty para conciliar el sueño. Se aplica técnicas de relajación y reestructuración cognitiva. Se recomienda seguimiento semanal.`,
                    tipo: 'texto'
                };
                const response = await this.makeRequest('POST', '/api/sessions', sessionData);
                stageResults.totalRequests++;
                stageResults.responseTimes.push(response.responseTime);
                stageResults.healthcareMetrics.sessionCreations.push(response.responseTime);
                if (response.success) {
                    stageResults.successfulRequests++;
                    stageResults.healthcareMetrics.sessionsCreated++;
                } else {
                    stageResults.failedRequests++;
                }
            }

            // Brief pause between operations
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
        }

        stageResults.healthcareMetrics.userSessionsCompleted++;
    }

    async runStage(stage, stageIndex) {
        console.log(`\n🎯 ${stage.name}`);
        console.log(`👥 Concurrent Users: ${stage.users}`);
        console.log(`⏱️ Duration: ${stage.duration / 1000} seconds`);
        console.log('─'.repeat(60));

        const stageResults = {
            stageName: stage.name,
            users: stage.users,
            duration: stage.duration,
            startTime: Date.now(),
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            healthcareMetrics: {
                sessionsCreated: 0,
                patientLookups: [],
                sessionCreations: [],
                userSessionsCompleted: 0
            }
        };

        this.isRunning = true;
        const stageStartTime = Date.now();

        // Start concurrent users
        const userPromises = this.professionals.slice(0, stage.users).map((professional, index) => {
            return this.simulateHealthcareWorkload(professional, stageResults, stageStartTime);
        });

        // Wait for stage duration
        await new Promise(resolve => setTimeout(resolve, stage.duration));

        // Stop stage
        this.isRunning = false;
        await Promise.all(userPromises);

        const actualDuration = Date.now() - stageResults.startTime;

        // Calculate stage metrics
        const avgResponseTime = stageResults.responseTimes.length > 0 ?
            Math.round(stageResults.responseTimes.reduce((a, b) => a + b, 0) / stageResults.responseTimes.length) : 0;

        const responseTimes = stageResults.responseTimes.sort((a, b) => a - b);
        const p95ResponseTime = responseTimes.length > 0 ?
            responseTimes[Math.floor(responseTimes.length * 0.95)] : 0;

        const errorRate = stageResults.totalRequests > 0 ? stageResults.failedRequests / stageResults.totalRequests : 0;
        const requestsPerSecond = stageResults.totalRequests / (actualDuration / 1000);

        const avgPatientLookupTime = stageResults.healthcareMetrics.patientLookups.length > 0 ?
            Math.round(stageResults.healthcareMetrics.patientLookups.reduce((a, b) => a + b, 0) / stageResults.healthcareMetrics.patientLookups.length) : 0;

        const avgSessionCreationTime = stageResults.healthcareMetrics.sessionCreations.length > 0 ?
            Math.round(stageResults.healthcareMetrics.sessionCreations.reduce((a, b) => a + b, 0) / stageResults.healthcareMetrics.sessionCreations.length) : 0;

        // Complete stage results
        const completeResults = {
            ...stageResults,
            actualDuration,
            metrics: {
                totalRequests: stageResults.totalRequests,
                successfulRequests: stageResults.successfulRequests,
                failedRequests: stageResults.failedRequests,
                errorRate,
                requestsPerSecond,
                avgResponseTime,
                p95ResponseTime,
                p99ResponseTime: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.99)] : 0
            },
            healthcare: {
                sessionsCreated: stageResults.healthcareMetrics.sessionsCreated,
                avgPatientLookupTime,
                avgSessionCreationTime,
                userSessionsCompleted: stageResults.healthcareMetrics.userSessionsCompleted
            },
            assessment: this.assessStagePerformance(avgResponseTime, errorRate, p95ResponseTime, avgPatientLookupTime, avgSessionCreationTime)
        };

        // Display stage results
        this.displayStageResults(completeResults);

        this.results.push(completeResults);

        // Brief pause between stages
        if (stageIndex < this.testStages.length - 1) {
            console.log('\n⏸️ Waiting 2 minutes before next stage...');
            await new Promise(resolve => setTimeout(resolve, 120000));
        }

        return completeResults;
    }

    assessStagePerformance(avgResponseTime, errorRate, p95ResponseTime, avgPatientLookupTime, avgSessionCreationTime) {
        const issues = [];
        let status = 'EXCELLENT';

        if (avgResponseTime > 2000 || errorRate > 0.25) {
            status = 'CRITICAL';
        } else if (avgResponseTime > 1000 || errorRate > 0.15) {
            status = 'POOR';
        } else if (avgResponseTime > 500 || errorRate > 0.1) {
            status = 'NEEDS_IMPROVEMENT';
        } else if (avgResponseTime > 300 || errorRate > 0.05) {
            status = 'GOOD';
        }

        if (avgResponseTime > 500) issues.push('Average response time > 500ms');
        if (p95ResponseTime > 1000) issues.push('P95 response time > 1s');
        if (errorRate > 0.1) issues.push('Error rate > 10%');
        if (avgPatientLookupTime > 300) issues.push('Patient lookup > 300ms');
        if (avgSessionCreationTime > 1000) issues.push('Session creation > 1s');

        return { status, issues };
    }

    displayStageResults(results) {
        console.log('\n📊 STAGE RESULTS:');
        console.log(`   Total Requests: ${results.metrics.totalRequests.toLocaleString()}`);
        console.log(`   Successful: ${results.metrics.successfulRequests.toLocaleString()}`);
        console.log(`   Failed: ${results.metrics.failedRequests.toLocaleString()}`);
        console.log(`   Requests/sec: ${Math.round(results.metrics.requestsPerSecond)}`);
        console.log(`   Error Rate: ${(results.metrics.errorRate * 100).toFixed(2)}%`);
        console.log('\n⚡ RESPONSE TIMES:');
        console.log(`   Average: ${results.metrics.avgResponseTime}ms`);
        console.log(`   P95: ${results.metrics.p95ResponseTime}ms`);
        console.log(`   P99: ${results.metrics.p99ResponseTime}ms`);
        console.log('\n🏥 HEALTHCARE METRICS:');
        console.log(`   Sessions Created: ${results.healthcare.sessionsCreated}`);
        console.log(`   Avg Patient Lookup: ${results.healthcare.avgPatientLookupTime}ms`);
        console.log(`   Avg Session Creation: ${results.healthcare.avgSessionCreationTime}ms`);
        console.log(`   Users Completed: ${results.healthcare.userSessionsCompleted}/${results.users}`);
        console.log('\n🎯 ASSESSMENT:');
        console.log(`   Status: ${this.getAssessmentIcon(results.assessment.status)} ${results.assessment.status}`);

        if (results.assessment.issues.length > 0) {
            console.log('   Issues:');
            results.assessment.issues.forEach(issue => console.log(`     • ${issue}`));
        }
    }

    getAssessmentIcon(status) {
        const icons = {
            'EXCELLENT': '✅',
            'GOOD': '🟢',
            'NEEDS_IMPROVEMENT': '⚠️',
            'POOR': '❌',
            'CRITICAL': '🚨'
        };
        return icons[status] || '❓';
    }

    async runProgressiveTest() {
        console.log('🏥 AIRA PROGRESSIVE LOAD TEST - 2000 USERS AUDIT');
        console.log('═'.repeat(80));
        console.log('Testing scalability from 100 → 2000 concurrent users');
        console.log('Healthcare system specific workload simulation');
        console.log(`System: ${process.platform} | Node.js: ${process.version} | CPUs: ${require('os').cpus().length}`);
        console.log('═'.repeat(80));

        const testStartTime = Date.now();

        // Run all stages
        for (let i = 0; i < this.testStages.length; i++) {
            const stage = this.testStages[i];
            await this.runStage(stage, i);
        }

        const totalTestDuration = Date.now() - testStartTime;

        console.log('\n' + '═'.repeat(80));
        console.log('🏁 PROGRESSIVE LOAD TEST COMPLETED');
        console.log(`⏱️ Total Duration: ${Math.round(totalTestDuration / 1000 / 60)} minutes`);
        console.log('═'.repeat(80));

        // Generate comprehensive summary
        this.generateFinalSummary();

        // Save detailed results
        this.saveResults();

        return this.results;
    }

    generateFinalSummary() {
        console.log('\n📊 COMPREHENSIVE SUMMARY:');
        console.log('─'.repeat(60));

        // Find maximum sustainable load
        const successfulStages = this.results.filter(result =>
            result.assessment.status !== 'CRITICAL' && result.assessment.status !== 'POOR'
        );

        const maxSustainableLoad = successfulStages.length > 0 ?
            Math.max(...successfulStages.map(r => r.users)) : 0;

        console.log(`🎯 Maximum Sustainable Load: ${maxSustainableLoad} concurrent users`);

        // Performance trends
        console.log('\n📈 PERFORMANCE TRENDS:');
        this.results.forEach(result => {
            const status = result.assessment.status === 'EXCELLENT' || result.assessment.status === 'GOOD' ? '✅' : '❌';
            console.log(`   ${status} ${result.users} users: ${result.metrics.avgResponseTime}ms avg, ${(result.metrics.errorRate * 100).toFixed(1)}% errors`);
        });

        // Bottleneck analysis
        console.log('\n🔍 BOTTLENECK ANALYSIS:');
        const allIssues = this.results.flatMap(r => r.assessment.issues);
        const issueFrequency = {};

        allIssues.forEach(issue => {
            issueFrequency[issue] = (issueFrequency[issue] || 0) + 1;
        });

        Object.entries(issueFrequency)
            .sort((a, b) => b[1] - a[1])
            .forEach(([issue, frequency]) => {
                console.log(`   • ${issue} (${frequency} stages)`);
            });

        // Overall assessment
        console.log('\n🏆 OVERALL ASSESSMENT:');
        if (maxSustainableLoad >= 2000) {
            console.log('   ✅ SYSTEM READY FOR PRODUCTION - Can handle 2000 users');
        } else if (maxSustainableLoad >= 1000) {
            console.log('   ⚠️ SYSTEM NEEDS OPTIMIZATION - Handles partial load');
        } else {
            console.log('   ❌ SYSTEM NOT READY - Major improvements needed');
        }
    }

    saveResults() {
        const reportData = {
            timestamp: new Date().toISOString(),
            testType: 'progressive_load_test',
            targetUsers: 2000,
            testStages: this.testStages.map(s => ({ name: s.name, users: s.users, duration: s.duration })),
            results: this.results,
            summary: {
                maxSustainableLoad: Math.max(...this.results.filter(r =>
                    r.assessment.status !== 'CRITICAL' && r.assessment.status !== 'POOR'
                ).map(r => r.users)),
                totalTestDuration: this.results.reduce((sum, r) => sum + r.actualDuration, 0),
                systemInfo: {
                    platform: process.platform,
                    nodeVersion: process.version,
                    cpus: require('os').cpus().length,
                    totalMemory: Math.round(require('os').totalmem() / (1024 * 1024 * 1024)) + ' GB'
                }
            }
        };

        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const reportPath = path.join(reportsDir, `progressive-load-test-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

        console.log(`\n📄 Detailed results saved: ${reportPath}`);
        return reportPath;
    }
}

// Auto-run if executed directly
if (require.main === module) {
    const test = new ProgressiveLoadTest();

    test.runProgressiveTest().catch(error => {
        console.error('❌ Progressive load test failed:', error.message);
        process.exit(1);
    });
}

module.exports = ProgressiveLoadTest;