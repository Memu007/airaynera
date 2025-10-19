# ESPECIFICACIÓN TÉCNICA - AIRA SISTEMA DE GESTIÓN CLÍNICA

## RESUMEN EJECUTIVO

**AIRA** es una plataforma especializada para psicólogos y psiquiatras que revoluciona la gestión clínica mediante la carga de sesiones por voz a través de WhatsApp. El sistema minimiza el tiempo administrativo permitiendo a profesionales de salud mental enfocarse en lo que importa: sus pacientes.

**Diferencial clave:** Transcripción automática de notas de sesión mediante mensajes de voz de WhatsApp, con mapeo automático a pacientes y persistencia segura.

---

## USER STORIES (PRIORIZADAS)

### P1 - CRÍTICAS PARA MVP

#### P1-1: Gestión de Pacientes
**Como** psicólogo/psiquiatra  
**Quiero** gestionar mi catálogo de pacientes con información básica  
**Para** tener acceso rápido a sus datos durante las sesiones

**Criterios de Aceptación:**
- [ ] Crear paciente con: nombre completo, DNI, teléfono, email, obra social
- [ ] DNI y teléfono almacenados con cifrado AES-256
- [ ] Buscar paciente por nombre, DNI o teléfono
- [ ] Marcar paciente como activo/inactivo (habilitado)
- [ ] Validación de formato de DNI según país
- [ ] Búsqueda instantánea con < 300ms de respuesta

#### P1-2: Carga de Sesión por Voz (WhatsApp)
**Como** psicólogo/psiquiatra  
**Quiero** enviar nota de voz por WhatsApp después de cada sesión  
**Para** que el sistema transcriba automáticamente y la asocie al paciente correcto

**Criterios de Aceptación:**
- [ ] Recepción de audio vía WhatsApp Cloud API
- [ ] Transcripción con OpenAI Whisper (español clínico)
- [ ] Detección automática de paciente por contexto o voz previa
- [ ] Creación automática de sesión con transcripción
- [ ] Confirmación al profesional de la sesión creada
- [ ] Tiempo de procesamiento < 30 segundos
- [ ] No almacenamiento de audio crudo (solo transcripción)

#### P1-3: Visualización de Sesiones
**Como** psicólogo/psiquiatra  
**Quiero** ver el historial de sesiones de cada paciente  
**Para** tener contexto clínico completo antes de cada consulta

**Criterios de Aceptación:**
- [ ] Listado cronológico de sesiones por paciente
- [ ] Búsqueda por fecha o palabras clave en notas
- [ ] Visualización de tipo de sesión, duración, notas
- [ ] Edición limitada de notas (hasta 24h después)
- [ ] Exportación segura de historial (PDF/XLSX)
- [ ] Filtros por tipo de sesión (individual, pareja, etc.)

### P2 - IMPORTANTES PARA PRODUCCIÓN

#### P2-1: Autenticación Segura
**Como** profesional de salud mental  
**Quiero** acceder al sistema con credenciales seguras  
**Para** proteger la información confidencial de mis pacientes

**Criterios de Aceptación:**
- [ ] Login con email y contraseña
- [ ] Autenticación de dos factores (opcional)
- [ ] Sesiones con JWT de 1 hora de expiración
- [ ] Cierre automático de sesión por inactividad
- [ ] Recuperación segura de contraseña
- [ ] Login con Google (opcional)

#### P2-2: Dashboard Clínico
**Como** psicólogo/psiquiatra  
**Quiero** un panel principal con información relevante  
**Para** tener vista rápida de mi actividad clínica

**Criterios de Aceptación:**
- [ ] Pacientes vistos hoy/esta semana
- [ ] Próximas sesiones (si integración calendario)
- [ ] Sesiones pendientes de transcripción
- [ ] Métricas básicas (sesiones por mes, pacientes activos)
- [ ] Acceso rápido a pacientes frecuentes
- [ ] Estados de carga clara en todas las operaciones

#### P2-3: Gestión de Tipos de Sesión
**Como** psicólogo/psiquiatra  
**Quiero** clasificar mis sesiones por tipo y modalidad  
**Para** tener mejor organización clínica y estadísticas

