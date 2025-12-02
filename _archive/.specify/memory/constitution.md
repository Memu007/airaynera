# CONSTITUCIÓN DEL PROYECTO AIRA

## MISIÓN Y VISIÓN

### Misión
Facilitar la gestión clínica de psicólogos y psiquiatras mediante una plataforma intuitiva que prioriza la carga de sesiones por voz, minimizando el tiempo administrativo y maximizando el tiempo de atención al paciente.

### Visión
Convertirnos en la herramienta estándar para profesionales de la salud mental en América Latina, eliminando las barreras administrativas mediante tecnología de voz y WhatsApp.

## PRINCIPIOS ARQUITECTÓNICOS

### 1. ESPECIALIZACIÓN CLÍNICA
- **Focus absoluto** en psicólogos y psiquiatras
- **Terminología clínica** apropiada para el sector
- **Flujos especializados** en salud mental
- **Confidencialidad** como prioridad máxima

### 2. VOZ COMO INTERFAZ PRINCIPAL
- **WhatsApp-first** para ingesta de contenido
- **Transcripción automática** con Whisper de OpenAI
- **Procesamiento de audio** optimizado para voces clínicas
- **Mapeo automático** paciente ↔ sesión

### 3. SIMPLICIDAD > COMPLEJIDAD
- **Máximo 3 clics** para cualquier acción común
- **Interfaz minimalista** sin distracciones
- **Onboarding intuitivo** para profesionales no técnicos
- **Carga cero** de configuración inicial

### 4. SEGURIDAD CLÍNICA
- **Cifrado AES-256** para datos sensibles (DNI, teléfono)
- **CSP estricto** en producción
- **Auditoría completa** de accesos y cambios
- **PII masking** en logs y debugging

### 5. ESCALABILIDAD CONTROLADA
- **Target: ≤600 usuarios** concurrentes
- **Performance predecible** sobre cantidad controlada
- **Recursos optimizados** no sobre-ingeniería
- **Costos predecibles** para profesionales independientes

## ESTÁNDARES DE CALIDAD

### Desarrollo
- **Cobertura de testing: 70%** mínimo
- **ESLint strict** para todo código nuevo
- **Code review** obligatorio para cambios críticos
- **Documentación** en español para todos los componentes

### Seguridad
- **Zero-trust** para todos los inputs
- **Rate limiting** agresivo (100/15min)
- **JWT con rotación** de secrets
- **Headers de seguridad** completos (Helmet)

### Performance
- **Time to First Byte < 200ms**
- **API responses < 500ms**
- **Transcripción de audio < 30s**
- **Offline-first** para funciones críticas

### UX/UI
- **Mobile-first** responsive design
- **WCAG 2.1 AA** accesibilidad mínima
- **Carga progresiva** de contenido
- **Feedback inmediato** en todas las acciones

## RESTRICCIONES TÉCNICAS

### Stack Tecnológico
- **Backend**: Node.js + Express (no frameworks complejos)
- **Frontend**: Vanilla JS + Bootstrap (no React/Vue)
- **Base de datos**: Firebase (producción) o SQLite (local)
- **Hosting**: VPS simple o Firebase Hosting

### Lo que NO haremos
- **No sobre-ingeniería** en features no críticas
- **No ML/AI complejo** más allá de transcripción
- **No integraciones corporativas** (foco en profesionales independientes)
- **No features de telemedicina** (solo gestión administrativa)

### Datos y Privacidad
- **No almacenar audio** crudo (solo transcripción)
- **No compartir datos** con terceros sin consentimiento
- **No retener datos** más allá de lo legalmente requerido
- **No profiling** automatizado de pacientes

## PROCESOS DE DESARROLLO

### Flujo de trabajo
1. **Spec-Driven Development** con Spec Kit
2. **User Stories** priorizadas por valor clínico
3. **Testing automático** en cada PR
4. **Despliegue gradual** con feature flags

### Manejo de Bugs
- **P0**: Seguridad clínica (24h)
- **P1:** Funcionalidad crítica (48h)
- **P2:** UX importante (1 semana)
- **P3:** Mejoras menores (próxima release)

### Releases
- **Semanales** para fixes críticos
- **Mensuales** para features nuevas
- **Trimestrales** para refactor mayor
- **Versionado semántico** (v2.x.x actual)

## COMPROMISOS CON LOS USUARIOS

### Profesionales de Salud Mental
- **Confidencialidad absoluta** de datos de pacientes
- **Disponibilidad 99.9%** en horario laboral
- **Soporte humano** por chat/whatsapp
- **Formación continua** en uso de la plataforma

### Pacientes (indirectamente)
- **Seguridad de sus datos** sensibles
- **Acceso controlado** solo por profesionales autorizados
- **Portabilidad** de sus datos clínicos
- **Transparencia** en uso de su información

## TOMA DE DECISIONES

### Criterios de Priorización
1. **Impacto clínico** directo
2. **Seguridad de datos** 
3. **Experiencia del profesional**
4. **Viabilidad técnica**
5. **Costo de desarrollo**

### Trade-offs Aceptados
- **Funcionalidad > Performance** (dentro de límites razonables)
- **Seguridad > Conveniencia** (siempre)
- **Simplicidad > Features** (generalmente)
- **Estabilidad > Novedad** (en producción)

## EVOLUCIÓN FUTURA

### Próximos 6 meses
- **Mejoras en transcripción** (español clínico)
- **Templates de notas** por especialidad
- **Exportación segura** para sistemas de historia clínica
- **Integración calendario** para gestión de turnos

### Próximos 12 meses
- **Móvil nativo** (React Native) para captura rápida
- **Análisis de sentimiento** básico en notas
- **Integración con sistemas** de salud pública
- **Multi-idioma** (inglés, portugués)

---

**Esta constitución guía todas las decisiones técnicas y de producto en AIRA.**

**Aprobada:** 18 de Octubre de 2025  
**Versión:** 1.0  
**Dueños:** Equipo AIRA + Community de Profesionales de Salud Mental