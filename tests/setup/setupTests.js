const { mockFirestore, mockFirestoreAdmin, clearTestData } = require('./mockFirestore');

// Mock Firestore Admin antes de cualquier import
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    credential: {
        cert: jest.fn(),
        applicationDefault: jest.fn()
    },
    firestore: () => mockFirestore
}));

// Mock fs para Winston en tests
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    stat: jest.fn((path, callback) => {
        if (callback) {
            callback(null, { isDirectory: () => false });
        } else {
            return Promise.resolve({ isDirectory: () => false });
        }
    }),
    createWriteStream: jest.fn(() => ({
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn()
    })),
    mkdirSync: jest.fn(),
    existsSync: jest.fn(() => true)
}));

// Mock Winston transports para evitar errores de archivo
jest.mock('winston/lib/winston/transports/file', () => {
    return jest.fn().mockImplementation(() => ({
        log: jest.fn(),
        on: jest.fn()
    }));
});

// Mock database connection
jest.mock('../src/config/db', () => mockFirestore);

// Mock logger específicamente
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }))
}));

// Global test setup
beforeEach(() => {
    clearTestData();
    jest.clearAllMocks();
});

afterEach(() => {
    clearTestData();
});

// Global timeout
jest.setTimeout(30000);

// Suppress console during tests unless needed
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error // Keep errors visible
}; 