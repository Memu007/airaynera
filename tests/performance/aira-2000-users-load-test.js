/**
 * 🏥 AIRA MEDICAL SYSTEM - PERFORMANCE AUDIT FOR 2000 USERS
 *
 * Lead Performance Engineer: Comprehensive load testing for healthcare system
 * Target: 2000 concurrent medical professionals
 *
 * REAL HEALTHCARE WORKLOADS - Not generic load testing
 *
 * Test Scenarios:
 * 1. Normal Daily Load (2000 users over 12 hours)
 * 2. Peak Hour Stress (1500 users in 1-hour window)
 * 3. Worst Case Scenario (2500 users + API failures)
 * 4. Voice Processing Load (200 concurrent audio uploads)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// 📊 CUSTOM METRICS FOR HEALTHCARE SYSTEM
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const patientLookupTime = new Trend('patient_lookup_time');
const sessionCreationTime = new Trend('session_creation_time');
const voiceProcessingTime = new Trend('voice_processing_time');
const whatsappResponseTime = new Trend('whatsapp_response_time');

// 🔥 CRITICAL BUSINESS METRICS
const crisisDetections = new Counter('crisis_detections');
const sessionsCreated = new Counter('sessions_created');
const patientsRegistered = new Counter('patients_registered');
const voiceUploadsProcessed = new Counter('voice_uploads_processed');

// 🎯 TEST CONFIGURATION BASED ON USER REQUIREMENTS
const TEST_TYPE = __ENV.TEST_TYPE || 'normal';
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8082';

// 📋 REALISTIC HEALTHCARE TEST DATA (200 patients per professional)
const PROFESSIONALS = Array.from({ length: 2000 }, (_, i) => ({
    dni: `30${String(i + 1).padStart(7, '0')}`,
    pin: '1234',
    name: `Dr. ${['García', 'Rodríguez', 'Martínez', 'López', 'González'][i % 5]} ${['Ana', 'Carlos', 'María', 'Juan', 'Laura'][i % 5]}`,
    specialty: ['Psicología', 'Psiquiatría', 'Terapia Ocupacional'][i % 3]
}));

// 🏥 PATIENT DATA GENERATOR (200 patients per professional)
function generatePatients(professionalDni, count = 200) {
    const surnames = ['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez'];
    const names = ['María', 'Carlos', 'Ana', 'Juan', 'Laura', 'Diego', 'Sofía', 'Martín'];
    const obrasSociales = ['OSDE', 'Swiss Medical', 'Medife', 'Omitt', 'Iprofesional'];

    return Array.from({ length: count }, (_, i) => ({
        nombre: `${names[i % names.length]} ${surnames[i % surnames.length]}`,
        dni: `${20 + Math.floor(i / 1000)}${String(i).padStart(7, '0')}`,
        obra_social: obrasSociales[i % obrasSociales.length],
        telefono: `+54 9 11 ${Math.floor(Math.random() * 9000 + 1000)} ${Math.floor(Math.random() * 9000 + 1000)}`,
        professional_dni: professionalDni
    }));
}

// 🎭 VOICE SESSION DATA (Realistic medical session content)
const VOICE_SESSIONS = [
    "Paciente presenta síntomas de ansiedad generalizada, difficulty para conciliar el sueño, preocupaciones excesivas sobre trabajo y familia. Se inicia tratamiento con técnicas de relajación y reestructuración cognitiva.",
    "Sesión de seguimiento, paciente reporta mejora en síntomas depresivos. Continúa con medicación antidepresiva, se ajusta dosis. Se trabaja en estrategias de afrontamiento para estrés laboral.",
    "Crisis de pánico atendida, paciente con hiperventilación y temor a perder el control. Se aplican técnicas de respiración y grounding. Se deriva a evaluación psiquiátrica para posible medicación ansiolítica.",
    "Terapia de pareja, conflictos de comunicación. Se identifica patrón de críticas y defensas. Se asignan tareas de comunicación asertiva para próxima sesión.",
    "Paciente adolescente con trastorno alimentario, se trabaja en imagen corporal y autoestima. Se coordina con nutricionista y familia para abordaje multidisciplinario."
];

// 🚨 CRISIS SCENARIOS (For safety system testing)
const CRISIS_MESSAGES = [
    "Ya no puedo más, no quiero seguir viviendo así",
    "Estoy pensando en hacerme daño",
    "No encuentro sentido a nada, preferiría no estar",
    "Me siento completamente solo y sin esperanza"
];

// 🔐 AUTHENTICATION SYSTEM
function authenticateProfessional(professional) {
    const startTime = Date.now();

    const response = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        dni: professional.dni,
        pin: professional.pin
    }), {
        headers: { 'Content-Type': 'application/json' }
    });

    const authTime = Date.now() - startTime;

    check(response, {
        'professional authenticated successfully': (r) => r.status === 200,
        'auth response time < 800ms': (r) => authTime < 800,
        'token received': (r) => JSON.parse(r.body).token !== undefined,
    });

    errorRate.add(response.status !== 200);
    responseTime.add(authTime);

    return response.status === 200 ? JSON.parse(response.body).token : null;
}

// 👥 PATIENT MANAGEMENT OPERATIONS
function registerPatient(token, patientData) {
    const startTime = Date.now();

    const response = http.post(`${BASE_URL}/api/patients`, JSON.stringify(patientData), {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    const operationTime = Date.now() - startTime;

    check(response, {
        'patient registered successfully': (r) => r.status === 201,
        'patient registration time < 600ms': (r) => operationTime < 600,
    });

    if (response.status === 201) {
        patientsRegistered.add(1);
    }

    errorRate.add(response.status !== 201);
    responseTime.add(operationTime);

    return response.status === 201 ? JSON.parse(response.body).data : null;
}

function searchPatients(token, query = '') {
    const startTime = Date.now();

    const url = query ?
        `${BASE_URL}/api/patients?search=${encodeURIComponent(query)}&limit=20` :
        `${BASE_URL}/api/patients?page=1&limit=20`;

    const response = http.get(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const lookupTime = Date.now() - startTime;
    patientLookupTime.add(lookupTime);

    check(response, {
        'patients retrieved successfully': (r) => r.status === 200,
        'patient lookup time < 300ms': (r) => lookupTime < 300,
    });

    errorRate.add(response.status !== 200);
    responseTime.add(lookupTime);

    return response.status === 200 ? JSON.parse(response.body).data : [];
}

// 📝 SESSION MANAGEMENT (CORE HEALTHCARE WORKLOAD)
function createSession(token, sessionData) {
    const startTime = Date.now();

    const response = http.post(`${BASE_URL}/api/sessions`, JSON.stringify(sessionData), {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    const creationTime = Date.now() - startTime;
    sessionCreationTime.add(creationTime);

    check(response, {
        'session created successfully': (r) => r.status === 201,
        'session creation time < 1000ms': (r) => creationTime < 1000,
    });

    if (response.status === 201) {
        sessionsCreated.add(1);
    }

    errorRate.add(response.status !== 201);
    responseTime.add(creationTime);

    return response.status === 201 ? JSON.parse(response.body).data : null;
}

// 🎤 VOICE PROCESSING (CRITICAL PATH FOR HEALTHCARE)
function processVoiceSession(token, patientId, voiceContent) {
    const startTime = Date.now();

    const sessionData = {
        patient_id: patientId,
        observaciones: voiceContent,
        tipo: 'voz',
        duracion_estimada: Math.floor(Math.random() * 30 + 15) // 15-45 min sessions
    };

    const response = http.post(`${BASE_URL}/api/sessions/voice`, JSON.stringify(sessionData), {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    const processingTime = Date.now() - startTime;
    voiceProcessingTime.add(processingTime);

    check(response, {
        'voice session processed successfully': (r) => r.status === 201,
        'voice processing time < 30000ms': (r) => processingTime < 30000, // 30s max for medical use
    });

    if (response.status === 201) {
        voiceUploadsProcessed.add(1);
    }

    errorRate.add(response.status !== 201);
    responseTime.add(processingTime);

    return response.status === 201 ? JSON.parse(response.body).data : null;
}

// 📱 WHATSAPP INTEGRATION TESTING
function testWhatsAppIntegration(professionalPhone, message) {
    const startTime = Date.now();

    const response = http.post(`${BASE_URL}/webhook/whatsapp`, JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{
            changes: [{
                field: 'messages',
                value: {
                    messaging_product: 'whatsapp',
                    messages: [{
                        from: professionalPhone,
                        text: { body: message },
                        timestamp: Math.floor(Date.now() / 1000)
                    }]
                }
            }]
        }]
    }), {
        headers: { 'Content-Type': 'application/json' }
    });

    const responseTime = Date.now() - startTime;
    whatsappResponseTime.add(responseTime);

    check(response, {
        'whatsapp webhook processed': (r) => r.status === 200,
        'whatsapp response time < 5000ms': (r) => responseTime < 5000,
    });

    // Check for crisis detection in response
    if (response.status === 200) {
        const responseBody = response.body;
        if (responseBody.includes('crisis') || responseBody.includes('ayuda')) {
            crisisDetections.add(1);
        }
    }

    errorRate.add(response.status !== 200);
}

// 🏥 REAL HEALTHCARE WORKLOAD SIMULATION
function simulateDailyWorkload(professional, token) {
    const patients = generatePatients(professional.dni);

    group('Professional Daily Workflow', function() {
        // 1. Morning: Check patient list (20% of daily workload)
        group('Morning Patient Review', function() {
            const patientList = searchPatients(token);
            sleep(Math.random() * 2 + 1); // 1-3s thinking time
        });

        // 2. Register new patients (5% of daily workload)
        if (Math.random() < 0.05) {
            group('New Patient Registration', function() {
                const newPatient = patients[Math.floor(Math.random() * patients.length)];
                registerPatient(token, newPatient);
                sleep(Math.random() * 3 + 2); // 2-5s form filling time
            });
        }

        // 3. Create sessions (60% of daily workload - 6 sessions/day average)
        const sessionsToday = Math.floor(Math.random() * 4 + 4); // 4-7 sessions per day
        for (let i = 0; i < sessionsToday; i++) {
            group(`Session ${i + 1} of ${sessionsToday}`, function() {
                const patient = patients[Math.floor(Math.random() * patients.length)];
                const sessionContent = VOICE_SESSIONS[Math.floor(Math.random() * VOICE_SESSIONS.length)];

                // 80% of sessions are voice-based
                if (Math.random() < 0.8) {
                    processVoiceSession(token, patient.dni, sessionContent);
                } else {
                    createSession(token, {
                        patient_id: patient.dni,
                        observaciones: sessionContent,
                        tipo: 'texto'
                    });
                }

                sleep(Math.random() * 10 + 5); // 5-15s between sessions
            });
        }

        // 4. Patient lookups throughout the day (15% of workload)
        const lookupsToday = Math.floor(Math.random() * 6 + 3); // 3-8 lookups per day
        for (let i = 0; i < lookupsToday; i++) {
            group(`Patient Lookup ${i + 1}`, function() {
                const searchTerm = patients[Math.floor(Math.random() * patients.length)].nombre.split(' ')[0];
                searchPatients(token, searchTerm);
                sleep(Math.random() * 3 + 1); // 1-4s between lookups
            });
        }

        // 5. Crisis scenario testing (0.1% probability - realistic for mental health)
        if (Math.random() < 0.001) {
            group('Crisis Detection Test', function() {
                const crisisMessage = CRISIS_MESSAGES[Math.floor(Math.random() * CRISIS_MESSAGES.length)];
                testWhatsAppIntegration(`+54911${Math.floor(Math.random() * 90000000 + 10000000)}`, crisisMessage);
                sleep(Math.random() * 5 + 2); // Time for crisis response
            });
        }
    });
}

// 🎯 MAIN TEST EXECUTION FUNCTION
export default function() {
    // Select random professional for this VU
    const professional = PROFESSIONALS[Math.floor(Math.random() * PROFESSIONALS.length)];

    // Authenticate
    const token = authenticateProfessional(professional);
    if (!token) {
        console.error(`Failed to authenticate professional ${professional.dni}`);
        return;
    }

    // Simulate realistic healthcare workload
    simulateDailyWorkload(professional, token);

    // Brief pause between cycles
    sleep(Math.random() * 5 + 2);
}

// ⚙️ TEST CONFIGURATIONS FOR DIFFERENT SCENARIOS

export let options = {};

// Scenario configuration based on TEST_TYPE environment variable
switch (TEST_TYPE) {
    case 'baseline':
        // Baseline: 100 users for 10 minutes
        options = {
            stages: [
                { duration: '2m', target: 25 },
                { duration: '6m', target: 100 },
                { duration: '2m', target: 0 }
            ],
            thresholds: {
                http_req_duration: ['p(95)<500'],
                http_req_failed: ['rate<0.05'],
                patient_lookup_time: ['p(95)<300'],
                session_creation_time: ['p(95)<1000'],
                voice_processing_time: ['p(95)<30000'],
                errors: ['rate<0.05']
            }
        };
        break;

    case 'normal_daily':
        // Normal Daily Load: 2000 users over 12 hours (gradual ramp)
        options = {
            stages: [
                { duration: '30m', target: 200 },   // Morning ramp-up
                { duration: '1h', target: 800 },     // Morning peak
                { duration: '2h', target: 1200 },    // Mid-morning
                { duration: '3h', target: 1500 },    // Lunch peak
                { duration: '2h', target: 1800 },    // Afternoon
                { duration: '2h', target: 2000 },    // Evening peak
                { duration: '1h', target: 1500 },    // Wind down
                { duration: '30m', target: 0 }       // End of day
            ],
            thresholds: {
                http_req_duration: ['p(95)<800'],
                http_req_failed: ['rate<0.1'],
                patient_lookup_time: ['p(95)<400'],
                session_creation_time: ['p(95)<1200'],
                voice_processing_time: ['p(95)<35000'],
                errors: ['rate<0.1']
            }
        };
        break;

    case 'peak_hour':
        // Peak Hour Stress: 1500 users in 1 hour
        options = {
            stages: [
                { duration: '5m', target: 500 },     // Rapid ramp-up
                { duration: '20m', target: 1200 },   // Peak load
                { duration: '30m', target: 1500 },   // Maximum stress
                { duration: '5m', target: 0 }        // Quick cool-down
            ],
            thresholds: {
                http_req_duration: ['p(95)<1200'],
                http_req_failed: ['rate<0.15'],
                patient_lookup_time: ['p(95)<600'],
                session_creation_time: ['p(95)<2000'],
                voice_processing_time: ['p(95)<45000'],
                errors: ['rate<0.15']
            }
        };
        break;

    case 'worst_case':
        // Worst Case: 2500 users + system stress
        options = {
            stages: [
                { duration: '2m', target: 1000 },    // Immediate stress
                { duration: '3m', target: 2000 },    // Double target
                { duration: '5m', target: 2500 },    // Beyond limits
                { duration: '10m', target: 2500 },   // Sustained overload
                { duration: '2m', target: 0 }        // Recovery test
            ],
            thresholds: {
                http_req_duration: ['p(95)<2000'],
                http_req_failed: ['rate<0.25'],
                patient_lookup_time: ['p(95)<1000'],
                session_creation_time: ['p(95)<3000'],
                voice_processing_time: ['p(95)<60000'],
                errors: ['rate<0.25']
            }
        };
        break;

    case 'voice_processing':
        // Voice Processing Load: 200 concurrent voice uploads
        options = {
            stages: [
                { duration: '2m', target: 50 },      // Warm-up
                { duration: '3m', target: 100 },     // Medium load
                { duration: '5m', target: 200 },     // Maximum voice load
                { duration: '5m', target: 200 },     // Sustained voice processing
                { duration: '2m', target: 0 }        // Cool-down
            ],
            thresholds: {
                http_req_duration: ['p(95)<1500'],
                http_req_failed: ['rate<0.2'],
                voice_processing_time: ['p(95)<40000'],
                errors: ['rate<0.2']
            }
        };
        break;

    case 'endurance':
        // Endurance Test: 500 users for 24 hours
        options = {
            stages: [
                { duration: '30m', target: 100 },    // Gradual start
                { duration: '1h', target: 300 },     // Build up
                { duration: '22h', target: 500 },    // Sustained load
                { duration: '30m', target: 0 }       // Wind down
            ],
            thresholds: {
                http_req_duration: ['p(95)<1000'],
                http_req_failed: ['rate<0.08'],
                patient_lookup_time: ['p(95)<500'],
                session_creation_time: ['p(95)<1500'],
                voice_processing_time: ['p(95)<40000'],
                errors: ['rate<0.08']
            }
        };
        break;

    default:
        // Default: Normal progressive load test
        options = {
            stages: [
                { duration: '2m', target: 50 },
                { duration: '5m', target: 100 },
                { duration: '2m', target: 200 },
                { duration: '5m', target: 300 },
                { duration: '2m', target: 400 },
                { duration: '5m', target: 500 },
                { duration: '2m', target: 0 }
            ],
            thresholds: {
                http_req_duration: ['p(95)<800'],
                http_req_failed: ['rate<0.1'],
                errors: ['rate<0.1']
            }
        };
}

// 📊 SETUP AND TEARDOWN FUNCTIONS
export function setup() {
    console.log(`🏥 AIRA PERFORMANCE AUDIT STARTED`);
    console.log(`📊 Test Type: ${TEST_TYPE}`);
    console.log(`🎯 Target Load: ${options.stages[options.stages.length - 2]?.target || 'unknown'} users`);
    console.log(`🔗 Base URL: ${BASE_URL}`);
    console.log(`⏰ Start Time: ${new Date().toISOString()}`);

    return {
        startTime: Date.now(),
        testType: TEST_TYPE,
        baseUrl: BASE_URL
    };
}

export function teardown(data) {
    const duration = Date.now() - data.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log(`🏥 AIRA PERFORMANCE AUDIT COMPLETED`);
    console.log(`⏱️ Duration: ${minutes}m ${seconds}s`);
    console.log(`📊 Test Type: ${data.testType}`);
    console.log(`🕐 End Time: ${new Date().toISOString()}`);
    console.log(`📈 Key Metrics:`);
    console.log(`   - Sessions Created: ${sessionsCreated.value}`);
    console.log(`   - Patients Registered: ${patientsRegistered.value}`);
    console.log(`   - Voice Uploads: ${voiceUploadsProcessed.value}`);
    console.log(`   - Crisis Detections: ${crisisDetections.value}`);
    console.log(`   - Error Rate: ${(errorRate.rate * 100).toFixed(2)}%`);
}

// 🚨 CUSTOM FUNCTIONS FOR HEALTHCARE-SPECIFIC TESTING

// Test emergency scenario with crisis detection
export function testCrisisDetection() {
    return {
        executor: 'per-vu-iterations',
        vus: 10,
        iterations: 5,
        maxDuration: '5m',
        exec: 'crisisTest'
    };
}

export function crisisTest() {
    const professional = PROFESSIONALS[Math.floor(Math.random() * PROFESSIONALS.length)];
    const token = authenticateProfessional(professional);

    if (token) {
        const crisisMessage = CRISIS_MESSAGES[Math.floor(Math.random() * CRISIS_MESSAGES.length)];
        testWhatsAppIntegration(`+54911${Math.floor(Math.random() * 90000000 + 10000000)}`, crisisMessage);
    }
}

// Test database performance under load
export function testDatabasePerformance() {
    return {
        executor: 'per-vu-iterations',
        vus: 50,
        iterations: 20,
        maxDuration: '10m',
        exec: 'dbTest'
    };
}

export function dbTest() {
    const professional = PROFESSIONALS[Math.floor(Math.random() * PROFESSIONALS.length)];
    const token = authenticateProfessional(professional);

    if (token) {
        // Rapid patient lookups
        for (let i = 0; i < 10; i++) {
            searchPatients(token, 'test');
            sleep(0.1);
        }
    }
}