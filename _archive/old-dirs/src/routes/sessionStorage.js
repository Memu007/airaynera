/**
 * SESSION STORAGE ROUTES - AIRA Medical Bot
 * ONLY for recording and storing sessions
 * NO medical advice or treatment recommendations
 */

const express = require('express');
const multer = require('multer');
const SessionStorageController = require('../controllers/sessionStorageController');

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Only accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

const router = express.Router();
const sessionController = new SessionStorageController();

// Register all session storage routes
sessionController.registerRoutes(router);

module.exports = router;