# Contratos funcionales del dominio

Estado: decisión activa para el MVP. Seguridad avanzada, cumplimiento y estética quedan fuera de este corte.

## Decisión de producto

La web y WhatsApp deben terminar en el mismo flujo:

1. El profesional autenticado elige un paciente.
2. Envía texto o audio.
3. AIRA crea un borrador editable.
4. El profesional revisa y confirma.
5. Recién entonces aparece una sesión en la ficha del paciente.

El recorrido de texto está implementado en web y WhatsApp simulado. La web acepta archivos de audio reales, los almacena temporalmente y los procesa mediante un worker SQLite. El worker puede usar fake o Gemini; fake sigue siendo el valor predeterminado. WhatsApp conserva el audio sintético y Meta real sigue pendiente.

## Reglas canónicas

- La API y el estado nuevo de la interfaz usan `camelCase`.
- Los identificadores JSON son strings.
- `clinicalDate` representa el día clínico (`YYYY-MM-DD`); `createdAt` representa cuándo se guardó el registro (ISO UTC).
- `durationMinutes` es la duración clínica; `audioDurationSeconds` es la duración del archivo de audio. Nunca se mezclan.
- SQLite puede conservar columnas históricas mientras los adaptadores las traduzcan.
- Las respuestas nuevas nunca exponen nombres históricos como `pacienteId`, `notas` o `mood_assessment`.

## Patient

```json
{
  "id": "7",
  "name": "Ana Pérez",
  "dni": "30111222",
  "phone": "+5491122334455",
  "email": "ana@example.com",
  "insurance": "OSDE",
  "status": "active",
  "source": "web",
  "createdAt": "2026-07-15T00:30:00.000Z",
  "updatedAt": "2026-07-15T00:30:00.000Z",
  "lastSessionDate": null,
  "totalSessions": 0
}
```

`status`: `active | inactive`.

## Session

```json
{
  "id": "41",
  "patientId": "7",
  "patientName": "Ana Pérez",
  "clinicalDate": "2026-07-14",
  "sessionType": "individual",
  "durationMinutes": 45,
  "careModality": "inPerson",
  "source": "web",
  "inputType": "text",
  "rawTranscript": null,
  "cleanNote": "Se trabajó ansiedad anticipatoria.",
  "medicationNotes": null,
  "moodAssessment": 3,
  "requiresFollowUp": true,
  "audioDurationSeconds": null,
  "status": "confirmed",
  "revision": 1,
  "draftId": null,
  "createdAt": "2026-07-15T00:35:00.000Z",
  "updatedAt": "2026-07-15T00:35:00.000Z",
  "confirmedAt": "2026-07-15T00:35:00.000Z"
}
```

`sessionType`: `individual | group | family | couple | other`.

`careModality`: `inPerson | video | phone | unspecified`.

### Edición y concurrencia de `PATCH /api/sessions/:id`

- `revision` es un entero que empieza en `1` y se incrementa en cada edición exitosa. Es la unidad de concurrencia optimista de la sesión.
- La edición exige la precondición `If-Match: <revision>`:
  - falta la cabecera → `428 REVISION_REQUIRED` y no cambia nada (un cliente viejo o sin cabecera no puede sobrescribir a ciegas);
  - cabecera presente pero no un entero positivo seguro (`Number.isSafeInteger && > 0`; `0` y números enormes incluidos) → `400 INVALID_REVISION`;
  - revisión distinta de la actual → `409 REVISION_CONFLICT` con el cuerpo `{ error, message, session }` (la sesión vigente), sin sobrescribir.
- Una edición sin ningún campo editable (`{}`, `[]` o sólo campos ignorados como `rawTranscript`) devuelve `400 EMPTY_PATCH` y **no** incrementa `revision`.
- El paciente nunca se reasigna: `patientId`/`pacienteId` en el cuerpo devuelve `400 PATIENT_REASSIGNMENT_NOT_ALLOWED`.
- Contrato de tipos estricto (mismo para POST y PATCH): fecha de calendario real `YYYY-MM-DD`, tipos/modalidades por lista, duración entera 1–480 o nula, ánimo 1–5 o nulo, seguimiento booleano real, límites de nota (10000) y medicación (5000). Arrays y objetos se rechazan antes de cualquier coerción; un `patientId` objeto es `400`, nunca `500`. `inputType`, `rawTranscript` y `audioDurationSeconds` se validan al crear y son inmutables en PATCH.
- Cliente (modelo por intento): cada guardado es un registro `{seq, desired, base, appliedBase, wireDelta, revision}` y un único `pump` es el emisor, así sólo el intento más nuevo sobrevive. El `wireDelta` se calcula contra la última base aplicada, que se **resetea en cada éxito** (por eso un revert de un campo produce delta no vacío y se envía); un delta vacío es no-op. El formulario no se cierra hasta confirmar. Ante `409` se muestra el conflicto campo por campo (los ocho campos), **persistido** para reabrir/recargar, con **Reintentar** y **Editar mi versión** que hacen un **merge de 3 vías** contra la base original del conflicto (sólo los campos que cambié, sin pisar los que tocó otro cliente) o **Usar la del servidor**; las acciones se deshabilitan durante un reintento y `state.conflict`/localStorage no se limpian hasta éxito o "Usar la del servidor" (un `400/500/red/segundo 409` re-muestra los ocho campos habilitados). La respuesta perdida se reconcilia comparando el servidor contra el estado completo esperado (`appliedBase + wireDelta`); la versión completa se persiste por pestaña (`tabId` en `sessionStorage`) para recuperar tras recargar, y dos pestañas no se borran entre sí. Se advierte al cerrar (X/backdrop) o recargar con formulario modificado —incluso inválido— o conflicto pendiente.

