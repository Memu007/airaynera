// Mock de firebase-admin
const mockFirestore = {
    collection: jest.fn(() => mockFirestore),
    doc: jest.fn(() => mockFirestore),
    get: jest.fn(() => Promise.resolve({
        empty: true,
        docs: [],
        exists: false,
        data: () => null
    })),
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
    where: jest.fn(() => mockFirestore),
    orderBy: jest.fn(() => mockFirestore),
    limit: jest.fn(() => mockFirestore),
    add: jest.fn(() => Promise.resolve({ id: 'mock-id' }))
};

const mockAdmin = {
    initializeApp: jest.fn(),
    credential: {
        cert: jest.fn()
    },
    firestore: jest.fn(() => mockFirestore),
    apps: []
};

module.exports = mockAdmin;
