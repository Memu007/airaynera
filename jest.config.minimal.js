module.exports = {
    testEnvironment: 'node',
    testMatch: [
        '<rootDir>/tests/simple/**/*.test.js',
        '<rootDir>/tests/unit/**/*.test.js'
    ],
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    moduleFileExtensions: ['js', 'json'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/coverage/']
};
