# Checklist de Staging (Go/No‑Go)

- Owner: PM + SRE

## Preflight
- CORS exacto por ambiente (lista/regex) validado con preflight
- HTTPS forzado y HSTS activo
- JWT rotation: plan y ventana definida
- Backups: creación diaria y verify semanal OK
- CI: lint, unit, integration, smoke E2E < 3 min, audit high=0
- Seguridad: SAST/DAST sin High/Critical

## Validaciones rápidas
- `/health` 200; `/metrics` expone métricas esperadas
- Emisión token controlada por rate‑limit
- Dashboard/CRUD operativos y consistentes

## Aprobaciones
- SecOps, QA, SRE, PM

