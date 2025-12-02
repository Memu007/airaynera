/**
 * Mock de Firestore para tests y modo desarrollo
 * Evita dependencias de Firebase en desarrollo/producción
 */

// Verificar si estamos en un entorno de testing
const isTestEnvironment = typeof jest !== 'undefined' || process.env.NODE_ENV === 'test';

// Función helper para crear mock functions
const createMockFn = (returnValue) => {
    if (isTestEnvironment && typeof jest !== 'undefined') {
        return jest.fn().mockResolvedValue(returnValue);
    }
    // Fallback para entornos sin Jest
    return () => Promise.resolve(returnValue);
};

// Mock data por defecto
const mockUserData = {
    id: 'user-123',
    email: 'test@example.com',
    hashedPassword: '$2b$10$hashedpassword',
    role: 'therapist',
    isActive: true,
    name: 'Test User',
    createdAt: new Date().toISOString()
};

const mockPatientData = {
    id: 'patient-123',
    name: 'Test Patient',
    dni: '12345678',
    insurance: 'Test Insurance',
    phone: '+1234567890',
    status: 'active',
    createdAt: new Date().toISOString()
};

// Mock del documento
const createMockDoc = (data = null) => ({
    exists: data !== null,
    data: () => data,
    id: data?.id || 'mock-id',
    ref: {
        path: 'mock/path'
    }
});

// Mock de la colección
const createMockCollection = (collectionName) => {
    const defaultData = collectionName === 'users' ? mockUserData : 
                       collectionName === 'patients' ? mockPatientData : 
                       { id: 'mock-id', data: 'mock-data' };

    return {
        doc: (docId) => ({
            get: createMockFn(createMockDoc(defaultData)),
            set: createMockFn(undefined),
            update: createMockFn(undefined),
            delete: createMockFn(undefined),
            id: docId || 'mock-doc-id'
        }),
        add: createMockFn({
            id: 'new-doc-id',
            ...defaultData
        }),
        where: () => ({
            get: createMockFn({
                empty: false,
                size: 1,
                docs: [createMockDoc(defaultData)]
            })
        }),
        orderBy: () => ({
            limit: () => ({
                get: createMockFn({
                    empty: false,
                    size: 1,
                    docs: [createMockDoc(defaultData)]
                })
            })
        }),
        limit: () => ({
            get: createMockFn({
                empty: false,
                size: 1,
                docs: [createMockDoc(defaultData)]
            })
        })
    };
};

// Mock principal de Firestore
const mockDb = {
    collection: (collectionName) => createMockCollection(collectionName),
    doc: (docPath) => ({
        get: createMockFn(createMockDoc(mockUserData)),
        set: createMockFn(undefined),
        update: createMockFn(undefined),
        delete: createMockFn(undefined)
    }),
    runTransaction: createMockFn(mockUserData),
    batch: () => ({
        set: createMockFn(undefined),
        update: createMockFn(undefined),
        delete: createMockFn(undefined),
        commit: createMockFn(undefined)
    })
};

// Mock de la clase Firestore
const MockFirestore = function() {
    return mockDb;
};

MockFirestore.prototype.collection = mockDb.collection;
MockFirestore.prototype.doc = mockDb.doc;

// Mock del admin SDK
const mockAdmin = {
    firestore: () => mockDb,
    initializeApp: isTestEnvironment && typeof jest !== 'undefined' ? 
        jest.fn() : 
        () => ({ name: 'mock-app' }),
    credential: {
        cert: isTestEnvironment && typeof jest !== 'undefined' ? 
            jest.fn() : 
            () => ({ type: 'mock-credential' })
    }
};

// Mock del cliente SDK
const mockClient = {
    Firestore: MockFirestore
};

const mockFirestore = {
    collection: jest.fn((collectionName) => {
        const whereChain = {
            where: jest.fn(() => whereChain),
            orderBy: jest.fn(() => whereChain),
            limit: jest.fn(() => whereChain),
            get: jest.fn(() => Promise.resolve({
                empty: false,
                docs: [{
                    id: 'mock-doc-id',
                    data: jest.fn(() => ({
                        id: 'mock-doc-id',
                        email: 'test@example.com',
                        name: 'Test User',
                        role: 'professional'
                    })),
                    exists: true
                }],
                forEach: jest.fn((callback) => {
                    [{
                        id: 'mock-doc-id',
                        data: jest.fn(() => ({
                            id: 'mock-doc-id',
                            email: 'test@example.com',
                            name: 'Test User',
                            role: 'professional'
                        }))
                    }].forEach(callback);
                })
            }))
        };
        
        return {
            doc: jest.fn((docId) => ({
                get: jest.fn(() => Promise.resolve({
                    exists: true,
                    id: docId,
                    data: jest.fn(() => ({
                        id: docId,
                        email: 'test@example.com',
                        name: 'Test User',
                        role: 'professional'
                    }))
                })),
                set: jest.fn(() => Promise.resolve()),
                update: jest.fn(() => Promise.resolve()),
                delete: jest.fn(() => Promise.resolve())
            })),
            add: jest.fn(() => Promise.resolve({ id: 'new-doc-id' })),
            where: jest.fn(() => whereChain),
            orderBy: jest.fn(() => whereChain),
            limit: jest.fn(() => whereChain),
            get: jest.fn(() => Promise.resolve({
                empty: false,
                docs: [{
                    id: 'mock-doc-id',
                    data: jest.fn(() => ({
                        id: 'mock-doc-id',
                        email: 'test@example.com',
                        name: 'Test User',
                        role: 'professional'
                    })),
                    exists: true
                }]
            }))
        };
    }),
    
    // Batch operations
    batch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn(() => Promise.resolve())
    })),
    
    // Transaction support
    runTransaction: jest.fn((callback) => {
        const transaction = {
            get: jest.fn(() => Promise.resolve({
                exists: true,
                data: jest.fn(() => ({ count: 0 }))
            })),
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        };
        return Promise.resolve(callback(transaction));
    })
};

module.exports = {
    mockFirestore,
    db: mockFirestore
}; 