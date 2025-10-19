/**
 * 👥 USER SERVICE - AIRA Medical System
 * Gestión de usuarios con seguridad y validación de contraseñas
 * Versión 2.0 - Production Ready
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { EventEmitter } = require('events');

class UserService extends EventEmitter {
    constructor(db) {
        super();
        this.db = db;
        
        // Configuración de seguridad de contraseñas
        this.passwordConfig = {
            minLength: 8,
            maxLength: 128,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            preventReuse: 5, // No reusar últimas 5 contraseñas
            bcryptRounds: 12
        };

        // Patrones prohibidos
        this.forbiddenPatterns = [
            /123456/i,
            /password/i,
            /qwerty/i,
            /admin/i,
            /letmein/i,
            /welcome/i,
            /aira/i,
            /medico/i,
            /psicologo/i,
            /doctor/i
        ];

        console.log('👥 UserService initialized');
    }

    /**
     * Validar fuerza de contraseña
     */
    validatePasswordStrength(password, userData = {}) {
        const errors = [];

        // Longitud mínima y máxima
        if (password.length < this.passwordConfig.minLength) {
            errors.push(`Mínimo ${this.passwordConfig.minLength} caracteres`);
        }
        if (password.length > this.passwordConfig.maxLength) {
            errors.push(`Máximo ${this.passwordConfig.maxLength} caracteres`);
        }

        // Requisitos de caracteres
        if (this.passwordConfig.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Al menos una mayúscula');
        }
        if (this.passwordConfig.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Al menos una minúscula');
        }
        if (this.passwordConfig.requireNumbers && !/[0-9]/.test(password)) {
            errors.push('Al menos un número');
        }
        if (this.passwordConfig.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Al menos un carácter especial');
        }

        // Patrones prohibidos
        for (const pattern of this.forbiddenPatterns) {
            if (pattern.test(password)) {
                errors.push('No usar patrones comunes o predecibles');
                break;
            }
        }

        // No contener información personal
        if (userData.name && password.toLowerCase().includes(userData.name.toLowerCase())) {
            errors.push('La contraseña no puede contener tu nombre');
        }
        if (userData.email && password.toLowerCase().includes(userData.email.split('@')[0].toLowerCase())) {
            errors.push('La contraseña no puede contener tu email');
        }
        if (userData.dni && password.includes(userData.dni)) {
            errors.push('La contraseña no puede contener tu DNI');
        }

        // Secuencias comunes
        if (this.hasCommonSequences(password)) {
            errors.push('No usar secuencias comunes (123, abc, etc.)');
        }

        // Calcular fuerza
        let strength = 'weak';
        if (errors.length === 0 && password.length >= 12) {
            strength = 'strong';
        } else if (errors.length <= 2 && password.length >= 8) {
            strength = 'medium';
        }

        return {
            isValid: errors.length === 0,
            errors,
            strength,
            score: this.calculatePasswordScore(password)
        };
    }

    /**
     * Calcular score de contraseña (0-100)
     */
    calculatePasswordScore(password) {
        let score = 0;

        // Longitud
        score += Math.min(password.length * 2, 30);

        // Diversidad de caracteres
        if (/[a-z]/.test(password)) score += 10;
        if (/[A-Z]/.test(password)) score += 10;
        if (/[0-9]/.test(password)) score += 10;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 15;

        // Bonus por longitud extra
        if (password.length > 12) score += 10;
        if (password.length > 16) score += 15;

        // Penalizaciones
        if (this.hasCommonSequences(password)) score -= 20;
        if (password.toLowerCase() === password) score -= 10;
        if (password.toUpperCase() === password) score -= 10;

        return Math.min(Math.max(score, 0), 100);
    }

    /**
     * Detectar secuencias comunes
     */
    hasCommonSequences(password) {
        const lowerPassword = password.toLowerCase();
        
        // Secuencias numéricas
        for (let i = 0; i <= 9; i++) {
            if (lowerPassword.includes(`${i}${i+1}${i+2}`)) return true;
        }
        
        // Secuencias alfabéticas
        const sequences = ['abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij', 'ijk', 'jkl', 'klm', 'lmn', 'mno', 'nop', 'opq', 'pqr', 'qrs', 'rst', 'stu', 'tuv', 'uvw', 'vwx', 'wxy', 'xyz'];
        for (const seq of sequences) {
            if (lowerPassword.includes(seq)) return true;
        }
        
        // Secuencias de teclado
        const keyboardSequences = ['qwe', 'wer', 'ert', 'rty', 'tyu', 'yui', 'uio', 'iop', 'asd', 'sdf', 'dfg', 'fgh', 'ghj', 'hjk', 'jkl', 'zxc', 'xcv', 'cvb', 'vbn', 'bnm'];
        for (const seq of keyboardSequences) {
            if (lowerPassword.includes(seq)) return true;
        }
        
        return false;
    }

    /**
     * Generar contraseña segura
     */
    generateSecurePassword(length = 12) {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const special = '!@#$%^&*(),.?":{}|<>';
        const all = lowercase + uppercase + numbers + special;
        
        let password = '';
        
        // Asegurar al menos uno de cada tipo
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += special[Math.floor(Math.random() * special.length)];
        
        // Completar con caracteres aleatorios
        for (let i = password.length; i < length; i++) {
            password += all[Math.floor(Math.random() * all.length)];
        }
        
        // Mezclar caracteres
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    /**
     * Hashear contraseña
     */
    async hashPassword(password) {
        try {
            const salt = await bcrypt.genSalt(this.passwordConfig.bcryptRounds);
            const hash = await bcrypt.hash(password, salt);
            
            // Devolver también el salt para verificación futura
            return {
                hash,
                salt,
                algorithm: 'bcrypt',
                rounds: this.passwordConfig.bcryptRounds
            };
        } catch (error) {
            console.error('Error hashing password:', error);
            throw new Error('Error al procesar la contraseña');
        }
    }

    /**
     * Verificar contraseña
     */
    async verifyPassword(password, hash) {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            console.error('Error verifying password:', error);
            return false;
        }
    }

    /**
     * Crear usuario profesional
     */
    async createProfessional(userData) {
        try {
            const {
                dni,
                name,
                email,
                password,
                specialty,
                role = 'professional',
                phone
            } = userData;

            // Validar datos básicos
            if (!dni || !name || !password) {
                throw new Error('DNI, nombre y contraseña son requeridos');
            }

            // Verificar si ya existe
            const existingDoc = await this.db.collection('professionals').doc(dni).get();
            if (existingDoc.exists) {
                throw new Error('El profesional ya existe');
            }

            // Validar contraseña
            const passwordValidation = this.validatePasswordStrength(password, {
                name,
                email,
                dni
            });

            if (!passwordValidation.isValid) {
                throw new Error(`Contraseña inválida: ${passwordValidation.errors.join(', ')}`);
            }

            // Hash de contraseña
            const passwordData = await this.hashPassword(password);

            // Crear documento de profesional
            const professionalData = {
                dni,
                nombre: name.trim(),
                email: email?.toLowerCase().trim() || `${dni}@aira.medical`,
                password_hash: passwordData.hash,
                especialidad: specialty?.trim() || 'General',
                role,
                telefono: phone?.trim() || '',
                status: 'active',
                created_at: new Date(),
                updated_at: new Date(),
                last_login: null,
                login_count: 0,
                password_created_at: new Date(),
                password_strength: passwordValidation.strength,
                metadata: {
                    password_algorithm: passwordData.algorithm,
                    password_rounds: passwordData.rounds,
                    source: 'system'
                }
            };

            // Guardar en base de datos
            await this.db.collection('professionals').doc(dni).set(professionalData);

            // Crear registro de historial de contraseñas
            await this.savePasswordHistory(dni, passwordData.hash);

            console.log(`✅ Professional created: ${dni.substring(0, 4)}***`);

            this.emit('professionalCreated', { dni, name, role });

            return {
                success: true,
                professional: {
                    dni,
                    name: professionalData.nombre,
                    email: professionalData.email,
                    specialty: professionalData.especialidad,
                    role: professionalData.role,
                    status: professionalData.status
                }
            };

        } catch (error) {
            console.error('Error creating professional:', error);
            throw error;
        }
    }

    /**
     * Cambiar contraseña
     */
    async changePassword(userId, currentPassword, newPassword) {
        try {
            // Obtener usuario
            const userDoc = await this.db.collection('professionals').doc(userId).get();
            if (!userDoc.exists) {
                throw new Error('Usuario no encontrado');
            }

            const userData = userDoc.data();

            // Verificar contraseña actual
            const isCurrentPasswordValid = await this.verifyPassword(currentPassword, userData.password_hash);
            if (!isCurrentPasswordValid) {
                throw new Error('Contraseña actual incorrecta');
            }

            // Validar nueva contraseña
            const passwordValidation = this.validatePasswordStrength(newPassword, {
                name: userData.nombre,
                email: userData.email,
                dni: userId
            });

            if (!passwordValidation.isValid) {
                throw new Error(`Contraseña inválida: ${passwordValidation.errors.join(', ')}`);
            }

            // Verificar que no se reutilice contraseña reciente
            const isPasswordReused = await this.checkPasswordReuse(userId, newPassword);
            if (isPasswordReused) {
                throw new Error('No puedes reusar una contraseña reciente');
            }

            // Hash de nueva contraseña
            const newPasswordData = await this.hashPassword(newPassword);

            // Actualizar en base de datos
            await this.db.collection('professionals').doc(userId).update({
                password_hash: newPasswordData.hash,
                updated_at: new Date(),
                password_updated_at: new Date(),
                password_strength: passwordValidation.strength,
                'metadata.password_algorithm': newPasswordData.algorithm,
                'metadata.password_rounds': newPasswordData.rounds
            });

            // Guardar en historial
            await this.savePasswordHistory(userId, newPasswordData.hash);

            console.log(`🔄 Password changed: ${userId.substring(0, 4)}***`);

            this.emit('passwordChanged', { userId });

            return { success: true };

        } catch (error) {
            console.error('Error changing password:', error);
            throw error;
        }
    }

    /**
     * Resetear contraseña (admin)
     */
    async resetPassword(userId, newPassword, adminId) {
        try {
            // Validar nueva contraseña
            const userDoc = await this.db.collection('professionals').doc(userId).get();
            if (!userDoc.exists) {
                throw new Error('Usuario no encontrado');
            }

            const userData = userDoc.data();

            const passwordValidation = this.validatePasswordStrength(newPassword, {
                name: userData.nombre,
                email: userData.email,
                dni: userId
            });

            if (!passwordValidation.isValid) {
                throw new Error(`Contraseña inválida: ${passwordValidation.errors.join(', ')}`);
            }

            // Hash de nueva contraseña
            const passwordData = await this.hashPassword(newPassword);

            // Actualizar en base de datos
            await this.db.collection('professionals').doc(userId).update({
                password_hash: passwordData.hash,
                updated_at: new Date(),
                password_reset_at: new Date(),
                password_reset_by: adminId,
                password_strength: passwordValidation.strength,
                status: 'active', // Activar cuenta si estaba bloqueada
                'metadata.password_algorithm': passwordData.algorithm,
                'metadata.password_rounds': passwordData.rounds,
                'metadata.last_reset_reason': 'admin_reset'
            });

            // Guardar en historial
            await this.savePasswordHistory(userId, passwordData.hash);

            console.log(`🔄 Password reset by admin: ${userId.substring(0, 4)}*** by ${adminId.substring(0, 4)}***`);

            this.emit('passwordReset', { userId, adminId });

            return { success: true };

        } catch (error) {
            console.error('Error resetting password:', error);
            throw error;
        }
    }

    /**
     * Guardar historial de contraseñas
     */
    async savePasswordHistory(userId, passwordHash) {
        try {
            const historyEntry = {
                user_id: userId,
                password_hash: passwordHash,
                created_at: new Date(),
                algorithm: 'bcrypt'
            };

            await this.db.collection('password_history').add(historyEntry);

            // Mantener solo últimas N contraseñas
            const historySnapshot = await this.db.collection('password_history')
                .where('user_id', '==', userId)
                .orderBy('created_at', 'desc')
                .limit(this.passwordConfig.preventReuse + 1)
                .get();

            if (historySnapshot.size > this.passwordConfig.preventReuse) {
                const toDelete = historySnapshot.docs[this.passwordConfig.preventReuse];
                await this.db.collection('password_history').doc(toDelete.id).delete();
            }

        } catch (error) {
            console.error('Error saving password history:', error);
        }
    }

    /**
     * Verificar si la contraseña fue reutilizada
     */
    async checkPasswordReuse(userId, newPassword) {
        try {
            const historySnapshot = await this.db.collection('password_history')
                .where('user_id', '==', userId)
                .orderBy('created_at', 'desc')
                .limit(this.passwordConfig.preventReuse)
                .get();

            for (const doc of historySnapshot.docs) {
                const historyEntry = doc.data();
                const isReused = await this.verifyPassword(newPassword, historyEntry.password_hash);
                if (isReused) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('Error checking password reuse:', error);
            return false;
        }
    }

    /**
     * Obtener información del usuario (sin datos sensibles)
     */
    async getUserInfo(userId) {
        try {
            const userDoc = await this.db.collection('professionals').doc(userId).get();
            if (!userDoc.exists) {
                return null;
            }

            const userData = userDoc.data();
            
            return {
                id: userData.dni,
                name: userData.nombre,
                email: userData.email,
                specialty: userData.especialidad,
                role: userData.role,
                phone: userData.telefono,
                status: userData.status,
                createdAt: userData.created_at,
                lastLogin: userData.last_login,
                loginCount: userData.login_count || 0,
                passwordStrength: userData.password_strength,
                metadata: userData.metadata
            };

        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    }

    /**
     * Actualizar último login
     */
    async updateLastLogin(userId) {
        try {
            await this.db.collection('professionals').doc(userId).update({
                last_login: new Date(),
                login_count: this.db.FieldValue.increment(1)
            });

            this.emit('loginUpdated', { userId });

        } catch (error) {
            console.error('Error updating last login:', error);
        }
    }

    /**
     * Crear usuarios de prueba seguros
     */
    async createTestUsers() {
        const testUsers = [
            {
                dni: 'admin123',
                name: 'Administrador AIRA',
                email: 'admin@aira.medical',
                password: this.generateSecurePassword(14),
                specialty: 'Administración',
                role: 'admin',
                phone: '+54911'
            },
            {
                dni: 'psych001',
                name: 'Dra. Ana Martínez',
                email: 'ana.martinez@aira.medical',
                password: this.generateSecurePassword(12),
                specialty: 'Psicología Clínica',
                role: 'professional',
                phone: '+54911'
            },
            {
                dni: 'psych002',
                name: 'Dr. Carlos Rodríguez',
                email: 'carlos.rodriguez@aira.medical',
                password: this.generateSecurePassword(12),
                specialty: 'Psiquiatría',
                role: 'professional',
                phone: '+54911'
            },
            {
                dni: 'psych003',
                name: 'Dra. Laura González',
                email: 'laura.gonzalez@aira.medical',
                password: this.generateSecurePassword(12),
                specialty: 'Terapia Familiar',
                role: 'professional',
                phone: '+54911'
            }
        ];

        const results = [];

        for (const testUser of testUsers) {
            try {
                // Verificar si ya existe
                const existingDoc = await this.db.collection('professionals').doc(testUser.dni).get();
                if (existingDoc.exists) {
                    console.log(`⚠️ Test user already exists: ${testUser.dni}`);
                    results.push({
                        dni: testUser.dni,
                        name: testUser.name,
                        status: 'already_exists'
                    });
                    continue;
                }

                await this.createProfessional(testUser);
                results.push({
                    dni: testUser.dni,
                    name: testUser.name,
                    email: testUser.email,
                    password: testUser.password, // Solo para testing
                    role: testUser.role,
                    status: 'created'
                });

                console.log(`✅ Test user created: ${testUser.dni}`);
            } catch (error) {
                console.error(`❌ Error creating test user ${testUser.dni}:`, error.message);
                results.push({
                    dni: testUser.dni,
                    name: testUser.name,
                    status: 'error',
                    error: error.message
                });
            }
        }

        return results;
    }
}

module.exports = UserService;