#!/usr/bin/env node
/**
 * AIRA MEDICAL BOT - HIPAA COMPLIANCE & BREACH DETECTION REPORT
 * 
 * Comprehensive HIPAA compliance validation and breach detection
 * Generates detailed compliance reports for medical data protection
 * 
 * Usage:
 *   node scripts/hipaa-compliance-report.js
 *   node scripts/hipaa-compliance-report.js --validate
 *   node scripts/hipaa-compliance-report.js --breach-detection
 *   node scripts/hipaa-compliance-report.js --audit-report
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Report configuration
const CONFIG = {
    reportDir: './reports/hipaa-compliance',
    auditLogPath: './logs/audit.log',
    securityLogPath: './logs/security.log',
    complianceLogPath: './logs/compliance.log',
    reportRetentionDays: 2555 // 7 years HIPAA requirement
};

// ANSI colors
const colors = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    bold: '\x1b[1m',
    reset: '\x1b[0m'
};

class HIPAAComplianceChecker {
    constructor() {
        this.requirements = {
            // Administrative Safeguards
            administrative: {
                securityOfficer: 'Security officer designated',
                policies: 'Security policies and procedures documented',
                training: 'Workforce security training program',
                accessManagement: 'Information access management',
                contingencyPlanning: 'Contingency planning'
            },
            
            // Physical Safeguards
            physical: {
                facilityAccess: 'Facility access controls',
                workstationSecurity: 'Workstation security',
                deviceSecurity: 'Device and media controls',
                disposal: 'Media disposal and reuse'
            },
            
            // Technical Safeguards
            technical: {
                accessControl: 'Access control mechanisms',
                auditControls: 'Audit controls',
                integrity: 'Data integrity protection',
                transmission: 'Transmission security (encryption)',
                authentication: 'Entity authentication'
            },
            
            // Breach Notification
            breachNotification: {
                procedures: 'Breach notification procedures',
                timeline: 'Notification within 60 days',
                documentation: 'Breach documentation',
                individualNotification: 'Individual notification process'
            }
        };
        
        this.complianceScore = {
            administrative: 0,
            physical: 0,
            technical: 0,
            breachNotification: 0,
            overall: 0
        };
    }
    
    // Check administrative safeguards
    checkAdministrativeSafeguards() {
        const results = {
            category: 'Administrative Safeguards',
            checks: [],
            score: 0,
            maxScore: Object.keys(this.requirements.administrative).length
        };
        
        // Security Officer
        results.checks.push({
            requirement: 'Security Officer Designated',
            check: 'SECURITY_OFFICER_EMAIL' in process.env,
            status: process.env.SECURITY_OFFICER_EMAIL ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: process.env.SECURITY_OFFICER_EMAIL || 'Security officer not designated',
            risk: 'HIGH'
        });
        
        // Security Policies
        results.checks.push({
            requirement: 'Security Policies Documented',
            check: fs.existsSync('./docs/security/security-policies.md'),
            status: fs.existsSync('./docs/security/security-policies.md') ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Security policies documentation',
            risk: 'HIGH'
        });
        
        // Workforce Training
        results.checks.push({
            requirement: 'Workforce Security Training',
            check: process.env.SECURITY_TRAINING_ENABLED === 'true',
            status: process.env.SECURITY_TRAINING_ENABLED === 'true' ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Security training program for employees',
            risk: 'MEDIUM'
        });
        
        // Access Management
        results.checks.push({
            requirement: 'Information Access Management',
            check: process.env.ACCESS_MANAGEMENT_ENABLED === 'true',
            status: process.env.ACCESS_MANAGEMENT_ENABLED === 'true' ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Role-based access control implemented',
            risk: 'HIGH'
        });
        
        // Contingency Planning
        results.checks.push({
            requirement: 'Contingency Planning',
            check: fs.existsSync('./docs/ops/disaster-recovery.md'),
            status: fs.existsSync('./docs/ops/disaster-recovery.md') ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Disaster recovery and backup procedures',
            risk: 'HIGH'
        });
        
        results.score = results.checks.filter(c => c.status === 'COMPLIANT').length;
        this.complianceScore.administrative = (results.score / results.maxScore) * 100;
        
        return results;
    }
    
    // Check technical safeguards
    checkTechnicalSafeguards() {
        const results = {
            category: 'Technical Safeguards',
            checks: [],
            score: 0,
            maxScore: Object.keys(this.requirements.technical).length
        };
        
        // Access Control
        results.checks.push({
            requirement: 'Access Control Mechanisms',
            check: process.env.REQUIRE_AUTH === 'true',
            status: process.env.REQUIRE_AUTH === 'true' ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Unique user identification and access controls',
            risk: 'CRITICAL'
        });
        
        // Audit Controls
        results.checks.push({
            requirement: 'Audit Controls',
            check: process.env.AUDIT_LOG_ENABLED === 'true',
            status: process.env.AUDIT_LOG_ENABLED === 'true' ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Comprehensive audit logging system',
            risk: 'CRITICAL'
        });
        
        // Data Integrity
        results.checks.push({
            requirement: 'Data Integrity Protection',
            check: process.env.DATA_INTEGRITY_CHECKS === 'true',
            status: process.env.DATA_INTEGRITY_CHECKS === 'true' ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Data integrity validation mechanisms',
            risk: 'HIGH'
        });
        
        // Transmission Security (Encryption)
        results.checks.push({
            requirement: 'Transmission Security',
            check: process.env.ENCRYPTION_SECRET && process.env.ENCRYPTION_SECRET.length >= 32,
            status: (process.env.ENCRYPTION_SECRET && process.env.ENCRYPTION_SECRET.length >= 32) ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'End-to-end encryption for PHI transmission',
            risk: 'CRITICAL'
        });
        
        // Entity Authentication
        results.checks.push({
            requirement: 'Entity Authentication',
            check: process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
            status: (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Secure authentication mechanisms',
            risk: 'CRITICAL'
        });
        
        results.score = results.checks.filter(c => c.status === 'COMPLIANT').length;
        this.complianceScore.technical = (results.score / results.maxScore) * 100;
        
        return results;
    }
    
    // Check physical safeguards (simplified for software system)
    checkPhysicalSafeguards() {
        const results = {
            category: 'Physical Safeguards',
            checks: [],
            score: 0,
            maxScore: Object.keys(this.requirements.physical).length
        };
        
        // For software systems, physical safeguards relate to hosting infrastructure
        
        results.checks.push({
            requirement: 'Facility Access Controls',
            check: process.env.HOSTING_SECURITY_REVIEW === 'true',
            status: process.env.HOSTING_SECURITY_REVIEW === 'true' ? 'COMPLIANT' : 'PARTIAL_COMPLIANT',
            details: 'Cloud provider physical security controls',
            risk: 'MEDIUM'
        });
        
        results.checks.push({
            requirement: 'Workstation Security',
            check: process.env.WORKSTATION_SECURITY_POLICY === 'true',
            status: process.env.WORKSTATION_SECURITY_POLICY === 'true' ? 'COMPLIANT' : 'PARTIAL_COMPLIANT',
            details: 'Endpoint security policies for developers',
            risk: 'MEDIUM'
        });
        
        results.checks.push({
            requirement: 'Device and Media Controls',
            check: process.env.DEVICE_SECURITY_POLICY === 'true',
            status: process.env.DEVICE_SECURITY_POLICY === 'true' ? 'COMPLIANT' : 'PARTIAL_COMPLIANT',
            details: 'Mobile device and media security',
            risk: 'MEDIUM'
        });
        
        results.checks.push({
            requirement: 'Media Disposal and Reuse',
            check: process.env.DATA_DISPOSAL_POLICY === 'true',
            status: process.env.DATA_DISPOSAL_POLICY === 'true' ? 'COMPLIANT' : 'PARTIAL_COMPLIANT',
            details: 'Secure data disposal procedures',
            risk: 'MEDIUM'
        });
        
        results.score = results.checks.filter(c => c.status === 'COMPLIANT').length;
        this.complianceScore.physical = (results.score / results.maxScore) * 100;
        
        return results;
    }
    
    // Check breach notification requirements
    checkBreachNotification() {
        const results = {
            category: 'Breach Notification',
            checks: [],
            score: 0,
            maxScore: Object.keys(this.requirements.breachNotification).length
        };
        
        results.checks.push({
            requirement: 'Breach Notification Procedures',
            check: fs.existsSync('./docs/security/breach-notification-procedures.md'),
            status: fs.existsSync('./docs/security/breach-notification-procedures.md') ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Documented breach notification procedures',
            risk: 'HIGH'
        });
        
        results.checks.push({
            requirement: 'Notification Timeline',
            check: process.env.BREACH_NOTIFICATION_TIMELINE_DAYS <= 60,
            status: (parseInt(process.env.BREACH_NOTIFICATION_TIMELINE_DAYS) || 60) <= 60 ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: `Notification timeline: ${process.env.BREACH_NOTIFICATION_TIMELINE_DAYS || 60} days`,
            risk: 'HIGH'
        });
        
        results.checks.push({
            requirement: 'Breach Documentation',
            check: process.env.BREACH_DOCUMENTATION_REQUIRED === 'true',
            status: process.env.BREACH_DOCUMENTATION_REQUIRED === 'true' ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Comprehensive breach documentation process',
            risk: 'MEDIUM'
        });
        
        results.checks.push({
            requirement: 'Individual Notification Process',
            check: process.env.BREACH_INDIVIDUAL_NOTIFICATION === 'true',
            status: process.env.BREACH_INDIVIDUAL_NOTIFICATION === 'true' ? 'COMPLIANT' : 'NON_COMPLIANT',
            details: 'Process for notifying affected individuals',
            risk: 'HIGH'
        });
        
        results.score = results.checks.filter(c => c.status === 'COMPLIANT').length;
        this.complianceScore.breachNotification = (results.score / results.maxScore) * 100;
        
        return results;
    }
    
    // Calculate overall compliance score
    calculateOverallCompliance() {
        const categories = [
            { score: this.complianceScore.administrative, weight: 25 },
            { score: this.complianceScore.physical, weight: 20 },
            { score: this.complianceScore.technical, weight: 40 },
            { score: this.complianceScore.breachNotification, weight: 15 }
        ];
        
        let weightedSum = 0;
        let totalWeight = 0;
        
        categories.forEach(category => {
            weightedSum += (category.score * category.weight);
            totalWeight += category.weight;
        });
        
        this.complianceScore.overall = Math.round(weightedSum / totalWeight);
        return this.complianceScore.overall;
    }
    
    // Generate compliance level
    getComplianceLevel(score) {
        if (score >= 95) return 'EXCELLENT';
        if (score >= 85) return 'GOOD';
        if (score >= 70) return 'NEEDS_IMPROVEMENT';
        if (score >= 50) return 'SIGNIFICANT_GAPS';
        return 'CRITICAL_NON_COMPLIANCE';
    }
    
    // Generate recommendations
    generateRecommendations(results) {
        const recommendations = [];
        
        results.forEach(categoryResult => {
            categoryResult.checks.forEach(check => {
                if (check.status !== 'COMPLIANT') {
                    recommendations.push({
                        category: categoryResult.category,
                        requirement: check.requirement,
                        risk: check.risk,
                        recommendation: this.getRecommendation(check.requirement),
                        priority: this.getPriority(check.risk)
                    });
                }
            });
        });
        
        return recommendations.sort((a, b) => {
            const priorityOrder = { 'CRITICAL': 1, 'HIGH': 2, 'MEDIUM': 3, 'LOW': 4 };
            return priorityOrder[a.risk] - priorityOrder[b.risk];
        });
    }
    
    getRecommendation(requirement) {
        const recommendations = {
            'Access Control Mechanisms': 'Implement mandatory authentication for all PHI access',
            'Audit Controls': 'Enable comprehensive audit logging for all system activities',
            'Data Integrity Protection': 'Implement data integrity checks and validation',
            'Transmission Security': 'Ensure all PHI is encrypted in transit using AES-256',
            'Entity Authentication': 'Implement strong multi-factor authentication',
            'Security Officer Designated': 'Designate a security officer with appropriate authority',
            'Security Policies Documented': 'Create comprehensive security policies and procedures',
            'Breach Notification Procedures': 'Document breach notification procedures per HIPAA requirements',
            'Individual Notification Process': 'Establish process for notifying affected individuals'
        };
        
        return recommendations[requirement] || 'Address HIPAA compliance requirements';
    }
    
    getPriority(risk) {
        return { 'CRITICAL': 1, 'HIGH': 2, 'MEDIUM': 3, 'LOW': 4 }[risk] || 3;
    }
}

class BreachDetector {
    constructor() {
        this.breachIndicators = [
            'AUTH_BYPASS_ATTEMPT',
            'INJECTION_ATTACK',
            'XSS_ATTEMPT',
            'UNAUTHORIZED_PHI_ACCESS',
            'DATA_EXFILTRATION',
            'PRIVILEGE_ESCALATION',
            'MASSIVE_DATA_ACCESS',
            'UNUSUAL_LOGIN_PATTERN',
            'MULTIPLE_FAILED_ATTEMPTS',
            'SENSITIVE_FILE_ACCESS'
        ];
        
        this.breachThresholds = {
            criticalEvents: 1, // Any critical event is potential breach
            highEvents: 5, // 5+ high severity events
            mediumEvents: 20, // 20+ medium severity events
            failedAuths: 50, // 50+ failed authentications
            unusualPatterns: 3 // 3+ unusual access patterns
        };
    }
    
    // Analyze security logs for breach indicators
    analyzeSecurityLogs() {
        const analysis = {
            timestamp: new Date().toISOString(),
            totalEvents: 0,
            criticalEvents: 0,
            highEvents: 0,
            mediumEvents: 0,
            suspiciousPatterns: [],
            potentialBreaches: [],
            riskLevel: 'LOW'
        };
        
        try {
            // In a real implementation, this would parse actual log files
            // For now, simulate based on environment and known issues
            
            // Check for critical security issues
            if (process.env.REQUIRE_AUTH !== 'true') {
                analysis.criticalEvents++;
                analysis.suspiciousPatterns.push({
                    type: 'AUTH_DISABLED',
                    description: 'Authentication is not required',
                    severity: 'CRITICAL',
                    riskScore: 10
                });
            }
            
            // Check for weak secrets
            if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
                analysis.highEvents++;
                analysis.suspiciousPatterns.push({
                    type: 'WEAK_JWT_SECRET',
                    description: 'JWT secret is too short',
                    severity: 'HIGH',
                    riskScore: 8
                });
            }
            
            // Check for missing encryption
            if (!process.env.ENCRYPTION_SECRET) {
                analysis.criticalEvents++;
                analysis.suspiciousPatterns.push({
                    type: 'NO_ENCRYPTION',
                    description: 'PHI encryption is not configured',
                    severity: 'CRITICAL',
                    riskScore: 10
                });
            }
            
            // Check audit logging
            if (process.env.AUDIT_LOG_ENABLED !== 'true') {
                analysis.highEvents++;
                analysis.suspiciousPatterns.push({
                    type: 'NO_AUDIT_LOGGING',
                    description: 'Audit logging is not enabled',
                    severity: 'HIGH',
                    riskScore: 7
                });
            }
            
            analysis.totalEvents = analysis.criticalEvents + analysis.highEvents + analysis.mediumEvents;
            
            // Determine risk level
            if (analysis.criticalEvents >= this.breachThresholds.criticalEvents ||
                analysis.highEvents >= this.breachThresholds.highEvents) {
                analysis.riskLevel = 'CRITICAL';
                analysis.potentialBreaches.push('High security risk detected - immediate investigation required');
            } else if (analysis.highEvents >= 2) {
                analysis.riskLevel = 'HIGH';
                analysis.potentialBreaches.push('Multiple high-risk security issues identified');
            } else if (analysis.totalEvents >= 5) {
                analysis.riskLevel = 'MEDIUM';
            }
            
        } catch (error) {
            analysis.error = `Breach detection analysis failed: ${error.message}`;
        }
        
        return analysis;
    }
    
    // Generate breach alert
    generateBreachAlert(analysis) {
        if (analysis.riskLevel === 'CRITICAL') {
            return {
                timestamp: new Date().toISOString(),
                alertType: 'POTENTIAL_BREACH',
                severity: 'CRITICAL',
                description: 'Critical security vulnerabilities detected that could result in PHI breach',
                indicators: analysis.suspiciousPatterns,
                immediateActions: [
                    'IMMEDIATELY investigate all security issues',
                    'Consider system lockdown until issues are resolved',
                    'Notify security officer and compliance team',
                    'Document all findings and actions taken',
                    'Prepare breach notification process if PHI exposure confirmed'
                ],
                notificationRequired: true
            };
        } else if (analysis.riskLevel === 'HIGH') {
            return {
                timestamp: new Date().toISOString(),
                alertType: 'SECURITY_RISK',
                severity: 'HIGH',
                description: 'High-risk security issues identified requiring immediate attention',
                indicators: analysis.suspiciousPatterns,
                immediateActions: [
                    'Address high-risk security issues within 24 hours',
                    'Implement additional monitoring',
                    'Review access logs for unusual activity'
                ],
                notificationRequired: false
            };
        }
        
        return null;
    }
}

// Main report generation
function generateComplianceReport() {
    console.log(colors.bold + colors.cyan + 'AIRA MEDICAL BOT - HIPAA COMPLIANCE REPORT' + colors.reset);
    console.log(colors.cyan + 'Comprehensive HIPAA Compliance Assessment' + colors.reset);
    console.log(colors.gray + `Generated: ${new Date().toISOString()}` + colors.reset);
    console.log(colors.gray + '=' .repeat(60) + colors.reset + '\n');
    
    // Load environment
    require('dotenv').config();
    
    const checker = new HIPAAComplianceChecker();
    const detector = new BreachDetector();
    
    // Run all compliance checks
    const administrativeResults = checker.checkAdministrativeSafeguards();
    const technicalResults = checker.checkTechnicalSafeguards();
    const physicalResults = checker.checkPhysicalSafeguards();
    const breachResults = checker.checkBreachNotification();
    
    const allResults = [administrativeResults, technicalResults, physicalResults, breachResults];
    
    // Calculate overall compliance
    const overallScore = checker.calculateOverallCompliance();
    const complianceLevel = checker.getComplianceLevel(overallScore);
    
    // Run breach detection
    const breachAnalysis = detector.analyzeSecurityLogs();
    const breachAlert = detector.generateBreachAlert(breachAnalysis);
    
    // Generate recommendations
    const recommendations = checker.generateRecommendations(allResults);
    
    // Create comprehensive report
    const report = {
        metadata: {
            timestamp: new Date().toISOString(),
            reportType: 'HIPAA_COMPLIANCE_ASSESSMENT',
            version: '1.0',
            systemName: 'AIRA Medical Bot'
        },
        
        executiveSummary: {
            overallComplianceScore: overallScore,
            complianceLevel: complianceLevel,
            riskLevel: breachAnalysis.riskLevel,
            totalChecks: allResults.reduce((sum, r) => sum + r.maxScore, 0),
            passedChecks: allResults.reduce((sum, r) => sum + r.score, 0),
            criticalIssues: allResults.reduce((sum, r) => 
                sum + r.checks.filter(c => c.risk === 'CRITICAL' && c.status !== 'COMPLIANT').length, 0),
            highIssues: allResults.reduce((sum, r) => 
                sum + r.checks.filter(c => c.risk === 'HIGH' && c.status !== 'COMPLIANT').length, 0)
        },
        
        complianceAssessment: {
            administrative: administrativeResults,
            technical: technicalResults,
            physical: physicalResults,
            breachNotification: breachResults
        },
        
        breachDetection: breachAnalysis,
        breachAlert: breachAlert,
        
        recommendations: recommendations,
        
        nextSteps: {
            immediate: recommendations.filter(r => r.priority === 1).map(r => r.recommendation),
            shortTerm: recommendations.filter(r => r.priority === 2).map(r => r.recommendation),
            longTerm: recommendations.filter(r => r.priority >= 3).map(r => r.recommendation)
        },
        
        appendix: {
            hipaaRequirements: checker.requirements,
            complianceScores: checker.complianceScore,
            breachThresholds: detector.breachThresholds
        }
    };
    
    // Save report
    if (!fs.existsSync(CONFIG.reportDir)) {
        fs.mkdirSync(CONFIG.reportDir, { recursive: true });
    }
    
    const reportFile = path.join(CONFIG.reportDir, `hipaa-compliance-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Display summary
    console.log(colors.white + colors.bold + 'COMPLIANCE SUMMARY:' + colors.reset);
    console.log(`Overall Score: ${getScoreColor(overallScore)}${overallScore}%${colors.reset} (${getComplianceColor(complianceLevel)}${complianceLevel}${colors.reset})`);
    console.log(`Risk Level: ${getRiskColor(breachAnalysis.riskLevel)}${breachAnalysis.riskLevel}${colors.reset}`);
    
    console.log('\n' + colors.white + colors.bold + 'CATEGORY BREAKDOWN:' + colors.reset);
    allResults.forEach(result => {
        const percentage = Math.round((result.score / result.maxScore) * 100);
        const color = percentage >= 80 ? colors.green : (percentage >= 60 ? colors.yellow : colors.red);
        console.log(`${result.category}: ${color}${percentage}%${colors.reset} (${result.score}/${result.maxScore})`);
    });
    
    // Critical issues
    const criticalIssues = allResults.flatMap(r => 
        r.checks.filter(c => c.risk === 'CRITICAL' && c.status !== 'COMPLIANT')
    );
    
    if (criticalIssues.length > 0) {
        console.log('\n' + colors.red + colors.bold + '🚨 CRITICAL COMPLIANCE ISSUES 🚨' + colors.reset);
        criticalIssues.forEach((issue, index) => {
            console.log(`${colors.red}${index + 1}. ${issue.requirement}${colors.reset}`);
            console.log(`   ${colors.gray}${issue.details}${colors.reset}`);
        });
    }
    
    // High priority recommendations
    const highPriorityRecs = recommendations.filter(r => r.priority <= 2);
    if (highPriorityRecs.length > 0) {
        console.log('\n' + colors.yellow + colors.bold + 'HIGH PRIORITY RECOMMENDATIONS:' + colors.reset);
        highPriorityRecs.slice(0, 5).forEach((rec, index) => {
            console.log(`${colors.yellow}${index + 1}. ${rec.recommendation}${colors.reset}`);
        });
    }
    
    // Breach alert
    if (breachAlert) {
        console.log('\n' + colors.red + colors.bold + '⚠️  SECURITY ALERT ⚠️' + colors.reset);
        console.log(`${colors.red}${breachAlert.description}${colors.reset}`);
        if (breachAlert.notificationRequired) {
            console.log(colors.red + colors.bold + 'IMMEDIATE NOTIFICATION REQUIRED' + colors.reset);
        }
    }
    
    console.log(`\n${colors.cyan}Report saved to: ${reportFile}${colors.reset}`);
    
    return report;
}

function getScoreColor(score) {
    if (score >= 90) return colors.green;
    if (score >= 70) return colors.yellow;
    return colors.red;
}

function getComplianceColor(level) {
    switch (level) {
        case 'EXCELLENT': return colors.green;
        case 'GOOD': return colors.blue;
        case 'NEEDS_IMPROVEMENT': return colors.yellow;
        case 'SIGNIFICANT_GAPS': return colors.orange;
        case 'CRITICAL_NON_COMPLIANCE': return colors.red;
        default: return colors.white;
    }
}

function getRiskColor(risk) {
    switch (risk) {
        case 'LOW': return colors.green;
        case 'MEDIUM': return colors.yellow;
        case 'HIGH': return colors.orange;
        case 'CRITICAL': return colors.red;
        default: return colors.white;
    }
}

// Main execution
function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help')) {
        console.log(colors.cyan + 'AIRA Medical Bot - HIPAA Compliance Reporter' + colors.reset);
        console.log('Usage: node scripts/hipaa-compliance-report.js [options]\n');
        console.log('Options:');
        console.log('  --validate       Validate HIPAA compliance');
        console.log('  --breach-detection Run breach detection analysis');
        console.log('  --audit-report   Generate audit compliance report');
        console.log('  --help           Show this help message\n');
        return;
    }
    
    try {
        // Load environment
        require('dotenv').config();
        
        if (args.includes('--validate')) {
            generateComplianceReport();
        } else if (args.includes('--breach-detection')) {
            const detector = new BreachDetector();
            const analysis = detector.analyzeSecurityLogs();
            console.log('Breach Detection Analysis:', JSON.stringify(analysis, null, 2));
        } else if (args.includes('--audit-report')) {
            console.log('Audit report generation - feature coming soon');
        } else {
            // Default: generate full compliance report
            const report = generateComplianceReport();
            
            // Exit with appropriate code based on compliance level
            if (report.executiveSummary.complianceLevel === 'CRITICAL_NON_COMPLIANCE' ||
                report.breachDetection.riskLevel === 'CRITICAL') {
                console.log('\n' + colors.red + colors.bold + '🚨 CRITICAL COMPLIANCE ISSUES DETECTED 🚨' + colors.reset);
                console.log(colors.red + 'IMMEDIATE ACTION REQUIRED FOR HIPAA COMPLIANCE' + colors.reset);
                process.exit(1);
            } else if (report.executiveSummary.overallComplianceScore < 80) {
                console.log('\n' + colors.yellow + colors.bold + '⚠️  COMPLIANCE IMPROVEMENT NEEDED ⚠️' + colors.reset);
                console.log(colors.yellow + 'Address compliance issues before production deployment' + colors.reset);
                process.exit(2);
            } else {
                console.log('\n' + colors.green + colors.bold + '✅ HIPAA COMPLIANCE ASSESSMENT COMPLETED ✅' + colors.reset);
                console.log(colors.green + 'System demonstrates good HIPAA compliance posture' + colors.reset);
                process.exit(0);
            }
        }
        
    } catch (error) {
        console.error(colors.red + colors.bold + 'HIPAA COMPLIANCE ERROR:' + colors.reset, error);
        console.error(colors.red + 'Unable to complete compliance assessment' + colors.reset);
        process.exit(3);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    HIPAAComplianceChecker,
    BreachDetector,
    generateComplianceReport
};