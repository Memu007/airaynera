// Setup específico para tests de frontend con jsdom
import 'jest-extended';

// Mock de window y document para jsdom
global.window = window;
global.document = document;

// Mock de APIs del browser
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Mock de IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {
        return null;
    }
    disconnect() {
        return null;
    }
    unobserve() {
        return null;
    }
};

// Mock de ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor() {}
    observe() {
        return null;
    }
    disconnect() {
        return null;
    }
    unobserve() {
        return null;
    }
};

// Mock de Web APIs
Object.defineProperty(window, 'location', {
    value: {
        href: 'http://localhost',
        protocol: 'http:',
        host: 'localhost',
        pathname: '/',
        search: '',
        hash: ''
    },
    writable: true
});

Object.defineProperty(window, 'navigator', {
    value: {
        userAgent: 'jest',
        language: 'en',
        onLine: true
    },
    writable: true
});

// Mock de localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock de sessionStorage
const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock de fetch
global.fetch = jest.fn();

// Mock de setTimeout y setInterval para tests de performance
jest.useFakeTimers('modern');

// Cleanup después de cada test
afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    sessionStorageMock.removeItem.mockClear();
    sessionStorageMock.clear.mockClear();
    if (global.fetch) {
        global.fetch.mockClear();
    }
}); 