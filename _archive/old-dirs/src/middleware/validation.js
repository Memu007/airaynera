const { celebrate, Joi, Segments } = require('celebrate');
const mongoose = require('mongoose');

// Middleware para validar el formato de ObjectId de Mongoose/MongoDB
const validateObjectId = (req, res, next) => {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            error: 'Invalid ID format',
            code: 'INVALID_ID_FORMAT'
        });
    }
    next();
};

// Esquemas de validación de Joi
const schemas = {
    // Auth
    register: {
        [Segments.BODY]: Joi.object().keys({
            name: Joi.string().min(3).max(50).required(),
            email: Joi.string().email().required(),
            password: Joi.string().min(8).required(),
            role: Joi.string().valid('professional', 'admin')
        })
    },
    login: {
        [Segments.BODY]: Joi.object().keys({
            email: Joi.string().email().required(),
            password: Joi.string().required()
        })
    },

    // Patient
    createPatient: {
        [Segments.BODY]: Joi.object().keys({
            name: Joi.string().min(3).max(50).required(),
            dni: Joi.string().pattern(/^[0-9]{7,8}$/).required(),
            email: Joi.string().email().allow('').optional(),
            phone: Joi.string().allow('').optional(),
            birthDate: Joi.date().iso().optional(),
            address: Joi.string().allow('').optional()
        })
    },
    updatePatient: {
        [Segments.BODY]: Joi.object().keys({
            name: Joi.string().min(3).max(50),
            email: Joi.string().email().allow(''),
            phone: Joi.string().allow(''),
            birthDate: Joi.date().iso(),
            address: Joi.string().allow('')
        }).min(1) // Al menos un campo para actualizar
    },

    // Session
    createSession: {
        [Segments.BODY]: Joi.object().keys({
            patientId: Joi.string().required(), // Idealmente validar que sea un ObjectId
            date: Joi.date().iso().required(),
            time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
            duration: Joi.number().integer().min(15).max(240),
            notes: Joi.string().allow(''),
            type: Joi.string().valid('individual', 'group', 'family'),
            status: Joi.string().valid('scheduled', 'confirmed', 'completed', 'cancelled')
        })
    },

    // Collaboration - Referrals
    createReferral: {
        [Segments.BODY]: Joi.object().keys({
            toUserId: Joi.string().required(),
            patientId: Joi.string().required(),
            fromSpecialty: Joi.string().valid('psychology', 'psychiatry', 'general_practice', 'neurology', 'other').required(),
            toSpecialty: Joi.string().valid('psychology', 'psychiatry', 'general_practice', 'neurology', 'other').required(),
            reasonForReferral: Joi.string().min(10).max(500).required(),
            urgency: Joi.string().valid('routine', 'urgent', 'emergency').default('routine'),
            clinicalNotes: Joi.string().max(2000).optional(),
            recommendations: Joi.string().max(1000).optional()
        })
    },

    updateReferralStatus: {
        [Segments.BODY]: Joi.object().keys({
            status: Joi.string().valid('accepted', 'rejected', 'pending_review', 'completed').required(),
            responseNotes: Joi.string().max(1000).optional()
        })
    },

    // Collaboration - Care Teams
    createCareTeam: {
        [Segments.BODY]: Joi.object().keys({
            patientId: Joi.string().required(),
            teamName: Joi.string().max(100).optional(),
            members: Joi.array().items(
                Joi.object().keys({
                    userId: Joi.string().required(),
                    role: Joi.string().valid('primary', 'psychologist', 'psychiatrist', 'therapist', 'counselor', 'member').default('member'),
                    specialty: Joi.string().valid('psychology', 'psychiatry', 'general_practice', 'neurology', 'other').optional()
                })
            ).optional(),
            emergencyContact: Joi.object().keys({
                name: Joi.string().required(),
                relationship: Joi.string().required(),
                phone: Joi.string().required(),
                priority: Joi.string().valid('primary', 'secondary').default('primary')
            }).optional()
        })
    },

    // Collaboration - Patient Consent
    createConsent: {
        [Segments.BODY]: Joi.object().keys({
            patientId: Joi.string().required(),
            consentType: Joi.string().valid('share_info', 'treatment', 'emergency', 'research').required(),
            scope: Joi.string().valid('specific', 'all', 'emergency_only', 'limited').required(),
            expiresAt: Joi.date().iso().optional(),
            notes: Joi.string().max(500).optional()
        })
    },

    // Collaboration - Emergency Alerts
    createEmergencyAlert: {
        [Segments.BODY]: Joi.object().keys({
            patientId: Joi.string().required(),
            alertType: Joi.string().valid('suicide_risk', 'medical_emergency', 'crisis', 'medication_adverse', 'behavioral_crisis').required(),
            severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
            description: Joi.string().min(10).max(1000).required(),
            immediateAction: Joi.string().max(500).optional()
        })
    },

    // Collaboration - Team Messages
    createTeamMessage: {
        [Segments.BODY]: Joi.object().keys({
            careTeamId: Joi.string().required(),
            patientId: Joi.string().required(),
            message: Joi.string().min(1).max(2000).required(),
            messageType: Joi.string().valid('general', 'urgent', 'clinical_update', 'coordination', 'emergency').default('general'),
            priority: Joi.string().valid('normal', 'high', 'urgent').default('normal')
        })
    },

    // Session Storage - Store Session
    storeSession: {
        [Segments.BODY]: Joi.object().keys({
            sessionId: Joi.string().optional(),
            patientId: Joi.string().required(),
            sessionDate: Joi.date().iso().required(),
            sessionType: Joi.string().valid('audio', 'text').required(),
            sessionDuration: Joi.number().integer().min(1).max(300).required(),
            notes: Joi.string().max(2000).optional(),
            audioFile: Joi.binary().optional()
        })
    }
};

// Function to validate session storage
const validateSessionStorage = (sessionData) => {
    const schema = Joi.object({
        sessionId: Joi.string().optional(),
        professionalId: Joi.string().required(),
        professionalType: Joi.string().valid('psychologist', 'psychiatrist').required(),
        patientId: Joi.string().required(),
        sessionDate: Joi.date().iso().required(),
        sessionType: Joi.string().valid('audio', 'text').required(),
        sessionDuration: Joi.number().integer().min(1).max(300).required(),
        notes: Joi.string().max(2000).allow('').optional(),
        audioFile: Joi.binary().optional()
    });

    const { error, value } = schema.validate(sessionData);
    
    return {
        isValid: !error,
        errors: error ? error.details.map(d => d.message) : [],
        value: value
    };
};

// Exportar los middlewares de validación
module.exports = {
    validateObjectId,
    validate: (schema) => celebrate(schema, { abortEarly: false }),
    validateReferral: (req, res, next) => celebrate(schemas.createReferral, { abortEarly: false })(req, res, next),
    validateCareTeam: (req, res, next) => celebrate(schemas.createCareTeam, { abortEarly: false })(req, res, next),
    validateEmergencyAlert: (req, res, next) => celebrate(schemas.createEmergencyAlert, { abortEarly: false })(req, res, next),
    validateConsent: (req, res, next) => celebrate(schemas.createConsent, { abortEarly: false })(req, res, next),
    validateTeamMessage: (req, res, next) => celebrate(schemas.createTeamMessage, { abortEarly: false })(req, res, next),
    validateSessionStorage
}; 