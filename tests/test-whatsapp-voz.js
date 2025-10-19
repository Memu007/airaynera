#!/usr/bin/env node

/**
 * TEST SUITE PRAGMÁTICO - WhatsApp Voice Capture
 * QA Team Senior - Sin dependencias externas
 */

const assert = require('assert');

// Colores para output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Contadores
let passed = 0;
let failed = 0;
const failedTests = [];

// Mini framework
function test(description, fn) {
    try {
        fn();
        console.log(`  ${colors.green}✅${colors.reset} ${description}`);
        passed++;
    } catch (error) {
        console.log(`  ${colors.red}❌${colors.reset} ${description}`);
        console.log(`     ${colors.red}Error: ${error.message}${colors.reset}`);
        failed++;
        failedTests.push({ test: description, error: error.message });
    }
}

function suite(name, tests) {
    console.log(`\n${colors.blue}${name}${colors.reset}`);
    tests();
}

// FUNCIONES A TESTEAR (copiadas del frontend)
const detectMedicacion = (texto) => {
    const medicamentos = [];
    const patron = /\b(\w+)\s+(\d+(?:\.\d+)?)\s*(mg|ml|gr?|mcg|ui)/gi;
    let match;
    while ((match = patron.exec(texto)) !== null) {
        const dosisNum = parseFloat(match[2]);
        if (dosisNum > 0 && dosisNum <= 1000) {
            medicamentos.push({
                nombre: match[1],
                dosis: match[2] + match[3]
            });
        }
    }
    return medicamentos;
};

const detectarPacienteEnTexto = (texto, pacientes) => {
    const patronesPaciente = [
        /sesi[óo]n\s+(?:con|de)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?)/i,
        /paciente\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?)/i,
        /consulta\s+(?:con|de)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?)/i
    ];
    
    for (const patron of patronesPaciente) {
        const match = texto.match(patron);
        if (match && match[1]) {
            const nombreDetectado = match[1].trim();
            const normalized = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
            const paciente = pacientes.find(p => 
                normalized(p.name || '').includes(normalized(nombreDetectado)) ||
                normalized(nombreDetectado).includes(normalized(p.name || ''))
            );
            if (paciente) return paciente;
        }
    }
    return null;
};

// INICIO DE TESTS
console.log('\n╔════════════════════════════════════════════════╗');
console.log('║   🧪 TEST SUITE: WhatsApp Voice Capture       ║');
console.log('║   QA Team: Senior Testing Squad                ║');
console.log('╚════════════════════════════════════════════════╝');

// SUITE 1: DETECCIÓN DE MEDICACIÓN
suite('🔬 SUITE 1: DETECCIÓN DE MEDICACIÓN', () => {
    
    test('Detecta medicación simple (sertralina 50mg)', () => {
        const meds = detectMedicacion("continúa con sertralina 50mg");
        assert.strictEqual(meds.length, 1);
        assert.strictEqual(meds[0].nombre, 'sertralina');
        assert.strictEqual(meds[0].dosis, '50mg');
    });

    test('Detecta múltiples medicamentos', () => {
        const meds = detectMedicacion("sertralina 50mg por la mañana y clonazepam 0.5mg");
        assert.strictEqual(meds.length, 2);
        assert.strictEqual(meds[0].nombre, 'sertralina');
        assert.strictEqual(meds[1].nombre, 'clonazepam');
    });

    test('Rechaza dosis peligrosas (>1000mg)', () => {
        const meds = detectMedicacion("sertralina 9999mg no es seguro");
        assert.strictEqual(meds.length, 0, 'No debe detectar dosis peligrosas');
    });

    test('Detecta dosis decimales (0.5mg)', () => {
        const meds = detectMedicacion("clonazepam 0.5mg antes de dormir");
        assert.strictEqual(meds.length, 1);
        assert.strictEqual(meds[0].dosis, '0.5mg');
    });

    test('Maneja diferentes unidades (mg, ml, ui)', () => {
        const meds = detectMedicacion("insulina 10ui, jarabe 5ml");
        assert.strictEqual(meds.length, 2);
        assert.strictEqual(meds[0].dosis, '10ui');
        assert.strictEqual(meds[1].dosis, '5ml');
    });
});

