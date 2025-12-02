// Mock de la base de datos
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

const mockDb = {
    collection: jest.fn(() => mockFirestore)
};

module.exports = {
    initializeDatabase: jest.fn(() => mockDb),
    getDb: jest.fn(() => mockDb)
};
