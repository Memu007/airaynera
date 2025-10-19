/**
 * Rutas de Autenticación - AIRA
 * @version 1.0.0
 */

const { Router } = require('express');
const { login, register, getProfile, refreshToken, logout } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

const router = Router();

// Rutas públicas con rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshToken);

// Rutas protegidas
router.post('/logout', verifyToken(), logout);
router.get('/profile', verifyToken(), getProfile);

module.exports = router; 