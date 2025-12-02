const express = require('express');
const router = express.Router();
const collaborationService = require('../services/collaboration/CollaborationService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateReferral, validateCareTeam, validateEmergencyAlert } = require('../middleware/validation');

// Referral Routes
router.post('/referrals', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    validateReferral, 
    async (req, res) => {
        try {
            const referralData = {
                ...req.body,
                fromUserId: req.user.id
            };
            
            const referral = await collaborationService.createReferral(referralData);
            
            res.status(201).json({
                success: true,
                data: referral,
                message: 'Referral created successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get('/referrals', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    async (req, res) => {
        try {
            const { status, specialty, limit, offset } = req.query;
            const options = { status, specialty, limit, offset };
            
            const referrals = await collaborationService.getReferralsForProfessional(req.user.id, options);
            
            res.json({
                success: true,
                data: referrals
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.put('/referrals/:referralId/status', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    async (req, res) => {
        try {
            const { referralId } = req.params;
            const { status, responseNotes } = req.body;
            
            const updateData = {};
            if (responseNotes) {
                updateData.responseNotes = responseNotes;
            }
            
            const referral = await collaborationService.updateReferralStatus(
                referralId, 
                req.user.id, 
                status, 
                updateData
            );
            
            res.json({
                success: true,
                data: referral,
                message: 'Referral status updated successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get('/referrals/:referralId', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    async (req, res) => {
        try {
            const { referralId } = req.params;
            const referral = await collaborationService.getReferralById(referralId, req.user.id);
            
            if (!referral) {
                return res.status(404).json({
                    success: false,
                    error: 'Referral not found'
                });
            }
            
            res.json({
                success: true,
                data: referral
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

// Care Team Routes
router.post('/care-teams', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    validateCareTeam, 
    async (req, res) => {
        try {
            const teamData = {
                ...req.body,
                primaryProfessionalId: req.user.id
            };
            
            const careTeam = await collaborationService.createCareTeam(teamData);
            
            res.status(201).json({
                success: true,
                data: careTeam,
                message: 'Care team created successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get('/care-teams/patients/:patientId', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    async (req, res) => {
        try {
            const { patientId } = req.params;
            const careTeam = await collaborationService.getCareTeamForPatient(patientId, req.user.id);
            
            if (!careTeam) {
                return res.status(404).json({
                    success: false,
                    error: 'Care team not found'
                });
            }
            
            res.json({
                success: true,
                data: careTeam
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

// Patient Consent Routes
router.post('/consent', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    async (req, res) => {
        try {
            const consentData = {
                ...req.body,
                professionalId: req.user.id
            };
            
            const consent = await collaborationService.recordPatientConsent(consentData);
            
            res.status(201).json({
                success: true,
                data: consent,
                message: 'Patient consent recorded successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get('/consent/check/:patientId', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    async (req, res) => {
        try {
            const { patientId } = req.params;
            const { consentType } = req.query;
            
            const hasConsent = await collaborationService.checkPatientConsent(
                patientId, 
                req.user.id, 
                consentType
            );
            
            res.json({
                success: true,
                data: { hasConsent }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

// Emergency Alert Routes
router.post('/emergency-alerts', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    validateEmergencyAlert, 
    async (req, res) => {
        try {
            const alertData = {
                ...req.body,
                reporterId: req.user.id
            };
            
            const alert = await collaborationService.createEmergencyAlert(alertData);
            
            res.status(201).json({
                success: true,
                data: alert,
                message: 'Emergency alert created successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

// Team Communication Routes
router.post('/team-messages', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    async (req, res) => {
        try {
            const messageData = {
                ...req.body,
                fromUserId: req.user.id
            };
            
            const message = await collaborationService.createTeamMessage(messageData);
            
            res.status(201).json({
                success: true,
                data: message,
                message: 'Team message sent successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

router.get('/team-messages/:careTeamId', 
    authenticateToken, 
    requireRole(['professional', 'admin']), 
    async (req, res) => {
        try {
            const { careTeamId } = req.params;
            const { limit, offset, messageType } = req.query;
            const options = { limit, offset, messageType };
            
            const messages = await collaborationService.getTeamMessages(careTeamId, options);
            
            res.json({
                success: true,
                data: messages
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

module.exports = router;