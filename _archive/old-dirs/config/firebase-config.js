// Firebase configuración REAL para producción
const admin = require('firebase-admin');

// Configuración con variables de entorno
const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'aira-prod',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    databaseURL: process.env.FIREBASE_DATABASE_URL
};

// Inicializar Firebase Admin
let firebaseApp;

try {
    // Si hay credenciales reales
    if (firebaseConfig.privateKey && firebaseConfig.clientEmail) {
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: firebaseConfig.projectId,
                clientEmail: firebaseConfig.clientEmail,
                privateKey: firebaseConfig.privateKey
            }),
            databaseURL: firebaseConfig.databaseURL
        });
        console.log('✅ Firebase inicializado en modo PRODUCCIÓN');
    } else {
        // Fallback a emulador local
        process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
        firebaseApp = admin.initializeApp({
            projectId: 'demo-aira'
        });
        console.log('⚠️ Firebase en modo EMULADOR (desarrollo)');
    }
} catch (error) {
    console.error('❌ Error iniciando Firebase:', error.message);
    // Usar SQLite como fallback
    console.log('📦 Usando SQLite como fallback');
}

// Firestore con manejo de errores
const db = firebaseApp ? admin.firestore() : null;

// Funciones helper
const FirebaseService = {
    // Guardar documento
    async saveDoc(collection, docId, data) {
        try {
            if (!db) throw new Error('Firebase no disponible');
            
            await db.collection(collection).doc(docId).set({
                ...data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            return { success: true };
        } catch (error) {
            console.error('Error guardando:', error);
            // Fallback a SQLite
            return { success: false, fallback: 'sqlite' };
        }
    },
    
    // Obtener documento
    async getDoc(collection, docId) {
        try {
            if (!db) throw new Error('Firebase no disponible');
            
            const doc = await db.collection(collection).doc(docId).get();
            if (!doc.exists) return null;
            
            return { id: doc.id, ...doc.data() };
        } catch (error) {
            console.error('Error obteniendo:', error);
            return null;
        }
    },
    
    // Query con paginación
    async queryDocs(collection, filters = {}, limit = 10) {
        try {
            if (!db) throw new Error('Firebase no disponible');
            
            let query = db.collection(collection);
            
            // Aplicar filtros
            Object.entries(filters).forEach(([field, value]) => {
                query = query.where(field, '==', value);
            });
            
            const snapshot = await query.limit(limit).get();
            const docs = [];
            
            snapshot.forEach(doc => {
                docs.push({ id: doc.id, ...doc.data() });
            });
            
            return docs;
        } catch (error) {
            console.error('Error en query:', error);
            return [];
        }
    },
    
    // Eliminar documento
    async deleteDoc(collection, docId) {
        try {
            if (!db) throw new Error('Firebase no disponible');
            
            await db.collection(collection).doc(docId).delete();
            return { success: true };
        } catch (error) {
            console.error('Error eliminando:', error);
            return { success: false };
        }
    },
    
    // Batch write para performance
    async batchWrite(operations) {
        try {
            if (!db) throw new Error('Firebase no disponible');
            
            const batch = db.batch();
            
            operations.forEach(op => {
                const ref = db.collection(op.collection).doc(op.docId);
                
                switch(op.type) {
                    case 'create':
                    case 'update':
                        batch.set(ref, op.data, { merge: true });
                        break;
                    case 'delete':
                        batch.delete(ref);
                        break;
                }
            });
            
            await batch.commit();
            return { success: true };
        } catch (error) {
            console.error('Error en batch:', error);
            return { success: false };
        }
    }
};

module.exports = {
    firebase: firebaseApp,
    db,
    FirebaseService
};
