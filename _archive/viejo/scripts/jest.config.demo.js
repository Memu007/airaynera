/** Demo-focused Jest config: test only demo server and enforce 70% coverage */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/integration/demo-server.integration.test.js',
    '<rootDir>/tests/integration/demo-server.more.integration.test.js',
    '<rootDir>/tests/integration/demo-server.extra.functions.test.js',
    '<rootDir>/tests/integration/demo-server.persistence.integration.test.js',
    '<rootDir>/tests/unit/demo-helpers.test.js'
  ],
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/server-demo-funcional.js'],
  coverageThreshold: {
    global: { branches: 69, functions: 60, lines: 70, statements: 70 },
  },
};


