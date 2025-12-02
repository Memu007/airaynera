const sessionsService = require('../services/sessionsService');
const { validateSessionData } = require('../validators');

class SessionsController {
    async create(req, res) {
        try {
            const sessionData = req.body;
            const therapistId = req.user.id;

            // Validate session data
            const validation = validateSessionData(sessionData);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: validation.errors.join(', ')
                });
            }

            // Add therapist ID to session data
            sessionData.therapistId = therapistId;

            const session = await sessionsService.createSession(sessionData);
            
            res.status(201).json({
                success: true,
                session,
                message: 'Session created successfully'
            });

        } catch (error) {
            console.error('Error creating session:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    async getAll(req, res) {
        try {
            const therapistId = req.user.id;
            const { decrypt = false } = req.query;

            const sessions = await sessionsService.getSessionsByTherapist(therapistId, decrypt);
            
            res.json({
                success: true,
                sessions
            });

        } catch (error) {
            console.error('Error getting sessions:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    async getById(req, res) {
        try {
            const { id } = req.params;
            const therapistId = req.user.id;
            const { decrypt = false } = req.query;

            const session = await sessionsService.getSessionById(id, therapistId, decrypt);
            
            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }

            res.json({
                success: true,
                session
            });

        } catch (error) {
            console.error('Error getting session:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    async getByPatient(req, res) {
        try {
            const { patientId } = req.params;
            const therapistId = req.user.id;
            const { decrypt = false } = req.query;

            const sessions = await sessionsService.getSessionsByPatient(patientId, therapistId, decrypt);
            
            res.json({
                success: true,
                sessions
            });

        } catch (error) {
            console.error('Error getting patient sessions:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const therapistId = req.user.id;

            // Validate update data
            const validation = validateSessionData(updateData, true);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: validation.errors.join(', ')
                });
            }

            const session = await sessionsService.updateSession(id, updateData, therapistId);
            
            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }

            res.json({
                success: true,
                session,
                message: 'Session updated successfully'
            });

        } catch (error) {
            console.error('Error updating session:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.params;
            const therapistId = req.user.id;

            const result = await sessionsService.deleteSession(id, therapistId);
            
            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }

            res.json({
                success: true,
                message: 'Session deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting session:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
}

module.exports = new SessionsController(); 