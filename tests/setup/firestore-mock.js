// Mock completo y mejorado de Firestore para tests
class MockQuerySnapshot {
    constructor(docs = []) {
        this.docs = docs;
        this.empty = docs.length === 0;
        this.size = docs.length;
    }

    forEach(callback) {
        this.docs.forEach(doc => callback(doc));
    }

    map(callback) {
        return this.docs.map(callback);
    }
}

class MockDocumentSnapshot {
    constructor(id, data, exists = true) {
        this.id = id;
        this.exists = exists;
        this._data = data;
    }

    data() {
        return this._data;
    }
}

class MockQuery {
    constructor(data = []) {
        this.data = data;
        this.constraints = [];
    }

    where(fieldPath, opStr, value) {
        const filtered = this.data.filter(doc => {
            const docData = typeof doc.data === 'function' ? doc.data() : doc;
            const fieldValue = this._getNestedValue(docData, fieldPath);
            
            switch (opStr) {
                case '==':
                    return fieldValue === value;
                case '!=':
                    return fieldValue !== value;
                case '>':
                    return fieldValue > value;
                case '>=':
                    return fieldValue >= value;
                case '<':
                    return fieldValue < value;
                case '<=':
                    return fieldValue <= value;
                case 'array-contains':
                    return Array.isArray(fieldValue) && fieldValue.includes(value);
                case 'in':
                    return Array.isArray(value) && value.includes(fieldValue);
                case 'array-contains-any':
                    return Array.isArray(fieldValue) && Array.isArray(value) && 
                           fieldValue.some(item => value.includes(item));
                default:
                    return true;
            }
        });

        const newQuery = new MockQuery(filtered);
        newQuery.constraints = [...this.constraints, { type: 'where', fieldPath, opStr, value }];
        return newQuery;
    }

    orderBy(fieldPath, directionStr = 'asc') {
        const sorted = [...this.data].sort((a, b) => {
            const aData = typeof a.data === 'function' ? a.data() : a;
            const bData = typeof b.data === 'function' ? b.data() : b;
            
            const aValue = this._getNestedValue(aData, fieldPath);
            const bValue = this._getNestedValue(bData, fieldPath);
            
            if (aValue < bValue) return directionStr === 'asc' ? -1 : 1;
            if (aValue > bValue) return directionStr === 'asc' ? 1 : -1;
            return 0;
        });

        const newQuery = new MockQuery(sorted);
        newQuery.constraints = [...this.constraints, { type: 'orderBy', fieldPath, directionStr }];
        return newQuery;
    }

    limit(limit) {
        const limited = this.data.slice(0, limit);
        const newQuery = new MockQuery(limited);
        newQuery.constraints = [...this.constraints, { type: 'limit', limit }];
        return newQuery;
    }

    offset(offset) {
        const offsetted = this.data.slice(offset);
        const newQuery = new MockQuery(offsetted);
        newQuery.constraints = [...this.constraints, { type: 'offset', offset }];
        return newQuery;
    }

    async get() {
        const docs = this.data.map((data, index) => {
            const id = data.id || `mock-doc-${index}`;
            return new MockDocumentSnapshot(id, data);
        });

        return new MockQuerySnapshot(docs);
    }

    _getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
}

class MockCollectionReference {
    constructor(name, initialData = []) {
        this.name = name;
        this.data = initialData;
    }

    doc(id) {
        const docData = this.data.find(d => d.id === id);
        return new MockDocumentReference(id, docData || null);
    }

    add(data) {
        const id = `mock-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.data.push({ ...data, id });
        return Promise.resolve(new MockDocumentReference(id, { ...data, id }));
    }

    where(fieldPath, opStr, value) {
        return new MockQuery(this.data).where(fieldPath, opStr, value);
    }

    orderBy(fieldPath, directionStr) {
        return new MockQuery(this.data).orderBy(fieldPath, directionStr);
    }

    limit(limit) {
        return new MockQuery(this.data).limit(limit);
    }

    offset(offset) {
        return new MockQuery(this.data).offset(offset);
    }

    async get() {
        const docs = this.data.map((data, index) => {
            const id = data.id || `mock-doc-${index}`;
            return new MockDocumentSnapshot(id, data);
        });
        return new MockQuerySnapshot(docs);
    }

    // Método para agregar datos de prueba
    _addTestData(data) {
        this.data = data;
    }
}

class MockDocumentReference {
    constructor(id, data = null) {
        this.id = id;
        this._data = data;
    }

    collection(collectionPath) {
        const subcollectionData = this._data?.[collectionPath] || [];
        return new MockCollectionReference(collectionPath, subcollectionData);
    }

    async get() {
        return new MockDocumentSnapshot(this.id, this._data, !!this._data);
    }

    async set(data, options = {}) {
        this._data = { ...this._data, ...data };
        if (!options.merge) {
            this._data = { ...data, id: this.id };
        }
        return Promise.resolve();
    }

    async update(data) {
        if (!this._data) {
            throw new Error('Document does not exist');
        }
        this._data = { ...this._data, ...data };
        return Promise.resolve();
    }

    async delete() {
        this._data = null;
        return Promise.resolve();
    }
}

class MockFirestore {
    constructor() {
        this.collections = {};
    }

    collection(collectionPath) {
        if (!this.collections[collectionPath]) {
            this.collections[collectionPath] = new MockCollectionReference(collectionPath);
        }
        return this.collections[collectionPath];
    }

    batch() {
        return {
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            commit: jest.fn().mockResolvedValue()
        };
    }

    runTransaction(updateFunction) {
        const transaction = {
            get: jest.fn().mockResolvedValue(new MockDocumentSnapshot('mock-id', {})),
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        };
        return Promise.resolve(updateFunction(transaction));
    }

    // Helper para agregar datos de prueba
    _addTestData(collectionName, data) {
        if (!this.collections[collectionName]) {
            this.collections[collectionName] = new MockCollectionReference(collectionName);
        }
        this.collections[collectionName]._addTestData(data);
    }

    // Helper para limpiar datos
    _clearTestData() {
        this.collections = {};
    }
}

// Exportar funciones de utilidad
const createMockFirestore = () => new MockFirestore();

module.exports = {
    createMockFirestore,
    MockFirestore,
    MockCollectionReference,
    MockDocumentReference,
    MockQuery,
    MockDocumentSnapshot,
    MockQuerySnapshot
};
