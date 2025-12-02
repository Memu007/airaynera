/**
 * Validadores con Joi - AIRA Backend
 * Esquemas de validación para todas las rutas de la API
 * @version 1.0.0
 */

const Joi = require('joi');

// ===== ESQUEMAS COMUNES =====

const dniSchema = Joi.string()
    .pattern(/^\d{7,8}$/)
    .required()
    .messages({
        'string.pattern.base': 'DNI debe tener 7 u 8 dígitos',
        'string.empty': 'DNI es requerido'
    });

const emailSchema = Joi.string()
    .email()
    .required()
    .messages({
        'string.email': 'Email inválido',
        'string.empty': 'Email es requerido'
    });

const passwordSchema = Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
        'string.min': 'La contraseña debe tener al menos 8 caracteres',
        'string.pattern.base': 'La contraseña debe contener mayúsculas, minúsculas, números y caracteres especiales',
        'string.empty': 'Contraseña es requerida'
    });

const phoneSchema = Joi.string()
    .pattern(/^[\d\s\-\+\(\)]+$/)
    .min(10)
    .max(20)
    .messages({
        'string.pattern.base': 'Teléfono inválido'
    });

const mongoIdSchema = Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
        'string.pattern.base': 'ID inválido'
    });

// ===== VALIDADORES DE AUTENTICACIÓN =====

const authValidators = {
    login: Joi.object({
        email: emailSchema,
        password: Joi.string().required()
    }),

    register: Joi.object({
        email: emailSchema,
        password: passwordSchema,
        name: Joi.string().min(3).max(100).required(),
        specialty: Joi.string().valid('Psicólogo/a', 'Psiquiatra', 'Otro').required(),
        dni: dniSchema
    }),

    refresh: Joi.object({
        refreshToken: Joi.string().required()
    }),

    changePassword: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: passwordSchema
    }),

    resetPassword: Joi.object({
        email: emailSchema
    }),

    confirmReset: Joi.object({
        token: Joi.string().required(),
        newPassword: passwordSchema
    })
};

// ===== VALIDADORES DE PACIENTES =====

const patientValidators = {
    create: Joi.object({
        name: Joi.string().min(3).max(100).required(),
        dni: dniSchema,
        insurance: Joi.string().max(100).required(),
        phone: phoneSchema.allow(''),
        email: Joi.string().email().allow(''),
        birthDate: Joi.date().max('now'),
        address: Joi.string().max(200),
        emergencyContact: Joi.object({
            name: Joi.string().max(100),
            phone: phoneSchema,
            relationship: Joi.string().max(50)
        })
    }),

    update: Joi.object({
        name: Joi.string().min(3).max(100),
        insurance: Joi.string().max(100),
        phone: phoneSchema.allow(''),
        email: Joi.string().email().allow(''),
        address: Joi.string().max(200),
        status: Joi.string().valid('activo', 'inactivo'),
        emergencyContact: Joi.object({
            name: Joi.string().max(100),
            phone: phoneSchema,
            relationship: Joi.string().max(50)
        })
    }),

    search: Joi.object({
        query: Joi.string().min(2).max(100),
        status: Joi.string().valid('activo', 'inactivo', 'todos'),
        limit: Joi.number().min(1).max(100).default(20),
        offset: Joi.number().min(0).default(0)
    }),

    getById: Joi.object({
        id: mongoIdSchema.required()
    })
};

// ===== VALIDADORES DE SESIONES =====

