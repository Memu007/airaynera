const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class WhatsAppService {
    constructor() {
        this.baseURL = 'https://graph.facebook.com/v17.0';
        this.token = config.whatsapp.token;
        this.phoneNumberId = config.whatsapp.phoneNumberId;
    }

    async sendMessage(to, message) {
        try {
            const response = await axios.post(
                `${this.baseURL}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'text',
                    text: { body: message }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info('WhatsApp message sent successfully', {
                to,
                messageId: response.data.messages[0].id
            });

            return response.data;
        } catch (error) {
            logger.error('Error sending WhatsApp message', {
                error: error.message,
                to
            });
            throw error;
        }
    }

    async sendTemplate(to, templateName, languageCode, components = []) {
        try {
            const response = await axios.post(
                `${this.baseURL}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'template',
                    template: {
                        name: templateName,
                        language: {
                            code: languageCode
                        },
                        components
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info('WhatsApp template sent successfully', {
                to,
                templateName,
                messageId: response.data.messages[0].id
            });

            return response.data;
        } catch (error) {
            logger.error('Error sending WhatsApp template', {
                error: error.message,
                to,
                templateName
            });
            throw error;
        }
    }

    async markMessageAsRead(messageId) {
        try {
            const response = await axios.post(
                `${this.baseURL}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: messageId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            logger.info('WhatsApp message marked as read', { messageId });
            return response.data;
        } catch (error) {
            logger.error('Error marking WhatsApp message as read', {
                error: error.message,
                messageId
            });
            throw error;
        }
    }

    async handleWebhook(payload) {
        try {
            const { object, entry } = payload;

            if (object !== 'whatsapp_business_account') {
                throw new Error('Invalid webhook object');
            }

            for (const entryItem of entry) {
                const changes = entryItem.changes;
                for (const change of changes) {
                    if (change.value.messages) {
                        for (const message of change.value.messages) {
                            await this.processIncomingMessage(message);
                        }
                    }
                }
            }

            return { status: 'success' };
        } catch (error) {
            logger.error('Error handling WhatsApp webhook', {
                error: error.message,
                payload
            });
            throw error;
        }
    }

    async processIncomingMessage(message) {
        // This method will be implemented to handle incoming messages
        // and integrate with the crisis detection service
        logger.info('Processing incoming WhatsApp message', {
            messageId: message.id,
            from: message.from
        });

        // TODO: Implement message processing logic
        // 1. Save message to database
        // 2. Check for crisis indicators
        // 3. Send appropriate response
    }
}

module.exports = new WhatsAppService(); 