**Criterios de Aceptación:**
- [ ] Tipos predefinidos: Individual, Pareja, Familiar, Grupal
- [ ] Modalidades: Presencial, Virtual, Mixta
- [ ] Duración configurable por tipo (30, 45, 60, 90 min)
- [ ] Tarifa por tipo de sesión (para facturación)
- [ ] Campos adicionales según tipo (ej: participantes en terapia familiar)

### P3 - MEJORAS Y OPTIMIZACIONES

#### P3-1: Búsqueda Avanzada
**Como** profesional con muchos pacientes  
**Quiero** búsqueda avanzada con filtros múltiples  
**Para** encontrar información específica rápidamente

**Criterios de Aceptación:**
- [ ] Búsqueda por palabras clave en todas las notas
- [ ] Filtros por rango de fechas, tipo de sesión, obra social
- [ ] Búsqueda por diagnóstico o tratamiento (si se agrega)
- [ ] Guardado de búsquedas frecuentes
- [ ] Exportación de resultados de búsqueda

#### P3-2: Plantillas de Notas
**Como** psicólogo/psiquiatra  
**Quiero** plantillas predefinidas para diferentes tipos de sesión  
**Para** estandarizar mis notas clínicas y ahorrar tiempo

**Criterios de Aceptación:**
- [ ] Plantillas por especialidad (ej: Cognitivo-Conductual, Psicoanálisis)
- [ ] Campos personalizados según tipo de sesión
- [ ] Variables automáticas (fecha, paciente, tipo)
- [ ] Edición de plantillas existentes
- [ ] Creación de plantillas personalizadas

#### P3-3: Recordatorios y Seguimiento
**Como** profesional de salud mental  
**Quiero** sistema de recordatorios para seguimiento de pacientes  
**Para** no olvidar tareas importantes entre sesiones

**Criterios de Aceptación:**
- [ ] Recordatorios de próximas sesiones
- [ ] Tareas pendientes por paciente
- [ ] Seguimiento de evolución (escalas básicas)
- [ ] Notificaciones por email o WhatsApp
- [ ] Calendario integrado con Google Calendar

---

## REQUISITOS FUNCIONALES

### FR-001: Gestión de Pacientes
- **FR-001.1:** Creación de pacientes con validación de DNI
- **FR-001.2:** Cifrado de datos sensibles (DNI, teléfono)
- **FR-001.3:** Búsqueda instantánea por múltiples campos
- **FR-001.4:** Estado habilitado/inhabilitado con auditoría
- **FR-001.5:** Historial de cambios en datos del paciente

### FR-002: Procesamiento de Voz WhatsApp
- **FR-002.1:** Integración con WhatsApp Cloud API
- **FR-002.2:** Recepción y procesamiento de archivos de audio
- **FR-002.3:** Transcripción con OpenAI Whisper API
- **FR-002.4:** Detección automática de paciente por contexto
- **FR-002.5:** Creación automática de sesión con transcripción
- **FR-002.6:** Manejo de errores en transcripción (reintentos)

### FR-003: Gestión de Sesiones
- **FR-003.1:** CRUD completo de sesiones
- **FR-003.2:** Asociación automática/manual con paciente
- **FR-003.3:** Clasificación por tipo, duración, modalidad
- **FR-003.4:** Edición limitada en tiempo (24h)
- **FR-003.5:** Exportación en múltiples formatos

### FR-004: Autenticación y Seguridad
- **FR-004.1:** Login con email/contraseña
- **FR-004.2:** JWT con expiración configurable
- **FR-004.3:** Rate limiting por IP y usuario
- **FR-004.4:** Auditoría de accesos y acciones
- **FR-004.5:** Recuperación segura de credenciales

### FR-005: Dashboard y Reporting
- **FR-005.1:** Métricas de actividad clínica
- **FR-005.2:** Visualización de estadísticas básicas
- **FR-005.3:** Filtros por períodos de tiempo
- **FR-005.4:** Exportación de reportes

---

## REQUISITOS NO FUNCIONALES

### NRF-001: Seguridad
- **NRF-001.1:** Todos los datos sensibles cifrados con AES-256
- **NRF-001.2:** CSP estricto en producción
- **NRF-001.3:** HTTPS obligatorio en producción
- **NRF-001.4:** Auditoría completa de accesos (logs inmutables)
- **NRF-001.5:** PII masking en logs y debugging

