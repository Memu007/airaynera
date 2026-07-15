# Roadmap del MVP de AIRA

Última actualización: 2026-07-14.

Estado general: vertical web, texto por WhatsApp simulado y audio sintético por ambos canales aprobados localmente. Archivos reales, proveedor externo y Meta real están pendientes.

Alcance actual: priorizar funcionamiento. Seguridad avanzada, cumplimiento formal y estética se retomarán después de validar la idea.

## Secuencia de entrega

```text
Base técnica
→ Web funcional
→ WhatsApp vinculado
→ Flujo completo con texto
→ Audio web y WhatsApp
→ Nota clínica editable
→ Piloto
```

La integración se valida primero con texto. El audio se agrega después como otra forma de producir el mismo borrador. Esto permite separar problemas de identidad, estado y persistencia de los problemas de descarga y transcripción.

## Resumen

| Etapa | Resultado demostrable | Estimación orientativa |
|---|---|---:|
| 0. Base técnica | Aplicación reproducible, contratos y pruebas mínimas | 2–3 días |
| 1. Web funcional | Registro → paciente → sesión → recarga | 3–5 días |
| 2. Vinculación | Cuenta web vinculada con WhatsApp real | 4–6 días |
| 3. Flujo de texto | Texto → borrador → confirmar → ficha web | 4–6 días |
| 4. Audio | Audio web/WhatsApp → transcripción → borrador | 5–8 días |
| 5. Nota clínica | Estructuración y edición multicanal | 3–5 días |
| 6. Piloto | Prueba con profesionales y métricas | 1–2 semanas iniciales |

Las estimaciones no incluyen posibles demoras de configuración o aprobación de Meta.

## Etapa 0 — Base técnica

Objetivo: preparar el proyecto para avanzar sin ampliar las inconsistencias actuales.

Trabajo:

- Instalar dependencias y establecer una ejecución reproducible.
- Estandarizar Node.js 20.
- Definir un único contrato para pacientes, sesiones y borradores.
- Agregar migraciones versionadas para SQLite.
- Crear una base temporal para pruebas.
- Separar gradualmente las rutas nuevas de `server.js`.
- Crear adaptadores falsos de WhatsApp y transcripción.
- Consolidar GitHub Actions en una única verificación confiable.
- Marcar los workflows históricos o incompatibles para evitar señales engañosas.

Criterio de salida:

> Una base vacía se crea, las migraciones se aplican y las pruebas mínimas de contrato pasan en local y CI.

Estado: núcleo cumplido. Migraciones `001` a `005`, contratos, dobles de WhatsApp/transcripción/limpieza y persistencia conversacional aprobados.

## Etapa 1 — Web funcional

Objetivo: que la web sea una fuente de verdad confiable antes de conectar WhatsApp.

Trabajo:

- Hacer que el registro deje al usuario autenticado.
- Corregir la creación de sesiones desde la web.
- Cargar pacientes y sesiones desde la API al iniciar y recargar.
- Unificar nombres de campos y estados entre interfaz, API y SQLite.
- Corregir detalle, edición, filtros e indicadores.
- Separar fecha clínica, fecha de creación, duración del audio y duración clínica.
- Incorporar borradores en el modelo y la interfaz.

Criterio de salida:

1. Un usuario nuevo se registra.
2. Crea un paciente.
3. Registra una sesión escrita.
4. Recarga la página.
5. La ficha, el historial y los indicadores continúan correctos.

Tag sugerido: `mvp-v0.1-web-core`.

Estado: el criterio principal registro → paciente → sesión → recarga fue aprobado localmente. El formulario ya usa borrador y confirmación; falta una pantalla para recuperar/editar borradores pendientes antes de etiquetar la etapa.

## Etapa 2 — Vinculación web–WhatsApp

Objetivo: vincular explícitamente un número de WhatsApp con una cuenta web.

Recorrido:

1. El profesional presiona **Vincular WhatsApp**.
2. AIRA genera un código temporal y un enlace `wa.me`.
3. El profesional envía `VINCULAR 482913`.
4. El webhook recibe el número real del remitente.
5. AIRA consume el código y guarda la vinculación.
6. WhatsApp confirma y la web muestra el número vinculado de forma parcial.

Estados:

```text
Sin vincular → Pendiente → Vinculado → Desvinculado
```

Datos nuevos esperados:

- `whatsapp_links`: cuenta, teléfono, estado y fechas de vinculación.
- `whatsapp_link_codes`: código de un solo uso, vencimiento y consumo.
- `whatsapp_events`: identificador único de Meta, dirección, tipo y estado.

