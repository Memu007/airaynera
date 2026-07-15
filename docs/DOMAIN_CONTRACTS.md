# Contratos funcionales del dominio

Estado: decisión activa para el MVP. Seguridad avanzada, cumplimiento y estética quedan fuera de este corte.

## Decisión de producto

La web y WhatsApp deben terminar en el mismo flujo:

1. El profesional autenticado elige un paciente.
2. Envía texto o audio.
3. AIRA crea un borrador editable.
4. El profesional revisa y confirma.
5. Recién entonces aparece una sesión en la ficha del paciente.

El primer corte implementa registro, pacientes y sesiones de texto desde la web. El contrato de borradores ya queda definido para agregar audio y WhatsApp sin volver a diseñar el dominio.

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
  "draftId": null,
  "createdAt": "2026-07-15T00:35:00.000Z",
  "updatedAt": "2026-07-15T00:35:00.000Z",
  "confirmedAt": "2026-07-15T00:35:00.000Z"
}
```

`sessionType`: `individual | group | family | couple | other`.

`careModality`: `inPerson | video | phone | unspecified`.

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

## Vinculación web–WhatsApp implementada

La web autenticada administra el vínculo mediante:

```text
GET    /api/whatsapp/link
POST   /api/whatsapp/link
DELETE /api/whatsapp/link
```

`POST` recibe `phoneNumber`, genera un código de seis dígitos válido durante diez minutos y deja el vínculo en `pending`. `GET` permite recuperar el mismo pendiente durante su vigencia. El teléfono simulado envía `VINCULAR 482913` al mismo endpoint de entrada. Un código válido cambia el estado a `linked`; el mismo evento repetido devuelve la respuesta original incluso después de regenerar o desvincular.

Estados: `unlinked | pending | linked | expired`.

El adaptador funcional local recibe texto en `POST /api/dev/whatsapp/inbound`. No recibe JWT ni `userId`: resuelve la cuenta exclusivamente desde `from` y el vínculo persistido. Mantiene `selectedPatientId` explícito hasta incorporar el menú conversacional. Un `messageId` repetido devuelve el mismo borrador y no crea otra fila.

```json
{
  "messageId": "fake-message-001",
  "from": "+5491122334455",
  "selectedPatientId": "7",
  "clinicalDate": "2026-07-15",
  "message": {
    "type": "text",
    "text": "Se trabajó ansiedad anticipatoria."
  }
}
```

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
