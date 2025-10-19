const { Router } = require('express');
const { getAll, getById, create, update, remove, search } = require('../controllers/patientsController');
const { isProfessional } = require('../middleware/auth');
const { createLimiter } = require('../middleware/security');
const { validateObjectId } = require('../middleware/validation');

const router = Router();

// Todas las rutas de pacientes requieren rol de "professional" o "admin"
router.use(isProfessional);

// Rutas
router.get('/', getAll);
router.post('/', createLimiter, create);

router.get('/search', search);

router.get('/:id', validateObjectId, getById);
router.put('/:id', validateObjectId, update);
router.delete('/:id', validateObjectId, remove);

module.exports = router; 