Endpoints esperados:

- `POST /api/whatsapp/link`
- `GET /api/whatsapp/link`
- `DELETE /api/whatsapp/link`
- `GET /webhooks/whatsapp`
- `POST /webhooks/whatsapp`

Criterio de salida:

> Un usuario vinculado desde la web manda `MENÚ` y recibe una respuesta desde el número real de AIRA.

Estado parcial: código temporal, vencimiento, consumo desde teléfono, persistencia, estado visible, idempotencia, desvinculación y `MENÚ` están aprobados con el adaptador falso. La identidad se resuelve mediante `phone → userId`, sin aceptar JWT ni `userId` en el evento. Faltan webhook de Meta y envío real.

Tag sugerido: `mvp-v0.2-whatsapp-linked`.

## Etapa 3 — Vertical completo con texto

Objetivo: validar web y WhatsApp de punta a punta sin depender todavía del audio o la IA.

```text
MENÚ
→ Nueva sesión
→ Pacientes recientes o buscar
→ Elegir paciente
→ Enviar texto
→ Ver borrador
→ Guardar
→ Ver sesión en la web
```

Estados conversacionales mínimos:

- `menu`
- `choosingPatient`
- `awaitingNote`
- `processing`
- `awaitingConfirmation`

Estados de borrador:

- `received`
- `processing`
- `ready`
- `confirmed`
- `cancelled`
- `failed`

Datos nuevos esperados:

- `whatsapp_conversations`: estado actual, paciente seleccionado y vencimiento.
- `session_drafts`: entrada original, nota limpia, estado y referencia del mensaje.

Reglas:

- Solamente aparecen pacientes de la cuenta vinculada.
- Los recientes se ordenan por último uso.
- La búsqueda ignora mayúsculas y tildes.
- Los resultados ambiguos requieren selección explícita.
- El paciente nunca se deduce del contenido.
- Confirmar varias veces no crea más de una sesión.
- Un mismo evento de Meta no crea más de un borrador.

Criterio de salida:

> Una nota de texto enviada desde WhatsApp se confirma una sola vez y aparece en la ficha correcta de la web.

Tag sugerido: `mvp-v0.3-text-e2e`.

Estado parcial: el criterio completo está aprobado con el adaptador falso, incluida persistencia después de reiniciar, deduplicación de cada mensaje, confirmación/cancelación y aparición en la ficha web. Falta reemplazar el transporte por Meta real.

## Etapa 4 — Audio web y WhatsApp

Objetivo: usar audio como otra entrada al mismo sistema de borradores.

Recorrido técnico:

1. Recibir el archivo o el identificador de Meta.
2. Registrar el evento y responder rápidamente al webhook.
3. Descargar o recibir el audio.
4. Crear un trabajo persistente.
5. Transcribir.
6. Guardar la transcripción literal.
7. Generar una nota limpia.
8. Eliminar el archivo temporal cuando corresponda.
9. Enviar o mostrar el borrador.

Interfaz de proveedores:

```text
transcribe(audio) → rawTranscript
structure(rawTranscript) → structuredNote
```

Esto permite comparar o cambiar Groq, Gemini y OpenAI sin modificar el resto del producto.

El doble actual procesa de forma síncrona, pero persiste estados, intentos y leases recuperables. Antes de llamar a un proveedor de red se incorporará un trabajo SQLite y un worker fuera de la transacción del webhook. No se agrega Redis inicialmente.

Estados internos orientativos:

```text
Pendiente → Descargando → Transcribiendo → Estructurando → Terminado / Fallido
```

Criterios de salida:

- Acuse de recibo en menos de 5 segundos.
- Un audio de prueba produce un único borrador.
- La transcripción literal se conserva.
- Un fallo puede reintentarse sin reenviar el audio.
- El mismo identificador de Meta nunca produce dos sesiones.
- Un audio de cinco minutos termina normalmente en menos de dos minutos.
- El mismo pipeline acepta grabación o subida desde la web.

Tag sugerido: `mvp-v0.4-audio-e2e`.

Estado parcial: el recorrido sintético `audio → raw → clean → revisar → guardar/cancelar → ficha` funciona desde web y WhatsApp. Se probaron idempotencia, fallo por etapa, retry sin retranscribir, recuperación después de reiniciar y confirmación única. Faltan archivo real, almacenamiento temporal, benchmark de proveedores, worker asíncrono y descarga de Meta. La comparación vigente está en [AUDIO_PROVIDER_BENCHMARK.md](AUDIO_PROVIDER_BENCHMARK.md).

