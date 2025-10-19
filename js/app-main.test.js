const fs = require('fs');
const path = require('path');

// --- Test Setup ---
// Leemos el código de app-main.js como texto para evitar problemas
// al importar un archivo no modular con dependencias de navegador (jQuery, document).
const appMainPath = path.join(__dirname, 'app-main.js');
const appMainCode = fs.readFileSync(appMainPath, 'utf8');

// Extraemos el cuerpo de la función getWhatsAppBotResponse usando una expresión regular.
// Esto es un poco frágil, pero nos permite testear la función sin refactorizar todo el archivo.
const functionRegex = /function getWhatsAppBotResponse\(message\) \{[\s\S]*$/;
const match = appMainCode.match(functionRegex);

if (!match) {
    throw new Error('No se pudo encontrar la función getWhatsAppBotResponse en js/app-main.js');
}

// Creamos la función dinámicamente para poder probarla en el entorno de Node.js
const functionBody = match[0].substring(match[0].indexOf('{') + 1, match[0].lastIndexOf('}'));
const getWhatsAppBotResponse = new Function('message', functionBody);

// --- Tests ---
describe('getWhatsAppBotResponse', () => {

    test('Debería devolver un saludo cuando el mensaje es "hola"', () => {
        const response = getWhatsAppBotResponse('hola');
        expect(response).toEqual({ text: '¡Hola! 👋 Soy AIRA. ¿En qué puedo ayudarte hoy?' });
    });

    test('Debería devolver un saludo cuando el mensaje es "buen día"', () => {
        const response = getWhatsAppBotResponse('buen día');
        expect(response).toEqual({ text: '¡Hola! 👋 Soy AIRA. ¿En qué puedo ayudarte hoy?' });
    });

    test('Debería registrar un paciente con un nombre simple', () => {
        const response = getWhatsAppBotResponse('registrar paciente Carlos');
        expect(response).toEqual({ text: 'Paciente Carlos ha sido registrado.' });
    });

    test('Debería registrar un paciente con un nombre compuesto', () => {
        const response = getWhatsAppBotResponse('registrar paciente Ana de Armas');
        expect(response).toEqual({ text: 'Paciente Ana de Armas ha sido registrado.' });
    });

    test('Debería devolver un mensaje de fallback para un input no reconocido', () => {
        const response = getWhatsAppBotResponse('¿qué tiempo hace?');
        expect(response).toEqual({ text: 'No entendí tu solicitud. ¿Puedes intentar de nuevo?' });
    });

});
