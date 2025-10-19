# Runbooks Operativos

- Owner: SRE (Ana)

## Incidente de latencia/errores
1) Revisar `/metrics` y logs
2) Si 429 elevado: evaluar `RATE_LIMIT_MAX` temporalmente
3) Si CPU/IO alto: habilitar cache TTL corto (ya disponible) o escalar proceso
4) Si regresión: rollback al último tag estable

## Rotación de JWT
1) Generar nuevo `JWT_SECRET`
2) Setear `JWT_PREVIOUS_SECRET` al secreto anterior
3) Deploy; mantener ambos por ventana definida (p.ej. 24 h)
4) Retirar `JWT_PREVIOUS_SECRET`

## Backups y Restore
- Crear: `npm run backup:data`
- Verificar: `npm run backup:verify` (con `BACKUP_ENCRYPTION_KEY` si aplica)
- Restore: `npm run restore:data` (pre‑stop de servicios)

## Mantenimiento programado
- Activar modo mantenimiento (variable/env flag)
- Comunicar ventana y duración
- Verificar `/health` degrade y `/metrics`

## HTTPS/CORS por ambiente
- Forzar `REQUIRE_HTTPS=true` en staging/prod
- Definir `CORS_ORIGINS` y `CORS_ORIGINS_REGEX` exactos por entorno

