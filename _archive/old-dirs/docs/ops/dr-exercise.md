# Ejercicio de DR (Disaster Recovery)

- Owner: Data/DBA (Pablo) + SRE (Ana)
- Objetivo: verificar RPO≤24h y RTO≤1h semanalmente

## Procedimiento semanal
1) Generar backup cifrado (diario): `npm run backup:data`
2) Verificar backup: `npm run backup:verify`
3) Restore de prueba en entorno aislado (staging sandbox): `npm run restore:data <archivo>`
4) Medir tiempos (inicio/fin), validar integridad (endpoints CRUD en modo read)
5) Registrar bitácora en `reports/dr/<fecha>.md`

## Criterios de éxito
- Restore completo < 60 min
- Datos consistentes (pacientes/sesiones) y endpoints GET 200

## Observaciones
- Retención: 7 días en `backups/` + offsite
- Clave de cifrado gestionada por secret manager de CI/CD

