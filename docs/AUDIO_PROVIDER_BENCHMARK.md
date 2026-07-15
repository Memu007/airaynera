# Integración y benchmark de proveedores de audio

Última revisión: 2026-07-15.

## Decisión actual

Gemini es el primer proveedor real integrado porque existe una cuenta gratuita disponible para validar el recorrido sin contratar otro servicio. Esto no lo aprueba todavía para audio clínico ni descarta Groq u OpenAI.

El valor predeterminado sigue siendo:

```text
AUDIO_TRANSCRIBER=fake
NOTE_CLEANER=fake
```

Sólo al configurar `AUDIO_TRANSCRIBER=gemini` y `GEMINI_API_KEY` un archivo real usa Gemini. Los fixtures `fixture://` continúan forzando el proveedor falso para que web, WhatsApp simulado y CI sean deterministas.

## Adaptador Gemini implementado

`services/audio/geminiAudioTranscriber.js` usa REST nativo y no agrega un SDK:

- modelo configurable, con `gemini-3.1-flash-lite` como valor inicial;
- Files API para subir el audio y borrado remoto en `finally`;
- espera explícita hasta que el archivo remoto queda `ACTIVE`;
- Interactions API estable `v1`, salida JSON `{ "transcript": "..." }` y `store: false`;
- conservación literal de negaciones, números, dosis, nombres y fragmentos dudosos mediante el prompt;
- timeout, backoff cancelable y retries solamente donde la operación es segura;
- `upload, finalize` e `interactions.create` no se repiten a ciegas si se pierde la respuesta;
- la pérdida de lease o el apagado del worker abortan upload, espera, backoff o inferencia;
- un resultado tardío con fencing token obsoleto no puede modificar el borrador;
- el cleanup remoto tiene un intento independiente de hasta un segundo; si falla queda un warning y Files API conserva su expiración automática.

El pipeline tiene una ruta asíncrona usada por `workers/audio-worker.js`. La ruta síncrona se conserva únicamente para fixtures y rechaza proveedores que devuelvan una promesa.

Formatos habilitados en este adaptador: WAV, MP3/MPEG, AAC, OGG y MP4/M4A. AIRA todavía acepta WebM en la entrada general, pero Gemini no: con este proveedor un WebM termina como fallo visible y reintentable sólo después de convertir o reemplazar el archivo. La normalización automática de formatos queda pendiente.

Fuentes oficiales de la implementación:

- [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite).
- [Interactions API v1](https://ai.google.dev/api/interactions-api-v1) y [guía de Interactions](https://ai.google.dev/gemini-api/docs/interactions-overview).
- [Files API](https://ai.google.dev/gemini-api/docs/files) y [audio en Gemini](https://ai.google.dev/gemini-api/docs/audio).
- [Troubleshooting y retries](https://ai.google.dev/gemini-api/docs/troubleshooting).

## Smoke sintético reproducible

`benchmarks/audio/synthetic-smoke-v1/manifest.json` define diez textos completamente artificiales y cuatro variantes de voz/velocidad. El generador produce 40 WAV PCM mono de 16 kHz, registra SHA-256, tamaño, duración, referencia y spans críticos, y deja los binarios fuera de Git.

Las voces Paulina (`es-MX`) y Mónica (`es-ES`) no representan habla rioplatense real. Los audios duran pocos segundos y no tienen ruido ni compresión. Este corpus prueba que Gemini puede atravesar:

```text
WAV → almacenamiento temporal → draft/job SQLite → worker → Files API
→ Interactions API → rawTranscript → cleanNote → cleanup local/remoto
```

No sirve para elegir proveedor, estimar tiempo de corrección profesional ni aprobar fidelidad clínica.

Generación persistente de los mismos bytes para una corrida:

```bash
npm run corpus:audio:generate -- --output=/tmp/aira-gemini-smoke-v1
```

Validación offline de hashes, WAV, referencias y scorer:

```bash
npm run smoke:gemini -- \
  --validate-only \
  --corpus-manifest=/tmp/aira-gemini-smoke-v1/generated-manifest.json
```

Corrida real opt-in, siempre con árbol Git limpio y reporte obligatorio:

```bash
GEMINI_API_KEY=... npm run smoke:gemini -- \
  --corpus-manifest=/tmp/aira-gemini-smoke-v1/generated-manifest.json \
  --report=benchmarks/audio/results/gemini-smoke-20260715.json
```

El reporte conserva commit, hash del manifiesto, hash del prompt, modelo, hashes de audio, referencia e hipótesis artificiales, request ID, usage, latencias, WER/CER y spans. La corrida es secuencial y espera cuatro segundos entre casos por defecto; puede ajustarse con `--delay-ms`.

## Estado verificado

- Contrato HTTP simulado de Gemini, polling `ACTIVE`, cleanup, cancelación, retries y respuesta estructurada: aprobado.
- Provider registry, fixture síncrono, worker asíncrono, heartbeat, shutdown y fencing tardío: aprobado.
- Scorer offline, incluido un caso adversarial que contiene afirmación y negación contradictorias: aprobado.
- Generación y validación local de 40 WAV con servicios de voz de macOS: aprobada el 2026-07-15.
- Smoke real contra Gemini: **no ejecutado** porque este entorno no tiene `GEMINI_API_KEY` ni `GOOGLE_API_KEY` configurada.

No se registrará un resultado fake como si fuera una corrida Gemini.

## Free Tier y datos reales

El Free Tier puede usarse solamente con este corpus artificial. Google informa que el contenido del Free Tier puede usarse para mejorar sus productos, mientras que para el Paid Tier indica lo contrario. Los límites reales dependen del proyecto y deben revisarse en AI Studio.

Fuentes: [pricing de Gemini](https://ai.google.dev/gemini-api/docs/pricing) y [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

No se debe enviar audio de pacientes al Free Tier. La habilitación con datos clínicos reales requiere Paid Tier y las revisiones de privacidad, retención y contrato que el producto decidió diferir.

## Benchmark decisorio pendiente

La elección de proveedor continúa requiriendo un corpus humano separado:

- 30 a 50 audios creados para evaluación, sin datos de pacientes;
- referencias revisadas por una persona;
- exactamente los mismos bytes y hashes para Gemini, Groq y OpenAI;
- notas de 2 a 10 minutos, voces y condiciones representativas;
- WER/CER, omisiones, invenciones, negaciones, números, dosis y nombres;
- latencia, fallos, usage/costo y tiempo de corrección profesional;
- revisión explícita de cada contradicción o error crítico.

El proveedor elegido será el de menor costo entre los que superen el gate clínico acordado. Hasta entonces `AUDIO_TRANSCRIBER=fake` sigue siendo la configuración segura y reproducible del proyecto.
