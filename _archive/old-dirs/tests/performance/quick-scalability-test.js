/**
 * 🏥 AIRA QUICK SCALABILITY TEST
 * Rapid performance assessment for healthcare system
 * Tests: 100 → 500 → 1000 → 1500 → 2000 users (30 seconds each)
 */

const http = require('http');
const { performance } = require('perf_hooks');

class QuickScalabilityTest {
    constructor() {
        this.baseUrl = 'http://localhost:8082';
        this.results = [];
        this.isRunning = false;

        // Quick test stages - 30 seconds each
        this.testStages = [
            { users: 100, duration: 30000, name: '100 Users' },
            { users: 500, duration: 30000, name: '500 Users' },
            { users: 1000, duration: 30000, name: '1000 Users' },
            { users: 1500, duration: 30000, name: '1500 Users' },
            { users: 2000, duration: 30000, name: '2000 Users' }
        ];
    }

    async makeRequest() {
        const startTime = performance.now();

        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: 8082,
                path: '/health',
                method: 'GET'
            };

            const req = http.request(options, (res) => {
                res.on('data', () => {});
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

            req.end();
        });
    }

    async simulateUser(stageResults) {
        const userStartTime = Date.now();
        const userDuration = Math.random() * 20000 + 10000; // 10-30 seconds

        while (Date.now() - userStartTime < userDuration && this.isRunning) {
            const response = await this.makeRequest();
            stageResults.totalRequests++;
            stageResults.responseTimes.push(response.responseTime);

            if (response.success) {
                stageResults.successfulRequests++;
            } else {
                stageResults.failedRequests++;
            }

            // Brief pause between requests
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 200));
        }
    }

    async runStage(stage) {
        console.log(`\n🎯 Testing ${stage.name}...`);
        console.log(`👥 Users: ${stage.users} | Duration: ${stage.duration / 1000}s`);

        const stageResults = {
            stageName: stage.name,
            users: stage.users,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: []
        };

        this.isRunning = true;
        const startTime = Date.now();

        // Start concurrent users
        const userPromises = [];
        for (let i = 0; i < stage.users; i++) {
            userPromises.push(this.simulateUser(stageResults));
        }

        // Wait for stage duration
        await new Promise(resolve => setTimeout(resolve, stage.duration));

        // Stop stage
        this.isRunning = false;
        await Promise.all(userPromises);

        const actualDuration = Date.now() - startTime;

        // Calculate metrics
        const avgResponseTime = stageResults.responseTimes.length > 0 ?
            Math.round(stageResults.responseTimes.reduce((a, b) => a + b, 0) / stageResults.responseTimes.length) : 0;

        const responseTimes = stageResults.responseTimes.sort((a, b) => a - b);
        const p95ResponseTime = responseTimes.length > 0 ?
            responseTimes[Math.floor(responseTimes.length * 0.95)] : 0;

        const errorRate = stageResults.totalRequests > 0 ? stageResults.failedRequests / stageResults.totalRequests : 0;
        const requestsPerSecond = stageResults.totalRequests / (actualDuration / 1000);

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
                p95ResponseTime
            },
            assessment: this.assessPerformance(avgResponseTime, errorRate, p95ResponseTime)
        };

        // Display results
        this.displayResults(completeResults);
        this.results.push(completeResults);

        return completeResults;
    }

    assessPerformance(avgResponseTime, errorRate, p95ResponseTime) {
        if (avgResponseTime < 500 && errorRate < 0.1) {
            return { status: 'EXCELLENT', ready: true };
        } else if (avgResponseTime < 1000 && errorRate < 0.15) {
            return { status: 'GOOD', ready: true };
        } else if (avgResponseTime < 2000 && errorRate < 0.25) {
            return { status: 'NEEDS_IMPROVEMENT', ready: false };
        } else {
            return { status: 'POOR', ready: false };
        }
    }

    displayResults(results) {
        const status = results.assessment.ready ? '✅' : '❌';
        console.log(`   ${status} ${results.metrics.totalRequests.toLocaleString()} requests | ${results.metrics.avgResponseTime}ms avg | ${(results.metrics.errorRate * 100).toFixed(1)}% errors | ${results.metrics.requestsPerSecond.toFixed(0)} req/s`);
    }

    async runQuickTest() {
        console.log('🏥 AIRA QUICK SCALABILITY TEST');
        console.log('═'.repeat(50));
        console.log('Testing system scalability up to 2000 users');
        console.log('Each stage: 30 seconds duration');

        const testStartTime = Date.now();

        // Run all stages
        for (const stage of this.testStages) {
            await this.runStage(stage);

            // Brief pause between stages
            if (this.testStages.indexOf(stage) < this.testStages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        const totalDuration = Date.now() - testStartTime;

        console.log('\n' + '═'.repeat(50));
        console.log('🏁 QUICK SCALABILITY TEST COMPLETED');
        console.log(`⏱️ Total Duration: ${Math.round(totalDuration / 1000)}s`);
        console.log('═'.repeat(50));

        // Generate summary
        this.generateSummary();
    }

    generateSummary() {
        console.log('\n📊 SCALABILITY SUMMARY:');

        // Find maximum sustainable load
        const successfulStages = this.results.filter(r => r.assessment.ready);
        const maxSustainableLoad = successfulStages.length > 0 ?
            Math.max(...successfulStages.map(r => r.users)) : 0;

        console.log(`🎯 Maximum Sustainable Load: ${maxSustainableLoad} concurrent users`);

        // Performance trend
        console.log('\n📈 PERFORMANCE TREND:');
        this.results.forEach(result => {
            const status = result.assessment.ready ? '✅' : '❌';
            console.log(`   ${status} ${result.users} users: ${result.metrics.avgResponseTime}ms avg, ${(result.metrics.errorRate * 100).toFixed(1)}% errors`);
        });

        // Overall assessment
        console.log('\n🏆 OVERALL ASSESSMENT:');
        if (maxSustainableLoad >= 2000) {
            console.log('   ✅ SYSTEM READY - Can handle 2000 concurrent users');
        } else if (maxSustainableLoad >= 1000) {
            console.log('   ⚠️ SYSTEM NEEDS OPTIMIZATION - Handles partial load');
        } else if (maxSustainableLoad >= 500) {
            console.log('   ❌ SYSTEM REQUIRES MAJOR IMPROVEMENTS');
        } else {
            console.log('   🚨 SYSTEM NOT SUITABLE FOR PRODUCTION');
        }

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (maxSustainableLoad < 2000) {
            console.log('   • Implement horizontal scaling with load balancer');
            console.log('   • Add Redis caching for frequent operations');
            console.log('   • Optimize database queries and add indexes');
        }

        if (this.results.some(r => r.metrics.avgResponseTime > 1000)) {
            console.log('   • Implement response compression');
            console.log('   • Add CDN for static assets');
        }

        if (this.results.some(r => r.metrics.errorRate > 0.1)) {
            console.log('   • Review error handling and retry logic');
            console.log('   • Implement circuit breakers for external services');
        }
    }
}

// Auto-run if executed directly
if (require.main === module) {
    const test = new QuickScalabilityTest();
    test.runQuickTest().catch(error => {
        console.error('❌ Quick scalability test failed:', error.message);
        process.exit(1);
    });
}

module.exports = QuickScalabilityTest;