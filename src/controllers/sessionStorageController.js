/**
 * SESSION STORAGE CONTROLLER - AIRA Medical Bot
 * ONLY for recording and storing sessions
 * NO medical advice or treatment recommendations
 */

const SessionStorageService = require('../services/sessionStorageService');
const { requireAuth } = require('../middleware/auth');
const { validateSessionStorage } = require('../middleware/validation');

class SessionStorageController {
  constructor() {
    this.sessionService = new SessionStorageService();
  }

  /**
   * Store a new session
   * POST /api/sessions/store
   */
  async storeSession(req, res) {
    try {
      // Get professional info from JWT token
      const professionalId = req.user.sub;
      const professionalType = req.user.professionalType;

      // Prepare session data
      const sessionData = {
        ...req.body,
        professionalId,
        professionalType,
        sessionId: req.body.sessionId || this.generateSessionId()
      };

      // Validate session data
      const validation = validateSessionStorage(sessionData);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid session data',
          details: validation.errors
        });
      }

      // Store session
      const result = await this.sessionService.storeSession(sessionData);

      // Log session storage
      console.log(`[SESSION_STORAGE] Session stored: ${result.sessionId} by ${professionalType} ${professionalId}`);

      res.status(201).json({
        success: true,
        message: 'Session stored successfully',
        data: result
      });

    } catch (error) {
      console.error('[SESSION_STORAGE_ERROR]', error.message);
      
      res.status(500).json({
        error: 'STORAGE_ERROR',
        message: 'Failed to store session',
        details: error.message
      });
    }
  }

  /**
   * Retrieve a session
   * GET /api/sessions/:sessionId
   */
  async retrieveSession(req, res) {
    try {
      const { sessionId } = req.params;
      const professionalId = req.user.sub;

      // Retrieve session
      const session = await this.sessionService.retrieveSession(sessionId, professionalId);

      // Log session retrieval
      console.log(`[SESSION_RETRIEVE] Session retrieved: ${sessionId} by ${professionalId}`);

      res.json({
        success: true,
        message: 'Session retrieved successfully',
        data: session
      });

    } catch (error) {
      console.error('[SESSION_RETRIEVE_ERROR]', error.message);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        });
      }

      if (error.message.includes('Access denied')) {
        return res.status(403).json({
          error: 'ACCESS_DENIED',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'RETRIEVAL_ERROR',
        message: 'Failed to retrieve session',
        details: error.message
      });
    }
  }

  /**
   * List sessions for a professional
   * GET /api/sessions
   */
  async listSessions(req, res) {
    try {
      const professionalId = req.user.sub;
      const filters = {
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        sessionType: req.query.sessionType,
        professionalType: req.query.professionalType
      };

      // Remove undefined filters
      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

      // List sessions
      const result = await this.sessionService.listSessions(professionalId, filters);

      // Log session listing
      console.log(`[SESSION_LIST] ${result.total} sessions listed for ${professionalId}`);

      res.json({
        success: true,
        message: 'Sessions retrieved successfully',
        data: result
      });

    } catch (error) {
      console.error('[SESSION_LIST_ERROR]', error.message);
      
      res.status(500).json({
        error: 'LIST_ERROR',
        message: 'Failed to list sessions',
        details: error.message
      });
    }
  }

  /**
   * Delete a session
   * DELETE /api/sessions/:sessionId
   */
  async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;
      const professionalId = req.user.sub;

      // Delete session
      const result = await this.sessionService.deleteSession(sessionId, professionalId);

      // Log session deletion
      console.log(`[SESSION_DELETE] Session deleted: ${sessionId} by ${professionalId}`);

      res.json({
        success: true,
        message: 'Session deleted successfully',
        data: result
      });

    } catch (error) {
      console.error('[SESSION_DELETE_ERROR]', error.message);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        });
      }

      if (error.message.includes('Access denied')) {
        return res.status(403).json({
          error: 'ACCESS_DENIED',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'DELETE_ERROR',
        message: 'Failed to delete session',
        details: error.message
      });
    }
  }

  /**
   * Get storage statistics
   * GET /api/sessions/stats
   */
  async getStorageStats(req, res) {
    try {
      const professionalId = req.user.sub;

      // Get statistics
      const result = await this.sessionService.getStorageStats(professionalId);

      // Log stats retrieval
      console.log(`[SESSION_STATS] Stats retrieved for ${professionalId}: ${result.stats.totalSessions} sessions`);

      res.json({
        success: true,
        message: 'Storage statistics retrieved successfully',
        data: result
      });

    } catch (error) {
      console.error('[SESSION_STATS_ERROR]', error.message);
      
      res.status(500).json({
        error: 'STATS_ERROR',
        message: 'Failed to get storage statistics',
        details: error.message
      });
    }
  }

  /**
   * Upload audio session
   * POST /api/sessions/upload-audio
   */
  async uploadAudioSession(req, res) {
    try {
      const professionalId = req.user.sub;
      const professionalType = req.user.professionalType;

      if (!req.file) {
        return res.status(400).json({
          error: 'NO_FILE',
          message: 'No audio file provided'
        });
      }

      // Prepare session data
      const sessionData = {
        sessionId: req.body.sessionId || this.generateSessionId(),
        professionalId,
        professionalType,
        patientId: req.body.patientId,
        sessionDate: req.body.sessionDate || new Date().toISOString(),
        sessionType: 'audio',
        sessionDuration: parseInt(req.body.sessionDuration) || 60,
        audioFile: req.file.buffer,
        notes: req.body.notes || ''
      };

      // Store session
      const result = await this.sessionService.storeSession(sessionData);

      // Log audio upload
      console.log(`[AUDIO_UPLOAD] Audio session uploaded: ${result.sessionId} by ${professionalType} ${professionalId}`);

      res.status(201).json({
        success: true,
        message: 'Audio session uploaded successfully',
        data: {
          sessionId: result.sessionId,
          fileSize: req.file.size,
          sessionType: 'audio'
        }
      });

    } catch (error) {
      console.error('[AUDIO_UPLOAD_ERROR]', error.message);
      
      res.status(500).json({
        error: 'UPLOAD_ERROR',
        message: 'Failed to upload audio session',
        details: error.message
      });
    }
  }

  /**
   * Generate unique session ID
   * @returns {string} - Unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${timestamp}_${random}`;
  }

  /**
   * Register routes
   * @param {Object} router - Express router
   */
  registerRoutes(router) {
    // Session storage routes (all require authentication)
    router.post('/store', requireAuth, this.storeSession.bind(this));
    router.get('/:sessionId', requireAuth, this.retrieveSession.bind(this));
    router.get('/', requireAuth, this.listSessions.bind(this));
    router.delete('/:sessionId', requireAuth, this.deleteSession.bind(this));
    router.get('/stats', requireAuth, this.getStorageStats.bind(this));
    router.post('/upload-audio', requireAuth, this.uploadAudioSession.bind(this));
  }
}

module.exports = SessionStorageController;