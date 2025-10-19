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
    }
};

// Exportar los middlewares de validación
module.exports = {
    validateObjectId,
    validate: (schema) => celebrate(schema, { abortEarly: false })
}; 