module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  collectCoverageFrom: [
    'src/middleware/security.js',
    'src/validators/index.js',
    'src/services/authService.js',
    'src/services/patientsService.js',
    'src/services/sessionsService.js',
    'src/services/whatsapp.js',
    'src/utils/encryption.js',
    'src/config/database.js'
  ],
  testMatch: [
    '**/tests/simple/math.test.js',
    '**/tests/unit/middleware/security.test.js',
    '**/tests/validators/simple-validator.test.js',
    '**/tests/sessions.test.js',
    '**/tests/patients.test.js',
    '**/tests/auth.test.js',
    '**/tests/utils.test.js',
    '**/tests/whatsapp.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true
};
