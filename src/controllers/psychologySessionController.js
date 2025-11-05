/**
 * Psychology Session Controller - AIRA
 * Handles therapy session management, audio recording, and session workflows
 * @version 1.0.0
 */

const psychologyService = require('../services/psychologySessionService');
const logger = require('../utils/logger');
const { encryptPhi, decryptPhi } = require('../utils/encryption');

class PsychologySessionController {
    /**
     * Create new therapy session
     */
    async createSession(req, res) {
        try {
            const psychologistId = req.user.id;
            const { 
                patientId, 
                sessionType, 
                sessionDate, 
                duration, 
                presentingProblem,
                therapeuticApproach,
                sessionGoals 
            } = req.body;

            // Validate required fields
            if (!patientId || !sessionType || !sessionDate) {
                return res.status(400).json({
                    error: 'Missing required session fields',
                    code: 'VALIDATION_ERROR'
                });
            }

            const session = await psychologyService.createSession({
                psychologistId,
                patientId,
                sessionType,
                sessionDate: new Date(sessionDate),
                duration: duration || 50,
                presentingProblem: encryptPhi(presentingProblem || ''),
                therapeuticApproach,
                sessionGoals: encryptPhi(sessionGoals || ''),
                status: 'scheduled',
                createdAt: new Date()
            });

            logger.info('Therapy session created:', {
                sessionId: session.id,
                psychologistId,
                patientId,
                sessionType,
                sessionDate,
                ip: req.ip
            });

            res.status(201).json({
                success: true,
                session
            });

        } catch (error) {
            logger.error('Create session error:', error);
            res.status(500).json({
                error: 'Error creating therapy session',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get therapy sessions
     */
    async getSessions(req, res) {
        try {
            const psychologistId = req.user.id;
            const { 
                patientId, 
                status, 
                sessionType, 
                startDate, 
                endDate, 
                limit = 50, 
                offset = 0 
            } = req.query;

            const sessions = await psychologyService.getSessions({
                psychologistId,
                patientId,
                status,
                sessionType,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            // Decrypt PHI for authorized access
            const decryptedSessions = sessions.data.map(session => ({
                ...session,
                presentingProblem: session.presentingProblem ? decryptPhi(session.presentingProblem) : null,
                sessionGoals: session.sessionGoals ? decryptPhi(session.sessionGoals) : null,
                sessionNotes: session.sessionNotes ? decryptPhi(session.sessionNotes) : null,
                interventions: session.interventions ? decryptPhi(session.interventions) : null,
                homeworkAssigned: session.homeworkAssigned ? decryptPhi(session.homeworkAssigned) : null
            }));

            res.json({
                success: true,
                sessions: decryptedSessions,
                total: sessions.total,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: sessions.hasMore
                }
            });

        } catch (error) {
            logger.error('Get sessions error:', error);
            res.status(500).json({
                error: 'Error retrieving therapy sessions',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get session by ID
     */
    async getSessionById(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;

            const session = await psychologyService.getSessionById(id, psychologistId);

            if (!session) {
                return res.status(404).json({
                    error: 'Session not found',
                    code: 'SESSION_NOT_FOUND'
                });
            }

            // Decrypt PHI for authorized access
            const decryptedSession = {
                ...session,
                presentingProblem: session.presentingProblem ? decryptPhi(session.presentingProblem) : null,
                sessionGoals: session.sessionGoals ? decryptPhi(session.sessionGoals) : null,
                sessionNotes: session.sessionNotes ? decryptPhi(session.sessionNotes) : null,
                interventions: session.interventions ? decryptPhi(session.interventions) : null,
                homeworkAssigned: session.homeworkAssigned ? decryptPhi(session.homeworkAssigned) : null
            };

            res.json({
                success: true,
                session: decryptedSession
            });

        } catch (error) {
            logger.error('Get session by ID error:', error);
            res.status(500).json({
                error: 'Error retrieving therapy session',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Update therapy session
     */
    async updateSession(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;
            const updates = req.body;

            // Encrypt PHI updates
            const encryptedUpdates = { ...updates };
            if (updates.presentingProblem) encryptedUpdates.presentingProblem = encryptPhi(updates.presentingProblem);
            if (updates.sessionGoals) encryptedUpdates.sessionGoals = encryptPhi(updates.sessionGoals);
            if (updates.sessionNotes) encryptedUpdates.sessionNotes = encryptPhi(updates.sessionNotes);
            if (updates.interventions) encryptedUpdates.interventions = encryptPhi(updates.interventions);
            if (updates.homeworkAssigned) encryptedUpdates.homeworkAssigned = encryptPhi(updates.homeworkAssigned);

            // Add session end time if status is completed
            if (updates.status === 'completed' && !updates.actualEndTime) {
                encryptedUpdates.actualEndTime = new Date();
            }

            const result = await psychologyService.updateSession(id, psychologistId, encryptedUpdates);

            if (!result.success) {
                return res.status(404).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Session updated:', {
                sessionId: id,
                psychologistId,
                updatedFields: Object.keys(updates),
                ip: req.ip
            });

            res.json({
                success: true,
                session: result.session
            });

        } catch (error) {
            logger.error('Update session error:', error);
            res.status(500).json({
                error: 'Error updating therapy session',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Upload audio recording for session
     */
    async uploadAudioRecording(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;
            
            // Check if session exists and belongs to psychologist
            const session = await psychologyService.getSessionById(id, psychologistId);
            if (!session) {
                return res.status(404).json({
                    error: 'Session not found',
                    code: 'SESSION_NOT_FOUND'
                });
            }

            // Handle file upload (assuming multer middleware is set up)
            if (!req.file) {
                return res.status(400).json({
                    error: 'No audio file provided',
                    code: 'NO_FILE_PROVIDED'
                });
            }

            const audioRecording = await psychologyService.uploadAudioRecording({
                sessionId: id,
                psychologistId,
                audioFile: req.file,
                recordedAt: new Date(req.body.recordedAt || Date.now()),
                duration: parseInt(req.body.duration) || null
            });

            logger.info('Audio recording uploaded:', {
                sessionId: id,
                psychologistId,
                filename: req.file.originalname,
                size: req.file.size,
                ip: req.ip
            });

            res.status(201).json({
                success: true,
                audioRecording
            });

        } catch (error) {
            logger.error('Upload audio recording error:', error);
            res.status(500).json({
                error: 'Error uploading audio recording',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get audio recording for session
     */
    async getAudioRecording(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;

            // Check if session exists and belongs to psychologist
            const session = await psychologyService.getSessionById(id, psychologistId);
            if (!session) {
                return res.status(404).json({
                    error: 'Session not found',
                    code: 'SESSION_NOT_FOUND'
                });
            }

            const audioRecording = await psychologyService.getAudioRecording(id, psychologistId);

            if (!audioRecording) {
                return res.status(404).json({
                    error: 'Audio recording not found',
                    code: 'RECORDING_NOT_FOUND'
                });
            }

            // Set appropriate headers for audio file streaming
            res.set({
                'Content-Type': audioRecording.mimeType,
                'Content-Length': audioRecording.size,
                'Cache-Control': 'private, max-age=86400', // Cache for 1 day
                'Content-Disposition': `inline; filename="${audioRecording.filename}"`
            });

            // Stream the audio file
            res.send(audioRecording.buffer);

            logger.info('Audio recording accessed:', {
                sessionId: id,
                psychologistId,
                filename: audioRecording.filename,
                ip: req.ip
            });

        } catch (error) {
            logger.error('Get audio recording error:', error);
            res.status(500).json({
                error: 'Error retrieving audio recording',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Delete therapy session
     */
    async deleteSession(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;

            const result = await psychologyService.deleteSession(id, psychologistId);

            if (!result.success) {
                return res.status(404).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Session deleted:', {
                sessionId: id,
                psychologistId,
                ip: req.ip
            });

            res.json({
                success: true,
                message: 'Session deleted successfully'
            });

        } catch (error) {
            logger.error('Delete session error:', error);
            res.status(500).json({
                error: 'Error deleting therapy session',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Generate session summary
     */
    async generateSessionSummary(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;

            const summary = await psychologyService.generateSessionSummary(id, psychologistId);

            if (!summary) {
                return res.status(404).json({
                    error: 'Session not found or cannot generate summary',
                    code: 'SESSION_NOT_FOUND'
                });
            }

            // Decrypt PHI for authorized access
            const decryptedSummary = {
                ...summary,
                content: summary.content ? decryptPhi(summary.content) : null
            };

            res.json({
                success: true,
                summary: decryptedSummary
            });

        } catch (error) {
            logger.error('Generate session summary error:', error);
            res.status(500).json({
                error: 'Error generating session summary',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get session progress over time for a patient
     */
    async getSessionProgress(req, res) {
        try {
            const psychologistId = req.user.id;
            const { patientId } = req.query;
            const { timeframe = '6months', sessionType } = req.query;

            if (!patientId) {
                return res.status(400).json({
                    error: 'Patient ID is required',
                    code: 'VALIDATION_ERROR'
                });
            }

            const progress = await psychologyService.getSessionProgress({
                psychologistId,
                patientId,
                timeframe,
                sessionType
            });

            res.json({
                success: true,
                progress
            });

        } catch (error) {
            logger.error('Get session progress error:', error);
            res.status(500).json({
                error: 'Error retrieving session progress',
                code: 'INTERNAL_ERROR'
            });
        }
    }
}

module.exports = new PsychologySessionController();