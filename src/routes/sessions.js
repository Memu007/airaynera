const express = require('express');
const router = express.Router();
const sessionsController = require('../controllers/sessionsController');
const { isProfessional } = require('../middleware/auth');

// Todas las rutas de sesiones requieren rol de "professional" o "admin"
router.use(isProfessional);

// Session CRUD routes
router.post('/', sessionsController.create);
router.get('/', sessionsController.getAll);
router.get('/:id', sessionsController.getById);
router.put('/:id', sessionsController.update);
router.delete('/:id', sessionsController.delete);

// GET /api/sessions/patient/:patientId - Obtener todas las sesiones de un paciente
router.get('/patient/:patientId', sessionsController.getSessionsByPatient);

module.exports = router; 