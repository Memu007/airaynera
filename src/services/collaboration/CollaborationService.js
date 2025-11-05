const { db } = require('../../config/database');
const encryption = require('../../utils/encryption');
const logger = require('../../utils/logger');

class CollaborationService {
    constructor() {
        this.referralsCollection = db.collection('referrals');
        this.careTeamsCollection = db.collection('careTeams');
        this.consentsCollection = db.collection('patientConsents');
        this.communicationCollection = db.collection('teamCommunication');
        this.emergencyAlertsCollection = db.collection('emergencyAlerts');
        
        this.sensitiveFields = ['clinicalNotes', 'reasonForReferral', 'recommendations', 'emergencyDetails'];
    }

    /**
     * Create a new referral between professionals
     * @param {Object} referralData - Referral information
     * @returns {Promise<Object>} - Created referral
     */
    async createReferral(referralData) {
        try {
            const {
                fromUserId,
                toUserId,
                patientId,
                fromSpecialty,
                toSpecialty,
                reasonForReferral,
                urgency,
                clinicalNotes,
                recommendations
            } = referralData;

            // Validate required fields
            if (!fromUserId || !toUserId || !patientId || !reasonForReferral) {
                throw new Error('Missing required fields for referral');
            }

            // Check if patient consent exists for sharing
            const hasConsent = await this.checkPatientConsent(patientId, fromUserId, 'share_info');
            if (!hasConsent) {
                throw new Error('Patient consent required for referral');
            }

            // Create referral object
            const referral = {
                id: `referral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                fromUserId,
                toUserId,
                patientId,
                fromSpecialty,
                toSpecialty,
                reasonForReferral: encryption.encrypt(reasonForReferral),
                urgency: urgency || 'routine',
                clinicalNotes: clinicalNotes ? encryption.encrypt(clinicalNotes) : null,
                recommendations: recommendations ? encryption.encrypt(recommendations) : null,
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                encryptionVersion: '1.0'
            };

            // Save to database
            await this.referralsCollection.doc(referral.id).set(referral);

            // Create notification for receiving professional
            await this.createTeamNotification({
                userId: toUserId,
                type: 'new_referral',
                title: 'New Patient Referral',
                message: `You have received a new referral from ${fromSpecialty}`,
                relatedId: referral.id,
                priority: urgency === 'urgent' ? 'high' : 'normal'
            });

            logger.info('Referral created successfully', { 
                referralId: referral.id,
                fromUserId,
                toUserId,
                patientId 
            });

            return this.sanitizeReferralForResponse(referral);

        } catch (error) {
            logger.error('Error creating referral', { error: error.message, referralData });
            throw error;
        }
    }

    /**
     * Get referrals for a professional
     * @param {string} userId - Professional ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Referrals list
     */
    async getReferralsForProfessional(userId, options = {}) {
        try {
            const { 
                status = null,
                specialty = null,
                limit = 50,
                offset = 0 
            } = options;

            let query = this.referralsCollection
                .where('toUserId', '==', userId);

            if (status) {
                query = query.where('status', '==', status);
            }

            query = query.orderBy('createdAt', 'desc').limit(limit);

            const snapshot = await query.get();
            const referrals = [];

            snapshot.forEach(doc => {
                const referralData = doc.data();
                referrals.push(this.sanitizeReferralForResponse(referralData));
            });

            return {
                referrals,
                total: snapshot.size,
                hasMore: snapshot.size === limit
            };

        } catch (error) {
            logger.error('Error getting referrals for professional', { 
                error: error.message,
                userId 
            });
            throw error;
        }
    }

    /**
     * Update referral status
     * @param {string} referralId - Referral ID
     * @param {string} userId - Professional ID
     * @param {string} status - New status
     * @param {Object} updateData - Additional update data
     * @returns {Promise<Object>} - Updated referral
     */
    async updateReferralStatus(referralId, userId, status, updateData = {}) {
        try {
            const referralDoc = await this.referralsCollection.doc(referralId).get();
            
            if (!referralDoc.exists) {
                throw new Error('Referral not found');
            }

            const referral = referralDoc.data();

            // Verify user is authorized to update this referral
            if (referral.toUserId !== userId) {
                throw new Error('Unauthorized to update this referral');
            }

            const updates = {
                status,
                updatedAt: new Date().toISOString(),
                ...updateData
            };

            // Add response notes if provided
            if (updateData.responseNotes) {
                updates.responseNotes = encryption.encrypt(updateData.responseNotes);
            }

            await this.referralsCollection.doc(referralId).update(updates);

            // Notify referring professional
            await this.createTeamNotification({
                userId: referral.fromUserId,
                type: 'referral_update',
                title: 'Referral Status Update',
                message: `Your referral has been ${status}`,
                relatedId: referralId,
                priority: status === 'accepted' ? 'normal' : 'high'
            });

            logger.info('Referral status updated', { 
                referralId,
                userId,
                status 
            });

            return await this.getReferralById(referralId, userId);

        } catch (error) {
            logger.error('Error updating referral status', { 
                error: error.message,
                referralId,
                userId 
            });
            throw error;
        }
    }

    /**
     * Create or update a care team
     * @param {Object} teamData - Care team information
     * @returns {Promise<Object>} - Created/updated care team
     */
    async createCareTeam(teamData) {
        try {
            const {
                patientId,
                primaryProfessionalId,
                teamName,
                members = [],
                emergencyContact = null
            } = teamData;

            // Check if care team already exists
            const existingTeam = await this.getCareTeamForPatient(patientId);
            
            const careTeam = {
                id: existingTeam ? existingTeam.id : `careteam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                patientId,
                primaryProfessionalId,
                teamName: teamName || `Care Team - ${new Date().toLocaleDateString()}`,
                members: members.map(member => ({
                    ...member,
                    addedAt: new Date().toISOString(),
                    role: member.role || 'member'
                })),
                emergencyContact,
                isActive: true,
                createdAt: existingTeam ? existingTeam.createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (existingTeam) {
                // Update existing team
                await this.careTeamsCollection.doc(careTeam.id).update(careTeam);
            } else {
                // Create new team
                await this.careTeamsCollection.doc(careTeam.id).set(careTeam);
            }

            // Notify all team members
            for (const member of careTeam.members) {
                await this.createTeamNotification({
                    userId: member.userId,
                    type: 'care_team_update',
                    title: 'Care Team Update',
                    message: existingTeam ? 'Care team has been updated' : 'You have been added to a care team',
                    relatedId: careTeam.id,
                    priority: 'normal'
                });
            }

            logger.info('Care team created/updated', { 
                careTeamId: careTeam.id,
                patientId,
                isUpdate: !!existingTeam 
            });

            return careTeam;

        } catch (error) {
            logger.error('Error creating care team', { error: error.message, teamData });
            throw error;
        }
    }

    /**
     * Get care team for a patient
     * @param {string} patientId - Patient ID
     * @param {string} userId - Requesting user ID
     * @returns {Promise<Object|null>} - Care team data
     */
    async getCareTeamForPatient(patientId, userId = null) {
        try {
            const snapshot = await this.careTeamsCollection
                .where('patientId', '==', patientId)
                .where('isActive', '==', true)
                .get();

            if (snapshot.empty) {
                return null;
            }

            const teamDoc = snapshot.docs[0];
            const teamData = teamDoc.data();

            // Check if user is authorized to view this care team
            if (userId) {
                const isMember = teamData.members.some(member => member.userId === userId) ||
                                teamData.primaryProfessionalId === userId;
                
                if (!isMember) {
                    throw new Error('Unauthorized to view this care team');
                }
            }

            return {
                id: teamDoc.id,
                ...teamData
            };

        } catch (error) {
            logger.error('Error getting care team', { 
                error: error.message,
                patientId,
                userId 
            });
            throw error;
        }
    }

    /**
     * Record patient consent for information sharing
     * @param {Object} consentData - Consent information
     * @returns {Promise<Object>} - Created consent record
     */
    async recordPatientConsent(consentData) {
        try {
            const {
                patientId,
                professionalId,
                consentType,
                scope,
                expiresAt,
                notes = null
            } = consentData;

            const consent = {
                id: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                patientId,
                professionalId,
                consentType, // 'share_info', 'treatment', 'emergency'
                scope, // 'specific', 'all', 'emergency_only'
                status: 'active',
                grantedAt: new Date().toISOString(),
                expiresAt: expiresAt || null,
                notes: notes ? encryption.encrypt(notes) : null,
                encryptionVersion: '1.0'
            };

            await this.consentsCollection.doc(consent.id).set(consent);

            logger.info('Patient consent recorded', { 
                consentId: consent.id,
                patientId,
                professionalId,
                consentType 
            });

            return consent;

        } catch (error) {
            logger.error('Error recording patient consent', { error: error.message, consentData });
            throw error;
        }
    }

    /**
     * Check if patient consent exists
     * @param {string} patientId - Patient ID
     * @param {string} professionalId - Professional ID
     * @param {string} consentType - Type of consent
     * @returns {Promise<boolean>} - Consent exists and is active
     */
    async checkPatientConsent(patientId, professionalId, consentType) {
        try {
            const snapshot = await this.consentsCollection
                .where('patientId', '==', patientId)
                .where('professionalId', '==', professionalId)
                .where('consentType', '==', consentType)
                .where('status', '==', 'active')
                .get();

            if (snapshot.empty) {
                return false;
            }

            // Check if any consent has expired
            for (const doc of snapshot.docs) {
                const consent = doc.data();
                if (!consent.expiresAt || new Date(consent.expiresAt) > new Date()) {
                    return true;
                }
            }

            return false;

        } catch (error) {
            logger.error('Error checking patient consent', { 
                error: error.message,
                patientId,
                professionalId,
                consentType 
            });
            return false;
        }
    }

    /**
     * Create emergency alert
     * @param {Object} alertData - Emergency alert information
     * @returns {Promise<Object>} - Created alert
     */
    async createEmergencyAlert(alertData) {
        try {
            const {
                patientId,
                reporterId,
                alertType,
                severity,
                description,
                immediateAction
            } = alertData;

            const alert = {
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                patientId,
                reporterId,
                alertType, // 'suicide_risk', 'medical_emergency', 'crisis'
                severity, // 'low', 'medium', 'high', 'critical'
                description: encryption.encrypt(description),
                immediateAction: immediateAction ? encryption.encrypt(immediateAction) : null,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                encryptionVersion: '1.0'
            };

            await this.emergencyAlertsCollection.doc(alert.id).set(alert);

            // Get care team for patient
            const careTeam = await this.getCareTeamForPatient(patientId);
            
            // Notify all team members immediately
            if (careTeam) {
                const notifications = careTeam.members.map(member => ({
                    userId: member.userId,
                    type: 'emergency_alert',
                    title: `EMERGENCY: ${alertType.replace(/_/g, ' ').toUpperCase()}`,
                    message: `Emergency alert for patient - Severity: ${severity}`,
                    relatedId: alert.id,
                    priority: severity === 'critical' ? 'critical' : 'urgent'
                }));

                // Also notify primary professional
                notifications.push({
                    userId: careTeam.primaryProfessionalId,
                    type: 'emergency_alert',
                    title: `EMERGENCY: ${alertType.replace(/_/g, ' ').toUpperCase()}`,
                    message: `Emergency alert for patient - Severity: ${severity}`,
                    relatedId: alert.id,
                    priority: severity === 'critical' ? 'critical' : 'urgent'
                });

                await Promise.all(notifications.map(notification => 
                    this.createTeamNotification(notification)
                ));
            }

            logger.warn('Emergency alert created', { 
                alertId: alert.id,
                patientId,
                alertType,
                severity 
            });

            return alert;

        } catch (error) {
            logger.error('Error creating emergency alert', { error: error.message, alertData });
            throw error;
        }
    }

    /**
     * Create team communication message
     * @param {Object} messageData - Message information
     * @returns {Promise<Object>} - Created message
     */
    async createTeamMessage(messageData) {
        try {
            const {
                fromUserId,
                careTeamId,
                patientId,
                message,
                messageType = 'general',
                priority = 'normal'
            } = messageData;

            const teamMessage = {
                id: `message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                fromUserId,
                careTeamId,
                patientId,
                message: encryption.encrypt(message),
                messageType, // 'general', 'urgent', 'clinical_update', 'coordination'
                priority, // 'normal', 'high', 'urgent'
                status: 'active',
                createdAt: new Date().toISOString(),
                encryptionVersion: '1.0'
            };

            await this.communicationCollection.doc(teamMessage.id).set(teamMessage);

            // Get care team members to notify
            const careTeam = await this.getCareTeamForPatient(patientId);
            if (careTeam) {
                const recipients = careTeam.members
                    .filter(member => member.userId !== fromUserId)
                    .map(member => ({
                        userId: member.userId,
                        type: 'team_message',
                        title: 'New Team Message',
                        message: `New message from care team`,
                        relatedId: teamMessage.id,
                        priority
                    }));

                await Promise.all(recipients.map(notification => 
                    this.createTeamNotification(notification)
                ));
            }

            logger.info('Team message created', { 
                messageId: teamMessage.id,
                fromUserId,
                careTeamId,
                messageType 
            });

            return teamMessage;

        } catch (error) {
            logger.error('Error creating team message', { error: error.message, messageData });
            throw error;
        }
    }

    /**
     * Get team communication messages
     * @param {string} careTeamId - Care team ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Messages list
     */
    async getTeamMessages(careTeamId, options = {}) {
        try {
            const { 
                limit = 50,
                offset = 0,
                messageType = null 
            } = options;

            let query = this.communicationCollection
                .where('careTeamId', '==', careTeamId)
                .where('status', '==', 'active')
                .orderBy('createdAt', 'desc')
                .limit(limit);

            if (messageType) {
                query = query.where('messageType', '==', messageType);
            }

            const snapshot = await query.get();
            const messages = [];

            snapshot.forEach(doc => {
                const messageData = doc.data();
                messages.push(this.sanitizeMessageForResponse(messageData));
            });

            return {
                messages,
                total: snapshot.size,
                hasMore: snapshot.size === limit
            };

        } catch (error) {
            logger.error('Error getting team messages', { 
                error: error.message,
                careTeamId 
            });
            throw error;
        }
    }

    /**
     * Create team notification
     * @param {Object} notificationData - Notification data
     * @returns {Promise<Object>} - Created notification
     */
    async createTeamNotification(notificationData) {
        try {
            const notification = {
                id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...notificationData,
                createdAt: new Date().toISOString(),
                read: false
            };

            // In a real implementation, this would integrate with a notification system
            // For now, we'll store in a collection
            await this.communicationCollection.doc(`notification_${notification.id}`).set({
                ...notification,
                type: 'notification'
            });

            logger.info('Team notification created', { 
                notificationId: notification.id,
                userId: notification.userId,
                type: notification.type 
            });

            return notification;

        } catch (error) {
            logger.error('Error creating team notification', { error: error.message, notificationData });
            throw error;
        }
    }

    /**
     * Get referral by ID
     * @param {string} referralId - Referral ID
     * @param {string} userId - Requesting user ID
     * @returns {Promise<Object|null>} - Referral data
     */
    async getReferralById(referralId, userId) {
        try {
            const doc = await this.referralsCollection.doc(referralId).get();
            
            if (!doc.exists) {
                return null;
            }

            const referral = doc.data();

            // Check authorization
            if (referral.fromUserId !== userId && referral.toUserId !== userId) {
                throw new Error('Unauthorized to view this referral');
            }

            return this.sanitizeReferralForResponse(referral);

        } catch (error) {
            logger.error('Error getting referral by ID', { 
                error: error.message,
                referralId,
                userId 
            });
            throw error;
        }
    }

    /**
     * Sanitize referral for response
     * @param {Object} referral - Raw referral data
     * @returns {Object} - Sanitized referral
     */
    sanitizeReferralForResponse(referral) {
        const sanitized = { ...referral };
        
        // Decrypt sensitive fields
        this.sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                try {
                    sanitized[field] = encryption.decrypt(sanitized[field]);
                } catch (error) {
                    logger.warn('Failed to decrypt referral field', { 
                        field, 
                        referralId: referral.id 
                    });
                    sanitized[field] = '[Encrypted]';
                }
            }
        });

        delete sanitized.encryptionVersion;
        return sanitized;
    }

    /**
     * Sanitize message for response
     * @param {Object} message - Raw message data
     * @returns {Object} - Sanitized message
     */
    sanitizeMessageForResponse(message) {
        const sanitized = { ...message };
        
        // Decrypt message content
        if (sanitized.message) {
            try {
                sanitized.message = encryption.decrypt(sanitized.message);
            } catch (error) {
                logger.warn('Failed to decrypt message', { 
                    messageId: message.id 
                });
                sanitized.message = '[Encrypted]';
            }
        }

        delete sanitized.encryptionVersion;
        return sanitized;
    }
}

module.exports = new CollaborationService();