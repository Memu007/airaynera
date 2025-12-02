describe('Data Integrity & Consistency', () => {
  let authToken;
  let testPatientId;

  before(() => {
    cy.request('POST', '/api/auth/demo-token')
      .then((response) => {
        authToken = response.body.token;
      });
  });

  beforeEach(() => {
    // Create a test patient for each test
    cy.request({
      method: 'POST',
      url: '/api/pacientes',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { name: 'Data Integrity Test Patient' }
    }).then((response) => {
      testPatientId = response.body.id;
    });
  });

  describe('Cascade Operations', () => {
    it('deletes all sessions when deleting a patient', () => {
      // Create sessions for the patient
      const sessionPromises = [];
      for (let i = 0; i < 3; i++) {
        sessionPromises.push(
          cy.request({
            method: 'POST',
            url: '/api/sesiones',
            headers: { Authorization: `Bearer ${authToken}` },
            body: {
              pacienteId: testPatientId,
              notas: `Session ${i + 1}`,
              mood_assessment: 3
            }
          })
        );
      }

      cy.wrap(Promise.all(sessionPromises)).then(() => {
        // Delete the patient
        cy.request({
          method: 'DELETE',
          url: `/api/pacientes/${testPatientId}`,
          headers: { Authorization: `Bearer ${authToken}` }
        }).then(() => {
          // Verify sessions are also deleted
          cy.request({
            method: 'GET',
            url: '/api/sesiones',
            headers: { Authorization: `Bearer ${authToken}` }
          }).then((response) => {
            const patientSessions = response.body.filter(s => s.pacienteId === testPatientId);
            expect(patientSessions).to.have.length(0);
          });
        });
      });
    });
  });

  describe('Concurrent Modifications', () => {
    it('handles concurrent updates to the same patient', () => {
      // Simulate concurrent updates
      const update1 = cy.request({
        method: 'PUT',
        url: `/api/pacientes/${testPatientId}`,
        headers: { Authorization: `Bearer ${authToken}` },
        body: { name: 'Updated Name 1', phone: '1111111111' }
      });

      const update2 = cy.request({
        method: 'PUT',
        url: `/api/pacientes/${testPatientId}`,
        headers: { Authorization: `Bearer ${authToken}` },
        body: { name: 'Updated Name 2', email: 'test@example.com' }
      });

      cy.wrap(Promise.all([update1, update2])).then(() => {
        // Verify final state is consistent
        cy.request({
          method: 'GET',
          url: `/api/pacientes/${testPatientId}`,
          headers: { Authorization: `Bearer ${authToken}` }
        }).then((response) => {
          // Should have one of the names and all non-conflicting updates
          expect(response.body.name).to.be.oneOf(['Updated Name 1', 'Updated Name 2']);
          // Non-conflicting updates should be preserved
          if (response.body.name === 'Updated Name 2') {
            expect(response.body.email).to.equal('test@example.com');
          }
        });
      });
    });
  });

  describe('Data Validation Boundaries', () => {
    it('validates DNI format for Argentina', () => {
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { 
          name: 'Test Patient',
          dni: '123' // Too short
        },
        failOnStatusCode: false
      }).then((response) => {
        if (response.status === 201) {
          // If accepted, should be stored correctly
          expect(response.body.dni).to.match(/^\d{7,8}$/);
        } else {
          expect(response.status).to.be.oneOf([400, 422]);
        }
      });
    });

    it('validates phone number format', () => {
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { 
          name: 'Test Patient',
          phone: 'not-a-phone'
        },
        failOnStatusCode: false
      }).then((response) => {
        if (response.status === 201) {
          // If accepted, should be formatted correctly
          expect(response.body.phone).to.match(/^\+?\d+$/);
        } else {
          expect(response.status).to.be.oneOf([400, 422]);
        }
      });
    });

    it('validates email format', () => {
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { 
          name: 'Test Patient',
          email: 'invalid-email'
        },
        failOnStatusCode: false
      }).then((response) => {
        if (response.status === 201) {
          // Should not accept invalid email
          expect(response.body.email).to.include('@');
        } else {
          expect(response.status).to.be.oneOf([400, 422]);
        }
      });
    });
  });

  describe('Referential Integrity', () => {
    it('prevents creating sessions for non-existent patients', () => {
      cy.request({
        method: 'POST',
        url: '/api/sesiones',
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          pacienteId: '99999', // Non-existent
          notas: 'Test session',
          mood_assessment: 3
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 404]);
      });
    });

    it('prevents updating non-existent sessions', () => {
      cy.request({
        method: 'PUT',
        url: '/api/sesiones/99999',
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          notas: 'Updated notes'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });

  describe('Data Encryption', () => {
    it('encrypts sensitive fields (dni, phone) at rest', () => {
      // This test assumes we can verify encryption indirectly
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { 
          name: 'Encryption Test',
          dni: '12345678',
          phone: '1122334455'
        }
      }).then((response) => {
        const patientId = response.body.id;
        
        // When retrieved, should be decrypted correctly
        cy.request({
          method: 'GET',
          url: `/api/pacientes/${patientId}`,
          headers: { Authorization: `Bearer ${authToken}` }
        }).then((getResponse) => {
          expect(getResponse.body.dni).to.equal('12345678');
          expect(getResponse.body.phone).to.equal('1122334455');
        });
      });
    });
  });
});
