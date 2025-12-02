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
    '**/tests/unit/middleware/security.test.js',
    '**/tests/sessions.test.js',
    '**/tests/patients.test.js',
    '**/tests/auth.test.js',
    '**/tests/simple/math.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/utils.test.js',
    '/tests/whatsapp.test.js',
    '/tests/validators/simple-validator.test.js',
    '/tests/unit/services/authService.test.js',
    '/tests/controllers/simple-auth.test.js',
    '/tests/utils/encryption.test.js',
    '/tests/models/models.test.js',
    '/tests/routes/routes.test.js',
    '/tests/config/config.test.js',
    '/tests/services/ai-simple.test.js',
    '/tests/comprehensive/comprehensive.test.js',
    '/tests/validators/validators-working.test.js'
  ]
};
