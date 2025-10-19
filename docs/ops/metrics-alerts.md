# Métricas y Alertas (Staging/Prod)

- Owner: SRE (Ana)
- Fuente: `middleware/metrics.js` y endpoint `/metrics`

## Métricas clave
- totalRequests, requests2xx, requests4xx, requests5xx
- avgResponseMs, p95 (via navegador/APM si aplica)
- rateLimitedHits (429)
- requestPerEndpoint (opcional si se agrega)

## Umbrales y alertas
- Error rate (5xx / total) > 1% por 5 min: Alerta media
- p95 > 750 ms por 10 min: Alerta media
- rateLimitedHits > 100/min sostenido: aviso (posible ajuste de límites)
- 4xx spike > 20% por 10 min: Aviso (cambios UI o clientes)

Canales: Slack `#staging-alerts` y email on‑call. Horario: 8‑22h AR, guardia pasiva fuera de horario.

## Runbooks vinculados
- Ver `docs/ops/runbooks.md` (incidentes, escala, mitigación temporal, rollback)

## Tablero sugerido
- Gráfico de latencia p50/p95, tasa de error, RPS, 429/min, breakdown por endpoint.

