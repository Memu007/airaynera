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
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**',
    '!src/services/AIService.js',
    '!src/services/CrisisDetectionService.js',
    '!src/services/DatabaseService.js',
    '!src/services/ResilienceService.js',
    '!src/services/SecurityService.js',
    '!src/services/WhatsAppService.js',
    '!src/app.js',
    '!src/server.js',
    '!src/routes/**',
    '!src/controllers/**',
    '!src/models/**',
    '!src/utils/logger.js',
    '!src/utils/encryption.js',
    '!src/dashboard/**',
    '!src/api/**',
    '!src/servicios/**',
    '!src/tareas/**'
  ],
  testMatch: [
    '**/tests/simple/**/*.test.js',
    '**/tests/unit/middleware/**/*.test.js',
    '**/tests/validators/**/*.test.js',
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