## Etapa 5 — Nota clínica estructurada y edición

Objetivo: transformar el relato literal en documentación útil sin inventar información.

Salida inicial:

- Nota de evolución.
- Temas tratados.
- Intervenciones mencionadas.
- Acuerdos o tareas.
- Medicación mencionada.
- Próximo seguimiento.
- Fragmentos dudosos.
- Transcripción literal.

Reglas:

- Lo no mencionado queda vacío.
- No inferir diagnósticos.
- No calcular riesgo clínico automáticamente en este MVP.
- Conservar nombres, negaciones y dosis.
- Mantener transcripción literal y nota limpia por separado.

Acciones desde WhatsApp:

- Guardar.
- Cancelar.
- Volver a grabar.
- Abrir el borrador para editarlo en la web.

Criterio de salida:

> Un borrador puede editarse o confirmarse desde la web o WhatsApp y genera exactamente una sesión final.

Tag sugerido: `mvp-v0.5-clinical-drafts`.

## Etapa 6 — Piloto y confiabilidad

Objetivo: probar el producto con 3 a 5 profesionales y medir el ahorro real.

Trabajo:

- Reintentos y recuperación de trabajos trabados.
- Estados claros de procesamiento y error.
- Mensajes duplicados y fuera de orden.
- Audios vacíos, ruidosos, corruptos o demasiado largos.
- Actualización de borradores entre web y WhatsApp.
- Métricas de costo, latencia y tiempo de corrección.
- Pruebas con 30 a 50 audios anonimizados o creados para evaluación.

Criterios iniciales:

- Más del 90% de audios completados.
- Cero sesiones duplicadas.
- 100% de pacientes seleccionados explícitamente.
- Al menos 85% de notas con correcciones menores.
- Registro del tiempo de edición por nota.

## Arquitectura recomendada

Se mantienen Express y SQLite para validar el MVP. No se hará una reescritura tecnológica antes de probar el producto.

Separación gradual:

```text
routes/
  whatsapp.js
  drafts.js
services/
  whatsapp/
    link-service.js
    conversation-service.js
    meta-client.js
    message-handler.js
    media-service.js
  processing/
    job-service.js
    transcription-service.js
    note-structuring-service.js
  providers/
    transcription/
    note-structuring/
workers/
  audio-worker.js
db/
  migrations/
js/
  api-client.js
  whatsapp-link.js
  session-drafts.js
```

La lógica central no vivirá en n8n. Identidad, vinculación, paciente seleccionado, estado conversacional, deduplicación, borradores y confirmación pertenecen a AIRA. n8n puede utilizarse para experimentos aislados si aporta valor.

## Pruebas por vertical

Cada etapa debe incluir:

- pruebas unitarias para reglas de estado y transformación;
- pruebas de API con SQLite temporal;
- simuladores para Meta y proveedores externos;
- una prueba manual de aceptación documentada;
- verificación de que los reintentos no duplican datos.

Pruebas verticales prioritarias:

1. Web → paciente → sesión → recarga.
2. Web → vincular número → `MENÚ` real.
3. WhatsApp → paciente → texto → guardar → web.
4. WhatsApp → paciente → audio → guardar → web.
5. Web → paciente → audio → editar → guardar.
6. Evento duplicado → un borrador y una sesión.
7. Error de transcripción → reintento sin pérdida.
8. Guardado simultáneo desde web y WhatsApp → una sesión.

## GitHub y versiones

Ramas sugeridas:

- `agent/01-web-core`
- `agent/02-whatsapp-link`
- `agent/03-whatsapp-text-flow`
- `agent/04-audio-processing`
- `agent/05-clinical-drafts`

Reglas:

- Push frecuente de la rama de trabajo.
- Pull request en borrador por vertical.
- Commits pequeños con una conducta verificable.
- Merge a `main` solamente con el criterio de salida cumplido.
- Tag después de cada demostración aceptada.
- Actualizar `HANDOFF.md` y `WORKLOG.md` en cada PR.
- No subir secretos, bases, audios, transcripciones ni datos reales.

GitHub respalda código y documentación. El respaldo de la base del piloto será un proceso separado.

## Dependencias externas

Para la vinculación real:

- aplicación de Meta;
- WhatsApp Business Account;
- número de prueba o productivo;
- token de acceso;
- `phone_number_id`;
- URL pública HTTPS de staging;
- token de verificación del webhook.

Para audio:

- credencial de un proveedor de transcripción;
- conjunto de audios de prueba sin datos reales.

Estas dependencias no bloquean las primeras etapas porque se desarrollarán adaptadores falsos.
