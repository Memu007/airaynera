const AIService = require('../../src/services/AIService');

describe('AIService validators', () => {
  test('redactSensitive masks emails/phones/ids', () => {
    const t = 'Paciente juan@mail.com tel 11-5555-1234 id 12345678';
    const r = AIService.redactSensitive(t);
    expect(r).toContain('[email]');
    expect(r).toContain('[tel]');
    expect(r).toContain('[id]');
  });

  test('validateSummary enforces headings and length', () => {
    const ok = `**Estado Emocional:** Bien\n**Observaciones Clínicas:** ...\n**Intervenciones:** ...\n**Recomendaciones:** ...`;
    expect(AIService.validateSummary(ok)).toBeTruthy();
    const bad = 'texto libre sin formato';
    expect(AIService.validateSummary(bad)).toBeNull();
  });
});