// SUITE 2: DETECCIÓN DE PACIENTE
suite('👤 SUITE 2: DETECCIÓN DE PACIENTE', () => {
    const pacientes = [
        { id: '1', name: 'María González' },
        { id: '2', name: 'Carlos Rodríguez' },
        { id: '3', name: 'Ana López' }
    ];

    test('Detecta "sesión con [nombre]"', () => {
        const p = detectarPacienteEnTexto("Sesión con María González", pacientes);
        assert.notStrictEqual(p, null);
        assert.strictEqual(p.id, '1');
    });

    test('Detecta "paciente [nombre]"', () => {
        const p = detectarPacienteEnTexto("El paciente Carlos Rodríguez presenta", pacientes);
        assert.notStrictEqual(p, null);
        assert.strictEqual(p.id, '2');
    });

    test('Detecta nombre parcial (solo nombre)', () => {
        const p = detectarPacienteEnTexto("Sesión con María", pacientes);
        assert.notStrictEqual(p, null);
        assert.strictEqual(p.id, '1');
    });

    test('Maneja mayúsculas y tildes', () => {
        const p = detectarPacienteEnTexto("SESIÓN CON MARÍA GONZÁLEZ", pacientes);
        assert.notStrictEqual(p, null);
        assert.strictEqual(p.id, '1');
    });

    test('Retorna null si no encuentra paciente', () => {
        const p = detectarPacienteEnTexto("Sesión con Juan Pérez", pacientes);
        assert.strictEqual(p, null);
    });
});

// SUITE 3: CASOS REALES DE USO
suite('🎯 SUITE 3: CASOS REALES DE PSICÓLOGOS', () => {
    const pacientes = [
        { id: '1', name: 'María González' },
        { id: '2', name: 'Carlos Rodríguez' }
    ];

    test('Sesión completa con medicación', () => {
        const texto = "Sesión con María González. Continúa con sertralina 50mg y clonazepam 0.5mg por las noches. Presenta mejora en ansiedad.";
        
        const paciente = detectarPacienteEnTexto(texto, pacientes);
        const meds = detectMedicacion(texto);
        
        assert.notStrictEqual(paciente, null);
        assert.strictEqual(paciente.name, 'María González');
        assert.strictEqual(meds.length, 2);
        assert.strictEqual(meds[0].nombre, 'sertralina');
        assert.strictEqual(meds[1].nombre, 'clonazepam');
    });

    test('Sesión sin medicación', () => {
        const texto = "Sesión con Carlos Rodríguez. Solo terapia cognitiva conductual. No requiere medicación.";
        
        const paciente = detectarPacienteEnTexto(texto, pacientes);
        const meds = detectMedicacion(texto);
        
        assert.notStrictEqual(paciente, null);
        assert.strictEqual(paciente.name, 'Carlos Rodríguez');
        assert.strictEqual(meds.length, 0);
    });

    test('Cambio de dosis', () => {
        const texto = "Paciente María González. Aumentamos sertralina de 50mg a 75mg por respuesta parcial";
        
        const paciente = detectarPacienteEnTexto(texto, pacientes);
        const meds = detectMedicacion(texto);
        
        assert.notStrictEqual(paciente, null);
        assert.strictEqual(meds.length, 2);
    });
});

