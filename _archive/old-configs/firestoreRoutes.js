const express = require('express');
const router = express.Router();

// Helper to obtain professional DNI until auth is implemented
function getProfessionalDni(req) {
  return req.header('x-dni') || 'demo-prof';
}

// Mock siempre activo para pruebas (remover en prod)
router.get('/pacientes', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const professionalDni = getProfessionalDni(req);
    const includeDisabled = req.query.incluirInhabilitados === 'true';
    const patients = await db.getPatientsByProfessional(professionalDni, includeDisabled);
    res.json(patients);
  } catch (error) {
    console.error('[API] GET /pacientes', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/pacientes', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.registerPatient(getProfessionalDni(req), req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.status(201).json(result.patient);
  } catch (error) {
    console.error('[API] POST /pacientes', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Actualizar estado u otros campos simples de paciente
router.put('/pacientes/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const professionalDni = getProfessionalDni(req);
    const { habilitado } = req.body;
    const patientId = req.params.id;

    if (typeof habilitado === 'undefined') {
      return res.status(400).json({ error: 'Campo habilitado es requerido y debe ser booleano o string válido' });
    }

    // Convertir booleano a string esperado por el backend
    let statusValue = habilitado;
    if (typeof habilitado === 'boolean') {
      statusValue = habilitado ? 'activo' : 'inactivo';
    }

    const result = await db.updatePatientStatus(professionalDni, patientId, statusValue);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] PUT /pacientes/:id', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ------------------ SESIONES ------------------
router.get('/sesiones', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const filters = {
      patient_id: req.query.patient_id || undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
      fecha_desde: req.query.fecha_desde ? new Date(req.query.fecha_desde) : undefined,
      fecha_hasta: req.query.fecha_hasta ? new Date(req.query.fecha_hasta) : undefined,
    };
    const result = await db.getSessions(getProfessionalDni(req), filters);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.sessions);
  } catch (error) {
    console.error('[API] GET /sesiones', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/sesiones', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.registerSession(getProfessionalDni(req), req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.status(201).json({ session_id: result.session_id });
  } catch (error) {
    console.error('[API] POST /sesiones', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
