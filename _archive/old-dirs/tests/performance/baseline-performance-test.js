/**
 * 🏥 AIRA BASELINE PERFORMANCE TEST
 * Native Node.js performance testing for 2000 users audit
 * Alternative to k6 when k6 is not available
 */

const http = require('http');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class BaselinePerformanceTest {
    constructor() {
        this.baseUrl = 'http://localhost:8082';
        this.results = {
            requests: [],
            metrics: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                responseTimes: [],
                errorTypes: {}
            },
            healthcare: {
                sessionsCreated: 0,
                patientsRegistered: 0,
                voiceProcessingTimes: [],
                patientLookups: [],
                crisisDetections: 0
            }
        };
        this.isRunning = false;
        this.concurrentUsers = 100;
        this.testDuration = 60000; // 1 minute baseline test
        this professionals = this.generateTestProfessionals(100);
    }

    generateTestProfessionals(count) {
        const surnames = ['García', 'Rodríguez', 'Martínez', 'López', 'González'];
        const names = ['Ana', 'Carlos', 'María', 'Juan', 'Laura'];
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

                    this.results.metrics.totalRequests++;
                    this.results.metrics.responseTimes.push(responseTime);

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        this.results.metrics.successfulRequests++;
                    } else {
                        this.results.metrics.failedRequests++;
                        const errorType = `HTTP_${res.statusCode}`;
                        this.results.metrics.errorTypes[errorType] = (this.results.metrics.errorTypes[errorType] || 0) + 1;
                    }

                    resolve({
                        statusCode: res.statusCode,
                        responseTime,
                        body: body,
                        headers: res.headers
                    });
                });
            });

            req.on('error', (error) => {
                const endTime = performance.now();
                const responseTime = Math.round(endTime - startTime);

                this.results.metrics.totalRequests++;
                this.results.metrics.failedRequests++;
                this.results.metrics.responseTimes.push(responseTime);
                this.results.metrics.errorTypes['NETWORK_ERROR'] = (this.results.metrics.errorTypes['NETWORK_ERROR'] || 0) + 1;

                resolve({
                    statusCode: 0,
                    responseTime,
                    error: error.message
                });
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    async authenticateProfessional(professional) {
        const response = await this.makeRequest('POST', '/api/auth/login', {
            dni: professional.dni,
            pin: professional.pin
        });

        if (response.statusCode === 200) {
            try {
                const data = JSON.parse(response.body);
                return data.token;
            } catch (error) {
                console.warn('Failed to parse auth response:', error.message);
                return null;
            }
        }

        return null;
    }

    async registerPatient(token, patientData) {
        const response = await this.makeRequest('POST', '/api/patients', patientData, {
            'Authorization': `Bearer ${token}`
        });

        if (response.statusCode === 201) {
            this.results.healthcare.patientsRegistered++;
            return JSON.parse(response.body);
        }

        return null;
    }

    async searchPatients(token, query = '') {
        const startTime = performance.now();
        const path = query ? `/api/patients?search=${encodeURIComponent(query)}&limit=20` : '/api/patients?page=1&limit=20';

        const response = await this.makeRequest('GET', path, null, {
            'Authorization': `Bearer ${token}`
        });

        const lookupTime = Math.round(performance.now() - startTime);
        this.results.healthcare.patientLookups.push(lookupTime);

        if (response.statusCode === 200) {
            return JSON.parse(response.body);
        }

        return null;
    }

    async createSession(token, sessionData) {
        const startTime = performance.now();

        const response = await this.makeRequest('POST', '/api/sessions', sessionData, {
            'Authorization': `Bearer ${token}`
        });

        const creationTime = Math.round(performance.now() - startTime);

        if (response.statusCode === 201) {
            this.results.healthcare.sessionsCreated++;
            if (sessionData.observaciones && sessionData.observaciones.length > 100) {
                this.results.healthcare.voiceProcessingTimes.push(creationTime);
            }
            return JSON.parse(response.body);
        }

        return null;
    }

    async simulateUserWorkload(professional, userId) {
        console.log(`Starting user ${userId}: Dr. ${professional.name}`);

        // Authenticate
        const token = await this.authenticateProfessional(professional);
        if (!token) {
            console.warn(`User ${userId}: Authentication failed`);
            return;
        }

        // Simulate realistic healthcare workflow
        const workloadDuration = Math.random() * 30000 + 10000; // 10-40 seconds of work
        const startTime = Date.now();

        while (Date.now() - startTime < workloadDuration && this.isRunning) {
            try {
                // Patient lookup (40% probability)
                if (Math.random() < 0.4) {
                    await this.searchPatients(token, '');
                    await this.sleep(Math.random() * 2000 + 500); // 0.5-2.5s thinking time
                }

                // Create session (30% probability)
                if (Math.random() < 0.3) {
                    const sessionData = {
                        patient_id: `test_patient_${userId}_${Date.now()}`,
                        observaciones: `Sesión de prueba para paciente - evaluación de ansiedad y estrés. Paciente reporta dificultad para conciliar el sueño y preocupaciones excesivas sobre trabajo. Se inicia técnicas de relajación y reestructuración cognitiva.`,
                        tipo: 'texto'
                    };
                    await this.createSession(token, sessionData);
                    await this.sleep(Math.random() * 5000 + 2000); // 2-7s between sessions
                }

                // Register new patient (10% probability)
                if (Math.random() < 0.1) {
                    const patientData = {
                        nombre: `Paciente Test ${userId}`,
                        dni: `40${String(userId).padStart(7, '0')}`,
                        obra_social: 'OSDE',
                        telefono: `+54 9 11 ${Math.floor(Math.random() * 9000 + 1000)} ${Math.floor(Math.random() * 9000 + 1000)}`
                    };
                    await this.registerPatient(token, patientData);
                    await this.sleep(Math.random() * 3000 + 1000); // 1-4s form filling time
                }

                // Brief pause between operations
                await this.sleep(Math.random() * 1000 + 500);

            } catch (error) {
                console.warn(`User ${userId}: Error in workload simulation:`, error.message);
            }
        }

        console.log(`Completed user ${userId}: Dr. ${professional.name}`);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async runBaselineTest() {
        console.log('🏥 AIRA BASELINE PERFORMANCE TEST');
        console.log(`🎯 Testing with ${this.concurrentUsers} concurrent users`);
        console.log(`⏱️ Duration: ${this.testDuration / 1000} seconds`);
        console.log('─'.repeat(50));

        this.isRunning = true;
        const testStartTime = Date.now();

        // Start concurrent users
        const userPromises = this.professionals.slice(0, this.concurrentUsers).map((professional, index) => {
            return this.simulateUserWorkload(professional, index + 1);
        });

        // Wait for test duration
        await this.sleep(this.testDuration);

        // Stop test
        this.isRunning = false;

        // Wait for all users to complete
        await Promise.all(userPromises);

        const testDuration = Date.now() - testStartTime;

        console.log('─'.repeat(50));
        console.log('✅ Baseline test completed');
        console.log(`⏱️ Actual duration: ${Math.round(testDuration / 1000)} seconds`);

        // Calculate and display results
        this.calculateAndDisplayResults(testDuration);

        return this.results;
    }

    calculateAndDisplayResults(testDuration) {
        const metrics = this.results.metrics;
        const healthcare = this.results.healthcare;

        // Calculate statistics
        const responseTimes = metrics.responseTimes.sort((a, b) => a - b);
        const avgResponseTime = responseTimes.length > 0 ?
            Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;
        const p95ResponseTime = responseTimes.length > 0 ?
            responseTimes[Math.floor(responseTimes.length * 0.95)] : 0;
        const p99ResponseTime = responseTimes.length > 0 ?
            responseTimes[Math.floor(responseTimes.length * 0.99)] : 0;

        const errorRate = metrics.totalRequests > 0 ? metrics.failedRequests / metrics.totalRequests : 0;
        const requestsPerSecond = metrics.totalRequests / (testDuration / 1000);

        const avgPatientLookupTime = healthcare.patientLookups.length > 0 ?
            Math.round(healthcare.patientLookups.reduce((a, b) => a + b, 0) / healthcare.patientLookups.length) : 0;

        const avgVoiceProcessingTime = healthcare.voiceProcessingTimes.length > 0 ?
            Math.round(healthcare.voiceProcessingTimes.reduce((a, b) => a + b, 0) / healthcare.voiceProcessingTimes.length) : 0;

        // Display results
        console.log('\n📊 PERFORMANCE METRICS:');
        console.log(`   Total Requests: ${metrics.totalRequests}`);
        console.log(`   Successful: ${metrics.successfulRequests} (${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%)`);
        console.log(`   Failed: ${metrics.failedRequests} (${(errorRate * 100).toFixed(2)}%)`);
        console.log(`   Requests/sec: ${Math.round(requestsPerSecond)}`);
        console.log('\n⚡ RESPONSE TIMES:');
        console.log(`   Average: ${avgResponseTime}ms`);
        console.log(`   P95: ${p95ResponseTime}ms`);
        console.log(`   P99: ${p99ResponseTime}ms`);
        console.log('\n🏥 HEALTHCARE METRICS:');
        console.log(`   Sessions Created: ${healthcare.sessionsCreated}`);
        console.log(`   Patients Registered: ${healthcare.patientsRegistered}`);
        console.log(`   Avg Patient Lookup: ${avgPatientLookupTime}ms`);
        console.log(`   Avg Voice Processing: ${avgVoiceProcessingTime}ms`);

        // Performance assessment
        console.log('\n🎯 PERFORMANCE ASSESSMENT:');
        const assessment = this.assessPerformance(avgResponseTime, errorRate, p95ResponseTime);
        console.log(`   Overall Status: ${assessment.status}`);
        console.log(`   Meets 500ms Target: ${assessment.meetsResponseTimeTarget ? '✅ YES' : '❌ NO'}`);
        console.log(`   Meets 10% Error Target: ${assessment.meetsErrorTarget ? '✅ YES' : '❌ NO'}`);
        console.log(`   Healthcare UX Target: ${assessment.meetsHealthcareTarget ? '✅ YES' : '❌ NO'}`);

        if (assessment.issues.length > 0) {
            console.log('\n⚠️ ISSUES IDENTIFIED:');
            assessment.issues.forEach(issue => console.log(`   • ${issue}`));
        }

        // Save detailed results
        this.saveResults(testDuration, assessment);
    }

    assessPerformance(avgResponseTime, errorRate, p95ResponseTime) {
        const issues = [];

        let status = 'EXCELLENT';
        if (avgResponseTime > 1000 || errorRate > 0.2) {
            status = 'POOR';
        } else if (avgResponseTime > 500 || errorRate > 0.1) {
            status = 'NEEDS_IMPROVEMENT';
        } else if (avgResponseTime > 300 || errorRate > 0.05) {
            status = 'GOOD';
        }

        if (avgResponseTime > 500) issues.push('Average response time exceeds 500ms target');
        if (p95ResponseTime > 1000) issues.push('P95 response time exceeds 1 second');
        if (errorRate > 0.1) issues.push('Error rate exceeds 10% threshold');
        if (this.results.healthcare.patientLookups.some(time => time > 500)) {
            issues.push('Patient lookup times exceed 500ms threshold');
        }
        if (this.results.healthcare.voiceProcessingTimes.some(time => time > 30000)) {
            issues.push('Voice processing times exceed 30 second threshold');
        }

        return {
            status,
            meetsResponseTimeTarget: avgResponseTime <= 500,
            meetsErrorTarget: errorRate <= 0.1,
            meetsHealthcareTarget: this.results.healthcare.patientLookups.every(time => time <= 500) &&
                                  this.results.healthcare.voiceProcessingTimes.every(time => time <= 30000),
            issues
        };
    }

    saveResults(testDuration, assessment) {
        const results = {
            timestamp: new Date().toISOString(),
            testType: 'baseline',
            concurrentUsers: this.concurrentUsers,
            testDuration,
            metrics: this.results.metrics,
            healthcare: this.results.healthcare,
            assessment,
            systemInfo: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                cpus: require('os').cpus().length,
                totalMemory: Math.round(require('os').totalmem() / (1024 * 1024 * 1024)) + ' GB'
            }
        };

        const reportsDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const reportPath = path.join(reportsDir, `baseline-performance-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

        console.log(`\n📄 Detailed results saved: ${reportPath}`);
        return reportPath;
    }
}

// Auto-run if executed directly
if (require.main === module) {
    const test = new BaselinePerformanceTest();

    // Allow configuration via command line arguments
    if (process.argv.includes('--users')) {
        const usersIndex = process.argv.indexOf('--users');
        if (usersIndex + 1 < process.argv.length) {
            test.concurrentUsers = parseInt(process.argv[usersIndex + 1]) || 100;
        }
    }

    if (process.argv.includes('--duration')) {
        const durationIndex = process.argv.indexOf('--duration');
        if (durationIndex + 1 < process.argv.length) {
            test.testDuration = parseInt(process.argv[durationIndex + 1]) * 1000 || 60000;
        }
    }

    test.runBaselineTest().catch(error => {
        console.error('❌ Baseline test failed:', error.message);
        process.exit(1);
    });
}

module.exports = BaselinePerformanceTest;