# Plan de Pruebas E2E (Production‑lite)

- Owner: QA (Lucía)
- Objetivo: Cobertura de flujos críticos con 20+ casos, smoke < 3 min en CI

## Entorno
- Base URL: staging
- Auth: `REQUIRE_AUTH=true` con usuarios de prueba
- Datos: dataset pequeño y estable (pacientes/sesiones seed)

## Flujos críticos (mínimo)
1) Login OK/KO
2) Ver dashboard y KPIs actualizados
3) CRUD Pacientes (crear, editar, inhabilitar/habilitar, eliminar)
4) Lista pacientes con filtro “mostrar inhabilitados”
5) CRUD Sesiones (crear, editar, eliminar)
6) Filtros por fecha y paciente en sesiones
7) Export (si aplica)
8) Notificaciones UI (éxito/error)
9) Health/metrics y estado de mantenimiento
10) Autorización por rol en `GET /api/admin/ping`

## Criterios de aceptación
- p95 < 750 ms en endpoints críticos durante smoke
- 0 errores UI visibles (toasts, validación)
- Datos consistentes entre listas y dashboard

## No funcionales
- Stress moderado post‑deploy (autocannon) para validar headroom
- CSP strict: sin violaciones en consola

## Reporte
- Informe diario con fallas reproducibles, videos/capturas y commit sospechoso

