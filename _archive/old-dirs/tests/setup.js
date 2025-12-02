// Mock global para Firestore
global.__resetFirestoreData = () => {
    // Resetear datos simulados de Firestore
    global.__firestoreData = {
        users: {},
        sessions: {},
        refreshTokens: {}
    };
};

// Inicializar datos
global.__resetFirestoreData();

// Mock de console.error para tests
global.console.error = jest.fn();