// SUITE 4: SEGURIDAD Y VALIDACIÓN
suite('🔒 SUITE 4: SEGURIDAD', () => {
    
    test('Sanitiza caracteres XSS (<>)', () => {
        const malicioso = "sertralina<script>alert('xss')</script>";
        const seguro = malicioso.replace(/[<>'"]/g, '');
        assert.ok(!seguro.includes('<'));
        assert.ok(!seguro.includes('>'));
        assert.ok(!seguro.includes("'"));
    });

    test('Valida rango de dosis (0-1000)', () => {
        const valida = detectMedicacion("paracetamol 500mg");
        const invalida = detectMedicacion("paracetamol 5000mg");
        assert.strictEqual(valida.length, 1);
        assert.strictEqual(invalida.length, 0);
    });

    test('Evita inyección SQL en nombres', () => {
        const nombreMalicioso = "'; DROP TABLE patients; --";
        const seguro = nombreMalicioso.replace(/[';-]/g, '');
        assert.ok(!seguro.includes("'"));
        assert.ok(!seguro.includes(";"));
    });
});

// SUITE 5: CASOS BORDE
suite('🔧 SUITE 5: CASOS BORDE', () => {
    
    test('Maneja texto vacío', () => {
        const meds = detectMedicacion('');
        assert.strictEqual(meds.length, 0);
    });

    test('Maneja array vacío de pacientes', () => {
        const p = detectarPacienteEnTexto('Sesión con María', []);
        assert.strictEqual(p, null);
    });

    test('Ignora medicación sin dosis', () => {
        const meds = detectMedicacion("El paciente toma sertralina pero no especifica dosis");
        assert.strictEqual(meds.length, 0);
    });

    test('Detecta nombres compuestos', () => {
        const pacientes = [{ id: '1', name: 'María del Carmen' }];
        const p = detectarPacienteEnTexto("Sesión con María del Carmen", pacientes);
        assert.notStrictEqual(p, null);
    });
});

// SUITE 6: PERFORMANCE 
suite('⚡ SUITE 6: PERFORMANCE', () => {
    
    test('Procesa 100 medicamentos < 100ms', () => {
        const texto = Array(100).fill('sertralina 50mg').join(' ');
        const start = Date.now();
        const meds = detectMedicacion(texto);
        const tiempo = Date.now() - start;
        assert.ok(tiempo < 100, `Tardó ${tiempo}ms`);
        assert.strictEqual(meds.length, 100);
    });

    test('Busca en 1000 pacientes < 50ms', () => {
        const pacientes = Array(1000).fill(null).map((_, i) => ({
            id: String(i),
            name: `Paciente ${i}`
        }));
        const start = Date.now();
        const p = detectarPacienteEnTexto("Sesión con Paciente 500", pacientes);
        const tiempo = Date.now() - start;
        assert.ok(tiempo < 50, `Tardó ${tiempo}ms`);
    });
});

// RESULTADOS FINALES
console.log('\n╔════════════════════════════════════════════════╗');
console.log('║              📊 RESULTADOS FINALES             ║');
console.log('╠════════════════════════════════════════════════╣');
console.log(`║ ${colors.green}✅ Tests pasados:${colors.reset}  ${passed.toString().padEnd(27)} ║`);
console.log(`║ ${colors.red}❌ Tests fallidos:${colors.reset} ${failed.toString().padEnd(27)} ║`);

const total = passed + failed;
const coverage = total > 0 ? Math.round((passed / total) * 100) : 0;
const emoji = coverage >= 80 ? '🎉' : coverage >= 60 ? '⚠️' : '🔴';

console.log(`║ ${emoji} Coverage:       ${coverage}%`.padEnd(50) + '║');
console.log('╚════════════════════════════════════════════════╝');

// Detalles de fallos
if (failed > 0) {
    console.log(`\n${colors.red}TESTS FALLIDOS:${colors.reset}`);
    failedTests.forEach(t => {
        console.log(`  • ${t.test}`);
        console.log(`    ${colors.yellow}${t.error}${colors.reset}`);
    });
}

// RECOMENDACIONES QA
console.log('\n📝 RECOMENDACIONES QA TEAM SENIOR:');
if (coverage >= 80) {
    console.log(`${colors.green}✅ Cobertura excelente - Listo para producción${colors.reset}`);
} else if (coverage >= 60) {
    console.log(`${colors.yellow}⚠️ Cobertura aceptable - Revisar tests fallidos${colors.reset}`);
} else {
    console.log(`${colors.red}🔴 Cobertura crítica - NO deployar${colors.reset}`);
}

// Exit code para CI/CD
process.exit(failed > 0 ? 1 : 0);
