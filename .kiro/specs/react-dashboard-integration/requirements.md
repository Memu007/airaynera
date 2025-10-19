# Requirements Document

## Introduction

Este documento define los requerimientos para la **refactorización completa del frontend** del proyecto AIRA Bot, basado en la auditoría técnica que reveló una brecha crítica entre la calidad del backend (excelente) y el frontend (deficiente). 

El objetivo es crear un dashboard web de **nivel enterprise** usando React + TypeScript que esté a la altura del backend robusto ya desarrollado. Esta refactorización es crítica para entregar "el mejor producto de su vida" y asegurar la adopción exitosa por parte de profesionales de la salud mental.

**Contexto crítico de la auditoría:**
- Backend: Arquitectura excelente con seguridad médica robusta
- Frontend actual: Deuda técnica masiva (5000+ líneas jQuery, 3 sistemas de auth)
- Impacto: La disparidad puede impactar severamente la adopción del producto
- Solución: Refactoring completo a React + TypeScript con testing desde el inicio

## Requirements

### Requirement 1: Integración Técnica Frontend-Backend

**User Story:** Como desarrollador del sistema, quiero que el frontend React se integre seamlessly con el backend Express existente, para que los profesionales puedan acceder a todas las funcionalidades a través de una interfaz web moderna sin comprometer la seguridad.

#### Acceptance Criteria

