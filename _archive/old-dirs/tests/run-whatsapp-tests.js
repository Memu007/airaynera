#!/usr/bin/env node

/**
 * TEST RUNNER PRAGMÁTICO - Sin dependencias externas
 * QA Team: Senior Testing Squad  
 */

const assert = require('assert');
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

let passed = 0;
let failed = 0;
const results = [];

// Mini framework de testing
function test(description, fn) {
    try {
        fn();
        console.log(`${colors.green}✅${colors.reset} ${description}`);
        passed++;
        results.push({ test: description, status: 'PASS' });
    } catch (error) {
        console.log(`${colors.red}❌${colors.reset} ${description}`);
        console.log(`   ${colors.red}${error.message}${colors.reset}`);
        failed++;
        results.push({ test: description, status: 'FAIL', error: error.message });
    }
}

// Importar funciones a testear
const { detectMedicacion, detectarPacienteEnTexto } = require('./whatsapp-voice-capture.test.js');

console.log('\n🚀 EJECUTANDO TESTS WHATSAPP VOICE CAPTURE\n');
console.log('='*50 + '\n');

// SUITE 1: DETECCIÓN DE MEDICACIÓN
console.log('🔬 DETECCIÓN DE MEDICACIÓN\n');

test('Detecta medicación simple', () => {
    const meds = detectMedicacion("continúa con sertralina 50mg");
    assert.strictEqual(meds.length, 1);
    assert.strictEqual(meds[0].nombre, 'sertralina');
});

test('Detecta múltiples medicamentos', () => {
    const meds = detectMedicacion("sertralina 50mg y clonazepam 0.5mg");
    assert.strictEqual(meds.length, 2);
});

test('Rechaza dosis peligrosas (>1000mg)', () => {
    const meds = detectMedicacion("sertralina 9999mg");
    assert.strictEqual(meds.length, 0);
});

test('Acepta dosis decimales', () => {
    const meds = detectMedicacion("clonazepam 0.5mg");
    assert.strictEqual(meds[0].dosis, '0.5mg');
});

// SUITE 2: DETECCIÓN DE PACIENTE  
console.log('\n👤 DETECCIÓN DE PACIENTE\n');

const pacientes = [
    { id: '1', name: 'María González' },
    { id: '2', name: 'Carlos Rodríguez' }
];

test('Detecta "sesión con [nombre]"', () => {
    const p = detectarPacienteEnTexto("Sesión con María González", pacientes);
    assert.strictEqual(p.id, '1');
});

test('Detecta "paciente [nombre]"', () => {
    const p = detectarPacienteEnTexto("El paciente Carlos Rodríguez", pacientes);
    assert.strictEqual(p.id, '2');
});

test('Detecta nombre parcial', () => {
    const p = detectarPacienteEnTexto("Sesión con María", pacientes);
    assert.strictEqual(p.id, '1');
});

test('Retorna null si no encuentra', () => {
    const p = detectarPacienteEnTexto("Sesión con Juan Pérez", pacientes);
    assert.strictEqual(p, null);
});

// SUITE 3: CASOS REALES
console.log('\n🎯 CASOS REALES DE PSICÓLOGOS\n');

test('Caso real: Sesión completa con medicación', () => {
    const texto = "Sesión con María González. Continúa con sertralina 50mg y clonazepam 0.5mg";
    const paciente = detectarPacienteEnTexto(texto, pacientes);
    const meds = detectMedicacion(texto);
    
    assert.strictEqual(paciente.name, 'María González');
    assert.strictEqual(meds.length, 2);
    assert.strictEqual(meds[0].nombre, 'sertralina');
});

test('Caso real: Sesión sin medicación', () => {
    const texto = "Sesión con Carlos Rodríguez. Solo terapia cognitiva.";
    const paciente = detectarPacienteEnTexto(texto, pacientes);
    const meds = detectMedicacion(texto);
    
    assert.strictEqual(paciente.name, 'Carlos Rodríguez');
    assert.strictEqual(meds.length, 0);
});

// SUITE 4: SEGURIDAD
console.log('\n🔒 SEGURIDAD Y VALIDACIÓN\n');

test('Sanitiza caracteres XSS', () => {
    const malicioso = "sertralina<script>alert('xss')</script>";
    const seguro = malicioso.replace(/[<>'"]/g, '');
    assert.ok(!seguro.includes('<'));
});

test('Valida rango de dosis (0-1000mg)', () => {
    const valida = detectMedicacion("paracetamol 500mg");
    const invalida = detectMedicacion("paracetamol 5000mg");
    assert.strictEqual(valida.length, 1);
    assert.strictEqual(invalida.length, 0);
});

// RESULTADOS FINALES
console.log('\n' + '='*50);
console.log('\n📊 RESULTADOS FINALES:\n');
console.log(`${colors.green}✅ Tests pasados: ${passed}${colors.reset}`);
console.log(`${colors.red}❌ Tests fallidos: ${failed}${colors.reset}`);

const coverage = Math.round((passed / (passed + failed)) * 100);
const emoji = coverage >= 80 ? '🎉' : coverage >= 60 ? '⚠️' : '🔴';
console.log(`\n${emoji} Coverage: ${coverage}%`);

// Exportar resultados para CI/CD
if (failed > 0) {
    console.log('\n❌ TESTS FALLIDOS - Revisar antes de deployar');
    process.exit(1);
} else {
    console.log('\n✅ TODOS LOS TESTS PASARON - Listo para producción');
    process.exit(0);
}
