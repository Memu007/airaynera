# 🔐 Security Testing Framework
## Medical Compliance & Security Validation Tools

This directory contains comprehensive security testing and HIPAA compliance validation tools for the AIRA medical bot system.

---

## 📋 Available Tools

### 1. Comprehensive Security Audit (`comprehensive-security-audit.js`)

**Purpose**: Complete security assessment including penetration testing, vulnerability scanning, and HIPAA compliance validation.

**Usage**:
```bash
node security-tests/comprehensive-security-audit.js
```

**Features**:
- ✅ Security configuration validation
- ✅ Penetration testing (auth bypass, authorization flaws, session management)
- ✅ Vulnerability scanning (XSS, injection, CSRF, file uploads)
- ✅ HIPAA compliance validation
- ✅ Detailed reporting with recommendations

**Output**: 
- Console results during execution
- JSON report file: `security-audit-report-[timestamp].json`

---

### 2. Vulnerability Scanner (`vulnerability-scanner.js`)

**Purpose**: Focused OWASP Top 10 vulnerability assessment with healthcare-specific security testing.

**Usage**:
```bash
node security-tests/vulnerability-scanner.js
```

**Features**:
- ✅ OWASP Top 10 vulnerability scanning
- ✅ Healthcare-specific vulnerability assessment
- ✅ PHI exposure risk analysis
- ✅ Security misconfiguration detection

**Output**:
- Console results during execution
- JSON report file: `vulnerability-scan-report-[timestamp].json`

---

### 3. HIPAA Compliance Validator (`hipaa-compliance-validator.js`)

**Purpose**: Comprehensive HIPAA Security Rule and Privacy Rule compliance validation.

**Usage**:
```bash
node security-tests/hipaa-compliance-validator.js
```

**Features**:
- ✅ HIPAA Security Rule (164.312) validation
- ✅ HIPAA Privacy Rule (164.502) assessment
- ✅ Breach Notification Rule (164.308) validation
- ✅ Organizational requirements assessment
- ✅ Policies and procedures review

**Output**:
- Console results during execution
- JSON report file: `hipaa-compliance-report-[timestamp].json`

---

## 🚀 Quick Start

### Prerequisites

Install required dependencies:
```bash
npm install axios
```

### Environment Configuration

Set the target system URL:
```bash
export TEST_BASE_URL="http://localhost:3000"
# or
export TEST_BASE_URL="https://your-production-url.com"
```

### Running All Security Tests

Execute all security validation tools:
```bash
# Run comprehensive security audit
node security-tests/comprehensive-security-audit.js

# Run vulnerability scanner
node security-tests/vulnerability-scanner.js

# Run HIPAA compliance validation
node security-tests/hipaa-compliance-validator.js
```

---

## 📊 Understanding Results

### Security Score Interpretation

| Score Range | Status | Meaning |
|-------------|---------|---------|
| 90-100% | ✅ EXCELLENT | Strong security posture |
| 80-89% | ✅ GOOD | Minor improvements needed |
| 70-79% | ⚠️ FAIR | Security improvements required |
| 60-69% | 🔴 POOR | Significant security issues |
| <60% | 🚨 CRITICAL | Security failure - immediate action required |

### HIPAA Compliance Status

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| FULLY_COMPLIANT | Meets all HIPAA requirements | Maintain compliance |
| SUBSTANTIALLY_COMPLIANT | Meets most requirements | Minor gaps to address |
| PARTIALLY_COMPLIANT | Meets some requirements | Significant work needed |
| NON_COMPLIANT | Does not meet requirements | Immediate remediation required |

### Risk Levels

| Risk Level | Action Required | Timeline |
|------------|-----------------|----------|
| CRITICAL | Immediate action required | 24-48 hours |
| HIGH | Urgent action required | 1 week |
| MEDIUM | Planned action required | 2-4 weeks |
| LOW | Routine maintenance | 1-3 months |

---

## 🎯 Common Security Issues Found

### Critical Issues (Immediate Action Required)

1. **Missing Environment Variables**
   - `JWT_SECRET` not configured
   - `ENCRYPTION_KEY` not configured
   - `REQUIRE_AUTH` not set to `true`

2. **Broken Encryption**
   - AES-256-GCM encryption not working
   - PHI stored in plaintext
   - Missing encryption keys

3. **Authentication Failures**
   - Authentication not enforced
   - Missing JWT implementation
   - No rate limiting on auth endpoints

### High Priority Issues

1. **Insufficient Audit Logging**
   - Missing required audit fields
   - No log integrity protection
   - No automated audit review

2. **Access Control Gaps**
   - No automatic session timeout
   - Missing emergency access procedures
   - Incomplete role-based access control

