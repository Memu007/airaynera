describe('CORS Policy Validation', () => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://app.example.com' // Si CORS_ORIGINS_REGEX está configurado
  ];

  const blockedOrigins = [
    'https://evil.com',
    'http://malicious.site',
    'https://app.example.com.evil.com', // Should not match regex
    'https://fake-app.example.com'     // Should not match regex
  ];

  it('allows requests from whitelisted origins', () => {
    allowedOrigins.forEach(origin => {
      cy.request({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization'
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`Testing origin: ${origin}`);
        
        if (origin === 'https://app.example.com') {
          // This will only work if CORS_ORIGINS_REGEX is properly configured
          // Otherwise, it might be blocked
          cy.log('Note: This origin requires CORS_ORIGINS_REGEX to be set');
        } else {
          expect(response.status).to.be.oneOf([200, 204]);
          const allowHeader = response.headers['access-control-allow-origin'];
          expect(allowHeader).to.be.oneOf([origin, '*']);
        }
      });
    });
  });

  it('blocks requests from non-whitelisted origins', () => {
    blockedOrigins.forEach(origin => {
      cy.request({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'GET'
        },
        failOnStatusCode: false
      }).then((response) => {
        cy.log(`Testing blocked origin: ${origin}`);
        
        const allowHeader = response.headers['access-control-allow-origin'];
        // Should not have the malicious origin in the header
        expect(allowHeader).to.not.equal(origin);
        
        // If CORS is properly configured, the header should be absent or show allowed origin only
        if (allowHeader) {
          expect(allowHeader).to.be.oneOf(['*', ...allowedOrigins]);
        }
      });
    });
  });

  it('handles preflight requests correctly', () => {
    cy.request({
      method: 'OPTIONS',
      url: '/api/pacientes',
      headers: {
        'Origin': 'http://localhost:3001',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    }).then((response) => {
      expect(response.status).to.be.oneOf([200, 204]);
      expect(response.headers).to.have.property('access-control-allow-methods');
      expect(response.headers).to.have.property('access-control-allow-headers');
      
      const allowedMethods = response.headers['access-control-allow-methods'];
      expect(allowedMethods).to.include('POST');
      expect(allowedMethods).to.include('GET');
      
      const allowedHeaders = response.headers['access-control-allow-headers'];
      expect(allowedHeaders.toLowerCase()).to.include('authorization');
      expect(allowedHeaders.toLowerCase()).to.include('content-type');
    });
  });

  it('validates CORS regex anchoring', () => {
    // Test that regex is properly anchored with ^ and $
    const sneakyOrigins = [
      'https://app.example.com.attacker.com',
      'https://evil.app.example.com',
      'http://app.example.com', // Wrong protocol
      'https://app.example.com:8080' // With port
    ];

    sneakyOrigins.forEach(origin => {
      cy.request({
        method: 'GET',
        url: '/api/health',
        headers: { 'Origin': origin },
        failOnStatusCode: false
      }).then((response) => {
        const allowHeader = response.headers['access-control-allow-origin'];
        
        // These should NOT be allowed by a properly anchored regex
        if (allowHeader && allowHeader !== '*') {
          expect(allowHeader).to.not.equal(origin);
        }
      });
    });
  });

  it('verifies credentials are handled correctly', () => {
    cy.request({
      method: 'OPTIONS',
      url: '/api/pacientes',
      headers: {
        'Origin': 'http://localhost:3001',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization'
      }
    }).then((response) => {
      expect(response.status).to.be.oneOf([200, 204]);
      
      // When credentials are allowed, origin cannot be *
      if (response.headers['access-control-allow-credentials'] === 'true') {
        expect(response.headers['access-control-allow-origin']).to.not.equal('*');
      }
    });
  });
});
