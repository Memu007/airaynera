// CRUD básico de sesiones asociado a un paciente temporal
describe('CRUD básico sesiones', () => {
  const api = () => Cypress.env('BASE_URL') || 'http://localhost:3001';

  function issueToken() {
    return cy.request('POST', `${api()}/api/auth/demo-token`).then(({ body }) => body.token);
  }

  it('crea, edita y elimina sesión', () => {
    let token;
    let patientId;
    let sessionId;
    issueToken()
      .then(t => { token = t; })
      // Crear paciente temporal
      .then(() => cy.request({
        method: 'POST',
        url: `${api()}/api/pacientes`,
        headers: { Authorization: `Bearer ${token}` },
        body: { name: 'Paciente Sesión E2E' },
      }))
      .then(({ body }) => { patientId = body.id; expect(patientId).to.exist; })
      // Crear sesión
      .then(() => cy.request({
        method: 'POST',
        url: `${api()}/api/sesiones`,
        headers: { Authorization: `Bearer ${token}` },
        body: { pacienteId: String(patientId), notas: 'nota e2e', mood_assessment: 4, requires_followup: false },
      }))
      .then(({ body }) => { sessionId = body.id; expect(sessionId).to.exist; })
      // Editar sesión
      .then(() => cy.request({
        method: 'PUT',
        url: `${api()}/api/sesiones/${sessionId}`,
        headers: { Authorization: `Bearer ${token}` },
        body: { notas: 'nota e2e editada', requires_followup: true },
      }))
      .its('status').should('eq', 200)
      // Listar sesiones
      .then(() => cy.request({
        method: 'GET',
        url: `${api()}/api/sesiones`,
        headers: { Authorization: `Bearer ${token}` },
      }))
      .then(({ status, body }) => {
        expect(status).to.eq(200);
        const found = (body || []).find(s => String(s.id) === String(sessionId));
        expect(found).to.exist;
      })
      // Eliminar sesión
      .then(() => cy.request({
        method: 'DELETE',
        url: `${api()}/api/sesiones/${sessionId}`,
        headers: { Authorization: `Bearer ${token}` },
      }))
      .its('status').should('be.oneOf', [200, 204])
      // Cleanup: eliminar paciente
      .then(() => cy.request({
        method: 'DELETE',
        url: `${api()}/api/pacientes/${patientId}`,
        headers: { Authorization: `Bearer ${token}` },
      }))
      .its('status').should('be.oneOf', [200, 204]);
  });
});


