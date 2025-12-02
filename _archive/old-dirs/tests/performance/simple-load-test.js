/**
 * 🏥 AIRA SIMPLE LOAD TEST
 * Basic performance testing for healthcare system
 */

const http = require('http');
const { performance } = require('perf_hooks');

class SimpleLoadTest {
    constructor() {
        this.baseUrl = 'http://localhost:8082';
        this.totalRequests = 0;
        this.successfulRequests = 0;
        this.failedRequests = 0;
        this.responseTimes = [];
        this.isRunning = false;
    }

    async makeRequest(path) {
        const startTime = performance.now();

        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: 8082,
                path: path,
                method: 'GET'
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    const endTime = performance.now();
                    const responseTime = Math.round(endTime - startTime);

                    this.totalRequests++;
                    this.responseTimes.push(responseTime);

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        this.successfulRequests++;
                    } else {
                        this.failedRequests++;
                    }

                    resolve({
                        statusCode: res.statusCode,
                        responseTime
                    });
                });
            });

            req.on('error', () => {
                const endTime = performance.now();
                const responseTime = Math.round(endTime - startTime);

                this.totalRequests++;
                this.failedRequests++;
                this.responseTimes.push(responseTime);

                resolve({
                    statusCode: 0,
                    responseTime
                });
            });

            req.end();
        });
    }

    async runLoadTest(users = 50, duration = 30000) {
        console.log(`🏥 AIRA SIMPLE LOAD TEST`);
        console.log(`🎯 Testing with ${users} concurrent users`);
        console.log(`⏱️ Duration: ${duration / 1000} seconds`);
        console.log('─'.repeat(50));

        this.isRunning = true;
        const startTime = Date.now();

        // Start concurrent users
        const userPromises = [];
        for (let i = 0; i < users; i++) {
            userPromises.push(this.simulateUser(i + 1));
        }

        // Wait for test duration
        await new Promise(resolve => setTimeout(resolve, duration));

        // Stop test
        this.isRunning = false;
        await Promise.all(userPromises);

        const testDuration = Date.now() - startTime;
        this.displayResults(testDuration);
    }

    async simulateUser(userId) {
        while (this.isRunning) {
            // Test health endpoint
            await this.makeRequest('/health');
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        }
    }

    displayResults(testDuration) {
        const avgResponseTime = this.responseTimes.length > 0 ?
            Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length) : 0;

        const responseTimes = this.responseTimes.sort((a, b) => a - b);
        const p95ResponseTime = responseTimes.length > 0 ?
            responseTimes[Math.floor(responseTimes.length * 0.95)] : 0;

        const errorRate = this.totalRequests > 0 ? this.failedRequests / this.totalRequests : 0;
        const requestsPerSecond = this.totalRequests / (testDuration / 1000);

        console.log('─'.repeat(50));
        console.log('✅ Load test completed');
        console.log(`⏱️ Duration: ${Math.round(testDuration / 1000)} seconds`);
        console.log('\n📊 RESULTS:');
        console.log(`   Total Requests: ${this.totalRequests}`);
        console.log(`   Successful: ${this.successfulRequests}`);
        console.log(`   Failed: ${this.failedRequests}`);
        console.log(`   Requests/sec: ${Math.round(requestsPerSecond)}`);
        console.log(`   Error Rate: ${(errorRate * 100).toFixed(2)}%`);
        console.log('\n⚡ RESPONSE TIMES:');
        console.log(`   Average: ${avgResponseTime}ms`);
        console.log(`   P95: ${p95ResponseTime}ms`);

        // Assessment
        console.log('\n🎯 ASSESSMENT:');
        if (avgResponseTime < 500 && errorRate < 0.1) {
            console.log('   Status: ✅ EXCELLENT - Meets all targets');
        } else if (avgResponseTime < 1000 && errorRate < 0.2) {
            console.log('   Status: ⚠️ NEEDS IMPROVEMENT - Some targets missed');
        } else {
            console.log('   Status: ❌ POOR - Major performance issues');
        }
    }
}

// Run test
if (require.main === module) {
    const test = new SimpleLoadTest();
    const users = parseInt(process.argv[2]) || 50;
    const duration = parseInt(process.argv[3]) || 30;

    test.runLoadTest(users, duration * 1000);
}

module.exports = SimpleLoadTest;