## SessionDraft

```json
{
  "id": "19",
  "patientId": "7",
  "patientName": "Ana Pérez",
  "clinicalDate": "2026-07-14",
  "sessionType": "individual",
  "durationMinutes": 45,
  "careModality": "unspecified",
  "source": "whatsapp",
  "inputType": "audio",
  "status": "ready",
  "rawTranscript": "Hoy trabajamos sobre...",
  "cleanNote": "Se trabajó ansiedad anticipatoria.",
  "medicationNotes": null,
  "moodAssessment": null,
  "requiresFollowUp": false,
  "audioDurationSeconds": 184,
  "sourceMessageId": "wamid.HBgN...",
  "sessionId": null,
  "failure": null,
  "createdAt": "2026-07-15T00:33:00.000Z",
  "updatedAt": "2026-07-15T00:34:00.000Z",
  "confirmedAt": null
}
```

Estados: `received -> transcribing -> structuring -> ready -> confirmed`. Cualquier etapa de procesamiento puede pasar a `failed`; todo borrador no confirmado puede pasar a `cancelled`.

Confirmar un borrador debe ser transaccional e idempotente: repetir la confirmación devuelve la misma sesión, nunca crea otra.

## API de borradores implementada

```text
GET   /api/session-drafts?status=ready&patientId=7
GET   /api/session-drafts/:id
POST  /api/session-drafts
PATCH /api/session-drafts/:id
POST  /api/session-drafts/:id/confirm
POST  /api/session-drafts/:id/cancel
```

En el vertical de texto, el borrador nace en `ready`. Solamente `ready` puede editarse o confirmarse. Confirmar por primera vez devuelve `201`; repetir la misma confirmación devuelve `200` y la misma sesión.

`POST /api/session-drafts` acepta solamente texto. Todo audio debe entrar por el pipeline específico para que no exista un borrador `received` sin medio ni forma de procesarse.

## Pipeline de audio implementado

La entrada común normalizada es:

```json
{
  "patientId": "7",
  "clinicalDate": "2026-07-14",
  "fixtureId": "pause-heavy-es-01"
}
```

Los fixtures sintéticos usan:

```text
GET  /api/audio-drafts/fixtures
POST /api/audio-drafts
POST /api/audio-drafts/:id/retry
```

La carga de un archivo real desde la web usa un cuerpo binario único:

```text
POST /api/audio-drafts/upload?patientId=7&clinicalDate=2026-07-14&sessionType=individual&durationMinutes=45&careModality=inPerson&audioDurationSeconds=184
Content-Type: audio/wav
Idempotency-Key: web-upload-...
```

El endpoint responde `202` con el borrador y el estado público del job. El cliente consulta `GET /api/audio-drafts/:id` hasta que el borrador queda revisable o falla. El límite predeterminado es 25 MB y la retención máxima del archivo es 24 horas; ambos son configurables.

`POST /api/audio-drafts` requiere `Idempotency-Key`. La misma clave y entrada devuelve el mismo borrador; reutilizarla con otro paciente, fecha, fixture o metadato funcional devuelve `409 IDEMPOTENCY_CONFLICT`.

El pipeline persiste:

- referencia opaca al medio y MIME, nunca el binario en SQLite;
- huella de la entrada;
- cantidad de intentos y etapa fallida;
- inicio y fin de procesamiento;
- `rawTranscript` literal y `cleanNote` por separado.

Estados implementados:

```text
received → transcribing → structuring → ready → confirmed
                    ↘ failed ↗
```

- Un fallo de transcripción reintenta desde `transcribing`.
- Un fallo de limpieza conserva `rawTranscript` y reintenta solamente `structuring`.
- Un borrador `received` o un claim vencido puede recuperarse después de reiniciar.
- El lease de procesamiento usa `AUDIO_PROCESSING_LEASE_MS`, cinco minutos por defecto.
- `rawTranscript`, tipo y duración de audio no son editables mediante los endpoints de revisión ni después de confirmar.
- `cleanNote` sí se edita antes o después de confirmar.
- Confirmar y cancelar usan transiciones condicionadas para que un resultado no sobrescriba al otro.
- El worker renueva el lease mientras espera un proveedor asíncrono y aborta si pierde ownership o recibe shutdown.
- Toda persistencia del resultado exige el fencing token vigente; una respuesta tardía no puede escribir.

