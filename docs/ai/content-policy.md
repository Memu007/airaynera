# Política de Contenido IA (Resúmenes Clínicos)

- Owner: AI/ML (Valentina)

## Requisitos de formato
- Encabezados obligatorios:
  - **Estado Emocional:**
  - **Observaciones Clínicas:**
  - **Intervenciones:**
  - **Recomendaciones:**
- Máx. ~200 palabras; tono profesional; sin nombres reales

## Prohibido
- PII sin redactar (emails, teléfonos, IDs): debe redactarse
- URLs o llamados a contacto externo
- Frases de prompt‑injection ("ignora instrucciones previas")
- Disclaimers meta‑AI (“como modelo de lenguaje…”) y bloques de código

## Redacción
- Reglas de redacción aplicadas automáticamente (ver `AIService.redactSensitive`)

## Validación y guardrails
- Validación sintáctica y de contenido (ver `validateSummary`)
- Suite de prompts anti‑jailbreak (objetivo >95% bloqueo)
- Escalamiento a revisión humana si falla validación

## Monitoreo
- Muestreo semanal de respuestas para auditoría clínica y de privacidad

