/**
 * N8N Workflow Configuration - AIRA Medical System (CORRECTED)
 * SOLO OPTIMIZACIÓN DE CARGA - SIN ANÁLISIS CLÍNICO
 *
 * Funcionalidades PERMITIDAS:
 * - Transcripción de voz a texto
 * - Reconocimiento básico de paciente (nombre)
 * - Carga automática de sesiones
 * - Formato de texto estructurado
 *
 * Funcionalidades PROHIBIDAS:
 * - ❌ Análisis clínico
 * - ❌ Diagnósticos automáticos
 * - ❌ Indicaciones médicas
 * - ❌ Evaluaciones de riesgo
 * - ❌ Recomendaciones terapéuticas
 */

const geminiOptimizedWorkflow = {
    workflowName: "AIRA Session Loader - Transcription Only",
    version: "2.1.0-corrected",
    description: "Optimización de carga de sesiones médicas - SOLO transcripción y carga",

    // Nodos del workflow corregido
    nodes: [
        {
            id: "1",
            name: "WhatsApp Webhook Receiver",
            type: "n8n-nodes-base.webhook",
            typeVersion: 1,
            position: [240, 300],
            parameters: {
                httpMethod: "POST",
                path: "aira-session-loader",
                responseMode: "onReceived",
                options: {}
            }
        },
        {
            id: "2",
            name: "Parse WhatsApp Message",
            type: "n8n-nodes-base.set",
            typeVersion: 1,
            position: [460, 300],
            parameters: {
                values: {
                    jsonString: "={{ $json.body }}",
                    phoneNumber: "={{ $json.body.entry[0].changes[0].value.messages[0].from }}",
                    messageType: "={{ $json.body.entry[0].changes[0].value.messages[0].type }}",
                    messageId: "={{ $json.body.entry[0].changes[0].value.messages[0].id }}",
                    timestamp: "={{ $json.body.entry[0].changes[0].value.messages[0].timestamp }}"
                },
                options: {}
            }
        },
        {
            id: "3",
            name: "Check Message Type",
            type: "n8n-nodes-base.switch",
            typeVersion: 1,
            position: [680, 300],
            parameters: {
                dataType: "string",
                value1: "={{ $json.messageType }}",
                rules: {
                    rules: [
                        {
                            value2: "audio",
                            operation: "equal",
                            output: 0
                        },
                        {
                            value2: "voice",
                            operation: "equal",
                            output: 0
                        },
                        {
                            value2: "text",
                            operation: "equal",
                            output: 0
                        },
                        {
                            operation: "default",
                            output: 1
                        }
                    ]
                }
            }
        },
        {
            id: "4",
            name: "Process Audio/Text Message",
            type: "n8n-nodes-base.function",
            typeVersion: 1,
            position: [900, 200],
            parameters: {
                functionCode: `
                    // Extraer información del mensaje
                    const messageData = $input.first().json;

                    let content = '';
                    let isAudio = false;

                    if (messageData.messageType === 'text') {
                        // Mensaje de texto directo
                        content = messageData.jsonString.entry[0].changes[0].value.messages[0].text.body;
                    } else {
                        // Mensaje de audio
                        const audio = messageData.jsonString.entry[0].changes[0].value.messages[0].audio ||
                                     messageData.jsonString.entry[0].changes[0].value.messages[0].voice;

                        if (!audio) {
                            throw new Error('No se encontró archivo de audio');
                        }

                        content = {
                            audioUrl: audio.file_url || audio.url,
                            audioId: audio.id,
                            mimeType: audio.mime_type
                        };
                        isAudio = true;
                    }

                    return {
                        phoneNumber: messageData.phoneNumber,
                        messageId: messageData.messageId,
                        content: content,
                        isAudio: isAudio,
                        timestamp: messageData.timestamp
                    };
                `
            }
        },
        {
            id: "5",
            name: "Process Audio (Download + Transcribe)",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [1120, 200],
            parameters: {
                url: "={{ $json.isAudio ? 'https://speech.googleapis.com/v1/speech:recognize' : 'http://localhost:8082/api/process-text' }}",
                authentication: "headerAuth",
                genericAuthType: "httpHeaderAuth",
                sendHeaders: true,
                headerParameters: {
                    parameters: [
                        {
                            name: "Authorization",
                            value: "Bearer {{ $credentials.googleCloud.token }}"
                        },
                        {
                            name: "Content-Type",
                            value: "application/json"
                        }
                    ]
                },
                sendBody: true,
                bodyParameters: {
                    parameters: [
                        {
                            name: $json.isAudio ? "config" : "textData",
                            value: "={{ $json.isAudio ? JSON.stringify({ encoding: 'WEBM_OPUS', languageCode: 'es-ES', enableAutomaticPunctuation: true }) : JSON.stringify({ text: $json.content }) }}"
                        },
                        {
                            name: $json.isAudio ? "audio" : "metadata",
                            value: "={{ $json.isAudio ? JSON.stringify({ content: $data.binary.audio.data.toString('base64') }) : JSON.stringify({ phoneNumber: $json.phoneNumber, timestamp: $json.timestamp }) }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "6",
            name: "Format Transcription",
            type: "n8n-nodes-base.function",
            typeVersion: 1,
            position: [1340, 200],
            parameters: {
                functionCode: `
                    const transcription = $input.first().json;
                    const messageData = $input.first().json.json;

                    let text = '';
                    let confidence = 1.0;

                    if (messageData.isAudio) {
                        // Procesar resultados de Google Speech-to-Text
                        const results = transcription.results || [];
                        if (results.length > 0) {
                            const bestResult = results[0];
                            const alternatives = bestResult.alternatives || [];
                            if (alternatives.length > 0) {
                                text = alternatives[0].transcript || '';
                                confidence = alternatives[0].confidence || 0.7;
                            }
                        }
                    } else {
                        // Texto directo
                        text = transcription.text || '';
                        confidence = 1.0;
                    }

                    // Validar que tengamos texto
                    if (text.length < 10) {
                        return {
                            success: false,
                            error: 'Texto demasiado corto',
                            originalContent: messageData.content
                        };
                    }

                    // Detectar nombre de paciente (solo si se menciona explícitamente)
                    const patientNameMatch = text.match(/paciente\\s+([A-Z][a-záéíóúñ]+(?:\\s+[A-Z][a-záéíóúñ]+)*)/i);
                    const patientName = patientNameMatch ? patientNameMatch[1] : null;

                    return {
                        success: true,
                        transcription: text.trim(),
                        confidence: confidence,
                        detectedPatientName: patientName,
                        wordCount: text.split(/\\s+/).length,
                        estimatedDuration: Math.ceil(text.split(/\\s+/).length * 2.5), // 2.5 segundos por palabra
                        phoneNumber: messageData.phoneNumber,
                        timestamp: messageData.timestamp
                    };
                `
            }
        },
        {
            id: "7",
            name: "Identify Professional",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [1560, 200],
            parameters: {
                url: "http://localhost:8082/api/session/identify-professional",
                method: "POST",
                sendHeaders: true,
                headerParameters: {
                    parameters: [
                        {
                            name: "Content-Type",
                            value: "application/json"
                        },
                        {
                            name: "Authorization",
                            value: "Bearer {{ $credentials.airaApi.token }}"
                        }
                    ]
                },
                sendBody: true,
                bodyParameters: {
                    parameters: [
                        {
                            name: "phoneNumber",
                            value: "={{ $json.phoneNumber }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "8",
            name: "Find/Create Patient",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [1780, 200],
            parameters: {
                url: "http://localhost:8082/api/session/find-patient",
                method: "POST",
                sendHeaders: true,
                headerParameters: {
                    parameters: [
                        {
                            name: "Content-Type",
                            value: "application/json"
                        },
                        {
                            name: "Authorization",
                            value: "Bearer {{ $credentials.airaApi.token }}"
                        }
                    ]
                },
                sendBody: true,
                bodyParameters: {
                    parameters: [
                        {
                            name: "professionalId",
                            value: "={{ $json.professional.id }}"
                        },
                        {
                            name: "patientName",
                            value: "={{ $json.detectedPatientName }}"
                        },
                        {
                            name: "createIfNotFound",
                            value: "false"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "9",
            name: "Create Session Record",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [2000, 200],
            parameters: {
                url: "http://localhost:8082/api/session/create",
                method: "POST",
                sendHeaders: true,
                headerParameters: {
                    parameters: [
                        {
                            name: "Content-Type",
                            value: "application/json"
                        },
                        {
                            name: "Authorization",
                            value: "Bearer {{ $credentials.airaApi.token }}"
                        }
                    ]
                },
                sendBody: true,
                bodyParameters: {
                    parameters: [
                        {
                            name: "professionalId",
                            value: "={{ $json.professional.id }}"
                        },
                        {
                            name: "patientId",
                            value: "={{ $json.patient.id }}"
                        },
                        {
                            name: "transcription",
                            value: "={{ $json.transcription }}"
                        },
                        {
                            name: "metadata",
                            value: "={{ { confidence: $json.confidence, wordCount: $json.wordCount, estimatedDuration: $json.estimatedDuration, detectedPatientName: $json.detectedPatientName, source: 'whatsapp', timestamp: $json.timestamp } }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "10",
            name: "Send Loading Confirmation",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [2220, 200],
            parameters: {
                url: "http://localhost:8082/api/session/send-confirmation",
                method: "POST",
                sendHeaders: true,
                headerParameters: {
                    parameters: [
                        {
                            name: "Content-Type",
                            value: "application/json"
                        },
                        {
                            name: "Authorization",
                            value: "Bearer {{ $credentials.airaApi.token }}"
                        }
                    ]
                },
                sendBody: true,
                bodyParameters: {
                    parameters: [
                        {
                            name: "phoneNumber",
                            value: "={{ $json.phoneNumber }}"
                        },
                        {
                            name: "sessionId",
                            value: "={{ $json.session.id }}"
                        },
                        {
                            name: "confirmationType",
                            value: "session_loaded"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "11",
            name: "Handle Unsupported Messages",
            type: "n8n-nodes-base.function",
            typeVersion: 1,
            position: [900, 400],
            parameters: {
                functionCode: `
                    const messageData = $input.first().json;

                    // Mensaje estándar para formatos no soportados
                    return {
                        success: false,
                        message: '🎤 Hola! Soy AIRA, tu asistente de carga de sesiones.\\n\\nPor favor, enviá tu sesión como:\\n• 📱 Mensaje de texto, o\\n• 🎤 Mensaje de voz\\n\\nFormato recomendado:\\n• Mencioná el nombre del paciente\\n• Describí la sesión en tus propias palabras\\n• Recebirás confirmación de carga automática\\n\\n⚠️  IMPORTANTE: Esta herramienta solo optimiza la carga de sesiones. No proporciona análisis clínico ni indicaciones médicas.',
                        phoneNumber: messageData.phoneNumber,
                        supportedFormats: ['text', 'audio', 'voice'],
                        timestamp: new Date().toISOString()
                    };
                `
            }
        },
        {
            id: "12",
            name: "Send Error Message",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [1120, 400],
            parameters: {
                url: "http://localhost:8082/api/session/send-message",
                method: "POST",
                sendHeaders: true,
                headerParameters: {
                    parameters: [
                        {
                            name: "Content-Type",
                            value: "application/json"
                        },
                        {
                            name: "Authorization",
                            value: "Bearer {{ $credentials.airaApi.token }}"
                        }
                    ]
                },
                sendBody: true,
                bodyParameters: {
                    parameters: [
                        {
                            name: "phoneNumber",
                            value: "={{ $json.phoneNumber }}"
                        },
                        {
                            name: "message",
                            value: "={{ $json.message }}"
                        }
                    ]
                },
                options: {}
            }
        }
    ],

    // Conexiones entre nodos (solo optimización de carga)
    connections: {
        "WhatsApp Webhook Receiver": {
            main: [
                [
                    {
                        node: "Parse WhatsApp Message",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Parse WhatsApp Message": {
            main: [
                [
                    {
                        node: "Check Message Type",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Check Message Type": {
            main: [
                [
                    {
                        node: "Process Audio/Text Message",
                        type: "main",
                        index: 0
                    }
                ],
                [
                    {
                        node: "Handle Unsupported Messages",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Process Audio/Text Message": {
            main: [
                [
                    {
                        node: "Process Audio (Download + Transcribe)",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Process Audio (Download + Transcribe)": {
            main: [
                [
                    {
                        node: "Format Transcription",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Format Transcription": {
            main: [
                [
                    {
                        node: "Identify Professional",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Identify Professional": {
            main: [
                [
                    {
                        node: "Find/Create Patient",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Find/Create Patient": {
            main: [
                [
                    {
                        node: "Create Session Record",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Create Session Record": {
            main: [
                [
                    {
                        node: "Send Loading Confirmation",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Handle Unsupported Messages": {
            main: [
                [
                    {
                        node: "Send Error Message",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        }
    }
};

module.exports = geminiOptimizedWorkflow;