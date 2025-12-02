# Manual de Usuario - Nuevas Funcionalidades AIRA

## Índice
1. [Sistema de Backup](#sistema-de-backup)
2. [Retención de Datos](#retención-de-datos)
3. [Historial de Cambios](#historial-de-cambios)
4. [Integración Web-WhatsApp](#integración-web-whatsapp)
5. [Exportación de Datos](#exportación-de-datos)
6. [Alertas de Seguridad](#alertas-de-seguridad)

---

## Sistema de Backup

### ¿Qué es?
Un sistema que crea copias de seguridad automáticas de tus datos para prevenir pérdidas.

### ¿Cómo usarlo?

#### Backup Manual
1. Ve a **Configuración > Backup**
2. Haz clic en **Crear Backup Ahora**
3. Espera a que se complete el proceso
4. Descarga el archivo de backup si deseas guardarlo localmente

#### Configurar Backup Automático
1. Ve a **Configuración > Backup**
2. Selecciona la frecuencia:
   - Diaria: se ejecuta todos los días a la hora configurada
   - Semanal: se ejecuta un día específico de la semana
3. Configura cuántas copias quieres mantener (entre 1 y 10)
4. Haz clic en **Guardar Configuración**

#### Restaurar desde Backup
1. Ve a **Configuración > Backup**
2. En la lista de backups disponibles, haz clic en **Restaurar** junto al backup deseado
3. Confirma la acción (esto reemplazará los datos actuales)
4. Espera a que se complete el proceso

---

## Retención de Datos

### ¿Qué es?
Sistema que gestiona el ciclo de vida de los datos clínicos, cumpliendo con la normativa de conservación mínima de 7 años.

### ¿Cómo usarlo?

#### Ver Configuración Actual
1. Ve a **Configuración > Retención de Datos**
2. Verás el período configurado para datos clínicos (mínimo 7 años)

#### Modificar Configuración
1. Ve a **Configuración > Retención de Datos**
2. Ajusta el período de retención (no puede ser menor a 7 años)
3. Haz clic en **Guardar Configuración**

#### Ver Datos Archivados
1. Ve a **Pacientes > Archivados**
2. Utiliza los filtros para encontrar pacientes específicos
3. Haz clic en un paciente para ver sus datos y sesiones archivadas

---

## Historial de Cambios

### ¿Qué es?
Registro detallado de todas las modificaciones realizadas a los datos de pacientes y sesiones.

### ¿Cómo usarlo?

#### Ver Historial de un Paciente
1. Ve a la ficha del paciente
2. Haz clic en la pestaña **Historial de Cambios**
3. Verás una lista cronológica de todos los cambios realizados
4. Utiliza los filtros para buscar por fecha o tipo de cambio

#### Comparar Versiones
1. En la vista de historial, selecciona dos fechas diferentes
2. Haz clic en **Comparar**
3. Se mostrarán las diferencias entre ambas versiones

#### Restaurar Versión Anterior
1. En la vista de historial, localiza la versión que deseas restaurar
2. Haz clic en **Restaurar a esta versión**
3. Confirma la acción

---

## Integración Web-WhatsApp

### ¿Qué es?
Sistema que sincroniza las conversaciones entre la interfaz web y WhatsApp, permitiendo una experiencia continua.

### ¿Cómo usarlo?

#### Cambiar de Canal Durante una Sesión
1. Durante una sesión web, haz clic en **Continuar en WhatsApp**
2. Se enviará un mensaje al paciente con un enlace para continuar la conversación
3. El contexto de la conversación se transferirá automáticamente

#### Recibir Notificaciones de Sesiones Cruzadas
1. Si un paciente inicia una sesión en WhatsApp mientras estás en la web, recibirás una notificación
2. Haz clic en **Ver Sesión** para unirte a la conversación desde la web
3. Todo el historial previo estará disponible

#### Ver Historial Unificado
1. En la ficha del paciente, la pestaña **Conversaciones** muestra todas las interacciones
2. Los mensajes están etiquetados según su origen (Web o WhatsApp)
3. Utiliza los filtros para ver solo conversaciones de un canal específico

---

## Exportación de Datos

### ¿Qué es?
Herramienta para exportar datos de pacientes y sesiones en formatos estándar (JSON, CSV).

### ¿Cómo usarlo?

#### Exportar Datos de un Paciente
1. Ve a la ficha del paciente
2. Haz clic en **Exportar**
3. Selecciona el formato deseado (JSON o CSV)
4. Elige qué datos incluir (información personal, sesiones, etc.)
5. Haz clic en **Descargar**

#### Exportación Masiva
1. Ve a **Pacientes**
2. Selecciona los pacientes que deseas exportar o usa **Seleccionar Todos**
3. Haz clic en **Exportar Seleccionados**
4. Configura las opciones de exportación
5. Haz clic en **Descargar**

#### Programar Exportaciones Periódicas
1. Ve a **Configuración > Exportación**
2. Configura la frecuencia (diaria, semanal, mensual)
3. Selecciona el formato y los datos a incluir
4. Configura el destino (email, almacenamiento en nube)
5. Haz clic en **Guardar Configuración**

---

## Alertas de Seguridad

### ¿Qué es?
Sistema que monitorea y notifica sobre eventos de seguridad importantes.

### ¿Cómo usarlo?

#### Ver Alertas Activas
1. El icono de campana en la barra superior muestra el número de alertas pendientes
2. Haz clic en el icono para ver el detalle de las alertas
3. Las alertas están codificadas por color según su gravedad

#### Configurar Notificaciones
1. Ve a **Configuración > Seguridad**
2. Configura los umbrales para cada tipo de alerta:
   - Intentos de login fallidos
   - Accesos inusuales
   - Exportaciones masivas
   - Modificaciones de datos sensibles
3. Selecciona los métodos de notificación (web, email)
4. Haz clic en **Guardar Configuración**

#### Gestionar Alertas
1. Ve a **Seguridad > Alertas**
2. Revisa la lista completa de alertas
3. Haz clic en **Marcar como Leída** para confirmar que has visto la alerta
4. Haz clic en **Resolver** cuando hayas tomado acción sobre la alerta
5. Utiliza los filtros para ver alertas por tipo, fecha o estado

---

## Preguntas Frecuentes

**P: ¿Qué pasa con los datos después de los 7 años?**  
R: Los datos se archivan pero no se eliminan. Puedes seguir accediendo a ellos desde la sección de archivados.

**P: ¿Cuánto espacio ocupan los backups?**  
R: El tamaño depende de la cantidad de pacientes y sesiones. En promedio, cada backup ocupa entre 5-20MB.

**P: ¿Puedo exportar datos de pacientes dados de baja?**  
R: Sí, todos los pacientes (activos y dados de baja) pueden ser exportados.

**P: ¿Las alertas de seguridad se envían también por WhatsApp?**  
R: No, actualmente las alertas solo se envían por email y notificaciones web.

**P: ¿Qué hago si recibo una alerta de "acceso inusual"?**  
R: Verifica si fuiste tú quien accedió desde una ubicación o dispositivo diferente. Si no reconoces el acceso, cambia tu contraseña inmediatamente.

---

## Soporte

Si necesitas ayuda adicional:
- Revisa la documentación completa en la sección **Ayuda**
- Contacta al soporte técnico desde **Configuración > Soporte**
