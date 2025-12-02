/**
 * Psychology Controller - AIRA
 * Core controller for psychologist-specific workflows
 * Handles clinical documentation, progress tracking, and psychology dashboard
 * @version 1.0.0
 */

const psychologyService = require('../services/psychologyService');
const logger = require('../utils/logger');
const { encryptPhi, decryptPhi } = require('../utils/encryption');

class PsychologyController {
    /**
     * Create SOAP note
     */
    async createSOAPNote(req, res) {
        try {
            const psychologistId = req.user.id;
            const { patientId, sessionData, subjective, objective, assessment, plan } = req.body;

            // Validate required fields
            if (!patientId || !subjective || !assessment || !plan) {
                return res.status(400).json({
                    error: 'Missing required SOAP note fields',
                    code: 'VALIDATION_ERROR'
                });
            }

            const soapNote = await psychologyService.createSOAPNote({
                psychologistId,
                patientId,
                sessionData,
                subjective: encryptPhi(subjective),
                objective: encryptPhi(objective || ''),
                assessment: encryptPhi(assessment),
                plan: encryptPhi(plan),
                createdAt: new Date()
            });

            logger.info('SOAP note created:', {
                noteId: soapNote.id,
                psychologistId,
                patientId,
                ip: req.ip
            });

            res.status(201).json({
                success: true,
                note: soapNote
            });

        } catch (error) {
            logger.error('Create SOAP note error:', error);
            res.status(500).json({
                error: 'Error creating SOAP note',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get patient notes
     */
    async getPatientNotes(req, res) {
        try {
            const { patientId } = req.params;
            const psychologistId = req.user.id;
            const { limit = 50, offset = 0, noteType } = req.query;

            const notes = await psychologyService.getPatientNotes({
                psychologistId,
                patientId,
                limit: parseInt(limit),
                offset: parseInt(offset),
                noteType
            });

            // Decrypt PHI for authorized access
            const decryptedNotes = notes.data.map(note => ({
                ...note,
                subjective: note.subjective ? decryptPhi(note.subjective) : null,
                objective: note.objective ? decryptPhi(note.objective) : null,
                assessment: note.assessment ? decryptPhi(note.assessment) : null,
                plan: note.plan ? decryptPhi(note.plan) : null
            }));

            res.json({
                success: true,
                notes: decryptedNotes,
                total: notes.total,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: notes.hasMore
                }
            });

        } catch (error) {
            logger.error('Get patient notes error:', error);
            res.status(500).json({
                error: 'Error retrieving patient notes',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get note by ID
     */
    async getNoteById(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;

            const note = await psychologyService.getNoteById(id, psychologistId);

            if (!note) {
                return res.status(404).json({
                    error: 'Note not found',
                    code: 'NOTE_NOT_FOUND'
                });
            }

            // Decrypt PHI for authorized access
            const decryptedNote = {
                ...note,
                subjective: note.subjective ? decryptPhi(note.subjective) : null,
                objective: note.objective ? decryptPhi(note.objective) : null,
                assessment: note.assessment ? decryptPhi(note.assessment) : null,
                plan: note.plan ? decryptPhi(note.plan) : null
            };

            res.json({
                success: true,
                note: decryptedNote
            });

        } catch (error) {
            logger.error('Get note by ID error:', error);
            res.status(500).json({
                error: 'Error retrieving note',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Update note
     */
    async updateNote(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;
            const updates = req.body;

            // Encrypt PHI updates
            const encryptedUpdates = { ...updates };
            if (updates.subjective) encryptedUpdates.subjective = encryptPhi(updates.subjective);
            if (updates.objective) encryptedUpdates.objective = encryptPhi(updates.objective);
            if (updates.assessment) encryptedUpdates.assessment = encryptPhi(updates.assessment);
            if (updates.plan) encryptedUpdates.plan = encryptPhi(updates.plan);

            const result = await psychologyService.updateNote(id, psychologistId, encryptedUpdates);

            if (!result.success) {
                return res.status(404).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Note updated:', {
                noteId: id,
                psychologistId,
                updatedFields: Object.keys(updates),
                ip: req.ip
            });

            res.json({
                success: true,
                note: result.note
            });

        } catch (error) {
            logger.error('Update note error:', error);
            res.status(500).json({
                error: 'Error updating note',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Sign note (make it read-only)
     */
    async signNote(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;
            const { signatureTimestamp } = req.body;

            const result = await psychologyService.signNote(id, psychologistId, signatureTimestamp);

            if (!result.success) {
                return res.status(400).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Note signed:', {
                noteId: id,
                psychologistId,
                signatureTimestamp,
                ip: req.ip
            });

            res.json({
                success: true,
                note: result.note
            });

        } catch (error) {
            logger.error('Sign note error:', error);
            res.status(500).json({
                error: 'Error signing note',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get patient progress
     */
    async getPatientProgress(req, res) {
        try {
            const { patientId } = req.params;
            const psychologistId = req.user.id;
            const { timeframe = '6months' } = req.query;

            const progress = await psychologyService.getPatientProgress({
                psychologistId,
                patientId,
                timeframe
            });

            res.json({
                success: true,
                progress
            });

        } catch (error) {
            logger.error('Get patient progress error:', error);
            res.status(500).json({
                error: 'Error retrieving patient progress',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Create treatment goal
     */
    async createGoal(req, res) {
        try {
            const psychologistId = req.user.id;
            const { patientId, title, description, targetDate, milestones } = req.body;

            const goal = await psychologyService.createGoal({
                psychologistId,
                patientId,
                title,
                description: encryptPhi(description),
                targetDate,
                milestones,
                createdAt: new Date()
            });

            logger.info('Goal created:', {
                goalId: goal.id,
                psychologistId,
                patientId,
                ip: req.ip
            });

            res.status(201).json({
                success: true,
                goal
            });

        } catch (error) {
            logger.error('Create goal error:', error);
            res.status(500).json({
                error: 'Error creating goal',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Update goal
     */
    async updateGoal(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;
            const updates = req.body;

            // Encrypt PHI updates
            const encryptedUpdates = { ...updates };
            if (updates.description) encryptedUpdates.description = encryptPhi(updates.description);

            const result = await psychologyService.updateGoal(id, psychologistId, encryptedUpdates);

            if (!result.success) {
                return res.status(404).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Goal updated:', {
                goalId: id,
                psychologistId,
                updatedFields: Object.keys(updates),
                ip: req.ip
            });

            res.json({
                success: true,
                goal: result.goal
            });

        } catch (error) {
            logger.error('Update goal error:', error);
            res.status(500).json({
                error: 'Error updating goal',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get progress report
     */
    async getProgressReport(req, res) {
        try {
            const { patientId } = req.params;
            const psychologistId = req.user.id;
            const { startDate, endDate, format = 'json' } = req.query;

            const report = await psychologyService.generateProgressReport({
                psychologistId,
                patientId,
                startDate,
                endDate,
                format
            });

            res.json({
                success: true,
                report
            });

        } catch (error) {
            logger.error('Get progress report error:', error);
            res.status(500).json({
                error: 'Error generating progress report',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get note templates
     */
    async getNoteTemplates(req, res) {
        try {
            const { templateType } = req.query;

            const templates = await psychologyService.getNoteTemplates(templateType);

            res.json({
                success: true,
                templates
            });

        } catch (error) {
            logger.error('Get note templates error:', error);
            res.status(500).json({
                error: 'Error retrieving note templates',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Create referral
     */
    async createReferral(req, res) {
        try {
            const psychologistId = req.user.id;
            const { patientId, referralType, specialistInfo, urgency, notes } = req.body;

            const referral = await psychologyService.createReferral({
                psychologistId,
                patientId,
                referralType,
                specialistInfo,
                urgency,
                notes: encryptPhi(notes),
                createdAt: new Date()
            });

            logger.info('Referral created:', {
                referralId: referral.id,
                psychologistId,
                patientId,
                referralType,
                ip: req.ip
            });

            res.status(201).json({
                success: true,
                referral
            });

        } catch (error) {
            logger.error('Create referral error:', error);
            res.status(500).json({
                error: 'Error creating referral',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get referrals
     */
    async getReferrals(req, res) {
        try {
            const psychologistId = req.user.id;
            const { status, limit = 50, offset = 0 } = req.query;

            const referrals = await psychologyService.getReferrals({
                psychologistId,
                status,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            // Decrypt PHI for authorized access
            const decryptedReferrals = referrals.data.map(referral => ({
                ...referral,
                notes: referral.notes ? decryptPhi(referral.notes) : null
            }));

            res.json({
                success: true,
                referrals: decryptedReferrals,
                total: referrals.total,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: referrals.hasMore
                }
            });

        } catch (error) {
            logger.error('Get referrals error:', error);
            res.status(500).json({
                error: 'Error retrieving referrals',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Update referral
     */
    async updateReferral(req, res) {
        try {
            const { id } = req.params;
            const psychologistId = req.user.id;
            const updates = req.body;

            // Encrypt PHI updates
            const encryptedUpdates = { ...updates };
            if (updates.notes) encryptedUpdates.notes = encryptPhi(updates.notes);

            const result = await psychologyService.updateReferral(id, psychologistId, encryptedUpdates);

            if (!result.success) {
                return res.status(404).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Referral updated:', {
                referralId: id,
                psychologistId,
                updatedFields: Object.keys(updates),
                ip: req.ip
            });

            res.json({
                success: true,
                referral: result.referral
            });

        } catch (error) {
            logger.error('Update referral error:', error);
            res.status(500).json({
                error: 'Error updating referral',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get dashboard statistics
     */
    async getDashboardStats(req, res) {
        try {
            const psychologistId = req.user.id;

            const stats = await psychologyService.getDashboardStats(psychologistId);

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            logger.error('Get dashboard stats error:', error);
            res.status(500).json({
                error: 'Error retrieving dashboard statistics',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get recent sessions
     */
    async getRecentSessions(req, res) {
        try {
            const psychologistId = req.user.id;
            const { limit = 10 } = req.query;

            const sessions = await psychologyService.getRecentSessions({
                psychologistId,
                limit: parseInt(limit)
            });

            res.json({
                success: true,
                sessions
            });

        } catch (error) {
            logger.error('Get recent sessions error:', error);
            res.status(500).json({
                error: 'Error retrieving recent sessions',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Get upcoming sessions
     */
    async getUpcomingSessions(req, res) {
        try {
            const psychologistId = req.user.id;
            const { days = 7 } = req.query;

            const sessions = await psychologyService.getUpcomingSessions({
                psychologistId,
                days: parseInt(days)
            });

            res.json({
                success: true,
                sessions
            });

        } catch (error) {
            logger.error('Get upcoming sessions error:', error);
            res.status(500).json({
                error: 'Error retrieving upcoming sessions',
                code: 'INTERNAL_ERROR'
            });
        }
    }
}

module.exports = new PsychologyController();