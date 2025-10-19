# Guía Visual - Nuevas Funcionalidades AIRA

## Menú Principal

El menú principal ahora incluye nuevas secciones:

```
┌─────────────────────────────────────────────────┐
│ AIRA - Asistente Inteligente                    │
├─────────────────────────────────────────────────┤
│ 🏠 Inicio                                       │
│ 👤 Pacientes                                    │
│    └─ 📁 Archivados                             │
│ 💬 Conversaciones                               │
│    └─ 🔄 Sesiones Cruzadas                      │
│ ⚙️ Configuración                                │
│    ├─ 💾 Backup                                 │
│    ├─ 📅 Retención de Datos                     │
│    ├─ 📤 Exportación                            │
│    └─ 🔒 Seguridad                              │
│ ❓ Ayuda                                        │
└─────────────────────────────────────────────────┘
```

## 1. Sistema de Backup

### Pantalla de Configuración de Backup

```
┌─────────────────────────────────────────────────────────────────────┐
│ Configuración de Backup                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Frecuencia de backup automático:                                   │
│                                                                     │
│  ○ Diario    ● Semanal    ○ Mensual                                │
│                                                                     │
│  Día de la semana: [Lunes ▼]                                        │
│                                                                     │
│  Hora: [02:00 ▼] AM                                                 │
│                                                                     │
│  Copias a mantener: [5 ▼]                                           │
│                                                                     │
│  [Crear Backup Ahora]                [Guardar Configuración]        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Backups Disponibles                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Fecha          Tamaño    Pacientes    Sesiones    Acción           │
│  20/06/2025     15.2 MB   48           230         [Restaurar]      │
│  13/06/2025     14.8 MB   47           220         [Restaurar]      │
│  06/06/2025     14.5 MB   47           210         [Restaurar]      │
│  30/05/2025     14.2 MB   46           200         [Restaurar]      │
│  23/05/2025     13.9 MB   45           190         [Restaurar]      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Retención de Datos

### Pantalla de Configuración de Retención

```
┌─────────────────────────────────────────────────────────────────────┐
│ Configuración de Retención de Datos                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Período de retención para datos clínicos:                          │
│                                                                     │
│  [10 ▼] años    (Mínimo legal: 7 años)                             │
│                                                                     │
│  Período de retención para datos de auditoría:                      │
│                                                                     │
│  [24 ▼] meses                                                       │
│                                                                     │
│  [Guardar Configuración]                                            │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Información                                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Los datos nunca se eliminan, solo se archivan                    │
│  • Datos archivados: 30 pacientes, 120 sesiones                     │
│  • Última verificación: 20/06/2025                                  │
│                                                                     │
│  [Ver Datos Archivados]                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 3. Historial de Cambios

### Vista de Historial de un Paciente

```
┌─────────────────────────────────────────────────────────────────────┐
│ Historial de Cambios - Paciente: Martínez, Ana                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Filtrar por:  [Todos ▼]  Desde: [01/06/2025]  Hasta: [20/06/2025]  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Fecha          Usuario       Campo        Cambio                   │
│  15/06/2025     Dr. López    Medicación   "Loratadina 10mg" →      │
│  14:30          (Web)                     "Loratadina 5mg"         │
│                                                                     │
│  10/06/2025     Dr. López    Teléfono     "1122334455" →           │
│  09:15          (WhatsApp)                "1133445566"             │
│                                                                     │
│  05/06/2025     Dr. López    Notas        "Paciente refiere..." →  │
│  16:45          (Web)                     "Paciente refiere... Se  │
│                                           agrega seguimiento..."   │
│                                                                     │
│  [Ver más]                                                          │
│                                                                     │
│  [Comparar Seleccionados]    [Restaurar Versión]                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 4. Integración Web-WhatsApp

### Notificación de Sesión Cruzada

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️ Sesión Activa en Otro Canal                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  El paciente Martínez, Ana tiene una sesión activa en WhatsApp      │
│  iniciada hace 5 minutos.                                           │
│                                                                     │
│  Opciones:                                                          │
│                                                                     │
│  [Continuar en Web]  [Ver en WhatsApp]  [Transferir a Web]          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Vista Unificada de Conversaciones

```
┌─────────────────────────────────────────────────────────────────────┐
│ Conversaciones - Paciente: Martínez, Ana                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Filtrar por:  [Todos ▼]  Desde: [01/06/2025]  Hasta: [20/06/2025]  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  15/06/2025 - Sesión #12                                            │
│                                                                     │
│  [Web] 14:30 - Dr. López: Buenos días Ana, ¿cómo te has sentido?    │
│                                                                     │
│  [Web] 14:31 - Ana: Mejor doctor, aunque sigo con algo de alergia   │
│                                                                     │
│  [Web] 14:32 - Dr. López: Vamos a ajustar la dosis de Loratadina    │
│                                                                     │
│  [WhatsApp] 15:45 - Ana: Doctor, olvidé preguntar si debo tomar     │
│                          la medicación con las comidas              │
│                                                                     │
│  [WhatsApp] 15:50 - Dr. López: Es preferible tomarla después del    │
│                               desayuno, Ana                         │
│                                                                     │
│  [Ver sesión completa]                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 5. Exportación de Datos

