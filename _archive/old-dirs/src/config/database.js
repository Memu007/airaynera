const admin = require('firebase-admin');

let db;

const initializeDatabase = () => {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL
            })
        });
    }
    db = admin.firestore();
    return db;
};

const getDb = () => {
    if (!db) {
        return initializeDatabase();
    }
    return db;
};

module.exports = {
    initializeDatabase,
    getDb
};
