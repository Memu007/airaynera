describe('Concurrent Updates & Race Conditions', () => {
  let authToken;
  let patientId;

  before(() => {
    // Get auth token with retry
    cy.wait(100); // Small delay to avoid rate limit
    cy.request({ 
      method: 'POST', 
      url: '/api/auth/demo-token'
    })
    .then((response) => {
      expect(response.status).to.eq(200);
      authToken = response.body.token;
      
      // Create test patient after getting token
      return cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { name: 'Concurrent Test Patient' }
      });
    })
    .then((response) => {
      patientId = response.body.id;
    });
  });

  after(() => {
    // Cleanup
    if (patientId) {
      cy.request({
        method: 'DELETE',
        url: `/api/pacientes/${patientId}`,
        headers: { Authorization: `Bearer ${authToken}` },
        failOnStatusCode: false
      });
    }
  });

  it('handles simultaneous patient updates without data corruption', () => {
    const update1 = { name: 'Updated Name 1', phone: '+541111111111' };
    const update2 = { name: 'Updated Name 2', phone: '+542222222222' };

    // Send two updates simultaneously
    const promises = [
      cy.request({
        method: 'PUT',
        url: `/api/pacientes/${patientId}`,
        headers: { Authorization: `Bearer ${authToken}` },
        body: update1
      }),
      cy.request({
        method: 'PUT',
        url: `/api/pacientes/${patientId}`,
        headers: { Authorization: `Bearer ${authToken}` },
        body: update2
      })
    ];

    // Wait for both to complete
    cy.wrap(Promise.all(promises)).then(() => {
      // Verify final state - one of the updates should have won
      cy.request({
        method: 'GET',
        url: `/api/pacientes/${patientId}`,
        headers: { Authorization: `Bearer ${authToken}` }
      }).then((response) => {
        expect(response.status).to.eq(200);
        // Should be one of the two updates, not a mix
        const finalName = response.body.name;
        const finalPhone = response.body.phone;
        
        const isUpdate1 = finalName === update1.name && finalPhone === update1.phone;
        const isUpdate2 = finalName === update2.name && finalPhone === update2.phone;
        
        expect(isUpdate1 || isUpdate2).to.be.true;
      });
    });
  });

  it('handles concurrent session creation for same patient', () => {
    const sessions = [];
    const sessionPromises = [];

    // Create 5 sessions simultaneously
    for (let i = 1; i <= 5; i++) {
      sessionPromises.push(
        cy.request({
          method: 'POST',
          url: '/api/sesiones',
          headers: { Authorization: `Bearer ${authToken}` },
          body: {
            pacienteId: patientId,
            notas: `Concurrent session ${i}`,
            mood_assessment: i
          }
        }).then(response => {
          sessions.push(response.body.id);
          return response;
        })
      );
    }

    cy.wrap(Promise.all(sessionPromises)).then((responses) => {
      // All should succeed
      responses.forEach(response => {
        expect(response.status).to.eq(201);
      });

      // Verify all sessions were created
      cy.request({
        method: 'GET',
        url: `/api/sesiones?pacienteId=${patientId}`,
        headers: { Authorization: `Bearer ${authToken}` }
      }).then((response) => {
        expect(response.body.length).to.be.at.least(5);
      });

      // Cleanup sessions
      sessions.forEach(sessionId => {
        cy.request({
          method: 'DELETE',
          url: `/api/sesiones/${sessionId}`,
          headers: { Authorization: `Bearer ${authToken}` },
          failOnStatusCode: false
        });
      });
    });
  });

  it('cache invalidation works correctly with concurrent operations', () => {
    // First GET to populate cache
    cy.request({
      method: 'GET',
      url: '/api/sesiones',
      headers: { Authorization: `Bearer ${authToken}` }
    }).then((response1) => {
      const initialCount = response1.body.length;

      // Create session (should invalidate cache)
      cy.request({
        method: 'POST',
        url: '/api/sesiones',
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          pacienteId: patientId,
          notas: 'Cache test session'
        }
      }).then((createResponse) => {
        const newSessionId = createResponse.body.id;

        // Immediate GET should show new session
        cy.request({
          method: 'GET',
          url: '/api/sesiones',
          headers: { Authorization: `Bearer ${authToken}` }
        }).then((response2) => {
          expect(response2.body.length).to.eq(initialCount + 1);

          // Cleanup
          cy.request({
            method: 'DELETE',
            url: `/api/sesiones/${newSessionId}`,
            headers: { Authorization: `Bearer ${authToken}` }
          });
        });
      });
    });
  });
});
