## AIRA – Demo funcional (PM-friendly)

Sistema médico simple para gestionar pacientes y sesiones con foco en: rapidez, seguridad práctica y no sobre‑ingeniería (≤600 usuarios). Este README es el centro operativo: cómo correrlo, cómo testearlo y qué está hecho/pendiente.

### 🎯 Desarrollo con Spec Kit (Spec-Driven Development)

Este proyecto utiliza **GitHub Spec Kit** para desarrollo dirigido por especificaciones. Para nuevas features o cambios significativos:

1. **Crear especificación:** `/speckit.specify` en Claude Code
2. **Generar plan técnico:** `/speckit.plan`
3. **Desglosar en tareas:** `/speckit.tasks`
4. **Implementar:** `/speckit.implement`

📖 **Guía completa:** Consulta [SPEC-KIT-GUIDE.md](./SPEC-KIT-GUIDE.md)

### 1) Requisitos
- Node.js ≥ 18 y npm.
- macOS/Linux/Windows.

### 2) Instalación
```bash
npm install
```

### 3) Ejecutar servidor demo
- Comando: `node server-demo-funcional.js`
- Healthcheck: `http://localhost:3000/health`
- Rutas:
  - Landing: `http://localhost:3000/`
  - Landing moderna: `http://localhost:3000/landing-moderna`
  - Demo (dashboard funcional): `http://localhost:3000/demo`

Si el puerto 3000 está ocupado (EADDRINUSE):
```bash
lsof -nP -i :3000 -t | xargs -I {} kill -9 {} || true
# o levantar en otro puerto
PORT=3001 node server-demo-funcional.js
```

### 4) Scripts útiles
- E2E smoke (auto‑levanta server y corre Cypress):
```bash
npm run e2e:smoke
```
- Tests demo (Jest, cobertura):
```bash
npx jest --config jest.config.demo.js --coverage --ci --watchAll=false
```
- Auditoría de dependencias:
```bash
npm run security:audit
```

### 5) Pruebas incluidas (estable)
- Integración API demo: `tests/integration/demo-server.integration.test.js`, `...more.integration.test.js`, `...extra.functions.test.js`.
- Unit helpers (frontend): `tests/unit/demo-helpers.test.js`.
- E2E smoke: `cypress/e2e/demo-smoke.cy.js` (alta paciente, alta sesión, render demo).
- Cobertura objetivo demo: líneas ≥ 70%, funciones ≥ 60% (ajustado para no sobre‑diseñar).

### 6) Seguridad aplicada (P0)
- Headers y CSP con `helmet` (bloqueo de inline handlers; allowlist de CDNs). En proceso de endurecimiento final.
- Headers y CSP con `helmet` + extras: `referrerPolicy`, `dnsPrefetchControl`, `permittedCrossDomainPolicies`, `hsts` en producción.
- Modo CSP configurable por env `CSP_MODE=relaxed|strict` (por defecto `relaxed`).
- CORS por allowlist.
- Rate‑limit `100/15min`.
- Validación de payload con `express-validator` y errores uniformes.
- Sanitización en frontend con `escapeHtml` y eliminación de `onclick` (migrado a listeners + delegación de eventos).
- Auth opcional (JWT): desactivado por defecto; activar con `REQUIRE_AUTH=true` y `JWT_SECRET`.

### 7) DevOps/CI
- GitHub Actions: lint/test/cobertura + E2E smoke con `start-server-and-test`.
- Healthchecks expuestos en `/health`.
- Auditoría de dependencias: `npm audit --audit-level=high` como gate en CI.

### 8) Estado funcional actual (Checklist)
- [x] Servir landing y demo: `/`, `/landing-moderna`, `/demo`.
- [x] Favicon sin 404.
- [x] API demo pacientes/sesiones (GET/POST/PUT/DELETE) con validaciones.
- [x] Normalización de campos ES/EN en pacientes.
- [x] Filtrado “Mostrar inhabilitados” backend + UI mejorada.
- [x] Reconciliación sesiones↔pacientes (IDs/nombres) y listado robusto.
- [x] Botón “Nueva sesión” y flujo correspondiente.
- [x] Eliminación de `alert()`, reemplazo por notificaciones.
- [x] Remoción “autocompletar datos de prueba”.
- [x] Migración `onclick` → `data-action` + delegación eventos.
- [x] CSP strict verificada en E2E; handlers inline bloqueados.
- [x] Jest demo config (`jest.config.demo.js`) aislando suites relevantes.
- [x] Cypress config + smoke estable.
- [x] CI (workflow) con test de cobertura y E2E smoke.
- [x] Logging sin PII.
- [x] Persistencia JSON cifrada (opcional) y SQLite (opcional) listos.
- [x] Headers de seguridad reforzados (Helmet extra).

