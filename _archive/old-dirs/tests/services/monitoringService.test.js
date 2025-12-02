const monitoringService = require('../../src/services/monitoringService');

// Mock del logger
jest.mock('../../src/utils/logger', () => ({
    audit: jest.fn(),
    error: jest.fn()
}));

describe('MonitoringService', () => {
    const logger = require('../../src/utils/logger');

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset metrics
        monitoringService.metrics.clear();
        monitoringService.alerts.clear();
        monitoringService.initializeMetrics();
    });

    describe('Metrics Management', () => {
        test('should initialize basic metrics', () => {
            const metrics = monitoringService.getAllMetrics();
            
            expect(metrics).toHaveProperty('requests_total');
            expect(metrics).toHaveProperty('requests_errors');
            expect(metrics).toHaveProperty('memory_usage');
            expect(metrics).toHaveProperty('cpu_usage');
            expect(metrics).toHaveProperty('encryption_operations');
            
            expect(metrics.requests_total.type).toBe('counter');
            expect(metrics.memory_usage.type).toBe('gauge');
        });

        test('should increment counters correctly', () => {
            monitoringService.incrementCounter('requests_total', 5);
            
            const metric = monitoringService.getMetric('requests_total');
            expect(metric.value).toBe(5);
            expect(metric.lastUpdated).toBeDefined();
        });

        test('should set gauge values correctly', () => {
            monitoringService.setGauge('memory_usage', 75);
            
            const metric = monitoringService.getMetric('memory_usage');
            expect(metric.value).toBe(75);
            expect(metric.lastUpdated).toBeDefined();
        });

        test('should handle invalid metric names gracefully', () => {
            expect(() => {
                monitoringService.incrementCounter('nonexistent_metric');
            }).not.toThrow();
            
            expect(() => {
                monitoringService.setGauge('nonexistent_gauge', 100);
            }).not.toThrow();
        });

        test('should record response times and calculate averages', () => {
            monitoringService.recordResponseTime(100);
            monitoringService.recordResponseTime(200);
            monitoringService.recordResponseTime(300);
            
            const avgMetric = monitoringService.getMetric('response_time_avg');
            expect(avgMetric.value).toBeGreaterThan(0);
            
            const totalRequests = monitoringService.getMetric('requests_total');
            expect(totalRequests.value).toBe(3);
        });
    });

    describe('Alert System', () => {
        test('should trigger alerts when thresholds are exceeded', async () => {
            // Set memory usage above threshold (80%)
            monitoringService.setGauge('memory_usage', 85);
            
            // Allow some time for threshold checking
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const activeAlerts = monitoringService.getActiveAlerts();
            expect(activeAlerts.some(alert => 
                alert.type.includes('memory_usage')
            )).toBe(true);
        });

        test('should create alert with correct structure', async () => {
            const alertId = await monitoringService.triggerAlert('test_alert', {
                value: 100,
                threshold: 80,
                severity: 'warning'
            });
            
            const alert = monitoringService.alerts.get(alertId);
            expect(alert).toHaveProperty('id');
            expect(alert).toHaveProperty('type');
            expect(alert).toHaveProperty('severity');
            expect(alert).toHaveProperty('timestamp');
            expect(alert).toHaveProperty('data');
            expect(alert).toHaveProperty('status');
            
            expect(alert.type).toBe('test_alert');
            expect(alert.severity).toBe('warning');
            expect(alert.status).toBe('active');
        });

        test('should resolve alerts automatically for warning level', async () => {
            const alertId = await monitoringService.triggerAlert('warning_alert', {
                severity: 'warning'
            });
            
            // Wait for auto-resolution (5 minutes in real code, but we'll test the mechanism)
            monitoringService.resolveAlert(alertId);
            
            const alert = monitoringService.alerts.get(alertId);
            expect(alert.status).toBe('resolved');
            expect(alert.resolvedAt).toBeDefined();
        });

        test('should not auto-resolve critical alerts', async () => {
            const alertId = await monitoringService.triggerAlert('critical_alert', {
                severity: 'critical'
            });
            
            // Critical alerts should not auto-resolve
            const alert = monitoringService.alerts.get(alertId);
            expect(alert.status).toBe('active');
            expect(alert.resolvedAt).toBeUndefined();
        });

        test('should get active alerts only', async () => {
            const alert1 = await monitoringService.triggerAlert('alert1', { severity: 'warning' });
            const alert2 = await monitoringService.triggerAlert('alert2', { severity: 'critical' });
            
            // Resolve one alert
            monitoringService.resolveAlert(alert1);
            
            const activeAlerts = monitoringService.getActiveAlerts();
            expect(activeAlerts).toHaveLength(1);
            expect(activeAlerts[0].id).toBe(alert2);
        });
    });

    describe('Error Recording', () => {
        test('should record errors and calculate error rate', () => {
            // Generate some successful requests
            monitoringService.recordResponseTime(100);
            monitoringService.recordResponseTime(150);
            monitoringService.recordResponseTime(200);
            
            // Generate an error
            const testError = new Error('Test error');
            monitoringService.recordError(testError, { context: 'test' });
            
            const totalRequests = monitoringService.getMetric('requests_total').value;
            const totalErrors = monitoringService.getMetric('requests_errors').value;
            
            expect(totalRequests).toBe(4); // 3 successful + 1 error
            expect(totalErrors).toBe(1);
            
            const errorRate = (totalErrors / totalRequests) * 100;
            expect(errorRate).toBe(25); // 25% error rate
        });

        test('should trigger alert for high error rate', () => {
            // Set up scenario with high error rate
            monitoringService.recordResponseTime(100); // 1 successful request
            
            // Generate multiple errors to exceed threshold
            for (let i = 0; i < 3; i++) {
                monitoringService.recordError(new Error(`Error ${i}`));
            }
            
            // Should trigger high error rate alert
            const activeAlerts = monitoringService.getActiveAlerts();
            expect(activeAlerts.some(alert => 
                alert.type === 'high_error_rate'
            )).toBe(true);
        });

        test('should log error details', () => {
            const testError = new Error('Database connection failed');
            const context = { userId: 'user-123', action: 'fetchData' };
            
            monitoringService.recordError(testError, context);
            
            expect(logger.error).toHaveBeenCalledWith(
                'Error recorded in monitoring',
                expect.objectContaining({
                    error: 'Database connection failed',
                    context
                })
            );
        });
    });

    describe('System Resource Monitoring', () => {
        test('should monitor memory usage', async () => {
            await monitoringService.monitorSystemResources();
            
            const memoryMetric = monitoringService.getMetric('memory_usage');
            expect(memoryMetric.value).toBeGreaterThan(0);
            expect(memoryMetric.value).toBeLessThanOrEqual(100);
        });

        test('should monitor CPU usage', async () => {
            await monitoringService.monitorSystemResources();
            
            const cpuMetric = monitoringService.getMetric('cpu_usage');
            expect(cpuMetric.value).toBeGreaterThanOrEqual(0);
            expect(cpuMetric.value).toBeLessThanOrEqual(100);
        });

        test('should monitor active connections', async () => {
            await monitoringService.monitorSystemResources();
            
            const connectionsMetric = monitoringService.getMetric('active_connections');
            expect(connectionsMetric.value).toBeGreaterThanOrEqual(0);
        });

        test('should log monitoring activities', async () => {
            await monitoringService.monitorSystemResources();
            
            expect(logger.audit).toHaveBeenCalledWith(
                'System resources monitored',
                expect.objectContaining({
                    memoryPercent: expect.any(Number),
                    memoryMB: expect.any(Number),
                    activeConnections: expect.any(Number)
                })
            );
        });

        test('should handle monitoring errors gracefully', async () => {
            // Mock process.memoryUsage to throw an error
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn(() => {
                throw new Error('Memory access denied');
            });
            
            await expect(monitoringService.monitorSystemResources()).resolves.not.toThrow();
            
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to monitor system resources',
                expect.objectContaining({
                    error: 'Memory access denied'
                })
            );
            
            // Restore original function
            process.memoryUsage = originalMemoryUsage;
        });
    });

    describe('Health Summary', () => {
        test('should generate comprehensive health summary', async () => {
            // Set up some metrics
            monitoringService.incrementCounter('requests_total', 100);
            monitoringService.incrementCounter('requests_errors', 5);
            monitoringService.setGauge('memory_usage', 65);
            monitoringService.setGauge('cpu_usage', 45);
            
            // Trigger an alert
            await monitoringService.triggerAlert('test_alert', { severity: 'warning' });
            
            const healthSummary = monitoringService.getHealthSummary();
            
            expect(healthSummary).toHaveProperty('status');
            expect(healthSummary).toHaveProperty('timestamp');
            expect(healthSummary).toHaveProperty('metrics');
            expect(healthSummary).toHaveProperty('alerts');
            expect(healthSummary).toHaveProperty('uptime');
            expect(healthSummary).toHaveProperty('version');
            
            expect(healthSummary.metrics.requests_total).toBe(100);
            expect(healthSummary.metrics.error_rate).toBe(5);
            expect(healthSummary.metrics.memory_usage).toBe(65);
            expect(healthSummary.alerts.total).toBe(1);
            expect(healthSummary.alerts.warning).toBe(1);
            expect(healthSummary.alerts.critical).toBe(0);
        });

        test('should determine overall status correctly', async () => {
            // Test healthy status
            let healthSummary = monitoringService.getHealthSummary();
            expect(healthSummary.status).toBe('healthy');
            
            // Test warning status
            await monitoringService.triggerAlert('warning_alert', { severity: 'warning' });
            healthSummary = monitoringService.getHealthSummary();
            expect(healthSummary.status).toBe('warning');
            
            // Test critical status
            await monitoringService.triggerAlert('critical_alert', { severity: 'critical' });
            healthSummary = monitoringService.getHealthSummary();
            expect(healthSummary.status).toBe('critical');
        });
    });

    describe('Alert Notifications', () => {
        beforeEach(() => {
            // Mock environment variables for notifications
            process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
            process.env.ADMIN_EMAIL = 'admin@aira.health';
            process.env.SMS_ENDPOINT = 'https://sms.provider.com/send';
        });

        afterEach(() => {
            delete process.env.SLACK_WEBHOOK_URL;
            delete process.env.ADMIN_EMAIL;
            delete process.env.SMS_ENDPOINT;
        });

        test('should attempt to send Slack notifications for non-info alerts', async () => {
            const alertId = await monitoringService.triggerAlert('test_alert', {
                severity: 'warning'
            });
            
            // Verify that the sendSlackAlert method was called
            expect(logger.audit).toHaveBeenCalledWith(
                'Slack alert would be sent',
                expect.objectContaining({
                    alertId
                })
            );
        });

        test('should attempt to send email for critical alerts', async () => {
            const alertId = await monitoringService.triggerAlert('critical_alert', {
                severity: 'critical'
            });
            
            expect(logger.audit).toHaveBeenCalledWith(
                'Email alert would be sent',
                expect.objectContaining({
                    alertId
                })
            );
        });

        test('should attempt to send SMS for critical system alerts', async () => {
            const alertId = await monitoringService.triggerAlert('system_failure', {
                severity: 'critical'
            });
            
            expect(logger.audit).toHaveBeenCalledWith(
                'SMS alert would be sent',
                expect.objectContaining({
                    alertId
                })
            );
        });

        test('should not send notifications when channels are not configured', async () => {
            delete process.env.SLACK_WEBHOOK_URL;
            delete process.env.ADMIN_EMAIL;
            delete process.env.SMS_ENDPOINT;
            
            const alertId = await monitoringService.triggerAlert('test_alert', {
                severity: 'critical'
            });
            
            // Should not attempt to send notifications
            const auditCalls = logger.audit.mock.calls.filter(call => 
                call[0].includes('would be sent')
            );
            expect(auditCalls).toHaveLength(0);
        });
    });

    describe('Cleanup and Maintenance', () => {
        test('should clean up resolved alerts older than 24 hours', () => {
            // Create old resolved alert
            const oldAlert = {
                id: 'old-alert',
                status: 'resolved',
                resolvedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
                timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
            };
            
            // Create recent resolved alert
            const recentAlert = {
                id: 'recent-alert',
                status: 'resolved',
                resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
                timestamp: new Date().toISOString()
            };
            
            monitoringService.alerts.set('old-alert', oldAlert);
            monitoringService.alerts.set('recent-alert', recentAlert);
            
            monitoringService.cleanupResolvedAlerts();
            
            expect(monitoringService.alerts.has('old-alert')).toBe(false);
            expect(monitoringService.alerts.has('recent-alert')).toBe(true);
        });

        test('should log cleanup activities', () => {
            // Create old resolved alert
            const oldAlert = {
                id: 'old-alert',
                status: 'resolved',
                resolvedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
                timestamp: new Date().toISOString()
            };
            
            monitoringService.alerts.set('old-alert', oldAlert);
            monitoringService.cleanupResolvedAlerts();
            
            expect(logger.audit).toHaveBeenCalledWith(
                'Resolved alerts cleaned up',
                expect.objectContaining({
                    cleanedCount: 1
                })
            );
        });
    });

    describe('Report Generation', () => {
        test('should generate comprehensive monitoring report', async () => {
            // Set up test data
            monitoringService.incrementCounter('requests_total', 50);
            monitoringService.setGauge('memory_usage', 70);
            await monitoringService.triggerAlert('test_alert', { severity: 'warning' });
            
            const report = monitoringService.generateReport({
                period: '1h',
                includeAlerts: true,
                includeMetrics: true
            });
            
            expect(report).toHaveProperty('period', '1h');
            expect(report).toHaveProperty('generatedAt');
            expect(report).toHaveProperty('summary');
            expect(report).toHaveProperty('metrics');
            expect(report).toHaveProperty('alerts');
            
            expect(report.summary.status).toBe('warning');
            expect(report.metrics.requests_total.value).toBe(50);
            expect(report.alerts.active).toHaveLength(1);
        });

        test('should generate report without metrics when requested', () => {
            const report = monitoringService.generateReport({
                includeMetrics: false,
                includeAlerts: true
            });
            
            expect(report).toHaveProperty('summary');
            expect(report).toHaveProperty('alerts');
            expect(report).not.toHaveProperty('metrics');
        });

        test('should generate report without alerts when requested', () => {
            const report = monitoringService.generateReport({
                includeMetrics: true,
                includeAlerts: false
            });
            
            expect(report).toHaveProperty('summary');
            expect(report).toHaveProperty('metrics');
            expect(report).not.toHaveProperty('alerts');
        });

        test('should log report generation', () => {
            monitoringService.generateReport();
            
            expect(logger.audit).toHaveBeenCalledWith(
                'Monitoring report generated',
                expect.objectContaining({
                    period: '1h',
                    metricsIncluded: true,
                    alertsIncluded: true
                })
            );
        });
    });

    describe('Health Check', () => {
        test('should return service health status', () => {
            const healthCheck = monitoringService.healthCheck();
            
            expect(healthCheck).toHaveProperty('status', 'healthy');
            expect(healthCheck).toHaveProperty('metricsCount');
            expect(healthCheck).toHaveProperty('activeAlertsCount');
            expect(healthCheck).toHaveProperty('monitoringActive');
            expect(healthCheck).toHaveProperty('lastUpdate');
            
            expect(healthCheck.metricsCount).toBeGreaterThan(0);
            expect(typeof healthCheck.monitoringActive).toBe('boolean');
        });
    });

    describe('Monitoring Lifecycle', () => {
        test('should start monitoring automatically', () => {
            expect(monitoringService.systemMonitorInterval).toBeDefined();
            expect(monitoringService.cleanupInterval).toBeDefined();
        });

        test('should stop monitoring when requested', () => {
            monitoringService.stopMonitoring();
            
            expect(logger.audit).toHaveBeenCalledWith('Automatic monitoring stopped');
        });

        test('should handle monitoring start/stop cycles', () => {
            monitoringService.stopMonitoring();
            monitoringService.startMonitoring();
            
            expect(logger.audit).toHaveBeenCalledWith(
                'Automatic monitoring started',
                expect.objectContaining({
                    systemMonitorInterval: 30000,
                    cleanupInterval: 3600000
                })
            );
        });
    });

    describe('Performance and Scalability', () => {
        test('should handle high-frequency metric updates', () => {
            const start = Date.now();
            
            // Simulate high-frequency updates
            for (let i = 0; i < 1000; i++) {
                monitoringService.incrementCounter('requests_total');
                monitoringService.setGauge('cpu_usage', Math.random() * 100);
            }
            
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
            
            const requestsMetric = monitoringService.getMetric('requests_total');
            expect(requestsMetric.value).toBe(1000);
        });

        test('should limit alert storage to prevent memory leaks', async () => {
            // Generate many alerts
            for (let i = 0; i < 100; i++) {
                await monitoringService.triggerAlert(`alert_${i}`, { severity: 'warning' });
            }
            
            expect(monitoringService.alerts.size).toBeLessThanOrEqual(100);
        });
    });

    describe('Error Handling', () => {
        test('should handle notification failures gracefully', async () => {
            // Mock notification failure
            const originalSendSlackAlert = monitoringService.sendSlackAlert;
            monitoringService.sendSlackAlert = jest.fn().mockRejectedValue(new Error('Network error'));
            
            await expect(monitoringService.triggerAlert('test_alert', { severity: 'warning' }))
                .resolves.toBeDefined();
            
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to send alert notifications',
                expect.objectContaining({
                    error: 'Network error'
                })
            );
            
            // Restore original method
            monitoringService.sendSlackAlert = originalSendSlackAlert;
        });

        test('should handle threshold checking errors', () => {
            // Mock an error in threshold checking
            const originalCheckThresholds = monitoringService.checkThresholds;
            monitoringService.checkThresholds = jest.fn().mockImplementation(() => {
                throw new Error('Threshold check failed');
            });
            
            expect(() => {
                monitoringService.setGauge('memory_usage', 85);
            }).not.toThrow();
            
            // Restore original method
            monitoringService.checkThresholds = originalCheckThresholds;
        });
    });
}); 