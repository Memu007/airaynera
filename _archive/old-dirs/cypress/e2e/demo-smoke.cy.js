describe('Demo smoke', () => {
  const baseUrl = Cypress.config('baseUrl') || 'http://localhost:3000';
  const apiBase = () => baseUrl; // mismo host/puerto
  let token;

  before(() => {
    // Obtener token y forzar que la app use Authorization en fetch y jQuery.ajax
    cy.request('POST', `${apiBase()}/api/auth/demo-token`).then(({ body }) => {
      token = body.token;
    });
  });

  beforeEach(() => {
    cy.window({ log: false }).then((win) => {
      try {
        if (win.fetch) {
          const originalFetch = win.fetch.bind(win);
          win.fetch = (input, init = {}) => {
            init.headers = Object.assign({}, init.headers, { Authorization: `Bearer ${token}` });
            return originalFetch(input, init);
          };
        }
        if (win.$ && win.$.ajaxSetup) {
          win.$.ajaxSetup({ headers: { Authorization: `Bearer ${token}` } });
        }
      } catch (_) {}
    });
  });

  it('Landing -> Demo renderiza', () => {
    cy.visit(`${baseUrl}/`, { timeout: 60000 });
    cy.contains('AIRA').should('exist');
    cy.visit(`${baseUrl}/demo`, { timeout: 60000 });
    cy.contains('Dashboard').should('exist');
    cy.get('#dashboardScreen', { timeout: 10000 }).should('be.visible');
  });

  it('Alta paciente: API ok y feedback visible', () => {
    cy.visit(`${baseUrl}/demo`, { timeout: 60000 });
    cy.get('#dashboardScreen', { timeout: 10000 }).should('be.visible');
    cy.intercept('POST', '/api/pacientes').as('createPatient');
    cy.get('[data-action="new-patient"]:visible').first().click({ force: true });
    cy.get('#patientName').type('Paciente Cypress');
    cy.get('#patientDni').type('44556677');
    cy.get('#patientInsurance').type('OSDE');
    cy.get('#patientPhone').type('1100000000');
    cy.get('#newPatientForm').submit();
    cy.wait('@createPatient').its('response.statusCode').should('be.oneOf', [200, 201]);
    cy.contains('Paciente registrado exitosamente', { timeout: 10000 }).should('exist');
  });

  it('Nueva sesión: API ok y feedback visible', () => {
    cy.visit(`${baseUrl}/demo`, { timeout: 60000 });
    cy.get('#dashboardScreen', { timeout: 10000 }).should('be.visible');
    cy.get('[data-action="nav-sessions"]').first().click();
    cy.intercept('POST', '/api/sesiones').as('createSession');
    cy.get('[data-action="new-session"]:visible').first().click({ force: true });
    // Seleccionar primer paciente disponible por índice 1 (después de placeholder)
    cy.get('#sessionPatient', { timeout: 10000 }).should('exist').select(1, { force: true });
    cy.get('#sessionContent').type('Sesión creada por Cypress');
    cy.get('#sessionMood').select('4');
    cy.get('#newSessionForm').submit();
    cy.wait('@createSession').its('response.statusCode').should('be.oneOf', [200, 201]);
    cy.contains('Sesión guardada exitosamente', { timeout: 10000 }).should('exist');
  });
});


