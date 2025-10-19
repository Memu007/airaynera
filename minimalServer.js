require('dotenv').config();
const express = require('express');
const app = express();
const firebaseAdmin = require('firebase-admin');

// Configuración Firebase
if(process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(
        require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      )
    });
  } catch (error) {
    console.warn('⚠️  Error inicializando Firebase:', error.message);
    console.warn('⚠️  Modo mock activado');
  }
}

// Middlewares esenciales
app.use(express.json());
app.use('/api', require('./firestoreRoutes'));

// Health Check
app.get('/health', (req, res) => res.status(200).json({status: 'ok'}));

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor listo para deploy en puerto ${PORT}`);
  if(!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn('⚠️  Firebase no configurado - Usando modo mock');
  }
});