3. **Security Misconfigurations**
   - HTTPS not required
   - CORS not properly configured
   - Missing security headers

---

## 🔧 Fixing Common Issues

### 1. Configure Required Environment Variables

Create `.env` file with required security variables:
```bash
# Authentication (CRITICAL)
REQUIRE_AUTH=true
JWT_SECRET=<64_character_secure_random_string>
JWT_REFRESH_SECRET=<different_64_character_secure_string>
SESSION_TIMEOUT=3600

# Encryption (CRITICAL)
ENCRYPTION_KEY=<32_character_secure_random_string>
MASTER_KEY=<32_character_secure_random_string>
DATA_KEY=<32_character_secure_random_string>

# Security Headers
REQUIRE_HTTPS=true
CORS_ORIGINS=<production_domain>
CSP_MODE=strict

# Monitoring
SECURITY_OFFICER=<email_address>
ALERT_EMAIL=<alert_email_address>
AUDIT_LOG_ENABLED=true
```

### 2. Generate Secure Secrets

Use OpenSSL to generate secure secrets:
```bash
# Generate JWT secrets (64 characters)
openssl rand -base64 64

# Generate encryption keys (32 characters)
openssl rand -base64 32
```

### 3. Install Missing Dependencies

```bash
npm install jsonwebtoken bcrypt
```

### 4. Enable Security Headers

Add to your server configuration:
```javascript
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  }
}));
```

---

## 📈 Continuous Security Monitoring

### Daily Checks

1. **Review Security Logs**
   ```bash
   tail -f logs/audit.log | grep "ERROR\|WARNING"
   ```

2. **Monitor Authentication Failures**
   ```bash
   grep "auth.*fail" logs/combined.log | tail -20
   ```

3. **Check System Health**
   ```bash
   node security-tests/comprehensive-security-audit.js | grep "Overall Security Score"
   ```

### Weekly Security Tasks

1. Run full vulnerability scan
2. Review audit logs for anomalies
3. Check for security updates
4. Validate backup integrity

### Monthly Security Reviews

1. Complete HIPAA compliance validation
2. Update security policies
3. Review access controls
4. Conduct security training

---

## 🚨 Incident Response

### Security Incident Categories

| Category | Response Time | Examples |
|----------|---------------|----------|
| CRITICAL | 1 hour | System compromise, PHI breach |
| HIGH | 4 hours | Security control failure |
| MEDIUM | 24 hours | Suspicious activity |
| LOW | 72 hours | Policy violation |

### Breach Notification Timeline

1. **Detection**: Immediately
2. **Assessment**: 1 hour
3. **Confirmation**: 24 hours
4. **Internal Notification**: 24 hours
5. **External Notification**: 60 days (per HIPAA)

---

## 📞 Support & Contacts

### Security Team
- **Security Officer**: [Designate contact]
- **Incident Response**: [Designate team]
- **Compliance Officer**: [Designate contact]

### Emergency Contacts
- **Critical Incidents**: [24/7 contact]
- **HIPAA Breach**: [Legal counsel]
- **Regulatory**: [HHS OCR contact]

---

## 📚 Additional Resources

### Security Frameworks
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

### Tools & Libraries
- [Helmet.js](https://helmetjs.github.io/) - Security headers
- [bcrypt](https://www.npmjs.com/package/bcrypt) - Password hashing
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) - JWT implementation
- [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) - Rate limiting

### Documentation
- See `COMPREHENSIVE-SECURITY-AUDIT-REPORT.md` for detailed findings
- See individual JSON reports for technical details
- Review OWASP testing guides for manual testing procedures

---

## 🔄 Automated Testing Integration

### CI/CD Pipeline Integration

Add to your CI/CD pipeline:
```yaml
# Example GitHub Actions
- name: Run Security Audit
  run: |
    npm install axios
    node security-tests/comprehensive-security-audit.js
    
- name: Run Vulnerability Scanner
  run: |
    node security-tests/vulnerability-scanner.js
    
- name: Validate HIPAA Compliance
  run: |
    node security-tests/hipaa-compliance-validator.js
```

### Pre-Deployment Checklist

- [ ] All critical environment variables configured
- [ ] Authentication system functional
- [ ] AES-256-GCM encryption working
- [ ] Security audit score > 80%
- [ ] HIPAA compliance score > 70%
- [ ] No critical vulnerabilities
- [ ] Rate limiting implemented
- [ ] Security headers configured
- [ ] HTTPS enforced
- [ ] Audit logging functional

---

**Last Updated**: October 26, 2025  
**Maintained By**: Medical Compliance & Security Validation Team  
**Version**: 1.0  

---

⚠️ **IMPORTANT**: These tools are designed for security testing and should only be used on systems you own or have explicit permission to test. Unauthorized security testing is illegal and unethical.