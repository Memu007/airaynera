# Guía de Spec-Driven Development con Spec Kit

## Introducción

**Spec Kit** es el toolkit oficial de GitHub para **Spec-Driven Development (SDD)** - una metodología que cambia el enfoque del código a la especificación como fuente de verdad.

### ¿Por qué Spec Kit?

En lugar de:
- 🔴 "Desarrolla esto" → código impreciso → retrabajos
- 🔴 Múltiples archivos de documentación dispersos
- 🔴 Ambigüedad en requisitos

**Spec Kit te proporciona:**
- ✅ Especificación → Plan → Tareas → Implementación (flujo claro)
- ✅ Claude Code + AI agents entienden exactamente qué construir
- ✅ Código de mejor calidad desde el primer día
- ✅ Testing integrado en el proceso

## Instalación

Spec Kit ya está instalado en este proyecto. Para verificar:

```bash
export PATH="/Users/Emi/.local/bin:$PATH"
specify --help
```

## Estructura de Spec Kit en el Proyecto

```
beiabot-master/
├── .specify/               # Core Spec Kit configuration
│   ├── memory/             # Project constitution & memory
│   ├── scripts/            # Automation scripts
│   └── templates/          # Templates for specs, plans, tasks
├── .claude/                # Claude Code integration
│   ├── commands/           # /speckit.* slash commands
│   └── settings.local.json # Local settings
├── spec.md                 # Project specification (crear cuando sea necesario)
├── plan.md                 # Implementation plan (crear cuando sea necesario)
└── tasks.md                # Task breakdown (crear cuando sea necesario)
```

## Flujo de Desarrollo con Spec Kit

### Paso 1: Establecer Constitución (Primera vez)

Define los principios del proyecto:

**En Claude Code, usa el comando:**
```
/speckit.constitution
```

Esto te ayudará a definir:
- Principios centrales del proyecto
- Estándares de calidad
- Restricciones técnicas
- Procesos de desarrollo

**Guardar como:** `.specify/memory/constitution.md`

### Paso 2: Crear Especificación

Para cualquier feature nueva o cambio significativo:

**En Claude Code:**
```
/speckit.specify
```

**Input:** Describe la feature en lenguaje natural, ej:
> "Agregar autenticación de dos factores para usuarios del sistema"

**Output generado:** `spec.md` con:
- ✅ User stories priorizadas (P1, P2, P3)
- ✅ Requisitos funcionales
- ✅ Criterios de éxito
- ✅ Edge cases
- ✅ Entidades de datos

**Revisión manual:**
- Verifica que las historias sean independientes
- Asegúrate que los criterios de éxito sean medibles
- Marca áreas ambiguas para aclaración

### Paso 3: Aclaración (Opcional pero recomendado)

Para features complejas:

**En Claude Code:**
```
/speckit.clarify
```

Sistema hace preguntas estructuradas para resolver ambigüedades **antes** de planificar.

### Paso 4: Generar Plan Técnico

Una vez aprobada la spec:

**En Claude Code:**
```
/speckit.plan
```

**Output:** `plan.md` con:
- 📋 Arquitectura técnica
- 🔧 Componentes a crear/modificar
- 🗂️ Estructura de datos
- 🔌 Integraciones
- ⚠️ Riesgos técnicos
- ✅ Decisiones de diseño justificadas

### Paso 5: Generar Tareas

Descomponer en tareas accionables:

**En Claude Code:**
```
/speckit.tasks
```

**Output:** `tasks.md` con:
- ✅ Lista de tareas independientes
- 📊 Dependencias entre tareas
- ⏱️ Estimaciones (si aplica)
- 🧪 Casos de test para cada tarea

### Paso 6: Análisis (Opcional, recomendado después de tareas)

Validar coherencia:

**En Claude Code:**
```
/speckit.analyze
```

**Revisa:**
- Consistencia entre spec y plan
- Cobertura: ¿todas las historias tienen tareas?
- Riesgos no identificados

### Paso 7: Checklist de Calidad

Antes de implementar:

**En Claude Code:**
```
/speckit.checklist
```

**Genera checklist para verificar:**
- Completitud de requisitos
- Claridad de aceptación
- Cobertura de edge cases

### Paso 8: Implementación

Con spec, plan y tareas, implementa:

**En Claude Code:**
```
/speckit.implement
```

Claude Code tendrá **contexto completo**:
- Sabrá exactamente qué historias resolver
- Entenderá restricciones arquitectónicas
- Sabrá qué probar

## Ejemplo: Feature de Auditoría

### Iniciando:

```
Usuario: Necesitamos un sistema de auditoría para rastrear cambios en pacientes
```

### Paso 1: `/speckit.specify`

Claude genera `spec.md` con:

**User Stories:**
- P1: Registrar cambios en datos de pacientes
- P2: Consultar histórico de cambios
- P3: Exportar reportes de auditoría

