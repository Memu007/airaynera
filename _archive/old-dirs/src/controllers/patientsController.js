/**
 * Controlador de Pacientes - AIRA
 * Maneja operaciones CRUD de pacientes
 * @version 1.0.0
 */

const patientsService = require('../services/patientsService');
const logger = require('../utils/logger');

class PatientsController {
    /**
     * Obtener todos los pacientes del usuario
     */
    async getAll(req, res) {
        try {
            const userId = req.user.id;
            const { status = 'activo', limit = 20, offset = 0 } = req.query;

            const patients = await patientsService.getPatientsByUser(userId, {
                status,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                success: true,
                patients: patients.data,
                total: patients.total,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: patients.hasMore
                }
            });

        } catch (error) {
            logger.error('Get patients error:', error);
            res.status(500).json({
                error: 'Error al obtener pacientes',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Obtener un paciente por ID
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const patient = await patientsService.getPatientById(id, userId);

            if (!patient) {
                return res.status(404).json({
                    error: 'Paciente no encontrado',
                    code: 'PATIENT_NOT_FOUND'
                });
            }

            res.json({
                success: true,
                patient
            });

        } catch (error) {
            logger.error('Get patient by ID error:', error);
            res.status(500).json({
                error: 'Error al obtener paciente',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Crear nuevo paciente
     */
    async create(req, res) {
        try {
            const userId = req.user.id;
            const patientData = {
                ...req.body,
                userId,
                createdAt: new Date(),
                status: 'activo'
            };

            const patient = await patientsService.createPatient(patientData);

            logger.info('Patient created:', {
                patientId: patient.id,
                userId,
                ip: req.ip
            });

            res.status(201).json({
                success: true,
                patient
            });

        } catch (error) {
            logger.error('Create patient error:', error);
            res.status(500).json({
                error: 'Error al crear paciente',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Actualizar paciente
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const updates = req.body;

            const result = await patientsService.updatePatient(id, userId, updates);

            if (!result.success) {
                return res.status(404).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Patient updated:', {
                patientId: id,
                userId,
                updatedFields: Object.keys(updates),
                ip: req.ip
            });

            res.json({
                success: true,
                patient: result.patient
            });

        } catch (error) {
            logger.error('Update patient error:', error);
            res.status(500).json({
                error: 'Error al actualizar paciente',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Cambiar status del paciente (activar/desactivar)
     */
    async changeStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const userId = req.user.id;

            const result = await patientsService.changePatientStatus(id, userId, status);

            if (!result.success) {
                return res.status(404).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Patient status changed:', {
                patientId: id,
                userId,
                newStatus: status,
                ip: req.ip
            });

            res.json({
                success: true,
                patient: result.patient
            });

        } catch (error) {
            logger.error('Change patient status error:', error);
            res.status(500).json({
                error: 'Error al cambiar estado del paciente',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Buscar pacientes
     */
    async search(req, res) {
        try {
            const userId = req.user.id;
            const { query, status, limit = 20, offset = 0 } = req.query;

            const results = await patientsService.searchPatients(userId, {
                query,
                status,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                success: true,
                patients: results.data,
                total: results.total,
                searchQuery: query
            });

        } catch (error) {
            logger.error('Search patients error:', error);
            res.status(500).json({
                error: 'Error al buscar pacientes',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Eliminar un paciente (soft delete)
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // *** PASAR userId AL SERVICIO ***
            const result = await patientsService.delete(id, userId);

            if (!result) {
                return res.status(404).json({
                    error: 'Paciente no encontrado',
                    code: 'PATIENT_NOT_FOUND'
                });
            }

            logger.info('Patient deleted successfully', {
                patientId: id,
                deletedBy: userId
            });

            res.json({
                success: true,
                message: 'Paciente eliminado correctamente'
            });

        } catch (error) {
            logger.error('Delete patient error:', error);
            
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    error: 'Paciente no encontrado',
                    code: 'PATIENT_NOT_FOUND'
                });
            }

            res.status(500).json({
                error: 'Error al eliminar paciente',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Obtener estadísticas de pacientes
     */
    async getStats(req, res) {
        try {
            const userId = req.user.id;
            // *** PASAR userId AL SERVICIO ***
            const stats = await patientsService.getStats(userId);

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            logger.error('Get patient stats error:', error);
            res.status(500).json({
                error: 'Error al obtener estadísticas',
                code: 'INTERNAL_ERROR'
            });
        }
    }
}

module.exports = new PatientsController(); 