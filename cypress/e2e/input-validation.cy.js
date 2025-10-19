describe('Input Validation & Injection Prevention', () => {
  let authToken;

  before(() => {
    cy.request({ method: 'POST', url: '/api/auth/demo-token', failOnStatusCode: false })
      .then((response) => {
        if (response.status === 429) return cy.request({ method: 'POST', url: '/api/auth/demo-token', failOnStatusCode: false });
        return response;
      })
      .then((response) => {
        expect(response.status).to.be.oneOf([200]);
        authToken = response.body.token;
      });
  });

  describe('XSS Prevention', () => {
    it('rejects script tags in patient name', () => {
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { 
          name: '<script>alert("XSS")</script>',
          dni: '12345678'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 422]);
      });
    });

    it('rejects HTML entities in session notes', () => {
      // First create a patient
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { name: 'Test Patient' }
      }).then((patientResponse) => {
        const patientId = patientResponse.body.id;
        
        // Try to inject HTML in session notes
        cy.request({
          method: 'POST',
          url: '/api/sesiones',
          headers: { Authorization: `Bearer ${authToken}` },
          body: { 
            pacienteId: patientId,
            notas: '<img src=x onerror=alert(1)>',
            mood_assessment: 3
          },
          failOnStatusCode: false
        }).then((response) => {
          // Should either reject or sanitize
          if (response.status === 201) {
            expect(response.body.notas).to.not.include('<img');
            expect(response.body.notas).to.not.include('onerror');
          } else {
            expect(response.status).to.be.oneOf([200, 201, 400, 422]);
          }
        });
      });
    });
  });

  describe('SQL Injection Prevention', () => {
    it('handles SQL injection attempts in patient search', () => {
      cy.request({
        method: 'GET',
        url: '/api/pacientes?search=\'; DROP TABLE pacientes; --',
        headers: { Authorization: `Bearer ${authToken}` },
        failOnStatusCode: false
      }).then((response) => {
        // Should return valid response, not error
        expect(response.status).to.eq(200);
        expect(response.body).to.be.an('array');
      });
    });

    it('handles SQL injection in patient ID parameter', () => {
      cy.request({
        method: 'GET',
        url: '/api/pacientes/1 OR 1=1',
        headers: { Authorization: `Bearer ${authToken}` },
        failOnStatusCode: false
      }).then((response) => {
        // Should return 404 or 400, not expose data
        expect(response.status).to.be.oneOf([400, 404]);
      });
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('rejects object injection in JSON body', () => {
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { 
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: { 
          name: { $ne: null },
          dni: { $gt: '' }
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 422]);
      });
    });
  });

  describe('Input Length Validation', () => {
    it('rejects excessively long patient names', () => {
      const longName = 'A'.repeat(300);
      cy.request({
        method: 'POST',
        url: '/api/pacientes',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { name: longName },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 413, 422]);
      });
    });

    it('rejects excessively long session notes', () => {
      const longNotes = 'B'.repeat(10001);
      cy.request({
        method: 'POST',
        url: '/api/sesiones',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { 
          pacienteId: '1',
          notas: longNotes
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 413, 422]);
      });
    });
  });

  describe('Type Validation', () => {
    it('rejects non-numeric patient IDs', () => {
      cy.request({
        method: 'GET',
        url: '/api/pacientes/abc',
        headers: { Authorization: `Bearer ${authToken}` },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 404]);
      });
    });

    it('rejects invalid mood assessment values', () => {
      cy.request({
        method: 'POST',
        url: '/api/sesiones',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { 
          pacienteId: '1',
          mood_assessment: 'happy' // Should be numeric 1-5
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 422]);
      });
    });
  });
});
