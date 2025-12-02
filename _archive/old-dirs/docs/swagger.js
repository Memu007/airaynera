/**
 * Configuración de Swagger - Documentación API AIRA
 * @version 1.0.0
 */

const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

// Configuración básica de Swagger
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'AIRA API Documentation',
        version: '2.0.0',
        description: `
# API de AIRA - Asistente Médico Inteligente

AIRA es un sistema de gestión médica que permite a profesionales de la salud mental
gestionar pacientes, sesiones y documentación clínica a través de una API REST segura.

## Características Principales
- 🔐 Autenticación JWT con refresh tokens
- 👥 Gestión completa de pacientes
- 📋 Registro de sesiones médicas
- 🔒 Cumplimiento con estándares HIPAA
- 📊 Auditoría completa de acciones
- 🛡️ Seguridad robusta contra ataques

## Autenticación
Todas las rutas protegidas requieren un token JWT en el header Authorization:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

## Códigos de Estado
- \`200\` - Éxito
- \`201\` - Recurso creado
- \`400\` - Error de validación
- \`401\` - No autenticado
- \`403\` - Sin permisos
- \`404\` - Recurso no encontrado
- \`429\` - Límite de rate limiting excedido
- \`500\` - Error interno del servidor
        `,
        contact: {
            name: 'Equipo AIRA',
            email: 'support@aira.com'
        },
        license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
        }
    },
    servers: [
        {
            url: 'http://localhost:8082',
            description: 'Servidor de desarrollo'
        },
        {
            url: 'https://api.aira.com',
            description: 'Servidor de producción'
        }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Token JWT obtenido del endpoint /api/auth/login'
            }
        },
        schemas: {
            User: {
                type: 'object',
                required: ['email', 'name', 'role'],
                properties: {
                    id: {
                        type: 'string',
                        description: 'ID único del usuario',
                        example: 'user_123456789'
                    },
                    email: {
                        type: 'string',
                        format: 'email',
                        description: 'Email del usuario',
                        example: 'doctor@aira.com'
                    },
                    name: {
                        type: 'string',
                        minLength: 3,
                        maxLength: 100,
                        description: 'Nombre completo del usuario',
                        example: 'Dr. Juan Pérez'
                    },
                    specialty: {
                        type: 'string',
                        enum: ['Psicólogo/a', 'Psiquiatra', 'Otro'],
                        description: 'Especialidad médica',
                        example: 'Psiquiatra'
                    },
                    role: {
                        type: 'string',
                        enum: ['admin', 'doctor', 'assistant'],
                        description: 'Rol del usuario en el sistema',
                        example: 'doctor'
                    },
                    status: {
                        type: 'string',
                        enum: ['active', 'inactive', 'locked'],
                        description: 'Estado de la cuenta',
                        example: 'active'
                    },
                    lastLogin: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Último inicio de sesión',
                        example: '2024-01-15T10:30:00Z'
                    }
                }
            },
            Patient: {
                type: 'object',
                required: ['name', 'dni', 'insurance'],
                properties: {
                    id: {
                        type: 'string',
                        description: 'ID único del paciente',
                        example: 'patient_123456789'
                    },
                    name: {
                        type: 'string',
                        minLength: 3,
                        maxLength: 100,
                        description: 'Nombre completo del paciente',
                        example: 'María García'
                    },
                    dni: {
                        type: 'string',
                        pattern: '^[0-9]{7,8}$',
                        description: 'DNI del paciente (7-8 dígitos)',
                        example: '12345678'
                    },
                    insurance: {
                        type: 'string',
                        maxLength: 100,
                        description: 'Obra social del paciente',
                        example: 'OSDE'
                    },
                    phone: {
                        type: 'string',
                        pattern: '^[\\d\\s\\-\\+\\(\\)]+$',
                        description: 'Teléfono del paciente',
                        example: '+54 11 1234-5678'
                    },
                    email: {
                        type: 'string',
                        format: 'email',
                        description: 'Email del paciente',
                        example: 'maria.garcia@email.com'
                    },
                    birthDate: {
                        type: 'string',
                        format: 'date',
                        description: 'Fecha de nacimiento',
                        example: '1985-03-15'
                    },
                    status: {
                        type: 'string',
                        enum: ['activo', 'inactivo'],
                        description: 'Estado del paciente',
                        example: 'activo'
                    },
                    createdAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Fecha de creación del registro',
                        example: '2024-01-15T10:30:00Z'
                    }
                }
            },
            Session: {
                type: 'object',
                required: ['patientId', 'content', 'moodAssessment'],
                properties: {
                    id: {
                        type: 'string',
                        description: 'ID único de la sesión',
                        example: 'session_123456789'
                    },
                    patientId: {
                        type: 'string',
                        description: 'ID del paciente',
                        example: 'patient_123456789'
                    },
                    content: {
                        type: 'string',
                        minLength: 10,
                        maxLength: 5000,
                        description: 'Contenido de la sesión médica',
                        example: 'Paciente refiere mejoría en el estado de ánimo...'
                    },
                    moodAssessment: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 5,
                        description: 'Evaluación del estado de ánimo (1-5)',
                        example: 4
                    },
                    medicationNotes: {
                        type: 'string',
                        maxLength: 1000,
                        description: 'Notas sobre medicación',
                        example: 'Continuar con sertralina 50mg/día'
                    },
                    nextAppointment: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Próxima cita programada',
                        example: '2024-02-15T14:00:00Z'
                    },
                    alerts: {
                        type: 'array',
                        items: {
                            type: 'string',
                            enum: ['crisis', 'medication_change', 'followup_required']
                        },
                        description: 'Alertas asociadas a la sesión',
                        example: ['followup_required']
                    },
                    createdAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Fecha de creación',
                        example: '2024-01-15T10:30:00Z'
                    }
                }
            },
            LoginRequest: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: {
                        type: 'string',
                        format: 'email',
                        description: 'Email del usuario',
                        example: 'doctor@aira.com'
                    },
                    password: {
                        type: 'string',
                        minLength: 8,
                        description: 'Contraseña del usuario',
                        example: 'SecurePassword123!'
                    }
                }
            },
            LoginResponse: {
                type: 'object',
                properties: {
                    success: {
                        type: 'boolean',
                        description: 'Indica si el login fue exitoso',
                        example: true
                    },
                    token: {
                        type: 'string',
                        description: 'Token JWT de acceso',
                        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    },
                    refreshToken: {
                        type: 'string',
                        description: 'Token para renovar el acceso',
                        example: 'refresh_token_here...'
                    },
                    user: {
                        $ref: '#/components/schemas/User'
                    }
                }
            },
            RegisterRequest: {
                type: 'object',
                required: ['email', 'password', 'name', 'specialty', 'dni'],
                properties: {
                    email: {
                        type: 'string',
                        format: 'email',
                        description: 'Email del nuevo usuario',
                        example: 'nuevo.doctor@aira.com'
                    },
                    password: {
                        type: 'string',
                        minLength: 8,
                        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]',
                        description: 'Contraseña (mín. 8 chars, mayús, minús, número, especial)',
                        example: 'SecurePass123!'
                    },
                    name: {
                        type: 'string',
                        minLength: 3,
                        maxLength: 100,
                        description: 'Nombre completo',
                        example: 'Dr. Ana López'
                    },
                    specialty: {
                        type: 'string',
                        enum: ['Psicólogo/a', 'Psiquiatra', 'Otro'],
                        description: 'Especialidad médica',
                        example: 'Psicólogo/a'
                    },
                    dni: {
                        type: 'string',
                        pattern: '^[0-9]{7,8}$',
                        description: 'DNI (7-8 dígitos)',
                        example: '87654321'
                    }
                }
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    error: {
                        type: 'string',
                        description: 'Mensaje de error',
                        example: 'Error de validación'
                    },
                    code: {
                        type: 'string',
                        description: 'Código de error',
                        example: 'VALIDATION_ERROR'
                    },
                    details: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                field: {
                                    type: 'string',
                                    example: 'email'
                                },
                                message: {
                                    type: 'string',
                                    example: 'Email inválido'
                                }
                            }
                        },
                        description: 'Detalles específicos del error'
                    }
                }
            },
            PaginatedResponse: {
                type: 'object',
                properties: {
                    success: {
                        type: 'boolean',
                        example: true
                    },
                    total: {
                        type: 'integer',
                        description: 'Total de elementos',
                        example: 150
                    },
                    pagination: {
                        type: 'object',
                        properties: {
                            limit: {
                                type: 'integer',
                                example: 20
                            },
                            offset: {
                                type: 'integer',
                                example: 0
                            },
                            hasMore: {
                                type: 'boolean',
                                example: true
                            }
                        }
                    }
                }
            }
        },
        responses: {
            UnauthorizedError: {
                description: 'Token de acceso inválido o expirado',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ErrorResponse'
                        },
                        example: {
                            error: 'Token inválido',
                            code: 'INVALID_TOKEN'
                        }
                    }
                }
            },
            ForbiddenError: {
                description: 'Sin permisos para realizar esta acción',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ErrorResponse'
                        },
                        example: {
                            error: 'Sin permisos',
                            code: 'INSUFFICIENT_PERMISSIONS'
                        }
                    }
                }
            },
            ValidationError: {
                description: 'Error de validación en los datos enviados',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ErrorResponse'
                        },
                        example: {
                            error: 'Errores de validación',
                            code: 'VALIDATION_ERROR',
                            details: [
                                {
                                    field: 'email',
                                    message: 'Email inválido'
                                }
                            ]
                        }
                    }
                }
            },
            RateLimitError: {
                description: 'Límite de solicitudes excedido',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ErrorResponse'
                        },
                        example: {
                            error: 'Demasiadas solicitudes',
                            code: 'RATE_LIMIT_EXCEEDED'
                        }
                    }
                }
            }
        }
    },
    security: [
        {
            bearerAuth: []
        }
    ],
    tags: [
        {
            name: 'Authentication',
            description: 'Endpoints de autenticación y gestión de usuarios'
        },
        {
            name: 'Patients',
            description: 'Gestión de pacientes'
        },
        {
            name: 'Sessions',
            description: 'Gestión de sesiones médicas'
        },
        {
            name: 'Reports',
            description: 'Reportes y estadísticas'
        }
    ]
};

// Opciones para swagger-jsdoc
const options = {
    definition: swaggerDefinition,
    apis: [
        './src/routes/*.js',
        './src/controllers/*.js',
        './src/models/*.js'
    ]
};

// Inicializar swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

// Configuración personalizada de Swagger UI
const swaggerUIOptions = {
    customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info .title { color: #007bff; }
        .swagger-ui .scheme-container { background: #f8f9fa; padding: 10px; }
    `,
    customSiteTitle: 'AIRA API Documentation',
    customfavIcon: '/images/aira-logo.svg',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch']
    }
};

/**
 * Configurar Swagger en Express app
 */
function setupSwagger(app) {
    // Servir la documentación en /api-docs
    app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec, swaggerUIOptions));
    
    // Endpoint para obtener el spec JSON
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });

    console.log('📚 Documentación Swagger disponible en: /api-docs');
}

module.exports = {
    swaggerSpec,
    setupSwagger,
    swaggerUIOptions
}; 