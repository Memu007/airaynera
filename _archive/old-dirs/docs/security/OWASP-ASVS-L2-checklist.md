# OWASP ASVS L2 - Checklist Production‑lite

Ámbito: API Node/Express + Front SPA/HTML. Enfoque L2 con priorización para ≤600 usuarios.

- Owner general: SecOps (Marcos)
- Revisión: PM, Backend, QA
- Meta: 0 hallazgos High/Critical abiertos antes de go‑live

## Estado resumido
- CSP strict, CORS por ambiente, HTTPS forzado: En producción
- JWT rotation (`JWT_PREVIOUS_SECRET`), rate limits: En producción
- Backups cifrados + verify semanal CI: En producción
- SAST (Semgrep) y DAST (ZAP baseline): Pendiente activar como gates

## Tabla de control (extracto priorizado)

| Código | Control | Evidencia | Estado | Owner | Due |
|-------|---------|-----------|--------|-------|-----|
| V1.1  | Definir arquitecturas y confianza | docs/ops/runbooks.md | En producción | PM | D3 |
| V2.1  | Autenticación fuerte (JWT, rotación) | `middleware/auth.js` | En producción | Sofía | — |
| V2.12 | Bloqueo/limitación de endpoints de token | rate‑limit auth | En producción | Sofía | — |
| V3.3  | Gestión de sesión segura | JWT, expiración | En producción | Sofía | — |
| V4.1  | Control de acceso por rol | `requireRole` | En producción | Sofía | — |
| V5.3  | Validación/sanitización de entradas | express‑validator, escapeHtml | En producción | Sofía | — |
| V6.4  | Cifrado en reposo de datos sensibles | backups cifrados; AES util | En producción | Pablo | — |
| V10.3 | Protección de XSS (CSP strict) | Helmet CSP MODE strict | En producción | Marcos | — |
| V10.5 | Protección contra inyecciones | Queries SQLite preparadas | En progreso | Sofía | D4 |
| V13.2 | Registro con redacción de PII | middleware/logging | En producción | Marcos | — |
| V14.2 | Config segura por entorno | env.example definido | En producción | Ana | — |
| V14.4 | Seguridad por defecto (CORS/HTTPS) | server config | En producción | Ana | — |
| V14.7 | SAST obligatorio en CI | Semgrep high=0 gate | Pendiente | Marcos | D3 |
| V14.8 | DAST baseline en CI | OWASP ZAP baseline | Pendiente | Marcos | D4 |
| V14.9 | Secret scanning | GH Advanced/Trufflehog | Pendiente | Ana | D3 |

Notas:
- CSRF no aplica al API sin cookies; revisar si se introduce sesión de navegador.
- Open redirect: no permitido; confirmar rutas externas.

## Acciones P0
1) Activar Semgrep en CI con gate high=0. Documentar excepciones si hiciera falta.
2) ZAP baseline en staging; gate high=0. Registrar riesgos aceptados.
3) Secret scanning en PR y branch main. Política de rotación de secretos.
4) Revisión de queries y parámetros en endpoints nuevos para inyección.

## Evidencia y reportes
- Guardar reportes SAST/DAST en `reports/security/` con fecha y commit.
- PM consolida hallazgos y SLAs de remediación.