### NRF-002: Performance
- **NRF-002.1:** Time to First Byte < 200ms
- **NRF-002.2:** API responses < 500ms (95th percentile)
- **NRF-002.3:** Transcripción de audio < 30s
- **NRF-002.4:** Soporte para ≤600 usuarios concurrentes
- **NRF-002.5:** Cache de búsquedas frecuentes

### NRF-003: Disponibilidad
- **NRF-003.1:** 99.9% uptime en horario laboral (8am-8pm)
- **NRF-003.2:** Backup diario automático
- **NRF-003.3:** Recovery time < 1 hora
- **NRF-003.4:** Health checks automáticos
- **NRF-003.5:** Modo mantenimiento controlado

### NRF-004: Usabilidad
- **NRF-004.1:** WCAG 2.1 AA compliance
- **NRF-004.2:** Mobile-first responsive design
- **NRF-004.3:** Onboarding < 5 minutos para nuevos usuarios
- **NRF-004.4:** Máximo 3 clics para acciones comunes
- **NRF-004.5:** Feedback inmediato en todas las acciones

---

## ENTIDADES DE DATOS

### Patient (Paciente)
```typescript
interface Patient {
  id: string;                    // UUID v4
  name: string;                  // Nombre completo (texto plano)
  dni: string;                   // Documento (cifrado AES-256)
  phone: string;                 // Teléfono (cifrado AES-256)
  email: string;                 // Email (texto plano)
  insurance: string;             // Obra social (texto plano)
  habilitado: boolean;           // Estado activo/inactivo
  created_via: string;           // Origen: 'manual' | 'whatsapp'
  fechaRegistro: Date;           // Fecha de creación
  lastSession?: Date;            // Última sesión registrada
  sessionCount: number;          // Total de sesiones
  createdBy: string;             // ID del profesional que lo creó
}
```

### Session (Sesión)
```typescript
interface Session {
  id: string;                    // UUID v4
  pacienteId: string;            // FK a Patient
  notas: string;                 // Notas transcribias (HTML sanitizado)
  tipo: SessionType;             // Tipo: 'individual' | 'pareja' | 'familiar' | 'grupal'
  modalidad: SessionModality;    // Modalidad: 'presencial' | 'virtual' | 'mixta'
  duracion: number;              // Duración en minutos
  fecha: Date;                   // Fecha y hora de la sesión
  medication_notes?: string;     // Notas de medicación (opcional)
  mood_assessment?: number;      // Evaluación de ánimo 1-5 (opcional)
  requires_followup: boolean;    // Requiere seguimiento
  followup_date?: Date;          // Fecha de seguimiento (opcional)
  created_via: string;           // Origen: 'manual' | 'whatsapp'
  transcription_confidence?: number; // Confianza en transcripción 0-1
  original_audio_url?: string;   // URL temporal del audio (no persistente)
  createdBy: string;             // ID del profesional
  createdAt: Date;               // Fecha de creación
  updatedAt?: Date;              // Última actualización
}
```

### User (Usuario/Profesional)
```typescript
interface User {
  id: string;                    // UUID v4
  nombre: string;                // Nombre completo
  especialidad: string;          // Especialidad: 'psicologia' | 'psiquiatria'
  email: string;                 // Email (único)
  telefono?: string;             // Teléfono (para WhatsApp)
  role: UserRole;                // Rol: 'admin' | 'user'
  licencia: string;              // Número de licencia profesional
  isActive: boolean;             // Cuenta activa
  isNewUser: boolean;            // Primer login
  lastLogin?: Date;              // Último acceso
  subscriptionStatus?: SubscriptionStatus; // Estado de suscripción
  createdAt: Date;
  updatedAt: Date;
}
```

### TranscriptionJob (Trabajo de Transcripción)
```typescript
interface TranscriptionJob {
  id: string;                    // UUID v4
  audioUrl: string;              // URL temporal del audio
  whatsappMessageId: string;     // ID del mensaje de WhatsApp
  fromPhone: string;             // Teléfono que envía el audio
  patientId?: string;            // Paciente detectado
  status: TranscriptionStatus;   // 'pending' | 'processing' | 'completed' | 'failed'
  transcription?: string;        // Resultado de la transcripción
  confidence?: number;           // Confianza del resultado
  error?: string;                // Error si falló
  attempts: number;              // Intentos realizados
  createdAt: Date;
  processedAt?: Date;
}
```

---

## CASOS BORDE Y MANEJO DE ERRORES

