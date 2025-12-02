describe('Admin y Metrics', () => {
  const api = () => Cypress.env('BASE_URL') || 'http://localhost:3001';

  it('admin ping con rol y metrics contienen campos básicos', () => {
    let token;
    cy.request('POST', `${api()}/api/auth/demo-token`).then(({ body }) => {
      token = body.token;
      return cy.request({
        method: 'GET',
        url: `${api()}/api/admin/ping`,
        headers: { Authorization: `Bearer ${token}` },
      });
    }).then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body.ok).to.eq(true);
      return cy.request({
        method: 'GET',
        url: `${api()}/metrics`,
        headers: { Authorization: `Bearer ${token}` },
      });
    }).then(({ status, body }) => {
      expect(status).to.eq(200);
      expect(body).to.have.property('totalRequests');
      expect(body).to.have.property('responses2xx');
      expect(body).to.have.property('avgResponseMs');
    });
  });
});


