// Wrapper para exponer el backend principal basado en Firestore
// Mientras migramos, reutilizamos el código existente de server.js
// TODO: mover la lógica aquí y eliminar el archivo raíz cuando terminemos
module.exports = require('../server.js');
