# Detalles Técnicos - Mejoras AIRA

## Estructura de Servicios Implementados

### 1. Sistema de Backup
- **Archivo:** `src/servicios/backupAutomatico.js`
- **Funcionalidad:** Gestión de copias de seguridad programadas
- **Métodos principales:**
  - `configurarBackup`: Define frecuencia y retención
  - `realizarBackup`: Ejecuta el proceso de copia
  - `restaurarBackup`: Recupera datos desde una copia
  - `verificarNecesidadBackup`: Determina si corresponde hacer backup

### 2. Retención de Datos
- **Archivo:** `src/servicios/retencionDatos.js`
- **Funcionalidad:** Implementa política de 7 años mínimo
- **Métodos principales:**
  - `configurarPolitica`: Define períodos de retención
  - `verificarDatosParaArchivar`: Identifica datos antiguos
  - `archivarDatos`: Marca como archivados sin eliminar
  - `exportarDatosArchivados`: Prepara para almacenamiento frío

### 3. Historial de Cambios
- **Archivo:** `src/servicios/historialCambios.js`
- **Funcionalidad:** Registro detallado de modificaciones
- **Métodos principales:**
  - `registrarCambio`: Guarda modificaciones con metadatos
  - `obtenerHistorial`: Recupera cambios por entidad
  - `detectarCambios`: Compara objetos para identificar diferencias
  - `reconstruirEstado`: Genera versión histórica de una entidad

### 4. Integración de Canales
- **Archivo:** `src/servicios/integracionCanales.js`
- **Funcionalidad:** Sincronización web-WhatsApp
- **Métodos principales:**
  - `sincronizarSesiones`: Detecta sesiones en múltiples canales
  - `transferirContexto`: Mueve conversación entre canales
  - `notificarSesionCruzada`: Alerta sobre sesiones simultáneas
  - `unificarHistorial`: Consolida mensajes de ambos canales

### 5. Exportación de Datos
- **Archivo:** `src/servicios/exportacionDatos.js`
- **Funcionalidad:** Generación de archivos en formatos estándar
- **Métodos principales:**
  - `exportarPaciente`: Genera archivo con datos de un paciente
  - `exportarTodosPacientes`: Exportación masiva
  - `convertirAJson`: Formatea datos para JSON
  - `convertirACsv`: Formatea datos para CSV

### 6. Alertas de Seguridad
- **Archivo:** `src/servicios/alertasSeguridad.js`
- **Funcionalidad:** Monitoreo y notificación de eventos
- **Métodos principales:**
  - `configurarAlertas`: Define umbrales y notificaciones
  - `monitorearLoginsFallidos`: Detecta intentos fallidos
  - `monitorearAccesoInusual`: Identifica patrones anómalos
  - `monitorearExportacionMasiva`: Detecta exportaciones grandes
  - `monitorearModificacionSensible`: Vigila cambios en datos críticos

## Integración con Sistema Existente

### Modificaciones en Base de Datos
- **Archivo:** `src/servicios/baseDatos.js`
- **Cambios:**
  - Nuevos campos para archivado en pacientes
  - Integración con historial de cambios
  - Método para obtener paciente por DNI

### Tareas Programadas
- **Archivo:** `src/tareas/tareasProgramadas.js`
- **Funcionalidad:** Ejecución automática de procesos
- **Tareas implementadas:**
  - Verificación de necesidad de backup
  - Archivado según política de retención
  - Monitoreo de alertas de seguridad

## Flujo de Datos

```
[Interfaz Web/WhatsApp] → [Servicios de Aplicación] → [Servicios de Datos]
         ↑                           ↓                        ↓
         └───────────────────────────┴────────────────────────┘
                      Notificaciones y Alertas
```

## Consideraciones de Seguridad

- Cifrado de datos sensibles mantenido en todas las operaciones
- Registro de auditoría para todas las acciones críticas
- Validación de permisos antes de operaciones sensibles
- Notificaciones inmediatas ante eventos sospechosos

## Rendimiento

- Operaciones de backup programadas en horarios de baja carga
- Archivado por lotes para minimizar impacto
- Consultas optimizadas para historial de cambios
- Exportación asíncrona para volúmenes grandes

## Próximas Mejoras Técnicas

1. Implementar caché para consultas frecuentes
2. Optimizar consultas a Firestore
3. Añadir compresión para backups de gran tamaño
4. Implementar sistema de colas para operaciones pesadas
