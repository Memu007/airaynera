#!/usr/bin/env node

/**
 * SECURITY DEPLOYMENT VALIDATION - AIRA Medical Bot
 * 
 * Script OBLIGATORIO antes de cualquier producción
 * Valida que toda la configuración de seguridad esté correcta
 * 
 * USO: node scripts/security-deployment-check.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔒 AIRA Medical Bot - Security Deployment Validation');
console.log('='.repeat(60));

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(level, message) {
  const color = colors[level] || colors.reset;
  console.log(`${color}${message}${colors.reset}`);
}

// Check if .env file exists
function checkEnvFile() {
  log('blue', '\n📁 Checking .env file...');
  
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    log('red', '❌ .env file not found!');
    log('yellow', '📝 Copy .env.secure.template to .env and configure it');
    return false;
  }
  
  log('green', '✅ .env file exists');
  return true;
}

// Validate critical security variables
function validateSecurityVars() {
  log('blue', '\n🔐 Validating security configuration...');
  
  const requiredVars = [
    'JWT_SECRET',
    'ENCRYPTION_SECRET', 
    'SESSION_SECRET',
    'REQUIRE_AUTH',
    'HIPAA_MODE',
    'AUDIT_LOG_ENABLED'
  ];
  
  const missing = [];
  const weak = [];
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    
    if (!value) {
      missing.push(varName);
      continue;
    }
    
    // Check for weak/placeholder values
    const weakPatterns = [
      /test/i, /demo/i, /example/i, /sample/i, /temp/i, /default/i,
      /your-.*-here/, /change.*this/, /placeholder/i, /dummy/i
    ];
    
    for (const pattern of weakPatterns) {
      if (pattern.test(value)) {
        weak.push(varName);
        break;
      }
    }
  }
  
  if (missing.length > 0) {
    log('red', `❌ Missing required variables: ${missing.join(', ')}`);
    return false;
  }
  
  if (weak.length > 0) {
    log('yellow', `⚠️  Weak/placeholder values detected: ${weak.join(', ')}`);
    return false;
  }
  
  // Validate specific values
  if (process.env.REQUIRE_AUTH !== 'true') {
    log('red', '❌ REQUIRE_AUTH must be true for HIPAA compliance');
    return false;
  }
  
  if (process.env.HIPAA_MODE !== 'true') {
    log('red', '❌ HIPAA_MODE must be true for medical data');
    return false;
  }
  
  if (process.env.AUDIT_LOG_ENABLED !== 'true') {
    log('red', '❌ AUDIT_LOG_ENABLED must be true for compliance');
    return false;
  }
  
  // Validate secret strength
  const jwtSecret = process.env.JWT_SECRET;
  const encryptionSecret = process.env.ENCRYPTION_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  
  if (jwtSecret.length < 32) {
    log('red', '❌ JWT_SECRET must be at least 32 characters');
    return false;
  }
  
  if (encryptionSecret.length < 32) {
    log('red', '❌ ENCRYPTION_SECRET must be at least 32 characters');
    return false;
  }
  
  if (sessionSecret.length < 32) {
    log('red', '❌ SESSION_SECRET must be at least 32 characters');
    return false;
  }
  
  log('green', '✅ All security variables are properly configured');
  return true;
}

// Check Node.js version
function checkNodeVersion() {
  log('blue', '\n🟢 Checking Node.js version...');
  
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    log('red', `❌ Node.js ${nodeVersion} is too old. Minimum required: v18.0.0`);
    return false;
  }
  
  log('green', `✅ Node.js ${nodeVersion} is supported`);
  return true;
}

// Check dependencies
function checkDependencies() {
  log('blue', '\n📦 Checking critical dependencies...');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    log('red', '❌ package.json not found');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const criticalDeps = [
    'jsonwebtoken',
    'bcrypt', 
    'helmet',
    'express-rate-limit',
    'cors',
    'express-validator'
  ];
  
  const missing = [];
  
  for (const dep of criticalDeps) {
    if (!dependencies[dep]) {
      missing.push(dep);
    }
  }
  
  if (missing.length > 0) {
    log('red', `❌ Missing critical dependencies: ${missing.join(', ')}`);
    log('yellow', '💡 Run: npm install ' + missing.join(' '));
    return false;
  }
  
  log('green', '✅ All critical dependencies are installed');
  return true;
}

// Check data directory
function checkDataDirectory() {
  log('blue', '\n📂 Checking data directory...');
  
  const dataDir = process.env.DATA_DIR || './data';
  const dataPath = path.join(process.cwd(), dataDir);
  
  if (!fs.existsSync(dataPath)) {
    try {
      fs.mkdirSync(dataPath, { recursive: true });
      log('green', `✅ Created data directory: ${dataDir}`);
    } catch (error) {
      log('red', `❌ Cannot create data directory: ${dataDir}`);
      return false;
    }
  }
  
  // Check directory permissions
  try {
    fs.accessSync(dataPath, fs.constants.R_OK | fs.constants.W_OK);
    log('green', '✅ Data directory is accessible');
  } catch (error) {
    log('red', `❌ Data directory permissions issue: ${dataDir}`);
    return false;
  }
  
  return true;
}

// Test encryption functionality
function testEncryption() {
  log('blue', '\n🔐 Testing encryption functionality...');
  
  try {
    const { secretoJWT, securityUtils } = require('../src/config/seguridad');
    
    if (!secretoJWT) {
      log('red', '❌ JWT secret not loaded');
      return false;
    }
    
    // Test token generation
    const testPayload = { sub: 'test-user', role: 'admin' };
    const token = securityUtils.generateToken(testPayload);
    
    if (!token) {
      log('red', '❌ Token generation failed');
      return false;
    }
    
    // Test password hashing
    const testPassword = 'test-password-123';
    const hashPromise = securityUtils.hashPassword(testPassword);
    
    if (!hashPromise) {
      log('red', '❌ Password hashing function not available');
      return false;
    }
    
    log('green', '✅ Encryption functionality is working');
    return true;
    
  } catch (error) {
    log('red', `❌ Encryption test failed: ${error.message}`);
    return false;
  }
}

// Main validation function
function runValidation() {
  log('blue', 'Starting security validation...\n');
  
  const checks = [
    { name: 'Environment File', fn: checkEnvFile },
    { name: 'Security Variables', fn: validateSecurityVars },
    { name: 'Node.js Version', fn: checkNodeVersion },
    { name: 'Dependencies', fn: checkDependencies },
    { name: 'Data Directory', fn: checkDataDirectory },
    { name: 'Encryption Test', fn: testEncryption }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    try {
      if (check.fn()) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      log('red', `❌ ${check.name} failed with error: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION RESULTS');
  console.log('='.repeat(60));
  
  log('green', `✅ Passed: ${passed}`);
  
  if (failed > 0) {
    log('red', `❌ Failed: ${failed}`);
    log('red', '\n🚨 SECURITY VALIDATION FAILED!');
    log('red', 'DO NOT DEPLOY TO PRODUCTION!');
    log('yellow', '\nFix the issues above and run this validation again.');
    process.exit(1);
  } else {
    log('green', '\n🎉 ALL SECURITY CHECKS PASSED!');
    log('green', '✅ System is ready for secure deployment');
    log('blue', '\nNext steps:');
    log('blue', '1. Start the application: npm start');
    log('blue', '2. Run health checks: curl http://localhost:8082/health');
    log('blue', '3. Monitor logs for security events');
  }
}

// Run validation if called directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  runValidation();
}

module.exports = { runValidation };