const sessionValidators = {
    create: Joi.object({
        patientId: mongoIdSchema.required(),
        content: Joi.string().min(10).max(5000).required(),
        moodAssessment: Joi.number().min(1).max(5).required(),
        medicationNotes: Joi.string().max(1000).allow(''),
        nextAppointment: Joi.date().min('now').allow(null),
        alerts: Joi.array().items(
            Joi.string().valid('crisis', 'medication_change', 'followup_required')
        ),
        attachments: Joi.array().items(
            Joi.object({
                type: Joi.string().valid('image', 'document', 'audio'),
                url: Joi.string().uri()
            })
        ).max(5)
    }),

    update: Joi.object({
        content: Joi.string().min(10).max(5000),
        moodAssessment: Joi.number().min(1).max(5),
        medicationNotes: Joi.string().max(1000).allow(''),
        nextAppointment: Joi.date().allow(null),
        alerts: Joi.array().items(
            Joi.string().valid('crisis', 'medication_change', 'followup_required')
        )
    }),

    search: Joi.object({
        patientId: mongoIdSchema,
        startDate: Joi.date(),
        endDate: Joi.date().min(Joi.ref('startDate')),
        moodRange: Joi.object({
            min: Joi.number().min(1).max(5),
            max: Joi.number().min(Joi.ref('min')).max(5)
        }),
        hasAlerts: Joi.boolean(),
        limit: Joi.number().min(1).max(100).default(20),
        offset: Joi.number().min(0).default(0)
    }),

    aiAnalysis: Joi.object({
        sessionId: mongoIdSchema.required(),
        analysisType: Joi.string()
            .valid('summary', 'risk_assessment', 'treatment_suggestions')
            .default('summary')
    })
};

// ===== VALIDADORES DE MENSAJES (WHATSAPP) =====

const messageValidators = {
    send: Joi.object({
        to: phoneSchema.required(),
        message: Joi.string().min(1).max(1000).required(),
        type: Joi.string().valid('text', 'template', 'media').default('text'),
        mediaUrl: Joi.when('type', {
            is: 'media',
            then: Joi.string().uri().required()
        })
    }),

    webhook: Joi.object({
        // WhatsApp webhook payload - estructura específica
        entry: Joi.array().required()
    })
};

// ===== VALIDADORES DE CONFIGURACIÓN =====

const settingsValidators = {
    updateProfile: Joi.object({
        name: Joi.string().min(3).max(100),
        specialty: Joi.string().valid('Psicólogo/a', 'Psiquiatra', 'Otro'),
        phone: phoneSchema,
        notifications: Joi.object({
            email: Joi.boolean(),
            whatsapp: Joi.boolean(),
            appointments: Joi.boolean(),
            alerts: Joi.boolean()
        })
    }),

    updatePreferences: Joi.object({
        language: Joi.string().valid('es', 'en', 'pt').default('es'),
        timezone: Joi.string().default('America/Argentina/Buenos_Aires'),
        dateFormat: Joi.string().valid('DD/MM/YYYY', 'MM/DD/YYYY').default('DD/MM/YYYY'),
        workingHours: Joi.object({
            start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
            end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        })
    })
};

// ===== MIDDLEWARE DE VALIDACIÓN =====

/**
 * Crea un middleware de validación para un esquema específico
 */
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // Mostrar todos los errores
            stripUnknown: true // Remover campos no definidos
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Errores de validación',
                code: 'VALIDATION_ERROR',
                details: errors
            });
        }

        // Reemplazar body con valores validados y sanitizados
        req.body = value;
        next();
    };
};

/**
 * Validar parámetros de ruta
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false
        });

        if (error) {
            return res.status(400).json({
                error: 'Parámetros inválidos',
                code: 'INVALID_PARAMS',
                details: error.details.map(d => d.message)
            });
        }

        req.params = value;
        next();
    };
};

/**
 * Validar query strings
 */
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false
        });

        if (error) {
            return res.status(400).json({
                error: 'Parámetros de búsqueda inválidos',
                code: 'INVALID_QUERY',
                details: error.details.map(d => d.message)
            });
        }

        req.query = value;
        next();
    };
};

// Exportar todo
module.exports = {
    // Validadores
    auth: authValidators,
    patients: patientValidators,
    sessions: sessionValidators,
    messages: messageValidators,
    settings: settingsValidators,
    
    // Middlewares
    validate,
    validateParams,
    validateQuery,
    
    // Esquemas comunes (por si se necesitan)
    schemas: {
        dni: dniSchema,
        email: emailSchema,
        password: passwordSchema,
        phone: phoneSchema,
        mongoId: mongoIdSchema
    }
}; 