### Pantalla de Exportación

```
┌─────────────────────────────────────────────────────────────────────┐
│ Exportación de Datos                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Paciente: Martínez, Ana                                            │
│                                                                     │
│  Formato:                                                           │
│  ○ JSON    ● CSV                                                    │
│                                                                     │
│  Datos a incluir:                                                   │
│  ☑ Información personal básica                                      │
│  ☑ Historial de sesiones                                            │
│  ☐ Notas clínicas completas                                         │
│  ☐ Historial de cambios                                             │
│  ☐ Datos archivados                                                 │
│                                                                     │
│  Período:                                                           │
│  Desde: [01/01/2025]  Hasta: [20/06/2025]                           │
│                                                                     │
│  [Exportar]  [Cancelar]                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 6. Alertas de Seguridad

### Panel de Alertas

```
┌─────────────────────────────────────────────────────────────────────┐
│ Alertas de Seguridad                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Filtrar por:  [Todos ▼]  Estado: [No resueltas ▼]                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔴 ALTO - 18/06/2025 14:22                                         │
│  Múltiples intentos de login fallidos (5) desde IP 200.55.142.13    │
│  [Detalles]  [Marcar como leída]  [Resolver]                        │
│                                                                     │
│  🟠 MEDIO - 17/06/2025 09:15                                        │
│  Acceso desde ubicación inusual (Córdoba, Argentina)                │
│  [Detalles]  [Marcar como leída]  [Resolver]                        │
│                                                                     │
│  🟡 BAJO - 15/06/2025 16:30                                         │
│  Exportación de datos de 15 pacientes                               │
│  [Detalles]  [Marcar como leída]  [Resolver]                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Configuración de Alertas

```
┌─────────────────────────────────────────────────────────────────────┐
│ Configuración de Alertas de Seguridad                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Umbrales de alerta:                                                │
│                                                                     │
│  Intentos de login fallidos: [5 ▼]                                  │
│                                                                     │
│  Exportación masiva (pacientes): [10 ▼]                             │
│                                                                     │
│  Notificaciones:                                                    │
│  ☑ Mostrar en interfaz web                                          │
│  ☑ Enviar por email                                                 │
│  ☐ Bloquear cuenta temporalmente tras múltiples intentos fallidos   │
│                                                                     │
│  Email para notificaciones: [doctor@ejemplo.com]                    │
│                                                                     │
│  [Guardar Configuración]                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Acceso Rápido

Para acceder rápidamente a estas funcionalidades, se han añadido iconos en la barra superior:

```
┌─────────────────────────────────────────────────────────────────────┐
│ AIRA                                    🔔2  💾  📤  ❓  👤 Dr. López │
└─────────────────────────────────────────────────────────────────────┘
```

Donde:
- 🔔2: Alertas de seguridad (el número indica alertas pendientes)
- 💾: Acceso rápido a backup
- 📤: Acceso rápido a exportación
- ❓: Ayuda
- 👤: Perfil de usuario
