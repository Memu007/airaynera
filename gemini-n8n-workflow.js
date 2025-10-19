/**
 * N8N Workflow Configuration - AIRA Medical System with Gemini 2.0
 * WhatsApp Voice Processing Automation con Google AI
 *
 * Reemplaza OpenAI por Google Gemini 2.0 para mayor eficiencia y menor costo
 */

const geminiWorkflowConfig = {
    workflowName: "AIRA WhatsApp Voice Processor - Gemini 2.0",
    version: "2.0.0",
    description: "Procesamiento automático de mensajes de voz de WhatsApp con Google Gemini 2.0 AI",

    // Nodos del workflow con Gemini 2.0
    nodes: [
        {
            id: "1",
            name: "WhatsApp Webhook Receiver",
            type: "n8n-nodes-base.webhook",
            typeVersion: 1,
            position: [240, 300],
            parameters: {
                httpMethod: "POST",
                path: "aira-whatsapp-gemini",
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
            name: "Speech to Text (Google)",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [1340, 200],
            parameters: {
                url: "https://speech.googleapis.com/v1/speech:recognize",
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
                            name: "config",
                            value: "={{ { encoding: 'WEBM_OPUS', languageCode: 'es-ES', enableAutomaticPunctuation: true, model: 'latest_short' } }}"
                        },
                        {
                            name: "audio",
                            value: "={{ { content: $data.binary.audio.data.toString('base64') } }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "7",
            name: "Process Google Transcription",
            type: "n8n-nodes-base.function",
            typeVersion: 1,
            position: [1560, 200],
            parameters: {
                functionCode: `
                    const transcription = $input.first().json;
                    const audioData = $input.first().json.json;

                    // Procesar resultados de Google Speech-to-Text
                    const results = transcription.results || [];
                    if (results.length === 0) {
                        return {
                            success: false,
                            error: 'No se pudo transcribir el audio',
                            audioData,
                            transcription
                        };
                    }

                    // Obtener la mejor transcripción
                    const bestResult = results[0];
                    const alternatives = bestResult.alternatives || [];
                    if (alternatives.length === 0) {
                        return {
                            success: false,
                            error: 'No hay alternativas de transcripción',
                            audioData,
                            transcription
                        };
                    }

                    const bestAlternative = alternatives[0];
                    const text = bestAlternative.transcript || '';
                    const confidence = bestAlternative.confidence || 0;

                    // Validar calidad de la transcripción
                    if (text.length < 10) {
                        return {
                            success: false,
                            error: 'Transcripción demasiado corta',
                            audioData,
                            transcription,
                            text
                        };
                    }

                    if (confidence < 0.7) {
                        return {
                            success: false,
                            error: 'Baja confianza en la transcripción',
                            audioData,
                            transcription,
                            text,
                            confidence
                        };
                    }

                    return {
                        success: true,
                        transcription: text.trim(),
                        confidence: confidence,
                        alternatives: alternatives.map(alt => alt.transcript),
                        audioData,
                        processedAt: new Date().toISOString()
                    };
                `
            }
        },
        {
            id: "8",
            name: "Patient Recognition (Gemini 2.0)",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [1780, 200],
            parameters: {
                url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
                authentication: "headerAuth",
                genericAuthType: "httpHeaderAuth",
                sendHeaders: true,
                headerParameters: {
                    parameters: [
                        {
                            name: "Authorization",
                            value: "Bearer {{ $credentials.googleAI.token }}"
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
                            name: "contents",
                            value: "={{ [{ parts: [{ text: \\\"Como asistente médico especializado en psicología y psiquiatría, analizá el siguiente texto de una sesión terapéutica para identificar al paciente y extraer información clínica relevante.\\n\\nTranscripción: '\\\" + $json.transcription + \\\"'\\n\\nContexto: Este mensaje fue enviado por un profesional de la salud mental.\\n\\nTareas:\\n1. Identificá si se menciona el nombre del paciente\\n2. Buscá patrones de reconocimiento (características únicas del paciente)\\n3. Determiná el tipo de sesión\\n4. Extraé información clave del contenido\\n5. Evaluá el estado emocional\\n6. Identificá si requiere atención urgente\\n\\nRespondé EXCLUSIVAMENTE en formato JSON válido:\\n{\\n  \\\"patientIdentified\\\": true/false,\\n  \\\"patientName\\\": \\\"nombre si se identifica\\\",\\n  \\\"confidence\\\": 0.0-1.0,\\n  \\\"sessionType\\\": \\\"individual/pareja/familia/grupo/crisis/supervisión\\\",\\n  \\\"keyInfo\\\": [\\\"información importante\\\"],\\n  \\\"emotionalTone\\\": \\\"positivo/neutro/negativo/crisis/ansioso/deprimido\\\",\\n  \\\"requiresUrgentAttention\\\": true/false,\\n  \\\"clinicalThemes\\\": [\\\"temas clínicos\\\"],\\n  \\\"riskLevel\\\": \\\"bajo/medio/alto/crisis\\\"\\n}\\\" }] }] }]"
                        },
                        {
                            name: "generationConfig",
                            value: "={{ { temperature: 0.3, maxOutputTokens: 2048, topP: 0.8, topK: 40 } }}"
                        },
                        {
                            name: "safetySettings",
                            value: "={{ [{ category: \\\"HARM_CATEGORY_HARASSMENT\\\", threshold: \\\"BLOCK_MEDIUM_AND_ABOVE\\\" }, { category: \\\"HARM_CATEGORY_HATE_SPEECH\\\", threshold: \\\"BLOCK_MEDIUM_AND_ABOVE\\\" }, { category: \\\"HARM_CATEGORY_SEXUALLY_EXPLICIT\\\", threshold: \\\"BLOCK_MEDIUM_AND_ABOVE\\\" }, { category: \\\"HARM_CATEGORY_DANGEROUS_CONTENT\\\", threshold: \\\"BLOCK_MEDIUM_AND_ABOVE\\\" }] }]"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "9",
            name: "Process Gemini Analysis",
            type: "n8n-nodes-base.function",
            typeVersion: 1,
            position: [2000, 200],
            parameters: {
                functionCode: `
                    const geminiResponse = $input.first().json;
                    const transcriptionData = $input.first().json.json;

                    // Extraer el contenido de la respuesta de Gemini
                    const candidates = geminiResponse.candidates || [];
                    if (candidates.length === 0) {
                        throw new Error('Gemini no devolvió respuesta');
                    }

                    const content = candidates[0].content || {};
                    const parts = content.parts || [];
                    if (parts.length === 0) {
                        throw new Error('Gemini no devolvió contenido');
                    }

                    const textResponse = parts[0].text || '';

                    // Parsear JSON de la respuesta
                    let analysis;
                    try {
                        // Buscar JSON en el texto
                        const jsonMatch = textResponse.match(/\\{[\\s\\S]*\\}/);
                        if (!jsonMatch) {
                            throw new Error('No se encontró JSON en la respuesta de Gemini');
                        }

                        analysis = JSON.parse(jsonMatch[0]);
                    } catch (error) {
                        console.error('Error parseando respuesta de Gemini:', error);
                        return {
                            success: false,
                            error: 'Error procesando respuesta de AI',
                            geminiResponse: textResponse,
                            transcriptionData
                        };
                    }

                    // Validar análisis
                    if (!analysis.confidence || analysis.confidence < 0.5) {
                        return {
                            success: false,
                            error: 'Baja confianza en el análisis de paciente',
                            analysis,
                            transcriptionData
                        };
                    }

                    return {
                        success: true,
                        patientAnalysis: analysis,
                        transcription: transcriptionData.transcription,
                        confidence: analysis.confidence,
                        requiresUrgentAttention: analysis.requiresUrgentAttention || false,
                        riskLevel: analysis.riskLevel || 'medio',
                        processedAt: new Date().toISOString()
                    };
                `
            }
        },
        {
            id: "10",
            name: "Find Patient in Database",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [2220, 200],
            parameters: {
                url: "http://localhost:8082/api/whatsapp/recognize-patient",
                method: "POST",
                authentication: "headerAuth",
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
                            value: "={{ $json.transcriptionData.audioData.phoneNumber }}"
                        },
                        {
                            name: "patientAnalysis",
                            value: "={{ $json.patientAnalysis }}"
                        },
                        {
                            name: "transcription",
                            value: "={{ $json.transcription }}"
                        },
                        {
                            name: "confidence",
                            value: "={{ $json.confidence }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "11",
            name: "Create Session",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [2440, 200],
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
                            name: "aiAnalysis",
                            value: "={{ $json.patientAnalysis }}"
                        },
                        {
                            name: "riskLevel",
                            value: "={{ $json.riskLevel }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "12",
            name: "Generate Clinical Summary (Gemini 2.0)",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [2660, 200],
            parameters: {
                url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
                authentication: "headerAuth",
                genericAuthType: "httpHeaderAuth",
                sendHeaders: true,
                headerParameters: {
                    parameters: [
                        {
                            name: "Authorization",
                            value: "Bearer {{ $credentials.googleAI.token }}"
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
                            name: "contents",
                            value: "={{ [{ parts: [{ text: \\\"Como psicólogo clínico experto con más de 10 años de experiencia, generá un resumen clínico estructurado de la siguiente sesión terapéutica:\\n\\nPaciente: {{ $json.patientData.nombre }} ({{ $json.patientData.edad }} años)\\nTranscripción: '{{ $json.transcription }}'\\nAnálisis de IA: {{ JSON.stringify($json.aiAnalysis) }}\\nNivel de riesgo: {{ $json.riskLevel }}\\n\\nGenerá un resumen clínico profesional con:\\n1. Resumen de la sesión (2-3 párrafos detallados)\\n2. Estado emocional detectado (escala 1-10)\\n3. Temas principales abordados\\n4. Intervenciones terapéuticas utilizadas\\n5. Progresos observados\\n6. Alertas o preocupaciones clínicas\\n7. Riesgos identificados\\n8. Recomendaciones para próximas sesiones\\n9. Objetivos terapéuticos sugeridos\\n\\nRespondé EXCLUSIVAMENTE en formato JSON válido:\\n{\\n  \\\"sessionSummary\\\": \\\"resumen detallado de la sesión\\\",\\n  \\\"emotionalState\\\": {\\n    \\\"overall\\\": \\\"positivo/neutro/negativo/crisis\\\",\\n    \\\"intensity\\\": 1-10,\\n    \\\"mainEmotions\\\": [\\\"emoción1\\\", \\\"emoción2\\\"]\\n  },\\n  \\\"themes\\\": [\\\"tema1\\\", \\\"tema2\\\"],\\n  \\\"interventions\\\": [\\\"intervención1\\\", \\\"intervención2\\\"],\\n  \\\"progress\\\": \\\"descripción de progresos\\\",\\n  \\\"alerts\\\": [\\\"alerta1\\\", \\\"alerta2\\\"],\\n  \\\"risks\\\": [\\\"riesgo1\\\", \\\"riesgo2\\\"],\\n  \\\"recommendations\\\": [\\\"recomendación1\\\", \\\"recomendación2\\\"],\\n  \\\"therapeuticGoals\\\": [\\\"objetivo1\\\", \\\"objetivo2\\\"],\\n  \\\"nextSessionFocus\\\": \\\"enfoque para próxima sesión\\\",\\n  \\\"requiresFollowUp\\\": true/false\\n}\\\" }] }] }]"
                        },
                        {
                            name: "generationConfig",
                            value: "={{ { temperature: 0.4, maxOutputTokens: 4096, topP: 0.8, topK: 40 } }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "13",
            name: "Process Clinical Summary",
            type: "n8n-nodes-base.function",
            typeVersion: 1,
            position: [2880, 200],
            parameters: {
                functionCode: `
                    const geminiResponse = $input.first().json;
                    const sessionData = $input.first().json.json;

                    // Extraer y parsear el resumen clínico
                    const candidates = geminiResponse.candidates || [];
                    if (candidates.length === 0) {
                        throw new Error('Gemini no devolvió resumen clínico');
                    }

                    const content = candidates[0].content || {};
                    const parts = content.parts || [];
                    if (parts.length === 0) {
                        throw new Error('Gemini no devolvió contenido del resumen');
                    }

                    const textResponse = parts[0].text || '';

                    // Parsear JSON del resumen
                    let clinicalSummary;
                    try {
                        const jsonMatch = textResponse.match(/\\{[\\s\\S]*\\}/);
                        if (!jsonMatch) {
                            throw new Error('No se encontró JSON en el resumen clínico');
                        }
                        clinicalSummary = JSON.parse(jsonMatch[0]);
                    } catch (error) {
                        console.error('Error parseando resumen clínico:', error);
                        return {
                            success: false,
                            error: 'Error procesando resumen clínico',
                            geminiResponse: textResponse,
                            sessionData
                        };
                    }

                    return {
                        success: true,
                        clinicalSummary,
                        sessionData,
                        processedAt: new Date().toISOString()
                    };
                `
            }
        },
        {
            id: "14",
            name: "Save Complete Session",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [3100, 200],
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
                            value: "={{ $json.sessionData.sessionId }}"
                        },
                        {
                            name: "clinicalSummary",
                            value: "={{ $json.clinicalSummary }}"
                        },
                        {
                            name: "transcription",
                            value: "={{ $json.sessionData.transcription }}"
                        },
                        {
                            name: "aiAnalysis",
                            value: "={{ $json.sessionData.aiAnalysis }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "15",
            name: "Send Confirmation",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.1,
            position: [3320, 200],
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
                            value: "={{ $json.sessionData.patientData.phoneNumber }}"
                        },
                        {
                            name: "confirmationData",
                            value: "={{ $json.clinicalSummary }}"
                        },
                        {
                            name: "sessionId",
                            value: "={{ $json.sessionData.sessionId }}"
                        }
                    ]
                },
                options: {}
            }
        },
        {
            id: "16",
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
                        message: '🎤 Hola! Soy AIRA, tu asistente médico inteligente. Por favor, enviá tu sesión como mensaje de voz para que pueda procesarla automáticamente con Gemini 2.0 AI.',
                        instructions: '• Hablá claramente durante mínimo 30 segundos\\n• Mencioná el nombre del paciente\\n• Describí la sesión detalladamente\\n• Recibirás un resumen clínico automático',
                        phoneNumber: messageData.phoneNumber,
                        supportedFormats: ['audio', 'voice'],
                        timestamp: new Date().toISOString()
                    };
                `
            }
        },
        {
            id: "17",
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

    // Conexiones entre nodos (actualizadas para Gemini)
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
                        node: "Speech to Text (Google)",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Speech to Text (Google)": {
            main: [
                [
                    {
                        node: "Process Google Transcription",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Process Google Transcription": {
            main: [
                [
                    {
                        node: "Patient Recognition (Gemini 2.0)",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Patient Recognition (Gemini 2.0)": {
            main: [
                [
                    {
                        node: "Process Gemini Analysis",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Process Gemini Analysis": {
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
                        node: "Generate Clinical Summary (Gemini 2.0)",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Generate Clinical Summary (Gemini 2.0)": {
            main: [
                [
                    {
                        node: "Process Clinical Summary",
                        type: "main",
                        index: 0
                    }
                ]
            ]
        },
        "Process Clinical Summary": {
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

module.exports = geminiWorkflowConfig;