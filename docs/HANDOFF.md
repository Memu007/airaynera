# Handoff de AIRA

Este es el documento operativo que debe leerse primero al retomar el proyecto.

Última actualización: 2026-07-15.

## Estado actual

- Repositorio de publicación vigente: [`Memu007/airaynera`](https://github.com/Memu007/airaynera), rama `main`.
- Repositorio histórico preservado: `Memu007/Aira.final` (sus PR #1 y #2 no son el destino de los próximos cambios).
- Rama local de trabajo: `agent/01-web-core`; el destino publicado sigue siendo `airaynera/main`.
- Último hito funcional: `4a0a082` (`harden audio expiry and inactive patient flow`).
- Etapa de producto: planificación del MVP terminada; seguridad avanzada y estética están diferidas por decisión de producto.
- Etapa técnica: la web acepta archivos de audio reales, los guarda temporalmente fuera de SQLite y los procesa mediante un worker con job, lease y recuperación persistentes. La expiración usa compare-and-set antes de cancelar el job o borrar el medio; un paciente inactivo conserva su historia pero no admite sesiones ni borradores nuevos. La transcripción continúa siendo simulada. La batería funcional aprobó 129/129.
- Próximo objetivo: cerrar las correcciones de integridad y UX web junto con el gate del supervisor; después ejecutar el benchmark con recortes creados o anonimizados y conectar el primer proveedor real. Meta real se incorpora después y solamente cuando existan credenciales.

## Dirección del producto acordada

AIRA no procesará sesiones terapéuticas completas en el MVP. El profesional enviará una nota posterior de aproximadamente 2 a 10 minutos o escribirá un texto breve.

El profesional no se reconoce con IA: su número de WhatsApp se vincula explícitamente con la cuenta creada en la web.

El paciente tampoco se deduce del audio: se selecciona explícitamente desde la web o el menú de WhatsApp antes de enviar la nota.

Toda entrada crea primero un borrador. La sesión definitiva se crea solamente después de **Guardar**.

La web es la fuente de verdad y WhatsApp es un canal adicional sobre los mismos datos.

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
- El formulario de sesión ofrece texto o carga de archivo real, muestra la transcripción simulada como solo lectura y deja la nota limpia editable.
- Mientras existe un borrador de audio, paciente y archivo quedan fijados; la confirmación valida nuevamente la asociación.
- La carga conserva una clave idempotente ante respuesta perdida, sigue el job por polling y permite reintentar o cancelar sin crear una sesión prematuramente.
- Las notas sin evaluación anímica muestran `Sin registrar` en lugar de valores indefinidos.
- Quedan pendientes la edición visible general de sesiones y una bandeja para recuperar borradores fuera del modal.

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
- No existe todavía un webhook real de Meta, envío real de respuestas, descarga de audio ni proveedor real de transcripción.
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
- `services/audio/fakeAudioProviders.js` contiene fixtures artificiales y limpieza conservadora; no contiene audios ni datos clínicos.
- `services/audio/temporaryAudioStore.js` recibe un stream binario, valida tamaño, firma y MIME, escribe primero un archivo parcial y entrega una referencia opaca `upload://...`.
- `POST /api/audio-drafts/upload` responde sin esperar la transcripción; el límite predeterminado es 25 MB y la retención máxima es 24 horas.
- `workers/audio-worker.js` reclama jobs con lease y fencing token, recupera trabajo abandonado y limpia el archivo después de persistir la transcripción o alcanzar un estado terminal.
- El barrido de expiración sólo cancela el job y elimina el medio si logró marcar atómicamente el borrador vencido; si otra instancia ya persistió la transcripción, el trabajo continúa.
- `npm start` supervisa servidor y worker; en Render, base y archivos temporales comparten el disco persistente montado en `/app/data`.
- Estados: `received → transcribing → structuring → ready/failed`; confirmar y cancelar siguen usando el servicio canónico.
- Un retry de estructuración conserva la transcripción y no vuelve a transcribir.
- `received`, jobs fallidos y leases vencidos son recuperables después de reiniciar; un worker con token obsoleto no puede sobrescribir al reemplazo.
- La fecha clínica por defecto usa `APP_TIME_ZONE=America/Argentina/Buenos_Aires`.
- `rawTranscript`, `inputType` y `audioDurationSeconds` son inmutables en la revisión y después de confirmar.
- El comparativo de Groq, Gemini y OpenAI está en `docs/AUDIO_PROVIDER_BENCHMARK.md`. Groq Whisper Large v3 Turbo queda como baseline de costo, no como proveedor aprobado todavía.

### Pruebas y CI

- Las dependencias quedaron instaladas con `npm ci`.
- `npm test` ahora levanta un servidor y una base SQLite temporales, ejecuta las pruebas y limpia el entorno al terminar.
- La batería integral actual aprobó 129 de 129 pruebas funcionales con Node.js 20, además de migración, vínculo, conversación, audio sintético y worker de uploads.
- La suite del worker cubre límite streamed, expiración integral, carrera después del snapshot y recuperación desde un segundo proceso real.
- La prueba funcional se repitió tres veces con polling del worker cada 10 ms; las tres corridas terminaron 126/126 y cubren 20 entradas de WhatsApp concurrentes.
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

El worker usa SQLite deliberadamente para este volumen del MVP. No se incorpora Redis ni un proveedor real hasta medir el corpus; la interfaz actual permite reemplazar el fake sin mover la llamada de red al proceso web.

### Decisión multiagente: dependencias y CI

El 2026-07-14 se compararon tres propuestas independientes:

- actualizar solamente el lockfile y conservar dependencias inactivas;
- retirar dependencias inactivas y aplicar correcciones compatibles;
- retirar dependencias inactivas, validar en copia aislada y mantener gates de CI.

Se eligió retirar las dependencias inactivas. Firestore, Gemini SDK, Axios, Celebrate, Joi, Mongoose, Multer, node-fetch, Socket.IO y Winston no tenían importaciones en el código activo. Podrán reincorporarse en versiones actuales cuando exista un uso real.

La alternativa de lockfile únicamente fue descartada porque mantenía casi la mitad del árbol sin aportar funcionalidad al MVP.

## Próximo bloque de trabajo

Rama prevista: `agent/01-web-core`.

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
- [ ] Ejecutar el benchmark Groq/Gemini/OpenAI.
- [x] Separar el procesamiento de archivos reales en un worker SQLite antes de conectar un proveedor o WhatsApp real.

### Etapa 1

- [x] Corregir el recorrido de registro y autenticación.
- [x] Corregir creación y carga de pacientes.
- [x] Corregir creación, carga y detalle de sesiones.
- [ ] Incorporar edición visible de sesiones.
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

- Destino vigente: [`Memu007/airaynera`](https://github.com/Memu007/airaynera), `main`, publicado el 2026-07-15.
- Verificación del hito actual: `npm test`, build, sintaxis embebida y `git diff --check` aprobados; 126/126 pruebas funcionales en tres corridas consecutivas.
- Implementación del hito actual: `179c329` (`process real audio uploads in sqlite worker`).
- Corrección de confiabilidad posterior a la auditoría: `4a0a082` (`harden audio expiry and inactive patient flow`).
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
5. Retomar `agent/01-web-core`.
6. Ejecutar `npm test` antes de cada publicación; las últimas tres corridas funcionales aprobaron 126/126.
7. Confirmar `npm run build`, sintaxis del JavaScript embebido y `git diff --check`.
8. Publicar el siguiente hito verificado en `airaynera/main` y registrar el resultado aquí y en `docs/WORKLOG.md`.
9. Preparar 30 a 50 recortes creados o anonimizados y ejecutar el benchmark Groq/Gemini/OpenAI usando el worker existente.
10. Elegir el primer proveedor por calidad, costo y latencia; conectar Meta solamente después y con credenciales disponibles.

## Regla para el próximo handoff

Actualizar este archivo antes de finalizar cada bloque. Debe quedar explícito:

- qué cambió;
- qué se verificó;
- qué falló;
- qué archivos son relevantes;
- cuál es la siguiente acción exacta;
- qué necesita aportar el usuario.
