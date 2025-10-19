// Minimal unit tests to raise branch/functions coverage around server helpers
const app = require('../../server-demo-funcional');

describe('Server config basics', () => {
  it('exports express app instance', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });
});


