#!/usr/bin/env node

/**
 * Script para ejecutar todos los tests del proyecto
 * Este script ejecuta todas las suites de tests en orden
 */

const { execSync } = require('child_process');
const path = require('path');

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

// Función para imprimir con formato
function print(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Función para ejecutar comando
function runCommand(command, description) {
    print(`\n${description}...`, 'cyan');
    try {
        const output = execSync(command, { 
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'test',
                ENCRYPTION_SECRET: 'test-secret-key-32-chars-long',
                JWT_SECRET: 'test-jwt-secret-key-32-chars-long'
            }
        });
        print(`✅ ${description} - COMPLETADO`, 'green');
        return true;
    } catch (error) {
        print(`❌ ${description} - ERROR`, 'red');
        return false;
    }
}

// Lista de suites de tests
const testSuites = [
    {
        name: 'Servicios - PatientsService',
        command: 'npm test -- tests/unit/services/patientsService.test.js --coverage --verbose'
    },
    {
        name: 'Servicios - AuthService',
        command: 'npm test -- tests/unit/services/authService.test.js --coverage --verbose'
    },
    {
        name: 'Controllers - PatientsController',
        command: 'npm test -- tests/unit/controllers/patientsController.test.js --coverage --verbose'
    },
    {
        name: 'Controllers - AuthController',
        command: 'npm test -- tests/unit/controllers/authController.test.js --coverage --verbose'
    },
    {
        name: 'Integración - API Pacientes',
        command: 'npm test -- tests/integration/patients-api.test.js --coverage --verbose'
    },
    {
        name: 'Integración - API Auth',
        command: 'npm test -- tests/integration/auth-api.test.js --coverage --verbose'
    },
    {
        name: 'Integración - Rutas',
        command: 'npm test -- tests/integration/routes.test.js --coverage --verbose'
    },
    {
        name: 'End-to-End - Aplicación Completa',
        command: 'npm test -- tests/e2e/app.test.js --coverage --verbose'
    }
];

// Función principal
async function runAllTests() {
    print('🚀 INICIANDO EJECUCIÓN DE TODOS LOS TESTS', 'bright');
    print('=============================================', 'bright');
    
    const startTime = Date.now();
    let passed = 0;
    let failed = 0;

    for (const suite of testSuites) {
        const success = runCommand(suite.command, suite.name);
        if (success) {
            passed++;
        } else {
            failed++;
        }
    }

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    print('\n📊 RESUMEN DE EJECUCIÓN', 'bright');
    print('========================', 'bright');
    print(`✅ Tests pasados: ${passed}`, 'green');
    print(`❌ Tests fallidos: ${failed}`, 'red');
    print(`⏱️  Tiempo total: ${totalTime} segundos`, 'cyan');
    
    if (failed === 0) {
        print('\n🎉 ¡TODOS LOS TESTS PASARON EXITOSAMENTE!', 'green');
        print('El proyecto está listo para producción con cobertura completa.', 'green');
    } else {
        print(`\n⚠️  ${failed} suite(s) fallaron. Revisa los logs para más detalles.`, 'yellow');
    }

    // Generar reporte de cobertura final
    print('\n📈 GENERANDO REPORTE DE COBERTURA FINAL...', 'magenta');
    try {
        execSync('npm run test:coverage', { 
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'test',
                ENCRYPTION_SECRET: 'test-secret-key-32-chars-long',
                JWT_SECRET: 'test-jwt-secret-key-32-chars-long'
            }
        });
    } catch (error) {
        print('⚠️  Error generando reporte de cobertura', 'yellow');
    }

    process.exit(failed > 0 ? 1 : 0);
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests };
