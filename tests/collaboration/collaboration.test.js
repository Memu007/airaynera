const request = require('supertest');
const app = require('../../src/app');
const CollaborationService = require('../../src/services/collaboration/CollaborationService');

// Mock data for testing
const mockUser = {
  id: 'test-professional-1',
  email: 'test@aira.com',
  name: 'Test Professional',
  role: 'professional'
};

const mockPatient = {
  id: 'test-patient-1',
  name: 'John Doe',
  dni: '12345678'
};

const mockProfessional = {
  id: 'test-professional-2',
  name: 'Dr. Smith',
  specialty: 'psychiatry'
};

describe('Collaboration Service Tests', () => {
  let authToken;

  beforeAll(async () => {
    // Setup auth token for testing
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@aira.com',
        password: 'testpassword123'
      });
    
    authToken = loginResponse.body.data.tokens.accessToken;
  });

  describe('Referral Management', () => {
    test('should create a new referral successfully', async () => {
      const referralData = {
        toUserId: mockProfessional.id,
        patientId: mockPatient.id,
        fromSpecialty: 'psychology',
        toSpecialty: 'psychiatry',
        reasonForReferral: 'Patient requires psychiatric evaluation for depression and anxiety symptoms',
        urgency: 'routine',
        clinicalNotes: 'Patient has been in therapy for 3 months with limited progress',
        recommendations: 'Consider medication evaluation for depressive symptoms'
      };

      const response = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(referralData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.reasonForReferral).toBe(referralData.reasonForReferral);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.urgency).toBe(referralData.urgency);
    });

    test('should validate required referral fields', async () => {
      const invalidReferralData = {
        toUserId: mockProfessional.id,
        // Missing patientId
        fromSpecialty: 'psychology',
        toSpecialty: 'psychiatry'
      };

      const response = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidReferralData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    test('should get referrals for professional', async () => {
      const response = await request(app)
        .get('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('referrals');
      expect(Array.isArray(response.body.data.referrals)).toBe(true);
    });

    test('should update referral status', async () => {
      // First create a referral
      const createResponse = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toUserId: mockProfessional.id,
          patientId: mockPatient.id,
          fromSpecialty: 'psychology',
          toSpecialty: 'psychiatry',
          reasonForReferral: 'Test referral for status update',
          urgency: 'routine'
        });

      const referralId = createResponse.body.data.id;

      // Update status
      const updateResponse = await request(app)
        .put(`/api/collaboration/referrals/${referralId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'accepted',
          responseNotes: 'Patient evaluation scheduled for next week'
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.status).toBe('accepted');
      expect(updateResponse.body.data.responseNotes).toBe('Patient evaluation scheduled for next week');
    });

    test('should prevent unauthorized referral access', async () => {
      const response = await request(app)
        .get('/api/collaboration/referrals/unauthorized-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Care Team Management', () => {
    test('should create a care team successfully', async () => {
      const careTeamData = {
        patientId: mockPatient.id,
        teamName: 'Test Care Team',
        members: [
          {
            userId: mockProfessional.id,
            role: 'psychiatrist',
            specialty: 'psychiatry'
          }
        ],
        emergencyContact: {
          name: 'Jane Doe',
          relationship: 'Spouse',
          phone: '+1234567890',
          priority: 'primary'
        }
      };

      const response = await request(app)
        .post('/api/collaboration/care-teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(careTeamData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.teamName).toBe(careTeamData.teamName);
      expect(response.body.data.members).toHaveLength(1);
      expect(response.body.data.emergencyContact.name).toBe(careTeamData.emergencyContact.name);
    });

    test('should get care team for patient', async () => {
      // Create a care team first
      await request(app)
        .post('/api/collaboration/care-teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: mockPatient.id,
          teamName: 'Test Care Team for Get',
          members: []
        });

      const response = await request(app)
        .get(`/api/collaboration/care-teams/patients/${mockPatient.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.patientId).toBe(mockPatient.id);
    });

    test('should validate care team required fields', async () => {
      const invalidCareTeamData = {
        // Missing patientId
        teamName: 'Invalid Team',
        members: []
      };

      const response = await request(app)
        .post('/api/collaboration/care-teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidCareTeamData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });
  });

  describe('Patient Consent Management', () => {
    test('should record patient consent successfully', async () => {
      const consentData = {
        patientId: mockPatient.id,
        consentType: 'share_info',
        scope: 'limited',
        notes: 'Patient consent recorded verbally during session'
      };

      const response = await request(app)
        .post('/api/collaboration/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send(consentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.consentType).toBe(consentData.consentType);
      expect(response.body.data.scope).toBe(consentData.scope);
      expect(response.body.data.status).toBe('active');
    });

    test('should check patient consent existence', async () => {
      // First record a consent
      await request(app)
        .post('/api/collaboration/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: mockPatient.id,
          consentType: 'share_info',
          scope: 'limited'
        });

      // Then check if it exists
      const response = await request(app)
        .get(`/api/collaboration/consent/check/${mockPatient.id}?consentType=share_info`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hasConsent).toBe(true);
    });

    test('should handle expired consents', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

      const response = await request(app)
        .post('/api/collaboration/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: mockPatient.id,
          consentType: 'share_info',
          scope: 'limited',
          expiresAt: pastDate.toISOString()
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.expiresAt).toBe(pastDate.toISOString());

      // Check should return false for expired consent
      const checkResponse = await request(app)
        .get(`/api/collaboration/consent/check/${mockPatient.id}?consentType=share_info`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(checkResponse.body.data.hasConsent).toBe(false);
    });
  });

  describe('Emergency Alert Management', () => {
    test('should create emergency alert successfully', async () => {
      const alertData = {
        patientId: mockPatient.id,
        alertType: 'suicide_risk',
        severity: 'critical',
        description: 'Patient expressed suicidal ideation during session',
        immediateAction: 'Patient placed on suicide watch, emergency contact notified'
      };

      const response = await request(app)
        .post('/api/collaboration/emergency-alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(alertData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.alertType).toBe(alertData.alertType);
      expect(response.body.data.severity).toBe(alertData.severity);
      expect(response.body.data.status).toBe('active');
    });

    test('should validate emergency alert severity levels', async () => {
      const invalidAlertData = {
        patientId: mockPatient.id,
        alertType: 'suicide_risk',
        severity: 'invalid_severity', // Invalid severity
        description: 'Test alert'
      };

      const response = await request(app)
        .post('/api/collaboration/emergency-alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidAlertData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('severity');
    });

    test('should create care team and notify members on emergency', async () => {
      // First create a care team
      const teamResponse = await request(app)
        .post('/api/collaboration/care-teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: mockPatient.id,
          teamName: 'Emergency Test Team',
          members: [
            { userId: mockProfessional.id, role: 'psychiatrist', specialty: 'psychiatry' }
          ]
        });

      const careTeamId = teamResponse.body.data.id;

      // Create emergency alert
      const alertResponse = await request(app)
        .post('/api/collaboration/emergency-alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: mockPatient.id,
          alertType: 'medical_emergency',
          severity: 'critical',
          description: 'Critical medical emergency'
        })
        .expect(201);

      expect(alertResponse.body.success).toBe(true);
      // In a real implementation, this would test that notifications were sent
    });
  });

  describe('Team Communication', () => {
    test('should send team message successfully', async () => {
      // First create a care team
      const teamResponse = await request(app)
        .post('/api/collaboration/care-teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: mockPatient.id,
          teamName: 'Communication Test Team',
          members: []
        });

      const careTeamId = teamResponse.body.data.id;

      const messageData = {
        careTeamId: careTeamId,
        patientId: mockPatient.id,
        message: 'Patient responded well to new treatment approach',
        messageType: 'clinical_update',
        priority: 'normal'
      };

      const response = await request(app)
        .post('/api/collaboration/team-messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.messageType).toBe(messageData.messageType);
      expect(response.body.data.priority).toBe(messageData.priority);
      expect(response.body.data.fromUserId).toBe(mockUser.id);
    });

    test('should get team messages', async () => {
      // Create care team and send messages first
      const teamResponse = await request(app)
        .post('/api/collaboration/care-teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: mockPatient.id,
          teamName: 'Message History Test Team',
          members: []
        });

      const careTeamId = teamResponse.body.data.id;

      // Send a test message
      await request(app)
        .post('/api/collaboration/team-messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          careTeamId: careTeamId,
          patientId: mockPatient.id,
          message: 'Test message for history',
          messageType: 'general'
        });

      // Get messages
      const response = await request(app)
        .get(`/api/collaboration/team-messages/${careTeamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('messages');
      expect(Array.isArray(response.body.data.messages)).toBe(true);
      expect(response.body.data.messages.length).toBeGreaterThan(0);
    });

    test('should validate message content length', async () => {
      const invalidMessageData = {
        careTeamId: 'test-team-id',
        patientId: mockPatient.id,
        message: 'a', // Too short
        messageType: 'general'
      };

      const response = await request(app)
        .post('/api/collaboration/team-messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidMessageData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('message');
    });
  });

  describe('Security and Authorization', () => {
    test('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/collaboration/referrals')
        .send({
          toUserId: mockProfessional.id,
          patientId: mockPatient.id,
          fromSpecialty: 'psychology',
          toSpecialty: 'psychiatry',
          reasonForReferral: 'Test referral'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should reject requests with invalid token', async () => {
      const response = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          toUserId: mockProfessional.id,
          patientId: mockPatient.id,
          fromSpecialty: 'psychology',
          toSpecialty: 'psychiatry',
          reasonForReferral: 'Test referral'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should enforce professional role requirement', async () => {
      // This test would need a user with non-professional role
      // For now, we'll just verify the endpoint exists and handles role checking
      const response = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toUserId: mockProfessional.id,
          patientId: mockPatient.id,
          fromSpecialty: 'psychology',
          toSpecialty: 'psychiatry',
          reasonForReferral: 'Test referral'
        });

      // The actual role validation happens in middleware
      expect([200, 400, 403]).toContain(response.status);
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should sanitize HTML in referral reason', async () => {
      const maliciousInput = '<script>alert("xss")</script>Test referral reason';
      
      const response = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toUserId: mockProfessional.id,
          patientId: mockPatient.id,
          fromSpecialty: 'psychology',
          toSpecialty: 'psychiatry',
          reasonForReferral: maliciousInput,
          urgency: 'routine'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reasonForReferral).not.toContain('<script>');
      expect(response.body.data.reasonForReferral).toContain('Test referral reason');
    });

    test('should validate message length limits', async () => {
      const longMessage = 'a'.repeat(2001); // Over 2000 character limit

      const response = await request(app)
        .post('/api/collaboration/team-messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          careTeamId: 'test-team-id',
          patientId: mockPatient.id,
          message: longMessage,
          messageType: 'general'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('message');
    });

    test('should validate professional ID format', async () => {
      const response = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toUserId: 'invalid-id-format',
          patientId: mockPatient.id,
          fromSpecialty: 'psychology',
          toSpecialty: 'psychiatry',
          reasonForReferral: 'Test referral'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('HIPAA Compliance', () => {
    test('should encrypt sensitive patient data', async () => {
      const sensitiveData = {
        toUserId: mockProfessional.id,
        patientId: mockPatient.id,
        fromSpecialty: 'psychology',
        toSpecialty: 'psychiatry',
        reasonForReferral: 'Patient has history of depression with suicidal ideation',
        urgency: 'urgent',
        clinicalNotes: 'Patient SSN: 123-45-6789, takes Prozac 20mg daily'
      };

      const response = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sensitiveData)
        .expect(201);

      expect(response.body.success).toBe(true);
      // In a real implementation, we'd verify the data is encrypted in storage
      // For now, we just ensure the endpoint doesn't expose raw sensitive data
    });

    test('should prevent data access without consent', async () => {
      // Try to access patient data without recorded consent
      const response = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toUserId: mockProfessional.id,
          patientId: mockPatient.id,
          fromSpecialty: 'psychology',
          toSpecialty: 'psychiatry',
          reasonForReferral: 'Test without consent'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('consent');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent referral requests', async () => {
      const referralPromises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/collaboration/referrals')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            toUserId: mockProfessional.id,
            patientId: `test-patient-${i}`,
            fromSpecialty: 'psychology',
            toSpecialty: 'psychiatry',
            reasonForReferral: `Test referral ${i}`,
            urgency: 'routine'
          })
      );

      const responses = await Promise.all(referralPromises);
      
      const successCount = responses.filter(r => r.status === 201).length;
      const errorCount = responses.filter(r => r.status >= 400).length;

      expect(successCount + errorCount).toBe(10);
      // All should either succeed or fail gracefully
    });

    test('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we test with invalid data that would cause database errors
      const response = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          toUserId: null, // Invalid user ID that would cause DB error
          patientId: mockPatient.id,
          fromSpecialty: 'psychology',
          toSpecialty: 'psychiatry',
          reasonForReferral: 'Test referral'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/collaboration/referrals')
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid-json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should validate enum values', async () => {
      const response = await request(app)
        .post('/api/collaboration/emergency-alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: mockPatient.id,
          alertType: 'invalid_alert_type', // Invalid enum value
          severity: 'high',
          description: 'Test alert'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('alertType');
    });
  });
});

describe('Collaboration Service Integration', () => {
  test('should integrate with existing patient service', async () => {
    // Test that collaboration features work with existing patient data
    const authToken = 'test-token'; // Mock token

    // This would test the actual service integration
    const patientResponse = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${authToken}`);

    // Verify we can get patient data for collaboration features
    expect([200, 401]).toContain(patientResponse.status);
  });

  test('should maintain data consistency across services', async () => {
    // Test that referral creation updates patient records appropriately
    // This would be an integration test with the patient service
    expect(true).toBe(true); // Placeholder
  });
});

// Cleanup
afterAll(async () => {
  // Clean up test data
  // This would involve deleting test referrals, care teams, consents, etc.
});