**Requisitos:**
- FR-001: Sistema DEBE registrar quién, qué, cuándo en cada cambio
- FR-002: Los cambios deben ser inmutables
- FR-003: Acceso a auditoría solo para admins

**Edge Cases:**
- ¿Qué pasa con eliminaciones lógicas?
- ¿Cómo manejar cambios en masa?

### Paso 2: `/speckit.plan`

Claude genera `plan.md` con:

```
Arquitectura:
- Nueva tabla/colección: AuditLog
- Middleware para interceptar cambios
- API endpoints para consulta de auditoría

Componentes:
1. AuditMiddleware (Express)
2. AuditService (Business logic)
3. AuditController (Endpoints)
4. Migrations

Riesgos:
- Performance si hay muchos cambios
- Sincronización de datos históricos
```

### Paso 3: `/speckit.tasks`

Claude genera `tasks.md`:

```
1. Crear schema AuditLog
2. Implementar AuditMiddleware
3. Crear AuditService
4. Agregar endpoints GET /api/audit
5. Implementar tests
6. Documentar API
```

### Paso 4: `/speckit.implement`

Ejecutas:
```
/speckit.implement
```

Claude Code tiene TODO el contexto. Implementa según el plan.

## Mejores Prácticas

### 1. Una Spec por Feature

No hagas specs para todo. Úsalos para:
- ✅ Nuevas features significativas
- ✅ Cambios arquitectónicos
- ✅ Integraciones complejas

No uses para:
- ❌ Bugs simples
- ❌ Refactorings menores
- ❌ Cambios de documentación

### 2. Revisión Humana

Siempre revisa `spec.md` antes de pasar a plan:
- ¿Las historias son claras?
- ¿Son medibles los criterios de éxito?
- ¿Hay ambigüedades?

### 3. Mantén la Constitución Actualizada

La constitución de tu proyecto debe reflejar principios reales:
- Revisarla cada trimestre
- Actualizarla cuando cambien procesos
- Usarla como guía en revisiones

### 4. Valida Implementación

Después de `/speckit.implement`:
```bash
npm test                # Jest coverage
npm run lint            # ESLint
npm run test:coverage   # Verifica 70% coverage
```

## Integración con MCP Servers

Spec Kit + MCP Servers crean un flujo poderoso:

```
┌─────────────┐
│ Sequential  │  Piensas en pasos
│ Thinking    │  antes de codear
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Spec Kit    │  Defines exactamente qué
│             │  va a construirse
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ESLint +    │  Valida código
│ Code Review │  mientras lo escribes
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Chrome      │  Testa en navegador
│ DevTools    │  en tiempo real
└─────────────┘
```

## Comandos Disponibles

| Comando | Propósito | Cuándo usar |
|---------|-----------|-----------|
| `/speckit.constitution` | Definir principios | Primera vez, cambios significativos |
| `/speckit.specify` | Crear feature spec | Inicio de feature |
| `/speckit.clarify` | Resolver ambigüedades | Antes de planificar si necesario |
| `/speckit.plan` | Generar plan técnico | Spec aprobada |
| `/speckit.tasks` | Desglosar en tareas | Después de plan |
| `/speckit.analyze` | Validar coherencia | Antes de implement |
| `/speckit.checklist` | Validar calidad | Antes de implement |
| `/speckit.implement` | Codear según spec | Con spec, plan, tasks listos |

## Troubleshooting

### Error: "specify command not found"

```bash
export PATH="/Users/Emi/.local/bin:$PATH"
```

Agrega esto a tu `.zshrc` o `.bashrc` para que sea permanente:
```bash
echo 'export PATH="/Users/Emi/.local/bin:$PATH"' >> ~/.zshrc
```

### Error: "Claude Code not found"

Spec Kit busca agentes IA instalados. Verifica:
```bash
specify check
```

### Los comandos `/speckit.*` no aparecen

Los comandos están en `.claude/commands/`. Si no aparecen:
1. Recarga Claude Code (Cmd+R en Mac)
2. Verifica que `.claude/` exista
3. Reinicia Claude Code completamente

## Recursos

- **Documentación oficial:** https://github.com/github/spec-kit
- **Sitio:** https://speckit.org/
- **Ejemplos:** `.specify/templates/`
- **Constitución template:** `.specify/memory/constitution.md`

## Próximos Pasos

1. **Estable la constitución del proyecto:**
   ```
   /speckit.constitution
   ```

2. **Prueba con una feature pequeña:**
   - Describe una feature
   - Ejecuta `/speckit.specify`
   - Revisa la salida
   - Ejecuta `/speckit.plan`
   - Valida que tenga sentido

3. **Adopta gradualmente:**
   - Comienza con features nuevas
   - Ajusta templates según necesidades
   - Entrena al equipo en el flujo

---

**Versión:** 1.0
**Actualizado:** Oct 18, 2025
**Contribuidores:** Claude Code + Spec Kit
