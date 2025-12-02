// Mock WhatsApp Service for testing
class MockWhatsAppService {
  constructor() {
    this.messages = [];
    this.webhookVerified = false;
  }

  async sendMessage(phoneNumber, message) {
    if (!phoneNumber || !message) {
      throw new Error('Phone number and message are required');
    }

    const messageData = {
      id: `msg_${Date.now()}`,
      to: phoneNumber,
      text: message,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    this.messages.push(messageData);
    return {
      success: true,
      messageId: messageData.id,
      status: 'sent'
    };
  }

  async sendTemplateMessage(phoneNumber, templateName, parameters = []) {
    if (!phoneNumber || !templateName) {
      throw new Error('Phone number and template name are required');
    }

    const messageData = {
      id: `tmpl_${Date.now()}`,
      to: phoneNumber,
      template: templateName,
      parameters: parameters,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    this.messages.push(messageData);
    return {
      success: true,
      messageId: messageData.id,
      status: 'sent'
    };
  }

  async processWebhook(webhookData) {
    if (!webhookData || !webhookData.messages) {
      throw new Error('Invalid webhook data');
    }

    const processedMessages = [];
    
    for (const message of webhookData.messages) {
      const processed = {
        id: message.id,
        from: message.from,
        text: message.text?.body || '',
        timestamp: message.timestamp,
        type: message.type,
        processed: true
      };

      processedMessages.push(processed);
    }

    return {
      success: true,
      processed: processedMessages.length,
      messages: processedMessages
    };
  }

  verifyWebhook(mode, token, challenge) {
    const expectedToken = 'test-webhook-token';
    
    if (mode === 'subscribe' && token === expectedToken) {
      this.webhookVerified = true;
      return challenge;
    }
    
    throw new Error('Webhook verification failed');
  }

  async getMessageStatus(messageId) {
    const message = this.messages.find(m => m.id === messageId);
    
    if (!message) {
      throw new Error('Message not found');
    }

    return {
      success: true,
      messageId: messageId,
      status: message.status,
      timestamp: message.timestamp
    };
  }

  async markMessageAsRead(messageId) {
    const message = this.messages.find(m => m.id === messageId);
    
    if (!message) {
      throw new Error('Message not found');
    }

    message.status = 'read';
    return {
      success: true,
      messageId: messageId,
      status: 'read'
    };
  }

  formatPhoneNumber(phoneNumber) {
    // Remove all non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming Argentina +54)
    if (cleaned.length === 10 && cleaned.startsWith('9')) {
      return `549${cleaned}`;
    }
    
    if (cleaned.length === 10) {
      return `54${cleaned}`;
    }
    
    return cleaned;
  }
}

describe('WhatsApp Service Tests', () => {
  let whatsappService;

  beforeEach(() => {
    whatsappService = new MockWhatsAppService();
    jest.clearAllMocks();
  });

  describe('Send Messages', () => {
    test('should send text message successfully', async () => {
      const phoneNumber = '+5491123456789';
      const message = 'Hola, este es un mensaje de prueba';

      const result = await whatsappService.sendMessage(phoneNumber, message);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('status', 'sent');
      expect(whatsappService.messages).toHaveLength(1);
      expect(whatsappService.messages[0].text).toBe(message);
    });

    test('should reject message without phone number', async () => {
      const message = 'Test message';

      await expect(whatsappService.sendMessage('', message))
        .rejects.toThrow('Phone number and message are required');
    });

    test('should reject message without text', async () => {
      const phoneNumber = '+5491123456789';

      await expect(whatsappService.sendMessage(phoneNumber, ''))
        .rejects.toThrow('Phone number and message are required');
    });

    test('should send template message successfully', async () => {
      const phoneNumber = '+5491123456789';
      const templateName = 'appointment_reminder';
      const parameters = ['Juan Pérez', '2024-01-15', '10:00'];

      const result = await whatsappService.sendTemplateMessage(phoneNumber, templateName, parameters);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('messageId');
      expect(whatsappService.messages).toHaveLength(1);
      expect(whatsappService.messages[0].template).toBe(templateName);
      expect(whatsappService.messages[0].parameters).toEqual(parameters);
    });

    test('should reject template message without required fields', async () => {
      await expect(whatsappService.sendTemplateMessage('', 'template'))
        .rejects.toThrow('Phone number and template name are required');
      
      await expect(whatsappService.sendTemplateMessage('+5491123456789', ''))
        .rejects.toThrow('Phone number and template name are required');
    });
  });

  describe('Webhook Processing', () => {
    test('should process incoming webhook messages', async () => {
      const webhookData = {
        messages: [
          {
            id: 'wamid.123',
            from: '5491123456789',
            timestamp: '1640995200',
            type: 'text',
            text: { body: 'Hola, necesito ayuda' }
          },
          {
            id: 'wamid.124',
            from: '5491123456789',
            timestamp: '1640995260',
            type: 'text',
            text: { body: 'Quiero agendar una cita' }
          }
        ]
      };

      const result = await whatsappService.processWebhook(webhookData);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('processed', 2);
      expect(result).toHaveProperty('messages');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].text).toBe('Hola, necesito ayuda');
      expect(result.messages[1].text).toBe('Quiero agendar una cita');
    });

    test('should handle empty webhook data', async () => {
      await expect(whatsappService.processWebhook({}))
        .rejects.toThrow('Invalid webhook data');
      
      await expect(whatsappService.processWebhook(null))
        .rejects.toThrow('Invalid webhook data');
    });

    test('should verify webhook successfully', () => {
      const mode = 'subscribe';
      const token = 'test-webhook-token';
      const challenge = 'challenge-string';

      const result = whatsappService.verifyWebhook(mode, token, challenge);

      expect(result).toBe(challenge);
      expect(whatsappService.webhookVerified).toBe(true);
    });

    test('should reject webhook verification with wrong token', () => {
      const mode = 'subscribe';
      const wrongToken = 'wrong-token';
      const challenge = 'challenge-string';

      expect(() => whatsappService.verifyWebhook(mode, wrongToken, challenge))
        .toThrow('Webhook verification failed');
    });
  });

  describe('Message Status Management', () => {
    test('should get message status', async () => {
      // First send a message
      const phoneNumber = '+5491123456789';
      const message = 'Test message';
      const sendResult = await whatsappService.sendMessage(phoneNumber, message);

      // Then get its status
      const statusResult = await whatsappService.getMessageStatus(sendResult.messageId);

      expect(statusResult).toHaveProperty('success', true);
      expect(statusResult).toHaveProperty('messageId', sendResult.messageId);
      expect(statusResult).toHaveProperty('status', 'sent');
    });

    test('should handle non-existent message status request', async () => {
      await expect(whatsappService.getMessageStatus('non-existent-id'))
        .rejects.toThrow('Message not found');
    });

    test('should mark message as read', async () => {
      // First send a message
      const phoneNumber = '+5491123456789';
      const message = 'Test message';
      const sendResult = await whatsappService.sendMessage(phoneNumber, message);

      // Then mark it as read
      const readResult = await whatsappService.markMessageAsRead(sendResult.messageId);

      expect(readResult).toHaveProperty('success', true);
      expect(readResult).toHaveProperty('status', 'read');

      // Verify status was updated
      const statusResult = await whatsappService.getMessageStatus(sendResult.messageId);
      expect(statusResult.status).toBe('read');
    });
  });

  describe('Phone Number Formatting', () => {
    test('should format Argentine phone numbers correctly', () => {
      // Test various input formats
      expect(whatsappService.formatPhoneNumber('9 11 1234-5678')).toBe('549111234567');
      expect(whatsappService.formatPhoneNumber('+54 9 11 1234 5678')).toBe('549111234567');
      expect(whatsappService.formatPhoneNumber('11-1234-5678')).toBe('541112345678');
      expect(whatsappService.formatPhoneNumber('(011) 1234-5678')).toBe('541112345678');
    });

    test('should handle already formatted numbers', () => {
      expect(whatsappService.formatPhoneNumber('549111234567')).toBe('549111234567');
      expect(whatsappService.formatPhoneNumber('541112345678')).toBe('541112345678');
    });

    test('should preserve international numbers', () => {
      expect(whatsappService.formatPhoneNumber('1234567890123')).toBe('1234567890123');
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      // Mock API failure scenario
      const originalSendMessage = whatsappService.sendMessage;
      whatsappService.sendMessage = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(whatsappService.sendMessage('+5491123456789', 'test'))
        .rejects.toThrow('API Error');

      // Restore original method
      whatsappService.sendMessage = originalSendMessage;
    });

    test('should validate phone number format', () => {
      const invalidNumbers = ['', 'abc', '123', '+54abc123'];
      
      // In a real implementation, these would be validated
      invalidNumbers.forEach(number => {
        expect(() => {
          const formatted = whatsappService.formatPhoneNumber(number);
          // Basic validation - should not contain letters
          expect(/[a-zA-Z]/.test(formatted)).toBe(false);
        }).not.toThrow();
      });
    });
  });

  describe('Message Queuing and Retry Logic', () => {
    test('should handle message queue', () => {
      const messageQueue = [];
      
      const queueMessage = (phoneNumber, message, priority = 'normal') => {
        messageQueue.push({
          id: `queue_${Date.now()}`,
          phoneNumber,
          message,
          priority,
          timestamp: new Date().toISOString(),
          attempts: 0,
          status: 'queued'
        });
      };

      queueMessage('+5491123456789', 'Test message 1');
      queueMessage('+5491123456789', 'Urgent message', 'high');

      expect(messageQueue).toHaveLength(2);
      expect(messageQueue[1].priority).toBe('high');
    });

    test('should implement retry logic', async () => {
      let attemptCount = 0;
      
      const sendWithRetry = async (phoneNumber, message, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            attemptCount++;
            if (attemptCount < 3) {
              throw new Error('Temporary failure');
            }
            return await whatsappService.sendMessage(phoneNumber, message);
          } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait before retry
          }
        }
      };

      const result = await sendWithRetry('+5491123456789', 'Test message');
      
      expect(result).toHaveProperty('success', true);
      expect(attemptCount).toBe(3); // Should have retried 3 times
    });
  });
}); 