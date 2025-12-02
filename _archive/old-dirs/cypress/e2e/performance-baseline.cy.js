describe('Performance Baseline Tests', () => {
  let authToken;
  const ACCEPTABLE_RESPONSE_TIME = 200; // ms for read operations
  const ACCEPTABLE_WRITE_TIME = 500; // ms for write operations

  before(() => {
    cy.request('POST', '/api/auth/demo-token')
      .then((response) => {
        authToken = response.body.token;
      });

    // Create test data
    const patients = [];
    for (let i = 0; i < 50; i++) {
      patients.push({
        name: `Perf Test Patient ${i}`,
        dni: `${10000000 + i}`,
        phone: `11${20000000 + i}`
      });
    }

    // Batch create patients
    cy.wrap(patients).each((patient) => {
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: patient
      });
    });
  });

  describe('Response Time Validation', () => {
    it('GET /api/pacientes responds within acceptable time', () => {
      const startTime = Date.now();
      
      cy.request({
        method: 'GET',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` }
      }).then((response) => {
        const responseTime = Date.now() - startTime;
        
        expect(response.status).to.eq(200);
        expect(responseTime).to.be.lessThan(ACCEPTABLE_RESPONSE_TIME);
        
        // Log for performance tracking
        cy.log(`GET /api/pacientes: ${responseTime}ms`);
      });
    });

    it('GET /api/sesiones responds within acceptable time', () => {
      const startTime = Date.now();
      
      cy.request({
        method: 'GET',
        url: '/api/sesiones',
        headers: { Authorization: `Bearer ${authToken}` }
      }).then((response) => {
        const responseTime = Date.now() - startTime;
        
        expect(response.status).to.eq(200);
        expect(responseTime).to.be.lessThan(ACCEPTABLE_RESPONSE_TIME);
        
        cy.log(`GET /api/sesiones: ${responseTime}ms`);
      });
    });

    it('POST operations complete within acceptable time', () => {
      const startTime = Date.now();
      
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          name: 'Performance Test Patient',
          dni: '99999999'
        }
      }).then((response) => {
        const responseTime = Date.now() - startTime;
        
        expect(response.status).to.eq(201);
        expect(responseTime).to.be.lessThan(ACCEPTABLE_WRITE_TIME);
        
        cy.log(`POST /api/pacientes: ${responseTime}ms`);
      });
    });
  });

  describe('Concurrent Request Handling', () => {
    it('handles multiple concurrent reads efficiently', () => {
      const requests = [];
      const startTime = Date.now();
      
      // Make 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          cy.request({
            method: 'GET',
            url: '/api/pacientes',
            headers: { Authorization: `Bearer ${authToken}` }
          })
        );
      }
      
      cy.wrap(Promise.all(requests)).then((responses) => {
        const totalTime = Date.now() - startTime;
        
        // All should succeed
        responses.forEach(r => expect(r.status).to.eq(200));
        
        // Total time should be less than sequential time
        expect(totalTime).to.be.lessThan(ACCEPTABLE_RESPONSE_TIME * 5);
        
        cy.log(`10 concurrent requests: ${totalTime}ms total`);
      });
    });
  });

  describe('Cache Effectiveness', () => {
    it('demonstrates cache performance improvement', () => {
      // First request (cache miss)
      const firstStartTime = Date.now();
      
      cy.request({
        method: 'GET',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` }
      }).then(() => {
        const firstResponseTime = Date.now() - firstStartTime;
        
        // Second request (should hit cache)
        const secondStartTime = Date.now();
        
        cy.request({
          method: 'GET',
          url: '/api/pacientes',
          headers: { Authorization: `Bearer ${authToken}` }
        }).then(() => {
          const secondResponseTime = Date.now() - secondStartTime;
          
          // Cache hit should be faster
          expect(secondResponseTime).to.be.lessThan(firstResponseTime);
          
          cy.log(`Cache miss: ${firstResponseTime}ms, Cache hit: ${secondResponseTime}ms`);
        });
      });
    });

    it('invalidates cache on data modification', () => {
      // Get initial data
      cy.request({
        method: 'GET',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` }
      }).then((initialResponse) => {
        const initialCount = initialResponse.body.length;
        
        // Create new patient
        cy.request({
          method: 'POST',
          url: '/api/pacientes',
          headers: { Authorization: `Bearer ${authToken}` },
          body: { name: 'Cache Test Patient' }
        }).then(() => {
          // Get data again - should reflect the change
          cy.request({
            method: 'GET',
            url: '/api/pacientes',
            headers: { Authorization: `Bearer ${authToken}` }
          }).then((updatedResponse) => {
            expect(updatedResponse.body.length).to.eq(initialCount + 1);
          });
        });
      });
    });
  });

  describe('Resource Limits', () => {
    it('handles large result sets efficiently', () => {
      const startTime = Date.now();
      
      cy.request({
        method: 'GET',
        url: '/api/pacientes?incluirInhabilitados=true',
        headers: { Authorization: `Bearer ${authToken}` }
      }).then((response) => {
        const responseTime = Date.now() - startTime;
        const dataSize = JSON.stringify(response.body).length;
        
        expect(response.status).to.eq(200);
        // Even with more data, should be reasonable
        expect(responseTime).to.be.lessThan(ACCEPTABLE_RESPONSE_TIME * 2);
        
        cy.log(`Large dataset: ${response.body.length} items, ${dataSize} bytes, ${responseTime}ms`);
      });
    });
  });
});