La configuración predeterminada es `AUDIO_TRANSCRIBER=fake` y `NOTE_CLEANER=fake`. `AUDIO_TRANSCRIBER=gemini` selecciona el adaptador real únicamente para uploads y exige `GEMINI_API_KEY`; los fixtures siempre usan fake. La transcripción se conserva en `rawTranscript` y la limpieza continúa separada. Todavía no existen grabación web ni descarga desde Meta.

El adaptador Gemini acepta WAV, MP3/MPEG, AAC, OGG y MP4/M4A. WebM sigue siendo válido para el almacenamiento neutral, pero Gemini lo rechaza hasta agregar normalización de formato. La falla queda persistida; el audio debe convertirse y cargarse nuevamente antes de reintentar con Gemini.

## Vinculación web–WhatsApp implementada

La web autenticada administra el vínculo mediante:

```text
GET    /api/whatsapp/link
POST   /api/whatsapp/link
DELETE /api/whatsapp/link
```

`POST` recibe `phoneNumber`, genera un código de seis dígitos válido durante diez minutos y deja el vínculo en `pending`. `GET` permite recuperar el mismo pendiente durante su vigencia. El teléfono simulado envía `VINCULAR 482913` al mismo endpoint de entrada. Un código válido cambia el estado a `linked`; el mismo evento repetido devuelve la respuesta original incluso después de regenerar o desvincular.

Estados: `unlinked | pending | linked | expired`.

El adaptador funcional local recibe texto en `POST /api/dev/whatsapp/inbound`. No recibe JWT, `userId` ni `selectedPatientId`: resuelve la cuenta exclusivamente desde `from`, y el paciente exclusivamente desde la conversación persistida. Un `messageId` repetido devuelve la respuesta guardada y no vuelve a avanzar el estado.

```json
{
  "messageId": "fake-message-001",
  "from": "+5491122334455",
  "message": {
    "type": "text",
    "text": "MENÚ"
  }
}
```

## Conversación de texto implementada

```text
menu
→ choosingPatient
→ awaitingNote
→ awaitingConfirmation
→ menu
```

Comandos: `MENÚ`, `NUEVA NOTA`, `BUSCAR <nombre>`, `PACIENTE <id>`, texto libre, `GUARDAR` y `CANCELAR`.

En `awaitingNote` también se acepta un evento sintético de audio. Si falla, la conversación conserva el borrador y acepta `REINTENTAR` o `CANCELAR`. Cuando queda listo, la respuesta muestra la nota preparada antes de `GUARDAR`.

- Solamente se listan pacientes activos de la cuenta vinculada.
- El texto libre crea un `SessionDraft` y cero sesiones.
- `MENÚ` no descarta un borrador pendiente.
- `GUARDAR` usa `confirmDraft`; `CANCELAR` usa `cancelDraft`.
- La conversación y la respuesta de cada evento se guardan en SQLite dentro de la misma transacción.
- El mismo `messageId` con otro teléfono o contenido devuelve `409 MESSAGE_ID_CONFLICT`.
- Desvincular elimina el estado conversacional, pero conserva el ledger de eventos.

Los endpoints históricos que escribían sesiones directamente desde WhatsApp devuelven `410`. Meta deberá reemplazar al adaptador falso sin modificar los servicios de vínculo o borradores.

## Compatibilidad temporal de entrada

Durante un hito, el servidor puede aceptar estos aliases, pero siempre responde con el contrato canónico:

- `pacienteId -> patientId`
- `fecha -> clinicalDate`
- `tipo -> sessionType`
- `duracion -> durationMinutes`
- `notas | notes | summary -> cleanNote`
- `medication_notes -> medicationNotes`
- `mood_assessment -> moodAssessment`
- `requires_followup -> requiresFollowUp`

`consulta`, `grupal`, `familiar` y `pareja` se traducen a `individual`, `group`, `family` y `couple`.

## Gates funcionales

- Registro devuelve una sesión autenticada utilizable inmediatamente.
- Un paciente creado sigue visible después de recargar.
- Una sesión creada sigue visible, con el nombre del paciente, después de recargar.
- Los filtros usan `clinicalDate`, no `createdAt`.
- Un paciente de otro usuario no puede asociarse por error.
- Un mensaje de WhatsApp repetido crea un solo borrador y una doble confirmación crea una sola sesión.
- Un teléfono no vinculado no puede crear borradores.
- Un teléfono vinculado resuelve una sola cuenta y deja de resolverla después de desvincularse.
- Audio sintético desde web y WhatsApp produce el mismo contrato, conserva raw/clean y no crea sesión antes de guardar.
- Una caída deja `received` o un claim recuperable; un retry de limpieza no vuelve a transcribir.
- Los hashes históricos de eventos de texto continúan deduplicando después del cambio que agregó eventos de audio.
