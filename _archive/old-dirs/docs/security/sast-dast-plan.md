# Plan SAST/DAST (CI) – Production‑lite

- Owner: SecOps (Marcos)
- Objetivo: gates automáticos que bloqueen High/Critical antes de merge/deploy

## SAST – Semgrep
- Acción: Semgrep en CI sobre PR y main
- Reglas: `p/ci`, `p/nodejs`, `p/security-audit`
- Gate: High=0; Medium con triage obligatorio
- Reportes: `reports/security/semgrep-<commit>.sarif`
- Responsables de remediar: autor del PR + reviewer Backend

## DAST – OWASP ZAP Baseline
- Acción: ZAP baseline en staging (HTTP target)
- Gate: High=0, Medium=0 (aceptación explicitada por PM si aplica)
- Reportes: `reports/security/zap-<fecha>.html`
- Excepciones: documentar reglas suprimidas con justificación

## Secret scanning
- Acción: Activar GitHub Advanced Security (si disponible) o `trufflehog` en CI
- Gate: secreto detectado = bloquea PR

## SCA (dependencias)
- Acción: `npm audit --audit-level=high` en CI
- Gate: High=0; Medium con triage en 48h

## Línea de tiempo
- D1: habilitar SAST y SCA (gates activos)
- D2: ZAP baseline en staging con gate
- D3: Secret scanning en PR/main

