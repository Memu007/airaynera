describe('Pacientes - filtro incluirInhabilitados', () => {
  const api = () => Cypress.env('BASE_URL') || 'http://localhost:3001';

  it('excluye inhabilitados por defecto y los incluye con incluirInhabilitados=true', () => {
    let token;
    let id;
    // token
    cy.request('POST', `${api()}/api/auth/demo-token`).then(({ body }) => { token = body.token; });
    // crear paciente inhabilitado
    cy.then(() => cy.request({
      method: 'POST', url: `${api()}/api/pacientes`, headers: { Authorization: `Bearer ${token}` },
      body: { name: 'Paciente Inhabilitado', habilitado: false },
    })).then(({ body }) => { id = body.id; expect(id).to.exist; });
    // listar por defecto (no debe aparecer)
    cy.then(() => cy.request({
      method: 'GET', url: `${api()}/api/pacientes`, headers: { Authorization: `Bearer ${token}` },
    })).then(({ body }) => {
      const found = (body || []).find(p => String(p.id) === String(id));
      expect(found).to.not.exist;
    });
    // listar con incluirInhabilitados=true (debe aparecer)
    cy.then(() => cy.request({
      method: 'GET', url: `${api()}/api/pacientes?incluirInhabilitados=true`, headers: { Authorization: `Bearer ${token}` },
    })).then(({ body }) => {
      const found = (body || []).find(p => String(p.id) === String(id));
      expect(found).to.exist;
    });
    // cleanup
    cy.then(() => cy.request({ method: 'DELETE', url: `${api()}/api/pacientes/${id}`, headers: { Authorization: `Bearer ${token}` } }))
      .its('status').should('be.oneOf', [200, 204]);
  });
});


