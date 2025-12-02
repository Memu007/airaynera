const { defineConfig } = require('cypress');
const fs = require('fs');

module.exports = defineConfig({
  video: false,
  chromeWebSecurity: false,
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    setupNodeEvents(on, config) {
      on('task', {
        fileExists(filePath) {
          return fs.existsSync(filePath);
        }
      });
    }
  },
});


