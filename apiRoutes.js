/**
 * API Routes for AIRA Dashboard
 * Provides REST endpoints for the React frontend
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Security: JWT secret is now required - NO hardcoded secrets allowed
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

if (!JWT_SECRET) {
    console.error('❌ SECURITY ERROR: JWT_SECRET environment variable is required');
    process.exit(1);
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token de acceso requerido'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }
    req.user = user;
    next();
  });
};

// ═══════════════════════════════════════════════════════════════════
// 🔐 AUTHENTICATION ROUTES
// ═══════════════════════════════════════════════════════════════════

// POST /api/auth/login
router.post('/auth/login', [
  body('dni')
    .isLength({ min: 7, max: 8 })
    .isNumeric()
    .withMessage('DNI debe tener 7-8 dígitos numéricos'),
  body('pin')
    .isLength({ min: 4, max: 8 })
    .isNumeric()
    .withMessage('PIN debe tener 4-8 dígitos numéricos')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: errors.array()
      });
    }

    const { dni, pin } = req.body;

    // Authenticate with database (assuming db is available globally)
    const authResult = await global.db.authenticateProfessional(dni, pin);

    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        error: authResult.error || 'Credenciales inválidas'
      });
    }

    // Generate JWT token
    const tokenPayload = {
      dni: authResult.professional.dni,
      nombre: authResult.professional.nombre,
      especialidad: authResult.professional.especialidad,
      plan: authResult.professional.plan
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Log successful login
    global.logger?.info(`Successful login: ${dni}`);

    res.json({
      success: true,
      data: {
        user: {
          id: authResult.professional.dni,
          dni: authResult.professional.dni,
          nombre: authResult.professional.nombre,
          especialidad: authResult.professional.especialidad,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        },
        token
      }
    });

  } catch (error) {
    global.logger?.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// POST /api/auth/logout
router.post('/auth/logout', authenticateToken, async (req, res) => {
  try {
    // Log logout
    global.logger?.info(`Logout: ${req.user.dni}`);

    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  } catch (error) {
    global.logger?.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cerrar sesión'
    });
  }
});

// GET /api/auth/me
router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        id: req.user.dni,
        dni: req.user.dni,
        nombre: req.user.nombre,
        especialidad: req.user.especialidad,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      }
    });
  } catch (error) {
    global.logger?.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener información del usuario'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📊 DASHBOARD ROUTES
// ═══════════════════════════════════════════════════════════════════

// GET /api/dashboard/stats
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const professionalDni = req.user.dni;

    // Get patients count
    const patientsResult = await global.db.getPatients(professionalDni);
    const totalPatients = patientsResult.success ? patientsResult.patients.length : 0;
    const activePatients = patientsResult.success ? 
      patientsResult.patients.filter(p => p.status === 'active' || p.status === 'activo').length : 0;

    // Get sessions count (this month)
    const sessionsResult = await global.db.getSessions(professionalDni);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlySessions = sessionsResult.success ? 
      sessionsResult.sessions.filter(s => {
        const sessionDate = new Date(s.fecha);
        return sessionDate.getMonth() === currentMonth && sessionDate.getFullYear() === currentYear;
      }).length : 0;

    // Count crisis sessions
    const crisisDetected = sessionsResult.success ?
      sessionsResult.sessions.filter(s => s.crisis_detected).length : 0;

    res.json({
      success: true,
      data: {
        totalPatients,
        activePatients,
        monthlySessions,
        crisisDetected,
        aiResponseRate: 98, // Mock data for now
        patientsTrend: 5,   // Mock data
        sessionsTrend: 12,  // Mock data
        aiTrend: -2         // Mock data
      }
    });

  } catch (error) {
    global.logger?.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// 👥 PATIENTS ROUTES
// ═══════════════════════════════════════════════════════════════════

// GET /api/patients
router.get('/patients', authenticateToken, async (req, res) => {
  try {
    const professionalDni = req.user.dni;
    const { search, status, page = 1, limit = 20 } = req.query;

    const result = await global.db.getPatients(professionalDni);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Error al obtener pacientes'
      });
    }

    let patients = result.patients;

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      patients = patients.filter(p => 
        p.nombre.toLowerCase().includes(searchLower) ||
        p.dni.includes(search)
      );
    }

    if (status && status !== 'all') {
      const normalizedStatus = status === 'activo' ? 'active' : 
                              status === 'inactivo' ? 'inactive' : status;
      patients = patients.filter(p => p.status === normalizedStatus);
    }

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPatients = patients.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        items: paginatedPatients.map(p => ({
          id: p.id,
          nombre: p.nombre,
          dni: p.dni,
          status: p.status,
          createdAt: p.created_at?.toISOString() || new Date().toISOString(),
          updatedAt: p.updated_at?.toISOString() || new Date().toISOString(),
          totalSessions: 0, // TODO: Calculate from sessions
          crisisCount: 0    // TODO: Calculate from sessions
        })),
        total: patients.length,
        page: parseInt(page),
        limit: parseInt(limit),
        hasNext: endIndex < patients.length,
        hasPrev: parseInt(page) > 1,
        nextPage: endIndex < patients.length ? parseInt(page) + 1 : null,
        prevPage: parseInt(page) > 1 ? parseInt(page) - 1 : null
      }
    });

  } catch (error) {
    global.logger?.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pacientes'
    });
  }
});

// GET /api/patients/:id
router.get('/patients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const professionalDni = req.user.dni;

    // TODO: Implement getPatientById method in DatabaseManager
    res.status(501).json({
      success: false,
      error: 'Funcionalidad no implementada aún'
    });

  } catch (error) {
    global.logger?.error('Get patient error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener paciente'
    });
  }
});

// POST /api/patients
router.post('/patients', [
  authenticateToken,
  body('nombre').isLength({ min: 2, max: 100 }).withMessage('Nombre debe tener 2-100 caracteres'),
  body('dni').isLength({ min: 7, max: 8 }).isNumeric().withMessage('DNI debe tener 7-8 dígitos'),
  body('obraSocial').optional().isLength({ max: 100 }),
  body('telefono').optional().matches(/^[\+]?[0-9\s\-\(\)]{8,20}$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: errors.array()
      });
    }

    const professionalDni = req.user.dni;
    const patientData = req.body;

    const result = await global.db.registerPatient(professionalDni, patientData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.status(201).json({
      success: true,
      data: result.patient
    });

  } catch (error) {
    global.logger?.error('Create patient error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear paciente'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// 📝 SESSIONS ROUTES
// ═══════════════════════════════════════════════════════════════════

// GET /api/sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const professionalDni = req.user.dni;
    const { patientId, search, type, page = 1, limit = 20 } = req.query;

    const result = await global.db.getSessions(professionalDni);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Error al obtener sesiones'
      });
    }

    let sessions = result.sessions;

    // Apply filters
    if (patientId) {
      sessions = sessions.filter(s => s.patient_id === patientId);
    }

    if (type && type !== 'all') {
      if (type === 'crisis') {
        sessions = sessions.filter(s => s.crisis_detected);
      }
      // Add more type filters as needed
    }

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedSessions = sessions.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        items: paginatedSessions.map(s => ({
          id: s.id,
          patientId: s.patient_id,
          patientName: s.patient_name || 'Paciente',
          observaciones: s.observaciones_decrypted || s.observaciones || '',
          resumen: s.resumen_ia,
          sessionType: s.crisis_detected ? 'crisis' : 'regular',
          crisisDetected: s.crisis_detected || false,
          crisisSeverity: s.crisis_detected ? 'medium' : null,
          createdAt: s.fecha?.toISOString() || s.created_at?.toISOString() || new Date().toISOString(),
          createdVia: 'whatsapp'
        })),
        total: sessions.length,
        page: parseInt(page),
        limit: parseInt(limit),
        hasNext: endIndex < sessions.length,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    global.logger?.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener sesiones'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// 🏥 HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════

// GET /api/health
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;