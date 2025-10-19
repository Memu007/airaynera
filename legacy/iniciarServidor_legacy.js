/**
 * Servidor de prueba para el dashboard de monitoreo
 * Permite probar el dashboard sin necesidad de implementar todos los servicios
 */

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

// Importar API simulada
const apiSimulada = require('./api-simulada');

// Configurar middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../')));

// Configurar rutas de API
app.use('/api', apiSimulada);

// Rutas
app.get('/', (req, res) => {
  // Servir la landing page
  res.sendFile(path.join(__dirname, '../../demopagina.html'));
});

app.get('/dashboard', (req, res) => {
  // Servir el dashboard completo
  res.sendFile(path.join(__dirname, '../../dashboard-ejemplo.html'));
});

app.get('/aira', (req, res) => {
  // Servir la landing page
  res.sendFile(path.join(__dirname, '../../demopagina.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de prueba iniciado en http://localhost:${PORT}`);
  console.log('Presiona Ctrl+C para detener el servidor');
});