1. WHEN el sistema se ejecuta en desarrollo THEN el frontend React debe usar un proxy para comunicarse con el backend en el puerto correcto
2. WHEN el sistema se despliega en producción THEN el servidor Express debe servir los archivos estáticos de React build desde una ruta específica
3. WHEN se realizan peticiones desde React al backend THEN todas las llamadas deben pasar por las rutas API seguras existentes (/api/*)
4. WHEN hay errores de conectividad THEN el frontend debe mostrar mensajes de error apropiados y manejar timeouts gracefully
5. WHEN el usuario navega entre páginas THEN el routing debe funcionar correctamente tanto en desarrollo como en producción

### Requirement 2: Sistema de Autenticación Web

**User Story:** Como profesional de la salud, quiero poder autenticarme en el dashboard web usando mis credenciales (DNI y PIN), para que pueda acceder de forma segura a la información de mis pacientes desde cualquier navegador.

#### Acceptance Criteria

1. WHEN accedo al dashboard por primera vez THEN debo ver una pantalla de login limpia y profesional
2. WHEN ingreso mi DNI y PIN correctos THEN el sistema debe autenticarme y redirigirme al dashboard principal
3. WHEN ingreso credenciales incorrectas THEN debo recibir un mensaje de error claro sin revelar información sensible
4. WHEN mi sesión expira THEN debo ser redirigido automáticamente al login
5. WHEN cierro sesión THEN todos los datos sensibles deben ser limpiados del navegador
6. WHEN hay múltiples intentos fallidos THEN el sistema debe aplicar las medidas de seguridad existentes

### Requirement 3: Dashboard Principal y Navegación

**User Story:** Como profesional de la salud, quiero tener un dashboard principal que me muestre un resumen de mi práctica y me permita navegar fácilmente a las diferentes secciones, para que pueda gestionar mi trabajo de forma eficiente.

#### Acceptance Criteria

1. WHEN accedo al dashboard THEN debo ver un resumen con estadísticas básicas (número de pacientes activos, sesiones recientes, etc.)
2. WHEN navego por el dashboard THEN debe haber un menú de navegación claro con acceso a Pacientes, Sesiones, y Configuración
3. WHEN uso el dashboard en diferentes dispositivos THEN la interfaz debe ser responsive y funcionar en desktop, tablet y móvil
4. WHEN hay problemas de conectividad THEN el dashboard debe mostrar el estado del sistema y opciones de recuperación
5. WHEN necesito ayuda THEN debe haber acceso fácil a documentación o soporte

### Requirement 4: Gestión de Pacientes

**User Story:** Como profesional de la salud, quiero poder ver, buscar y gestionar la lista de mis pacientes desde el dashboard web, para que pueda tener una visión completa de mi práctica y acceder rápidamente a la información que necesito.

#### Acceptance Criteria

1. WHEN accedo a la sección de pacientes THEN debo ver una lista paginada de todos mis pacientes con información básica (nombre, estado, última sesión)
2. WHEN busco un paciente THEN debo poder filtrar por nombre, DNI o estado (activo/inactivo)
3. WHEN selecciono un paciente THEN debo poder ver su perfil completo con historial de sesiones
4. WHEN necesito cambiar el estado de un paciente THEN debo poder activarlo o desactivarlo con confirmación
5. WHEN veo la lista de pacientes THEN los datos sensibles deben estar protegidos y solo mostrarse cuando sea necesario
6. WHEN hay muchos pacientes THEN la lista debe cargar de forma eficiente con paginación

### Requirement 5: Visualización de Sesiones

**User Story:** Como profesional de la salud, quiero poder ver y revisar las sesiones registradas a través del bot de WhatsApp desde el dashboard web, para que pueda tener una visión completa del progreso de mis pacientes y hacer seguimiento de los tratamientos.

#### Acceptance Criteria

1. WHEN accedo a las sesiones de un paciente THEN debo ver una lista cronológica de todas sus sesiones
2. WHEN selecciono una sesión THEN debo poder ver las observaciones completas, resumen de IA (si existe), y estado anímico registrado
3. WHEN hay sesiones con crisis detectadas THEN deben estar claramente marcadas y priorizadas en la visualización
4. WHEN reviso sesiones antiguas THEN debo poder navegar fácilmente por el historial con filtros por fecha
5. WHEN los datos están encriptados THEN el sistema debe desencriptarlos transparentemente para la visualización
6. WHEN imprimo o exporto información THEN debe mantener el formato profesional y la confidencialidad

### Requirement 6: Configuración y Perfil Profesional

**User Story:** Como profesional de la salud, quiero poder gestionar mi perfil y configuraciones del sistema desde el dashboard, para que pueda personalizar mi experiencia y mantener mi información actualizada.

#### Acceptance Criteria

1. WHEN accedo a mi perfil THEN debo poder ver y editar mi información profesional (nombre, especialidad, etc.)
2. WHEN quiero cambiar mi PIN THEN debo poder hacerlo siguiendo un proceso seguro con validación
3. WHEN configuro preferencias THEN debo poder ajustar notificaciones y opciones de visualización
4. WHEN reviso mi actividad THEN debo poder ver un log de mis acciones recientes en el sistema
5. WHEN hay actualizaciones del sistema THEN debo recibir notificaciones apropiadas
6. WHEN necesito soporte THEN debe haber información de contacto y recursos de ayuda disponibles

### Requirement 7: Seguridad y Cumplimiento

**User Story:** Como administrador del sistema, quiero que el dashboard web mantenga los mismos estándares de seguridad que el backend, para que la información médica esté protegida según las regulaciones de privacidad y las mejores prácticas de seguridad.

#### Acceptance Criteria

1. WHEN se transmiten datos THEN todas las comunicaciones deben usar HTTPS y encriptación apropiada
2. WHEN se almacenan datos en el navegador THEN solo debe guardarse información no sensible y con expiración apropiada
3. WHEN hay actividad sospechosa THEN el sistema debe aplicar las mismas medidas de seguridad que el backend
4. WHEN se detectan vulnerabilidades THEN el frontend debe tener protecciones contra XSS, CSRF y otros ataques comunes
5. WHEN se audita el sistema THEN todas las acciones del usuario deben quedar registradas apropiadamente
6. WHEN hay errores THEN no deben revelarse detalles técnicos que comprometan la seguridad

### Requirement 8: Performance y Experiencia de Usuario

**User Story:** Como profesional de la salud, quiero que el dashboard sea rápido y fácil de usar, para que pueda enfocarme en mi trabajo clínico sin frustraciones técnicas.

#### Acceptance Criteria

1. WHEN cargo el dashboard THEN la página principal debe cargar en menos de 3 segundos
2. WHEN navego entre secciones THEN las transiciones deben ser fluidas y rápidas
3. WHEN hay muchos datos THEN el sistema debe usar lazy loading y paginación para mantener el rendimiento
4. WHEN uso el sistema en conexiones lentas THEN debe haber indicadores de carga y manejo graceful de timeouts
5. WHEN cometo errores THEN debo recibir feedback claro y opciones para corregirlos
6. WHEN el sistema está ocupado THEN debo ver indicadores de progreso apropiados