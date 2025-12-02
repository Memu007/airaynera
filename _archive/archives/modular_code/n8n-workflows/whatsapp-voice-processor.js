/**
 * N8N Workflow Configuration for AIRA Medical System
 * WhatsApp Voice Processing Automation
 *
 * Este workflow define los nodos y flujos de automatización para procesar
 * mensajes de voz de WhatsApp y convertirlos en sesiones clínicas.
 */

const n8nWorkflowConfig = {
    workflowName: "AIRA WhatsApp Voice Processor",
    version: "1.0.0",
    description: "Procesamiento automático de mensajes de voz de WhatsApp para sesiones médicas",

    // Nodos del workflow
    nodes: [
        {
            id: "1",
            name: "WhatsApp Webhook Receiver",
            type: "n8n-nodes-base.webhook",
            typeVersion: 1,
            position: [240, 300],
            parameters: {
                httpMethod: "POST",
                path: "aira-whatsapp",
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
                            operation: "default",
                            output: 1
                        }
                    ]
                }
            }
        },
        {
            id: "4",
            name: "Process Audio Message",
            type: "n8n-nodes-base.function",
            typeVersion: 1,
            position: [900, 200],
            parameters: {
                functionCode: `
                    // Extraer información del audio
                    const messageData = $input.first().json;
                    const audio = messageData.jsonString.entry[0].changes[0].value.messages[0].audio ||
                                 messageData.jsonString.entry[0].changes[0].value.messages[0].voice;

                    if (!audio) {
                        throw new Error('No se encontró archivo de audio');
                    }

                    return {
                        phoneNumber: messageData.phoneNumber,
                        messageId: messageData.messageId,
                        audioUrl: audio.file_url || audio.url,
                        audioId: audio.id,
                        mimeType: audio.mime_type,
                        timestamp: messageData.timestamp
                    };
                `
            }
        },
        {
            id: "5",
            name: "Download Audio File",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [1120, 200],
            parameters: {
                url: "={{ $json.audioUrl }}",
                authentication: "headerAuth",
                genericAuthType: "httpHeaderAuth",
                sendHeaders: true,
                headerParameters: {
                    parameters: [
                        {
                            name: "Authorization",
                            value: "Bearer {{ $credentials.whatsappApi.token }}"
                        }
                    ]
                },
                options: {
                    response: {
                        response: {
                            responseFormat: "file"
                        }
                    }
                }
            }
        },
        {
            id: "6",
            name: "Speech to Text (OpenAI)",
            type: "n8n-nodes-base.openAi",
            typeVersion: 1,
            position: [1340, 200],
            parameters: {
                operation: "audio_transcriptions",
                requestId: "aira-transcription-{{ $now }}",
                file: "={{ $data.binary.audio.data }}",
                model: "whisper-1",
                language: "es",
                responseFormat: "verbose_json",
                temperature: 0.2,
                options: {}
            }
        },
        {
            id: "7",
            name: "Process Transcription",
            type: "n8n-nodes-base.function",
            typeVersion: 1,
            position: [1560, 200],
            parameters: {
                functionCode: `
                    const transcription = $input.first().json;
                    const audioData = $input.first().json.json;

                    // Validar calidad de la transcripción
                    const text = transcription.text || '';
                    const confidence = transcription.avg_logprob || 0;

                    if (text.length < 10) {
                        return {
                            success: false,
                            error: 'Transcripción demasiado corta',
                            audioData,
                            transcription
                        };
                    }

                    if (confidence < -0.5) {
                        return {
                            success: false,
                            error: 'Baja confianza en la transcripción',
                            audioData,
                            transcription
                        };
                    }

                    return {
                        success: true,
                        transcription: text,
                        confidence: confidence,
                        duration: transcription.duration,
                        language: transcription.language,
                        audioData,
                        processedAt: new Date().toISOString()
                    };
                `
            }
        },
        {
            id: "8",
            name: "Patient Recognition (AI)",
            type: "n8n-nodes-base.openAi",
            typeVersion: 1,
            position: [1780, 200],
            parameters: {
                operation: "text",
                model: "gpt-4-turbo-preview",
                options: {
                    temperature: 0.3
                },
                prompt: `
                    Como asistente médico especializado, analizá el siguiente texto de una sesión terapéutica
                    para identificar al paciente mencionado.

                    Contexto: Este mensaje fue enviado por un profesional de la salud mental.

                    Transcripción: "{{ $json.transcription }}"

                    Profesional: {{ $json.audioData.phoneNumber }}

                    Tareas:
                    1. Identificá si se menciona el nombre del paciente
                    2. Buscá patrones de reconocimiento de voz (características únicas)
                    3. Determiná el tipo de sesión (individual, pareja, familia, etc.)
                    4. Extraé información clave del contenido

                    Respondé en formato JSON:
                    {
                        "patientIdentified": true/false,
                        "patientName": "nombre si se identifica",
                        "confidence": 0.0-1.0,
                        "sessionType": "individual/pareja/familia/grupo/crisis",
                        "keyInfo": ["información importante"],
                        "emotionalTone": "positivo/neutro/negativo/crisis",
                        "requiresUrgentAttention": true/false
                    }
                `
            }
        },
        {
            id: "9",
            name: "Find Patient in Database",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [2000, 200],
            parameters: {
                url: "http://localhost:8082/api/whatsapp/recognize-patient",
                method: "POST",
                authentication: "predefinedCredentialType",
                nodeCredentialType: "httpHeaderAuth",
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
                            value: "={{ $json.audioData.phoneNumber }}"
                        },
                        {
                            name: "aiAnalysis",
                            value: "={{ $json }}"
                        },
                        {
                            name: "transcription",
                            value: "={{ $json.transcription }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "10",
            name: "Create Session",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [2220, 200],
            parameters: {
                url: "http://localhost:8082/api/whatsapp/create-session",
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
                            name: "patientData",
                            value: "={{ $json.patientData }}"
                        },
                        {
                            name: "sessionData",
                            value: "={{ $json.sessionData }}"
                        },
                        {
                            name: "transcription",
                            value: "={{ $json.transcription }}"
                        },
                        {
                            name: "audioInfo",
                            value: "={{ $json.audioData }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "11",
            name: "Generate AI Summary",
            type: "n8n-nodes-base.openAi",
            typeVersion: 1,
            position: [2440, 200],
            parameters: {
                operation: "text",
                model: "gpt-4-turbo-preview",
                options: {
                    temperature: 0.4
                },
                prompt: `
                    Como psicólogo clínico experto, generá un resumen estructurado de la siguiente sesión terapéutica:

                    Paciente: {{ $json.patientData.nombre }}
                    Transcripción: "{{ $json.transcription }}"
                    Duración: {{ $json.audioInfo.duration }} segundos

                    Generá un resumen clínico con:
                    1. Resumen de la sesión (2-3 párrafos)
                    2. Estado emocional detectado (escala 1-5)
                    3. Temas principales abordados
                    4. Intervenciones utilizadas
                    5. Progresos observados
                    6. Alertas o preocupaciones
                    7. Recomendaciones para próximas sesiones

                    Respondé en formato JSON.
                `
            }
        },
        {
            id: "12",
            name: "Save Complete Session",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [2660, 200],
            parameters: {
                url: "http://localhost:8082/api/whatsapp/save-session",
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
                            name: "sessionId",
                            value: "={{ $json.sessionId }}"
                        },
                        {
                            name: "aiSummary",
                            value: "={{ $json }}"
                        },
                        {
                            name: "finalData",
                            value: "={{ $json }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "13",
            name: "Send Confirmation",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [2880, 200],
            parameters: {
                url: "http://localhost:8082/api/whatsapp/send-confirmation",
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
                            value: "={{ $json.audioData.phoneNumber }}"
                        },
                        {
                            name: "confirmationData",
                            value: "={{ $json }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "14",
            name: "Handle Non-Audio Messages",
            type: "n8n-nodes-base.function",
            typeVersion: 1,
            position: [900, 400],
            parameters: {
                functionCode: `
                    const messageData = $input.first().json;

                    // Mensaje estándar para mensajes no-audio
                    return {
                        success: false,
                        message: 'Por favor, enviá tu sesión como mensaje de voz.',
                        phoneNumber: messageData.phoneNumber,
                        supportedFormats: ['audio', 'voice'],
                        timestamp: new Date().toISOString()
                    };
                `
            }
        },
        {
            id: "15",
            name: "Send Error Message",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [1120, 400],
            parameters: {
                url: "http://localhost:8082/api/whatsapp/send-message",
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

    // Conexiones entre nodos
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
                        node: "Process Audio Message",
                        type: "main",
                        index: 0
                    }
                ],
                [
                    {
                        node: "Handle Non-Audio Messages",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Process Audio Message": {
            main: [
                [
                    {
                        node: "Download Audio File",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Download Audio File": {
            main: [
                [
                    {
                        node: "Speech to Text (OpenAI)",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Speech to Text (OpenAI)": {
            main: [
                [
                    {
                        node: "Process Transcription",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Process Transcription": {
            main: [
                [
                    {
                        node: "Patient Recognition (AI)",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Patient Recognition (AI)": {
            main: [
                [
                    {
                        node: "Find Patient in Database",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Find Patient in Database": {
            main: [
                [
                    {
                        node: "Create Session",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Create Session": {
            main: [
                [
                    {
                        node: "Generate AI Summary",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Generate AI Summary": {
            main: [
                [
                    {
                        node: "Save Complete Session",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Save Complete Session": {
            main: [
                [
                    {
                        node: "Send Confirmation",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Handle Non-Audio Messages": {
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

module.exports = n8nWorkflowConfig;