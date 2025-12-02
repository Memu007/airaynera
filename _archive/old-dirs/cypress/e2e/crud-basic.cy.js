// CRUD básico de pacientes contra el API demo con auth
describe('CRUD básico pacientes', () => {
  const api = () => Cypress.env('BASE_URL') || 'http://localhost:3001';

  it('emite token y lista pacientes', () => {
    cy.request('POST', `${api()}/api/auth/demo-token`).then(({ body }) => {
      expect(body.token).to.be.a('string');
      const token = body.token;
      cy.request({
        method: 'GET',
        url: `${api()}/api/pacientes`,
        headers: { Authorization: `Bearer ${token}` },
      }).its('status').should('eq', 200);
    });
  });

  it('crea y elimina paciente', () => {
    let token;
    cy.request('POST', `${api()}/api/auth/demo-token`).then(({ body }) => {
      token = body.token;
      return cy.request({
        method: 'POST',
        url: `${api()}/api/pacientes`,
        headers: { Authorization: `Bearer ${token}` },
        body: { name: 'Paciente E2E', dni: '12345678', phone: '11-1111-1111', email: 'e2e@aira.test' },
      });
    }).then(({ body }) => {
      expect(body.id).to.exist;
      const id = body.id;
      return cy.request({
        method: 'DELETE',
        url: `${api()}/api/pacientes/${id}`,
        headers: { Authorization: `Bearer ${token}` },
      });
    }).its('status').should('be.oneOf', [200, 204]);
  });
});


