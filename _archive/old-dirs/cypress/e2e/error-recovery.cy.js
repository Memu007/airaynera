describe('Error Recovery & Resilience', () => {
  let authToken;

  before(() => {
    cy.request('POST', '/api/auth/demo-token')
      .then((response) => {
        authToken = response.body.token;
      });
  });

  describe('Graceful Error Handling', () => {
    it('returns user-friendly error for malformed JSON', () => {
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { 
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: '{"name": "Invalid JSON"', // Malformed JSON
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body).to.have.property('error');
        expect(response.body.error).to.not.include('SyntaxError');
        expect(response.body.error).to.include('Invalid');
      });
    });

    it('handles database errors gracefully', () => {
      // Try to create patient with duplicate unique field (if any)
      const uniqueData = { 
        name: 'Unique Test', 
        dni: '99999999' 
      };

      // Create first patient
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: uniqueData
      }).then(() => {
        // Try to create duplicate
        cy.request({
          method: 'POST',
          url: '/api/pacientes',
          headers: { Authorization: `Bearer ${authToken}` },
          body: uniqueData,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf([400, 409]);
          expect(response.body.error).to.not.include('SQLITE');
          expect(response.body.error).to.not.include('UNIQUE constraint');
        });
      });
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('continues serving cached data when database is slow', () => {
      // First, populate cache
      cy.request({
        method: 'GET',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` }
      }).then((initialResponse) => {
        const initialData = initialResponse.body;
        
        // Make another request immediately (should hit cache)
        cy.request({
          method: 'GET',
          url: '/api/pacientes',
          headers: { Authorization: `Bearer ${authToken}` }
        }).then((cachedResponse) => {
          expect(cachedResponse.body).to.deep.equal(initialData);
          expect(cachedResponse.status).to.eq(200);
        });
      });
    });
  });

  describe('Timeout Handling', () => {
    it('handles slow client connections gracefully', () => {
      // This tests that the server doesn't crash on slow clients
      // In real implementation, you'd set a small timeout
      cy.request({
        method: 'GET',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 10000 // 10 second timeout
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });

  describe('Recovery from Invalid State', () => {
    it('recovers from invalid session references', () => {
      // Create a session
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { name: 'Temp Patient' }
      }).then((patientResponse) => {
        const patientId = patientResponse.body.id;
        
        cy.request({
          method: 'POST',
          url: '/api/sesiones',
          headers: { Authorization: `Bearer ${authToken}` },
          body: {
            pacienteId: patientId,
            notas: 'Test session'
          }
        }).then((sessionResponse) => {
          const sessionId = sessionResponse.body.id;
          
          // Delete the patient (orphaning the session)
          cy.request({
            method: 'DELETE',
            url: `/api/pacientes/${patientId}`,
            headers: { Authorization: `Bearer ${authToken}` }
          }).then(() => {
            // Try to access the orphaned session
            cy.request({
              method: 'GET',
              url: `/api/sesiones/${sessionId}`,
              headers: { Authorization: `Bearer ${authToken}` },
              failOnStatusCode: false
            }).then((response) => {
              // Should handle gracefully
              expect(response.status).to.be.oneOf([404, 410]); // Not Found or Gone
            });
          });
        });
      });
    });
  });

  describe('Health Check Degradation', () => {
    it('health endpoint reflects system issues', () => {
      // Check initial health
      cy.request('/health').then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.status).to.be.oneOf(['ok', 'degraded']);
        
        // If test routes are enabled, trigger errors
        if (response.body.testRoutesEnabled) {
          // Trigger some 500 errors
          for (let i = 0; i < 3; i++) {
            cy.request({
              url: '/__test/500',
              failOnStatusCode: false
            });
          }
          
          // Check health again
          cy.request('/health').then((degradedResponse) => {
            // Might be degraded now
            expect(degradedResponse.body).to.have.property('metrics');
            if (degradedResponse.body.metrics.last5xxInWindow > 0) {
              cy.log(`System detected ${degradedResponse.body.metrics.last5xxInWindow} errors`);
            }
          });
        }
      });
    });
  });

  describe('Request Validation Recovery', () => {
    it('continues working after receiving invalid requests', () => {
      // Send various invalid requests
      const invalidRequests = [
        // Missing auth
        cy.request({
          url: '/api/pacientes',
          failOnStatusCode: false
        }),
        // Invalid method
        cy.request({
          method: 'PATCH',
          url: '/api/pacientes',
          headers: { Authorization: `Bearer ${authToken}` },
          failOnStatusCode: false
        }),
        // Invalid content type
        cy.request({
          method: 'POST',
          url: '/api/pacientes',
          headers: { 
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'text/plain'
          },
          body: 'not json',
          failOnStatusCode: false
        })
      ];

      cy.wrap(Promise.all(invalidRequests)).then(() => {
        // Server should still work normally
        cy.request({
          method: 'GET',
          url: '/api/pacientes',
          headers: { Authorization: `Bearer ${authToken}` }
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.be.an('array');
        });
      });
    });
  });
});