### Edge Cases Clínicos
1. **Paciente duplicado:** Mismo DNI o teléfono → Alerta y opción de merge
2. **Audio ininteligible:** Transcripción con < 70% confianza → Solicitud de confirmación
3. **Paciente no detectado:** Audio sin contexto claro → Selección manual de paciente
4. **Sesión simultánea:** Múltiples audivos para mismo paciente en corto tiempo → Agrupar o confirmar
5. **Datos inconsistentes:** Formato inválido en campos críticos → Rechazo con feedback específico

### Manejo de Errores Técnicos
1. **Caída de Whisper:** Retrasis exponencial (3 intentos) → Fallback a mensaje manual
2. **WhatsApp unavailable:** Queue de mensajes para procesar cuando se restaure
3. **Firebase timeout:** Fallback a SQLite local → Sincronización cuando se restaure
4. **Storage full:** Limpieza automática de audios temporales > 24h
5. **Rate limit exceeded:** Respuesta 429 con Retry-After header

### Casos de Seguridad
1. **Acceso no autorizado:** Log inmediato + bloqueo temporal de IP
2. **Datos sospechosos:** Patrones anómalos en transcripciones → Revisión manual
3. **Brute force:** Incremento progresivo de tiempo de respuesta
4. **XSS attempts:** Sanitización estricta + bloqueo de patrón
5. **PII exposure:** Detección automática + ofuscación en logs

---

## CRITERIOS DE ÉXITO

### Métricas de Adopción
- **Onboarding completion rate:** > 85% en primeros 7 días
- **Voice session adoption:** > 60% de sesiones creadas por WhatsApp
- **Daily active users:** > 40% de usuarios registrados activos diariamente
- **Patient creation:** Promedio > 3 pacientes por usuario en primera semana

### Métricas de Calidad
- **Transcription accuracy:** > 85% (medido por satisfacción del usuario)
- **Session creation time:** < 45 segundos desde envío de audio
- **Search response time:** < 300ms para consultas de pacientes
- **System uptime:** > 99.9% en horario laboral

### Métricas de Negocio
- **Churn rate:** < 10% mensual
- **Support tickets:** < 2 tickets por usuario por mes
- **Feature adoption:** > 70% usando al menos 3 features principales
- **User satisfaction:** NPS > 40

---

## DEPENDENCIAS EXTERNAS

### APIs Críticas
1. **OpenAI Whisper API:** Transcripción de audio
2. **WhatsApp Cloud API:** Recepción de mensajes de voz
3. **Firebase Firestore:** Base de datos principal
4. **Firebase Authentication:** Gestión de usuarios
5. **SendGrid (opcional):** Emails transaccionales

### SLAs Requeridos
- **Whisper API:** 99.5% uptime, < 30s response
- **WhatsApp API:** 99.9% uptime, < 5s delivery
- **Firebase:** 99.95% uptime, < 100ms read/write

### Planes de Contingencia
- **Whisper down:** Modo manual con texto + notificación
- **WhatsApp down:** Dashboard con opción de upload de audio
- **Firebase down:** SQLite local con sincronización diferida
- **Email service down:** Notificaciones in-app

---

## ESTIMACIONES Y ROADMAP

### Sprint 1 (2 semanas) - Core MVP
- [ ] Autenticación básica
- [ ] CRUD de pacientes
- [ ] Dashboard básico
- [ ] Integración WhatsApp接收

### Sprint 2 (2 semanas) - Voice Integration
- [ ] Transcripción con Whisper
- [ ] Mapeo automático paciente ↔ sesión
- [ ] Creación automática de sesiones
- [ ] Visualización de sesiones

### Sprint 3 (2 semanas) - Production Ready
- [ ] Seguridad completa (CSP, headers, rate limiting)
- [ ] Testing coverage > 70%
- [ ] Monitoring y logging
- [ ] Deploy a producción

### Sprint 4 (2 semanas) - Enhancement
- [ ] Búsqueda avanzada
- [ ] Exportación de datos
- [ ] Plantillas de notas
- [ ] Optimización performance

**Timeline total: 8 semanas hasta producción estable**

---

**Especificación aprobada por:** Equipo AIRA  
**Fecha:** 18 de Octubre de 2025  
**Versión:** 1.0  
**Próxima revisión:** Post-MVP (Diciembre 2025)