### 9) Roadmap inmediato (prioridad alta)
- [x] CSP strict estable (smoke E2E verde).
- [x] Auditoría de dependencias en CI (fail en “high”).
- [ ] Servir assets críticos locales o con SRI.
- [ ] Programar backups diarios (`npm run backup:data`) y script de restore; prueba de restore semanal.
- [ ] Activar `REQUIRE_AUTH=true` en staging y validar flujos con token.
- [ ] Monitoreo básico (uptime + alertas 5xx/rate limit). Endpoint `/metrics` con KPIs (avgResponseMs, 2xx/4xx/5xx, rateLimited).
- [ ] Modo mantenimiento (`MAINTENANCE=true`) bloquea escritura con 503.
- [ ] Forzar HTTPS en prod (`REQUIRE_HTTPS=true`) y limitar JSON (`JSON_LIMIT`).
- [ ] Rotación/retención de logs sin PII.
- [ ] Export XLSX: validar límites y sanitización reforzada.

### 10) Base de datos (evolución sin sobre‑ingeniería)
- Estado actual: en memoria para demo. Opcional: persistencia JSON cifrada o SQLite (implementado).
- Próximo paso recomendado (simple y robusto): SQLite (WAL) o Postgres gestionado.
- Mínimo esquema:
  - `patients(id, name, dni_enc, phone_enc, email, insurance, habilitado, created_at)`
  - `sessions(id, patient_id, fecha, tipo, duracion, notas, created_at)`
- Cifrado de campos sensibles (AES‑GCM) con key en env/KMS.
- Backups diarios cifrados, retención 7 días y prueba de restore.

### 13) Persistencia JSON cifrada (opcional)
- Activar con `USE_PERSISTENCE=true` y `DATA_KEY` (32 bytes en hex/base64) en variables de entorno.
- Archivos en `data/`: `patients.json`, `sessions.json`.
- Cifrado de `dni` y `phone` con AES‑256‑GCM. Sin `DATA_KEY`, guarda/lee en claro.

Ejemplo:
```bash
DATA_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
USE_PERSISTENCE=true node server-demo-funcional.js
```

### 15) SQLite (opcional)
- Requiere instalar `better-sqlite3` (no incluido por defecto):
```bash
npm i better-sqlite3 --save
```
- Ejecutar con:
```bash
USE_SQLITE=true node server-demo-funcional.js
```

### 16) Roadmap operativo (1 semana sugerida)
- Día 1–2: Backups diarios + restore y runbook de incidentes; health/alerts.
- Cron ejemplo (Linux):
```cron
0 2 * * * cd /ruta/al/proyecto && /usr/bin/node scripts/backup-data.js >> backups/cron.log 2>&1
```

Restore:
```bash
npm run restore:data -- backups/data_backup_YYYYMMDD_HHMM.tgz
```
- Día 3–4: Staging con `REQUIRE_AUTH=true`; roles mínimos; revisión endpoints.
- Día 5: Assets locales/SRI; CSP strict fijada en prod.
- Día 6: Privacidad/consentimiento visibles; DPA con proveedor.
- Día 7: Smoke E2E en staging con auth + checklist final y “go”.

### 14) Autenticación JWT (opcional)
- Activar protección de API: `REQUIRE_AUTH=true` y `JWT_SECRET`.
- Obtener token de demo: `POST /api/auth/demo-token` y usarlo como `Authorization: Bearer <token>`.

### 11) UX/Accesibilidad
- Consentimiento claro y copy sin “demo” para productivo.
- A11y base: labels/aria, foco visible, contraste.
- Estados vacíos consistentes y feedback no intrusivo.

### 12) Troubleshooting
- Error EADDRINUSE en 3000: ver sección 3 para liberar puerto o usar `PORT`.
- 404 en `/demo-whatsapp.html`: la ruta fue redirigida a `/demo`.

---

Este documento se irá marcando en cada entrega (checklist arriba) y todos los cambios se acompañan con tests (Jest/Cypress) para no romper funcionalidad existente.
