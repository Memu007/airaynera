# Handoff de AIRA

Este es el documento operativo que debe leerse primero al retomar el proyecto.

Última actualización: 2026-07-18.

## Estado actual

- Repositorio de publicación vigente: [`Memu007/airaynera`](https://github.com/Memu007/airaynera), rama `main`.
- Repositorio histórico preservado: `Memu007/Aira.final` (sus PR #1 y #2 no son el destino de los próximos cambios).
- Política de trabajo vigente: partir del último `airaynera/main`, aislar cada hito localmente y publicar el resultado verificado en `main` mientras continúe el prototipo interno.
- Último hito funcional: grabación directa desde web móvil — código en `fec6f67` (`mobile-web recording: capture a note directly and reuse the audio pipeline`) y pruebas/documentación/CI en `66a5c3a` (`test+docs: mobile recording suites (15 deterministic + 18 browser)`), ambos integrados en `main`. Antecede la bandeja de borradores/conflictos fuera del modal con aislamiento por cuenta (`cf5c165` + `1875de1`) y el modelo por intento de edición con reverts, merge de 3 vías, recuperación por pestaña y guardas de formulario sucio.
- Etapa de producto: planificación del MVP terminada; seguridad avanzada y estética están diferidas por decisión de producto.
- Estrategia de producto: `docs/PRODUCT.md` quedó actualizada como fuente de verdad para posicionamiento, mercado, precio, Google Calendar, piloto y la hipótesis futura de seguimiento por WhatsApp. El núcleo continúa siendo documentación post-sesión; no se amplió el MVP a diagnóstico, agenda integral ni monitoreo del paciente.
- Operación de agentes: `AGENTS.md` fija el orden de lectura y los briefs de un solo hito; `docs/ROLES_AND_REVIEW.md` es la fuente normativa de roles y proceso proporcional. Como la PM no programa, dev y lead resuelven los hechos técnicos y sólo le escalan decisiones de producto, costo, prioridad o riesgo en lenguaje común. La protección de `main` sigue inactiva durante el prototipo interno; dev y lead deben activarla y probarla antes del primer piloto externo o si se cumple el gatillo anticipado del protocolo.
- Etapa técnica: la carga real, almacenamiento temporal, job SQLite y worker están aprobados. El pipeline acepta proveedores asíncronos y contiene un adaptador Gemini 3.1 Flash-Lite, desactivado por defecto. Una credencial temporal autenticó el modelo; la primera corrida real detectó y corrigió un shape inválido de `user_input` (integrado desde `536c11c`), y queda pendiente repetir el probe/smoke. El smoke sintético de 40 WAV quedó generado y validado offline. La edición de sesión ahora tiene control de concurrencia real (revisión optimista + modelo por intento en cliente). La batería aprobó **129/129** funcionales más **130/130** de contrato/concurrencia de edición más **15/15** de grabación móvil (`npm test`), y en navegador real **108/108** (sesión) más **30/30** (grabación con micrófono simulado).
- Próximo objetivo: la bandeja fuera del modal (2026-07-18) y la grabación directa desde web móvil (2026-07-18) quedaron cerradas en cuanto a código y pruebas automatizadas; **falta el smoke en iPhone/Android reales** (bloqueo de validación: sin acceso a dispositivos desde este entorno, no se declara soporte móvil completo). Luego: repetir el probe/smoke de Gemini y preparar el corpus humano decisorio; agregar copiar/exportar e instrumentación; pilotear AIRA Notas con cinco psicólogos. Google Calendar se implementa como contexto de solo lectura si el piloto confirma uso. Meta real y seguimiento de medicación quedan detrás de gates separados.

## Dirección del producto acordada

AIRA no procesará sesiones terapéuticas completas en el MVP. El profesional enviará una nota posterior de aproximadamente 2 a 10 minutos o escribirá un texto breve.

El profesional no se reconoce con IA: su número de WhatsApp se vincula explícitamente con la cuenta creada en la web.

El paciente tampoco se deduce del audio: se selecciona explícitamente desde la web o el menú de WhatsApp antes de enviar la nota.

Toda entrada crea primero un borrador. La sesión definitiva se crea solamente después de **Guardar**.

La web es la fuente de verdad y WhatsApp es un canal adicional sobre los mismos datos.

## Dirección estratégica validada el 2026-07-16

- Posicionamiento: **asistente de cierre clínico post-sesión por voz**.
- Promesa: convertir un relato breve del profesional en una nota revisable sin grabar al paciente ni decidir por el profesional.
- Beachhead: psicólogos clínicos independientes de Argentina; psiquiatría queda como segunda cohorte.
- La ventaja no puede ser sólo `audio → nota`: competidores directos ya ofrecen recorridos similares. AIRA debe ganar por flujo móvil breve, español clínico local, revisión obligatoria, integración liviana y precio proporcional al uso.
- Google Calendar está aprobado como capa de contexto, no como agenda propia: sesiones terminadas sin nota, vínculo evento–paciente confirmado y carga precargada. Se profundiza si al menos 3 de 5 pilotos lo usan y mejora la documentación.
- `AIRA Seguimiento` es una hipótesis futura para psiquiatría, no un compromiso de implementación. El valor sería cerrar el circuito entre indicación confirmada, recordatorio discreto y resumen de autoinforme; nunca activar dosis u horarios desde IA.
- Hipótesis local de precio: primeras 10 notas sin cargo; luego `0,05 UP` por nota confirmada con tope de `3 UP` mensuales. Fallos y borradores no confirmados no se cobran. Debe validarse con costos y pago real.
- Gate del primer piloto: 5 psicólogos durante 2 semanas; al menos 60% de sesiones elegibles documentadas, 80% de borradores confirmados en 24 horas, edición mediana menor a 2 minutos, 85% con correcciones menores, cero errores críticos y al menos 3 dispuestos a pagar el precio completo.

El detalle, la evidencia competitiva y los límites están en [`docs/PRODUCT.md`](PRODUCT.md). `DOMAIN_CONTRACTS.md` no cambió porque Calendar y Seguimiento todavía no son contratos implementados.

## Recorrido objetivo

```text
Registro web
→ Crear paciente
→ Vincular WhatsApp
→ Elegir paciente
→ Enviar texto o audio
→ Recibir borrador
→ Guardar / Editar / Regrabar / Cancelar
→ Ver sesión en la ficha web
```

## Hallazgos relevantes del código actual

### Web

- El registro devuelve y guarda un token utilizable inmediatamente.
- La sesión web se restaura después de recargar mediante `/api/auth/verify`.
- Pacientes y sesiones se cargan desde la API y usan respuestas canónicas `camelCase`.
- Crear una sesión desde la web usa el contrato aceptado por el servidor y vuelve a consultar el historial.
- El nombre del paciente se obtiene mediante la relación persistida, no queda vacío.
- Fechas clínicas, timestamps, duración clínica y futura duración de audio están separadas.
- El cambio de estado de paciente dejó de ser local y se persiste mediante la API.
- El formulario de sesión ofrece texto, carga de archivo real o **grabación directa desde el dispositivo** (web móvil), muestra la transcripción simulada como solo lectura y deja la nota limpia editable.
- Grabación directa (2026-07-18): en modo audio hay un bloque `Grabar → Detener → escuchar → Regrabar` que pide el micrófono **sólo al tocar Grabar** (`getUserMedia` con `MediaRecorder`). La grabación se envía por el **mismo** pipeline que un archivo (idempotencia, polling, recuperación); no hay pipeline nuevo ni conversión de formato (WebM/Opus en Android/Chrome, MP4/AAC en iOS/Safari se aceptan tal cual). Paciente y datos clínicos se eligen antes de grabar y quedan fijados mientras exista el audio. El micrófono y el audio temporal se liberan al detener, regrabar, descartar, cerrar o salir. Ante permiso denegado o navegador incompatible se explica el problema y quedan disponibles las alternativas de archivo y texto. Se advierte al cerrar/recargar con una grabación sin enviar. La grabación en curso no se persiste entre recargas (por diseño: no guardamos audio crudo en el navegador); la idempotencia evita duplicados si se reintenta la subida.
- Fecha clínica, tipo, duración clínica y modalidad son controles visibles compartidos por texto y audio; ya no se inventan silenciosamente valores al guardar.
- La evaluación anímica es opcional y `requiresFollowUp` se marca en un checkbox independiente; la interfaz no deriva seguimiento desde el ánimo.
- Mientras existe un borrador de audio, paciente y archivo quedan fijados; la confirmación valida nuevamente la asociación.
- La carga conserva una clave idempotente ante respuesta perdida, sigue el job con polling acotado y permite retomar, reintentar o descartar explícitamente sin crear una sesión prematuramente.
- Cerrar el modal conserva el borrador de audio en la sesión web; cambiar a texto o descartarlo requiere confirmación.
- El selector de nuevas notas muestra solamente pacientes activos y el backend aplica la misma regla.
- La landing distingue funciones disponibles, simuladas y en desarrollo; registro ya no atraviesa un pago ficticio y las operaciones de perfil sin persistencia están desactivadas.
- Las notas sin evaluación anímica muestran `Sin registrar` en lugar de valores indefinidos.
- Una sesión guardada se edita desde su ficha: la modal de detalle ofrece **Editar**, precarga los campos clínicos explícitos y persiste con `PATCH /api/sessions/:id`; `rawTranscript`, `inputType` y `audioDurationSeconds` permanecen inmutables porque el formulario no los envía y el normalizador del servidor los ignora en PATCH.
- El `PATCH /api/sessions/:id` valida el mismo contrato que el POST: fecha `YYYY-MM-DD`, tipos y modalidades permitidos, duración entera de 1 a 480, ánimo 1–5 o nulo, booleano real para seguimiento y límites de texto; un cuerpo fuera de contrato devuelve `400` y no persiste.
- Vaciar la medicación persiste `NULL` y desaparece de la ficha; `updateSession` distingue "campo ausente" de "vaciado explícito".
- El formulario de edición usa submit y validación consistente: rechaza duración decimal o exponencial (no la trunca), exige fecha no vacía en lugar de conservar la anterior y valida en el mismo handler.
- Concurrencia de edición con garantía real, modelada por intento: las sesiones tienen `revision`; `PATCH /api/sessions/:id` **exige** `If-Match` (falta → `428`, malformada o no entera segura → `400`), actualiza condicionalmente y devuelve `409` con la sesión vigente; un cuerpo vacío/ignorado da `400 EMPTY_PATCH` sin tocar `revision`. En el cliente cada guardado es un intento `{seq, desired, base, appliedBase, wireDelta, revision}`: se envía sólo el delta contra la última base aplicada (que se **resetea en cada éxito**, así una v2 que **revierte** un campo lo compara contra v1 y el revert se envía), y un delta vacío es no-op. Sólo el intento más nuevo sobrevive; ni tras agotar reintentos de una respuesta perdida un payload viejo gana (al rendirse, la versión completa se guarda por pestaña en `localStorage`). El formulario **no se cierra hasta confirmar**. Ante `409` se muestra un panel **campo por campo** (los ocho campos) que se **persiste** (reabrir la ficha o recargar lo re-muestra); **Reintentar** y **Editar mi versión** hacen un **merge de 3 vías** contra la base original del conflicto (no pisan un campo que tocó otro cliente); `state.conflict`/localStorage no se limpian hasta éxito o **Usar la del servidor**, y un `400/500/red/segundo 409` re-muestra los ocho campos con acciones habilitadas. La respuesta perdida se reconcilia comparando el servidor contra el estado completo esperado (`appliedBase + wireDelta`). Se advierte al recargar/cerrar (X o backdrop) con formulario modificado —incluso inválido— o conflicto pendiente.
- Guardar una edición conserva los filtros de paciente y fecha; las tarjetas de sesión abren con Enter y Espacio; el nombre del paciente se muestra como texto, nunca interpolado como HTML en el formulario.
- Bandeja de borradores y conflictos **fuera del modal**: el panel `Trabajo sin confirmar` en el dashboard lista las sesiones con un borrador sin confirmar (guardado perdido/agotado) o un conflicto de edición pendiente, leyendo los mismos registros por pestaña de `localStorage` que usa la ficha. Cada entrada abre la ficha en su vista de conflicto o de recuperación; la bandeja persiste tras recargar, se actualiza al crear o resolver un ítem (guardado, `Usar la del servidor`, descartar, agotar reintentos) y se oculta cuando no hay trabajo pendiente. Un borrador cuyo guardado sigue en vuelo en esta pestaña no se muestra (no está atascado). Nombres y notas se renderizan como texto, nunca como HTML. Un borrador en conflicto se representa una sola vez (gana la fila de conflicto).
- Aislamiento por cuenta y sincronización de la bandeja (2026-07-18): las claves locales incluyen la cuenta autenticada (`aira:conflict:<cuenta>:<id>:<tab>` y `aira:pending:<cuenta>:<id>:<tab>`, con `<cuenta>` = `sub` del JWT), así el trabajo sin confirmar de un profesional **nunca** se lee bajo otra cuenta en la misma pestaña; al cerrar sesión se limpia el estado en memoria y la bandeja. Un registro cuya sesión fue borrada o es inaccesible no genera una tarjeta muerta: aparece como `Sesión no disponible` **sólo** con acción de descartar (no abre ficha). Tras un reintento exitoso de recuperación, la entrada y la bandeja desaparecen de inmediato sin recargar.

### WhatsApp

- Los endpoints `GET/POST/DELETE /api/whatsapp/link` administran el vínculo desde la cuenta web autenticada.
- `db/migrations/003_whatsapp_links.sql` persiste teléfono, estado, código de seis dígitos y vencimiento; `whatsapp_link_events` conserva la deduplicación aunque el vínculo se regenere o elimine.
- El código vence en diez minutos; regenerar invalida el anterior y repetir el mismo evento de vinculación es idempotente.
- El flujo funcional está en `POST /api/dev/whatsapp/inbound`: no acepta JWT ni `userId`; resuelve la cuenta exclusivamente desde `from`.
- El evento tampoco acepta `selectedPatientId`; la conversación exige `PACIENTE <id>` y persiste la selección.
- `db/migrations/004_whatsapp_conversations.sql` agrega el estado y un ledger de respuestas para todos los mensajes.
- Están implementados `MENÚ`, `NUEVA NOTA`, `BUSCAR`, selección de paciente, texto/audio sintético, `REINTENTAR`, `GUARDAR` y `CANCELAR`.
- La conversación sobrevive reinicios del proceso; `MENÚ` no descarta un borrador pendiente.
- El adaptador crea solamente `SessionDraft`; confirma mediante el mismo endpoint canónico que la web.
- Un `messageId` repetido devuelve el mismo borrador y no crea otra fila.
- Desvincular corta la resolución de identidad y libera el teléfono.
- Un pendiente puede retomarse después de recargar la web; un pendiente vencido libera el número incluso si su propietario abandonó el flujo.
- El deploy de prueba declara `WHATSAPP_ADAPTER=fake`; debe reemplazarse por Meta antes de producción real.
- Un audio fallido queda asociado a la conversación y puede reintentarse por etapa o cancelarse.
- La respuesta de audio listo muestra la nota preparada antes de guardar.
- No existe todavía un webhook real de Meta, envío real de respuestas ni descarga de audio. Gemini está implementado para uploads web y sigue desactivado por defecto; el primer smoke real falló por contrato y ya fue corregido para repetirlo.
- Los endpoints heredados que escribían directamente en `sessions` ahora devuelven `410`.
- El reconocimiento y envío n8n restantes siguen siendo prototipos y no forman parte del vertical nuevo.

### Código archivado

- `_archive/` contiene workflows de n8n, clientes parciales de Meta, un bot anterior y un grabador web.
- Sirven como referencia, pero contienen URLs, contratos y endpoints que no coinciden con la aplicación activa.
- No deben restaurarse completos sin revisión.

### Audio

- `db/migrations/005_audio_pipeline.sql` agrega referencia al medio, huella, intentos, etapa fallida y timestamps de procesamiento a `session_drafts`.
- `db/migrations/006_audio_processing_jobs.sql` agrega metadata del archivo temporal y la cola durable `audio_processing_jobs`.
- `services/audioDraftPipeline.js` es el punto común para web y WhatsApp.
- `services/audio/audioProviders.js` selecciona proveedores sin acoplar el pipeline; fixtures siempre fuerzan fake.
- `services/audio/fakeAudioProviders.js` contiene fixtures artificiales y limpieza conservadora; no contiene audios ni datos clínicos.
- `services/audio/geminiAudioTranscriber.js` implementa Files API + Interactions API v1, salida estructurada, `store:false`, espera `ACTIVE`, cleanup remoto y cancelación por lease/shutdown.
- `services/audio/temporaryAudioStore.js` recibe un stream binario, valida tamaño, firma y MIME, escribe primero un archivo parcial y entrega una referencia opaca `upload://...`.
- `POST /api/audio-drafts/upload` responde sin esperar la transcripción; el límite predeterminado es 25 MB y la retención máxima es 24 horas.
- `workers/audio-worker.js` reclama jobs con lease y fencing token, recupera trabajo abandonado, ejecuta el pipeline asíncrono, aborta el proveedor al perder el lease o apagar y limpia el archivo después de persistir la transcripción o alcanzar un estado terminal.
- El barrido de expiración sólo cancela el job y elimina el medio si logró marcar atómicamente el borrador vencido; si otra instancia ya persistió la transcripción, el trabajo continúa.
- `npm start` supervisa servidor y worker; `npm run dev` usa el mismo supervisor con autoreload. En Render, base y archivos temporales comparten el disco persistente montado en `/app/data`.
- El supervisor carga `.env` antes de crear ambos procesos; el worker standalone y el smoke también lo cargan.
- Estados: `received → transcribing → structuring → ready/failed`; confirmar y cancelar siguen usando el servicio canónico.
- Un retry de estructuración conserva la transcripción y no vuelve a transcribir.
- `received`, jobs fallidos y leases vencidos son recuperables después de reiniciar; un worker con token obsoleto no puede sobrescribir al reemplazo.
- La fecha clínica por defecto usa `APP_TIME_ZONE=America/Argentina/Buenos_Aires`.
- `rawTranscript`, `inputType` y `audioDurationSeconds` son inmutables en la revisión y después de confirmar.
- La integración Gemini, el smoke sintético y el benchmark humano pendiente están separados en `docs/AUDIO_PROVIDER_BENCHMARK.md`; ningún proveedor está aprobado todavía para audio clínico.
- `npm run corpus:audio:generate` produce 40 WAV TTS y un manifiesto con hashes fuera de Git; `npm run smoke:gemini` valida o ejecuta el recorrido integrado con reporte obligatorio.
- `npm run benchmark:audio-worker` genera 40 WAV deterministas de 2 a 10 minutos y atraviesa HTTP, almacenamiento temporal, job SQLite, worker y cleanup sin conservar los archivos.
- El resultado operativo está en `docs/AUDIO_WORKER_BENCHMARK.md`: tres corridas independientes, 120/120 listos, cero fallos, cero sesiones prematuras y cero residuos. No mide WER ni calidad clínica porque el fake no interpreta los bytes.

### Pruebas y CI

- Las dependencias quedaron instaladas con `npm ci`.
- `npm test` ahora levanta un servidor y una base SQLite temporales, ejecuta las pruebas y limpia el entorno al terminar.
- La batería integral actual aprobó 129/129 pruebas funcionales más 130/130 de edición de sesión (`scripts/session-edit-tests.js`), incluida en `npm test`; el total sale con código 0.
- `scripts/session-edit-tests.js` cubre edición completa con persistencia tras recarga, borrado de medicación a `NULL`, la matriz adversaria completa aplicada por caso a **POST y PATCH** (valores fuera de rango, tipos equivocados, arrays y objetos, más casos inválidos de `inputType`/`rawTranscript`/`audioDurationSeconds`) devolviendo `400` sin crear ni modificar ningún campo —incluida medicación—, `patientId` objeto que da `400` y no `500`, inmutabilidad de la evidencia de audio, y la concurrencia: revisión inicial 1, `If-Match` correcto incrementa, obsoleto da `409` sin persistir, ausente da `428` sin cambios, malformado da `400`, y cuerpo vacío/ignorado da `400` sin tocar `revision`.
- `scripts/session-edit-browser-tests.js` (Chromium por `playwright-core`, fuera de `npm test`) aprobó **108/108**: además de edición, filtros, teclado, render literal y los casos previos de concurrencia, cubre los casos de aceptación de la auditoría: v1 cambia A / v2 revierte A / tercero cambia B → `409` + retry deja el revert de v2 y la B del tercero; **Editar mi versión** no pisa el campo remoto; **cinco** PATCH abortados contados + recarga + recuperación de la versión completa; conflicto → retry → respuesta perdida; conflicto → retry → segundo `409` (re-muestra ocho campos, acciones habilitadas); cerrar un formulario sucio **inválido** pide confirmación; dos pestañas con recuperaciones distintas que no se borran entre sí; y Cancelar durante una solicitud en curso sin estado inconsistente. La sección 5s cubre la bandeja fuera del modal (oculta sin pendientes, aparece tras un guardado agotado, sobrevive a la recarga, abre recuperación/conflicto al clickear, texto como texto, se limpia al descartar/resolver). Las secciones 5t/5u/5v agregan: registro huérfano de sesión borrada → tarjeta `Sesión no disponible` sólo descartable que no abre ficha; reintento exitoso de recuperación que quita la entrada y la bandeja sin recargar; y aislamiento por cuenta (A deja una nota pendiente → cierra sesión → B ingresa en la misma pestaña → B no ve texto ni entradas de A, y el registro de A sigue en almacenamiento, sólo fuera de alcance). El runner resuelve el navegador por `PLAYWRIGHT_CHROMIUM_PATH`/`CHROMIUM_PATH`, instalación del sistema o canal `chrome`, sirve los assets CDN desde `vendor/` y corre en CI (ubuntu).
- `scripts/mobile-recording-tests.js` (en `npm test`) aprobó **15/15**: prueba que el audio de un `MediaRecorder` —WebM/Opus de Android/Chrome y MP4/AAC de iOS/Safari— es aceptado por el pipeline existente **sin conversión**, que un tipo declarado que no coincide, un contenedor desconocido y un archivo sobre el límite se rechazan, que una grabación WebM llega a `ready` con el transcriptor `fake` y su audio temporal se borra, que una subida duplicada no crea un segundo borrador, y que confirmar persiste exactamente una sesión.
- `scripts/mobile-recording-browser-tests.js` (Chromium con micrófono simulado `--use-fake-device-for-media-stream`, fuera de `npm test`) aprobó **30/30**: grabar → detener → escuchar → usar → nota `fake` → editar → confirmar → persistir tras recargar; el micrófono se libera al detener; permiso denegado no crea borrador/sesión y conserva archivo y texto; regrabar descarta la toma previa y vuelve a liberar el micrófono; el botón de preparar se deshabilita durante la subida; una respuesta de subida perdida + reintento no duplica la sesión; cerrar con una grabación sin enviar pide confirmación; **tras una subida fallida el paciente y los datos clínicos siguen bloqueados** y el reintento conserva el mismo paciente; un **doble toque** durante una adquisición lenta del micrófono adquiere una sola vez; una **adquisición invalidada** (cambio a texto) detiene el stream que llega tarde; y **cerrar sesión** apaga el recorder/micrófono, libera el audio local y no crea sesión. El runner espera realmente la salida de servidor y worker (con `SIGKILL` acotado de respaldo) y sale con código 0. Ambos corren en CI (ubuntu, Chrome del runner).
- `scripts/ui-contract-tests.js` verifica los campos clínicos explícitos y que seguimiento no se derive del ánimo.
- La suite del worker cubre límite streamed, expiración integral, carrera después del snapshot y recuperación desde un segundo proceso real.
- `scripts/gemini-provider-tests.js` cubre contrato HTTP sin red, estado `ACTIVE`, JSON estructurado, retries seguros, abort, shutdown, heartbeat y fencing contra un resultado asíncrono obsoleto.
- `scripts/runtime-supervisor-smoke.js` levanta el proceso de producción, verifica health, carga real, procesamiento hasta `ready` y apagado limpio.
- El benchmark de volumen procesó 103,5 MB y 226 minutos representados por corrida con concurrencia cinco; el peor acuse fue 365 ms y el peor p95 extremo a extremo fue 1719,4 ms.
- La CI ejecuta la batería integral, el supervisor real, sintaxis de Node/scripts embebidos y el contrato UI.
- En el hito anterior la prueba funcional se repitió tres veces con polling del worker cada 10 ms; las tres corridas terminaron 126/126 y cubrieron 20 entradas de WhatsApp concurrentes.
- La suite específica cubre deduplicación binaria, conflicto de clave, MIME inválido, cancelación atómica, lease abandonado, fencing contra escritura obsoleta, fallo inesperado del worker, retry y limpieza del archivo.
- Crear una sesión para un paciente inexistente ahora devuelve `404` en lugar de `500`.
- Cinco workflows que referenciaban archivos o comandos inexistentes fueron movidos a `_archive/github-workflows/`.
- `.github/workflows/ci.yml` es la verificación funcional canónica para el MVP.
- SQLite ahora aplica migraciones versionadas desde `db/migrations/`.
- La migración `003_whatsapp_links.sql` fue probada sobre base nueva, base heredada y segunda ejecución vacía.
- Las migraciones `004_whatsapp_conversations.sql`, `005_audio_pipeline.sql` y `006_audio_processing_jobs.sql`, la reapertura conversacional y la recuperación de audio desde otro proceso están probadas.
- La migración inicial es idempotente y fue probada contra una base nueva y una base con datos existentes.
- `TESTING-REPORT.md` refleja una ejecución de noviembre de 2025 y no debe interpretarse como una validación del código actual.

Estado remoto histórico del PR técnico #2 en `Memu007/Aira.final`:

- `Functional baseline`: aprobado.
- `semgrep`: aprobado.
- El primer `audit` falló por dependencias heredadas; informaba 30 vulnerabilidades, incluyendo 14 altas y 1 crítica.
- El primer `trufflehog` falló por configuración, no por un secreto detectado: el workflow repetía el argumento `--fail`.
- La corrección fue aplicada: se eliminaron diez dependencias sin uso, se regeneró el lockfile sin `--force` y se quitó el argumento duplicado.
- Verificación posterior local: 174 paquetes auditados, 0 vulnerabilidades, 30/30 pruebas y build aprobado.
- Verificación posterior remota: `Functional baseline`, `audit`, `semgrep` y `trufflehog` aprobados sobre `e2e6b93`.
- Implementación del vertical web: `f193163` (`make web core persistent`).
- Verificación remota del vertical web: `Functional baseline`, `audit`, `semgrep` y `trufflehog` aprobados.
- Implementación de borradores: `e9085b8` (`route notes through session drafts`).
- Verificación remota de borradores: `Functional baseline`, `audit`, `semgrep` y `trufflehog` aprobados.
- Implementación de vinculación: `db0d36d` (`link web accounts to whatsapp phones`).
- Verificación remota de vinculación: `Functional baseline`, `audit`, `semgrep` y `trufflehog` aprobados.
- Implementación del menú persistente: `7366868` (`add persistent whatsapp text menu`).
- Verificación remota del menú: `Functional baseline`, `audit`, `semgrep` y `trufflehog` aprobados.
- El hito de audio (`4cc5a13`, `00af12f`) se verificó luego con 115/115 pruebas y se publicó en `main` de [`Memu007/airaynera`](https://github.com/Memu007/airaynera).
- El PR técnico #2 permanece como historial del repositorio anterior; no representa el estado de publicación actual.

## Decisiones técnicas vigentes

- Mantener Express y SQLite para el MVP.
- No reescribir el frontend completo antes de validar el producto.
- Extraer gradualmente rutas y servicios nuevos.
- Mantener identidad, conversaciones, borradores, confirmación y deduplicación dentro de AIRA.
- No usar n8n como fuente de verdad.
- Implementar proveedores intercambiables para transcripción y estructuración.
- Mantener el proveedor falso hasta medir proveedores reales con el mismo corpus.
- Conservar transcripción literal y nota limpia por separado.
- Los fixtures heredados continúan síncronos; los archivos reales ya crean un job SQLite y se procesan fuera de la solicitud, aun usando el proveedor falso.
- Los contratos vigentes están en `docs/DOMAIN_CONTRACTS.md`.
- Los identificadores JSON son strings y las respuestas nuevas usan solamente `camelCase`.
- `clinicalDate` es el día clínico; `createdAt` es el momento de persistencia.
- `durationMinutes` y `audioDurationSeconds` nunca representan lo mismo.

### Decisión multiagente: contratos del dominio

El 2026-07-14 se compararon tres propuestas independientes. Se eligió la propuesta B porque mantuvo IDs consistentes, separó explícitamente fecha clínica de creación y duración clínica de duración de audio, y llevó web y WhatsApp al mismo modelo de borrador confirmable.

Para reducir riesgo, la implementación se dividió en dos cortes: primero el vertical web persistente; después `SessionDraft` y WhatsApp. SQLite conserva columnas históricas detrás de adaptadores y la API responde en formato canónico.

### Decisión multiagente: vinculación web–WhatsApp

El 2026-07-14 se compararon tres propuestas independientes. Se eligió un híbrido: el modelo persistente y la interfaz funcional de la propuesta mínima, junto con la regla de identidad y deduplicación de la propuesta conversacional.

Este bloque implementa vínculo, expiración, consumo desde teléfono y notas identificadas por número. El estado conversacional y el menú se dejaron para el siguiente bloque para poder aislar primero la identidad. El evento entrante nunca acepta `userId`; la web obtiene identidad del JWT y WhatsApp del teléfono vinculado.

### Decisión multiagente: menú conversacional

El 2026-07-14 se compararon tres propuestas de máquina de estados. Se eligió el dispatcher transaccional con ledger inmutable, sumando la regla de no descartar silenciosamente un borrador cuando llega `MENÚ`.

La transición, el efecto sobre `SessionDraft`, la conversación y la respuesta deduplicable se escriben en una transacción SQLite. El paciente nunca llega por un campo lateral ni se deduce de la nota.

### Decisión multiagente: audio

El 2026-07-14 se compararon tres propuestas. Se eligió el corte más liviano: reutilizar `SessionDraft`, procesar proveedores falsos de forma síncrona y persistir etapas/retries sin crear una cola separada antes de medir volumen.

La revisión competitiva posterior encontró huecos que no cubría el happy path. Se corrigieron: paciente web fijado al borrador, recuperación de `received` y claims vencidos, hash compatible con eventos de texto anteriores, fecha clínica en zona de Argentina, retry/cancel de audio fallido por WhatsApp, metadata de audio inmutable y confirmación/cancelación con compare-and-set.

Los tres agentes auditaron una segunda vez el diff corregido y declararon que no quedan bloqueantes para el corte sintético. El lease multiinstancia y el worker fuera del webhook se evalúan al incorporar red real.

La decisión de proveedor se difiere al benchmark. Con precios revisados el 2026-07-14, Groq Turbo es la baseline publicada más barata; Gemini y OpenAI se mantienen como challengers de simplicidad/calidad.

### Decisión multiagente: archivo real y worker

El 2026-07-15 se compararon tres propuestas independientes. Se eligió una entrada binaria de un solo archivo porque evita reincorporar un parser multipart antes de necesitar formularios complejos. El medio se almacena fuera de SQLite con referencia opaca; borrador y job se crean en una única transacción.

Dos rondas competitivas encontraron y corrigieron fallos que no aparecían siempre en el happy path: persistencia de SQLite en Render, cancelación y cleanup atómicos, error terminal del worker, fencing obsoleto, recuperación de respuesta perdida, retry con polling, arranque del supervisor y contención `SQLITE_BUSY`. Después de las correcciones, los tres revisores declararon el corte publicable.

El worker usa SQLite deliberadamente para este volumen del MVP. No se incorpora Redis. Gemini ya está detrás de la interfaz, pero `fake` sigue siendo el valor predeterminado hasta ejecutar el smoke real y el benchmark humano.

### Decisión multiagente: primer proveedor Gemini

El 2026-07-15 tres agentes compararon API, arquitectura del worker y diseño de corpus. Se eligió Gemini 3.1 Flash-Lite como primer adaptador por disponibilidad de Free Tier para datos artificiales, usando REST nativo, Files API e Interactions API v1 con `store:false`. Los fixtures siguen síncronos y el archivo real usa exclusivamente el worker asíncrono.

Tres rondas competitivas detectaron y corrigieron: polling del archivo hasta `ACTIVE`, POST no idempotentes reintentados a ciegas, backoff que sobrevivía al shutdown, cleanup remoto, abort de `SIGTERM`, fencing de resultados tardíos, reporte sin hash exacto y un scorer que podía aceptar una contradicción. La revisión final no dejó bloqueantes de código.

El corpus TTS quedó clasificado explícitamente como smoke de integración: diez textos por cuatro variantes, corto y con voces `es-MX/es-ES`. No reemplaza el corpus humano ni aprueba calidad clínica. El Free Tier sólo debe recibir datos artificiales.

### Decisión multiagente: dependencias y CI

El 2026-07-14 se compararon tres propuestas independientes:

- actualizar solamente el lockfile y conservar dependencias inactivas;
- retirar dependencias inactivas y aplicar correcciones compatibles;
- retirar dependencias inactivas, validar en copia aislada y mantener gates de CI.

Se eligió retirar las dependencias inactivas. Firestore, Gemini SDK, Axios, Celebrate, Joi, Mongoose, Multer, node-fetch, Socket.IO y Winston no tenían importaciones en el código activo. Podrán reincorporarse en versiones actuales cuando exista un uso real.

La alternativa de lockfile únicamente fue descartada porque mantenía casi la mitad del árbol sin aportar funcionalidad al MVP.

## Próximo bloque de trabajo

Base prevista: último `airaynera/main`, en una rama local aislada para el hito.

### Etapa 0

- [x] Instalar dependencias con `npm ci`.
- [x] Ejecutar el servidor con una base temporal.
- [x] Registrar los resultados de la línea base: 30/30.
- [x] Estandarizar Node.js 20.
- [x] Consolidar una única CI funcional confiable.
- [x] Dejar los cuatro checks remotos del PR en verde.
- [x] Introducir migraciones versionadas.
- [x] Definir contratos canónicos de paciente, sesión y borrador.
- [x] Crear un doble de prueba de WhatsApp para texto.
- [x] Vincular explícitamente una cuenta web con un teléfono en el doble de WhatsApp.
- [x] Completar el menú de texto y la confirmación/cancelación desde el doble de WhatsApp.
- [x] Crear el doble de transcripción y limpieza para audio.
- [x] Conectar audio sintético por web y WhatsApp.
- [x] Persistir etapas, reintentos y recuperación tras reinicio.
- [x] Aceptar un archivo real desde la web y almacenarlo temporalmente.
- [x] Ejecutar el benchmark operativo del worker con 40 WAV controlados.
- [x] Habilitar proveedores asíncronos y agregar el adaptador Gemini detrás del worker.
- [x] Generar y validar offline el smoke sintético de 40 WAV.
- [ ] Ejecutar el smoke real Gemini con clave local y conservar el reporte.
- [ ] Ejecutar el benchmark Groq/Gemini/OpenAI.
- [x] Separar el procesamiento de archivos reales en un worker SQLite antes de conectar un proveedor o WhatsApp real.

### Etapa 1

- [x] Corregir el recorrido de registro y autenticación.
- [x] Corregir creación y carga de pacientes.
- [x] Corregir creación, carga y detalle de sesiones.
- [x] Incorporar edición visible de sesiones (con contrato estricto y concurrencia optimista: `revision`, `If-Match`, `428`/`409`, UI de conflicto y recuperación).
- [x] Hacer persistentes los datos después de recargar.
- [x] Corregir filtros e indicadores principales del dashboard.
- [x] Incorporar el servicio y API inicial de borrador.
- [x] Preparar la tabla y restricciones del modelo de borrador.
- [x] Agregar pruebas automatizadas y una prueba visible del recorrido web completo.

## Criterio para cerrar el próximo bloque

> Un usuario nuevo se registra, crea un paciente, registra una sesión y continúa viéndola correctamente después de recargar la web.

Cumplido localmente el 2026-07-14. La prueba visible terminó con 1 paciente y 1 sesión antes y después de recargar, sin errores de consola.

El 2026-07-14 se repitió el criterio con el formulario conectado a `POST /api/session-drafts` seguido de confirmación: después de recargar continuaron exactamente 1 paciente y 1 sesión, sin errores ni duplicados.

El 2026-07-14 se aprobó además el corte de vinculación: login → generar código → recargar con el vínculo pendiente → recuperar el mismo comando → consumir `VINCULAR` desde el teléfono simulado → mostrar vínculo. El número persistió y quedó visible de forma parcial. La batería subió a 78/78.

El 2026-07-14 se aprobó el menú completo: crear paciente → vincular → `MENÚ` → `PACIENTE <id>` → nota → `MENÚ` conserva borrador → `GUARDAR` → recarga. Quedaron exactamente 1 paciente y 1 sesión con la nota correcta. La batería subió a 91/91 y una prueba separada continuó la conversación después de reiniciar el proceso.

El 2026-07-14 se aprobó visualmente el audio sintético: crear paciente → preparar audio con pausas → revisar raw/clean → guardar web → recargar → vincular WhatsApp → seleccionar paciente → enviar audio → guardar → recargar. Quedaron 1 paciente y 2 sesiones persistidas. La nota de WhatsApp sin estado anímico mostró `Sin registrar` y la consola del navegador no tuvo errores.

El 2026-07-15 se cerró el corte de archivo real: carga binaria → almacenamiento temporal → job durable → worker separado → transcripción simulada → revisión → confirmación. La prueba funcional verificó que la solicitud responde en cola, el worker prepara el mismo borrador y la sesión definitiva sólo aparece al confirmar. También se verificaron reinicio, retry, cancelación, deduplicación, aislamiento y cleanup.

## Dependencias que necesitaremos más adelante

### Meta / WhatsApp

- App de Meta.
- WhatsApp Business Account.
- Número de prueba o producción.
- Token de acceso.
- `phone_number_id`.
- URL HTTPS pública de staging.
- Token de verificación.

No bloquean la Etapa 0 o 1.

### Audio real

- Credencial del primer proveedor de transcripción.
- Audios de prueba creados o anonimizados.

No bloquean el vertical con archivo real y transcripción simulada ya aprobado.

## Historial y estado de publicación

- Destino vigente: [`Memu007/airaynera`](https://github.com/Memu007/airaynera), `main`. Publicación inicial 2026-07-15; último hito funcional aceptado en `fec6f67` (código de grabación móvil) y `66a5c3a` (pruebas/documentación/CI), ambos integrados. Cambios documentales posteriores pueden avanzar el `HEAD` sin cambiar ese hito.
- Verificación del hito actual: `npm test` con 129/129 funcionales + 130/130 de edición, navegador real 108/108, build, contrato UI, sintaxis embebida y `git diff --check` aprobados.
- Implementación de la auditoría: `4a0a082` (backend/worker), `e533eb9` (flujo web) y `f1472c4` (operación/contratos).
- Benchmark operativo del worker: `6ebe43b` (`benchmark controlled audio worker throughput`).
- Corrección de confiabilidad posterior a la auditoría: `4a0a082` (`harden audio expiry and inactive patient flow`).
- Corrección de integridad y UX web: `e533eb9` (`make clinical web flow explicit and recoverable`).
- El remoto local `origin` continúa apuntando a `Memu007/Aira.final` para conservar el historial; el remoto `airaynera` es el destino activo de publicación.
- Los archivos documentales se prepararon y validaron localmente.
- GitHub CLI (`gh`) está instalado, pero la gestión de PR puede requerir reautenticación; la publicación vigente se realizó con las credenciales de Git configuradas localmente.
- Se creó la rama `agent/document-product-roadmap` para publicar estos cambios sin modificar directamente `main`.
- Commit documental: `221522e` (`document product roadmap and handoff`).
- Rama publicada: `origin/agent/document-product-roadmap`.
- PR documental en borrador: [#1 — Document product roadmap and living handoff](https://github.com/Memu007/Aira.final/pull/1).
- La implementación continúa en `agent/01-web-core`, creada desde el commit documental `db9089c`.
- Primer commit técnico: `26d48e2` (`establish reproducible functional baseline`).
- PR técnico en borrador: [#2 — Establish reproducible web-core baseline](https://github.com/Memu007/Aira.final/pull/2).

## Cómo retomar

1. Leer este archivo.
2. Revisar `git status -sb` y `git diff`.
3. Confirmar que solamente estén los cambios documentales esperados.
4. Confirmar que `airaynera/main` tenga el último commit publicado.
5. Crear o actualizar una rama local aislada desde el último `airaynera/main`.
6. Ejecutar `npm test`, `npm run test:session-edit:browser`, `npm run test:mobile-recording:browser`, `npm run test:runtime-supervisor`, `npm run build` y `npm run lint` antes de cada publicación; la batería actual aprueba 129/129 + 130/130 + 15/15 y en navegador 108/108 + 30/30.
7. Confirmar `npm run build`, sintaxis del JavaScript embebido y `git diff --check`.
8. Publicar el siguiente hito verificado en `airaynera/main` y registrar el resultado aquí y en `docs/WORKLOG.md`.
9. Generar el corpus sintético fijo, configurar `GEMINI_API_KEY` fuera de Git y ejecutar `npm run smoke:gemini` con reporte obligatorio.
10. Preparar 30 a 50 recortes humanos creados para la prueba con referencias revisadas y spans críticos.
11. Ejecutar Gemini/Groq/OpenAI con exactamente esos bytes y elegir por calidad, costo y latencia.
12. Conectar Meta solamente después y con credenciales disponibles.

## Regla para el próximo handoff

Actualizar este archivo antes de finalizar cada bloque. Debe quedar explícito:

- qué cambió;
- qué se verificó;
- qué falló;
- qué archivos son relevantes;
- cuál es la siguiente acción exacta;
- qué necesita aportar el usuario.
