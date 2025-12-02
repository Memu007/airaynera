describe('Security Headers Validation', () => {
  // No auth needed for /health

  it('validates critical security headers on API responses', () => {
    cy.request({
      url: '/health',
      failOnStatusCode: false
    }).then((response) => {
      // OWASP recommended headers
      expect(response.headers).to.have.property('x-content-type-options', 'nosniff');
      expect(response.headers).to.have.property('x-frame-options', 'DENY');
      // Some proxies may strip X-XSS-Protection; tolerate absence
      if (response.headers['x-xss-protection']) {
        expect(response.headers['x-xss-protection']).to.eq('0');
      }
      expect(response.headers).to.have.property('content-security-policy');
      expect(response.headers).to.have.property('referrer-policy');
      expect(response.headers).to.have.property('permissions-policy');
      
      // Validate CSP includes key directives
      const csp = response.headers['content-security-policy'];
      expect(csp).to.include("default-src 'self'");
      expect(csp).to.include("script-src");
      expect(csp).to.include("style-src");
    });
  });

  it('ensures no sensitive headers are exposed', () => {
    cy.request({ url: '/health', failOnStatusCode: false }).then((response) => {
      // Headers that should NOT be present
      expect(response.headers).to.not.have.property('x-powered-by');
      expect(response.headers).to.not.have.property('server');
    });
  });

  it('validates CORS headers are restrictive', () => {
    cy.request({
      url: '/api/health',
      headers: { 
        'Origin': 'https://evil.com'
      },
      failOnStatusCode: false
    }).then((response) => {
      // Should not have CORS headers for unauthorized origin
      expect(response.headers).to.not.have.property('access-control-allow-origin', 'https://evil.com');
    });
  });
});
