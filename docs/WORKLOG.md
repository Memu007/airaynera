# Registro de trabajo de AIRA

Este archivo es acumulativo. Agregar entradas nuevas sin borrar el historial anterior. No incluir secretos, datos clínicos reales, audios ni transcripciones.

## 2026-07-15 — Publicación del hito de audio en el repositorio nuevo

### Resultado

- La suite integral se ejecutó después de la revisión competitiva y aprobó 115/115 pruebas funcionales.
- El hito de audio y su handoff (`4cc5a13`, `00af12f`) se publicaron en [`Memu007/airaynera`](https://github.com/Memu007/airaynera), rama `main`.
- `Memu007/Aira.final` y sus PR existentes se conservan como historial; los siguientes hitos se publican en `airaynera/main`.

### Próximo paso

1. Aceptar un archivo real desde la web y crear almacenamiento temporal fuera de SQLite.
2. Incorporar job/worker SQLite antes de cualquier llamada de red.
3. Ejecutar el benchmark de proveedores con recortes creados o anonimizados antes de conectar Meta.

## 2026-07-14 — Audio sintético común para web y WhatsApp

### Objetivo

Validar la idea completa `recorte de audio → transcripción original → nota limpia revisable → guardar/cancelar → ficha web` antes de incorporar archivos, Meta o un proveedor pago.

### Trabajo realizado

- Tres agentes propusieron arquitecturas independientes; se eligió reutilizar `SessionDraft` con etapas persistidas y proveedores intercambiables, sin agregar todavía una cola separada.
- Se agregó la migración `005_audio_pipeline.sql` con referencia de medio, MIME, huella, intentos, etapa fallida y timestamps.
- Web y WhatsApp simulado usan `services/audioDraftPipeline.js` y los mismos proveedores falsos deterministas.
- Se conservan por separado `rawTranscript` y `cleanNote`; solamente la nota limpia puede editarse.
- La limpieza falsa elimina pausas y una muletilla inicial sin inferir diagnósticos, cambiar negaciones o alterar números.
- Se agregaron fixtures de éxito, pausas, transcripción fallida, limpieza fallida y audio vacío.
- Los fallos se reintentan por etapa; `received` y claims vencidos se recuperan tras reiniciar.
- La web fija paciente y fixture al borrador, conserva la misma clave ante una respuesta perdida y limpia contenido anterior antes de reprocesar.
- WhatsApp conserva el audio fallido, acepta `REINTENTAR/CANCELAR` y muestra la nota preparada antes de guardar.
- Se mantuvo compatibilidad de deduplicación con hashes de mensajes de texto persistidos antes de incorporar audio.
- La fecha clínica por defecto usa la zona de Argentina y la evidencia/metadata de audio confirmada quedó inmutable.
- Confirmar, cancelar y editar borradores usan condiciones de estado para evitar que una operación terminal pise a otra.
- El dashboard representa una evaluación anímica ausente como `Sin registrar`.
- Los tres agentes revisaron nuevamente las correcciones y no encontraron bloqueantes restantes para el corte sintético; el worker de red quedó explícitamente fuera de este veredicto.

### Revisión competitiva

Los tres revisores coincidieron en dos bloqueantes: paciente web modificable después de preparar y borradores interrumpidos sin recuperación. También se tomaron los mejores hallazgos secundarios: retry/cancel de WhatsApp fallido, compatibilidad de hashes, fecha clínica, huella completa, metadata confirmada inmutable y transiciones terminales condicionadas.

El worker asíncrono no se incorporó todavía: es obligatorio antes de llamar a un proveedor real para no mantener abierta la transacción del webhook.

### Verificaciones

- Antes de la revisión final, `npm test` aprobó migraciones, vínculo, conversación, audio y 109/109 pruebas funcionales.
- Después de las correcciones se aprobaron `test:audio-pipeline` y `test:whatsapp-conversation`, incluidos restart desde `received/structuring` y replay de un hash histórico.
- La corrida funcional integral posterior no pudo iniciarse por un límite temporal de ejecución de herramientas; queda como gate obligatorio antes de publicar.
- Commit local del hito: `4cc5a13` (`add provider-neutral audio draft pipeline`).
- Recorrido visible aprobado: un paciente, una sesión de audio web y una sesión de audio WhatsApp persistieron tras recargar.
- La transcripción original fue de solo lectura; la nota limpia se editó antes de guardar.
- El flujo de WhatsApp recorrió `MENÚ → NUEVA NOTA → PACIENTE → audio → GUARDAR`.
- Después de corregir la ausencia de mood, el dashboard y el detalle mostraron `Sin registrar`.
- Consola del navegador: sin errores.

### Proveedores

- Groq `whisper-large-v3-turbo` queda como baseline de costo publicada.
- Gemini queda como challenger de proveedor único y OpenAI como challenger de calidad.
- No se eligió ni integró todavía un proveedor real.
- Costos, fuentes y gate están en `docs/AUDIO_PROVIDER_BENCHMARK.md`.

### Siguiente trabajo

1. Repetir la suite integral y publicar este hito en el PR #2.
2. Aceptar un archivo real desde la web y crear almacenamiento temporal fuera de SQLite.
3. Incorporar job/worker SQLite antes de cualquier llamada de red.
4. Ejecutar el benchmark con 30 a 50 recortes creados o anonimizados.
5. Conectar Meta solamente después de elegir proveedor y disponer de credenciales.

## 2026-07-14 — Menú de texto completo sobre teléfono vinculado

### Objetivo

Demostrar el recorrido `MENÚ → paciente → nota → GUARDAR/CANCELAR → ficha web` sin Meta ni audio, conservando identidad, estado e idempotencia dentro de AIRA.

### Trabajo realizado

- Tres agentes compitieron con propuestas independientes de máquina de estados, transacciones, respuestas y gates.
- Se eligió un dispatcher transaccional con `MENÚ` no destructivo cuando hay un borrador pendiente.
- Se agregó `004_whatsapp_conversations.sql` con conversación por cuenta y ledger durable de todos los mensajes entrantes.
- `POST /api/dev/whatsapp/inbound` dejó de aceptar `selectedPatientId`; el paciente sale únicamente de `PACIENTE <id>` persistido.
- Se implementaron `MENÚ`, `NUEVA NOTA`, búsqueda simple, lista de pacientes activos, selección, nota libre, `GUARDAR` y `CANCELAR`.
- Crear la nota produce solamente `SessionDraft`; guardar reutiliza la confirmación canónica e idempotente.
- Un evento repetido devuelve la respuesta guardada; reutilizar el ID con otro teléfono o texto devuelve conflicto.
- Desvincular elimina la conversación y evita heredar paciente o borrador al volver a vincular.
- El modal web incluye un simulador de texto mínimo que llama al mismo adaptador y refresca sesiones al guardar.

### Verificaciones

- `npm test`: migraciones, vínculo, reinicio conversacional y 91/91 pruebas funcionales aprobadas.
- Una prueba separada termina el proceso, abre SQLite desde otro proceso y continúa desde `awaitingNote`.
- Cubiertos pacientes ajenos, campos laterales ignorados, cada mensaje duplicado, payload conflictivo, borrador pendiente, guardar, cancelar y desvincular.
- `npm run build`, sintaxis JavaScript y `git diff --check`: aprobados.
- Recorrido visible aprobado: crear paciente → vincular → MENÚ → seleccionar → nota → GUARDAR → recargar.
- Después de recargar: exactamente 1 paciente, 1 sesión y la nota correcta visibles.
- Commit funcional publicado: `7366868` (`add persistent whatsapp text menu`).
- PR técnico [#2](https://github.com/Memu007/Aira.final/pull/2) actualizado.
- GitHub Actions: `Functional baseline`, `audit`, `semgrep` y `trufflehog` aprobados sobre el menú persistente.

### Siguiente trabajo

1. Crear el doble de audio y el contrato `audio → rawTranscript → cleanNote → SessionDraft`.
2. Evaluar proveedores por costo y calidad con audios creados o anonimizados antes de elegir Gemini, Groq u OpenAI.
3. Conectar Meta real recién cuando existan sus credenciales, sin cambiar conversación ni borradores.

## 2026-07-14 — Vinculación cuenta web ↔ teléfono simulado

### Objetivo

Eliminar el JWT del transporte simulado y demostrar que un mensaje entrante puede identificar correctamente al profesional a partir de un número previamente vinculado en la web.

### Trabajo realizado

- Tres agentes compitieron con propuestas independientes de datos, servicio, endpoints, interfaz y gates.
- Se eligió un corte mínimo persistente: vínculo y nota ahora; menú conversacional completo en el siguiente bloque.
- Se agregó la migración `003_whatsapp_links.sql` con estados, código temporal, teléfono único e identificador del evento de vinculación.
- Los eventos consumidos se conservan en `whatsapp_link_events`, de modo que los reintentos tardíos no vuelven a ejecutar efectos.
- La web autenticada puede consultar, generar y eliminar un vínculo.
- El código de seis dígitos vence en diez minutos, se invalida al regenerar y solamente puede consumirse desde el teléfono indicado.
- `POST /api/dev/whatsapp/inbound` ya no acepta JWT ni `userId`; resuelve `phone → userId` y después usa `SessionDraft`.
- Un teléfono desconocido no crea borradores; desvincular corta inmediatamente la resolución de identidad.
- La interfaz dejó de afirmar que WhatsApp está sincronizado sin respaldo persistido.
- El modal visible genera el código, simula `VINCULAR`, muestra el número parcial y permite desvincular.
- El mismo código pendiente se recupera al cerrar el modal o recargar la web.
- El deploy de prueba activa explícitamente el adaptador falso hasta incorporar Meta.

### Verificaciones

- `npm test`: migraciones, servicio de vínculo y 78/78 pruebas funcionales aprobadas.
- Cubiertos vencimiento, liberación de códigos abandonados, código regenerado, teléfono incorrecto, número ocupado, repetición tardía del evento, aislamiento entre cuentas y reutilización después de desvincular.
- Una nota desde el teléfono vinculado crea un solo borrador; el mismo `messageId` no duplica.
- `npm run build`, sintaxis JavaScript y `git diff --check`: aprobados.
- Recorrido visible aprobado: login → vincular celular → generar código → recargar pendiente → recuperar código → simular mensaje → estado vinculado.
- Después de recargar, la web conserva tanto el pendiente recuperable como el teléfono ya vinculado.
- Commit funcional publicado: `db0d36d` (`link web accounts to whatsapp phones`).
- PR técnico [#2](https://github.com/Memu007/Aira.final/pull/2) actualizado.
- GitHub Actions: `Functional baseline`, `audit`, `semgrep` y `trufflehog` aprobados sobre el vertical de vinculación.

### Siguiente trabajo

1. Implementar el estado conversacional `MENÚ → elegir paciente → enviar nota → confirmar/cancelar` sobre el teléfono ya vinculado.
2. Mantener el mismo servicio de vínculo y borradores al agregar el webhook de Meta.
3. Agregar audio solamente después de aprobar el menú completo con texto.

## 2026-07-14 — Borradores y WhatsApp simulado con texto

### Objetivo

Demostrar que web y WhatsApp pueden producir el mismo borrador y que solamente una confirmación crea la sesión final.

### Trabajo realizado

- Tres agentes compitieron con propuestas independientes de implementación.
- Se eligió un servicio canónico de `SessionDraft` con confirmación transaccional y un adaptador falso autenticado.
- Se agregaron creación, listado, detalle, edición, cancelación y confirmación de borradores.
- La confirmación copia los campos al modelo Session dentro de una transacción y enlaza ambas filas.
- Repetir la confirmación devuelve la misma sesión.
- El formulario web ahora crea un borrador y luego lo confirma; si la segunda operación falla, la nota queda recuperable.
- `POST /api/dev/whatsapp/inbound` simula una entrada de texto con usuario autenticado y paciente explícito.
- Repetir un `messageId` devuelve el mismo borrador.
- Los endpoints heredados de WhatsApp que escribían sesiones directamente quedaron deshabilitados con `410`.

### Verificaciones

- `npm test`: migraciones y 66/66 pruebas funcionales aprobadas.
- Crear un borrador no incrementa sesiones.
- Confirmar dos veces crea exactamente una sesión.
- Cancelar impide confirmar.
- Otra cuenta no puede leer ni usar el paciente o borrador.
- WhatsApp simulado deduplica el mensaje y conserva `source=whatsapp` al confirmar.
- Recorrido visible web aprobado con la nueva ruta: 1 paciente y 1 sesión antes y después de recargar.
- Consola del navegador: sin errores ni advertencias.
- Commit funcional publicado: `e9085b8` (`route notes through session drafts`).
- PR técnico [#2](https://github.com/Memu007/Aira.final/pull/2) actualizado a `Build the persistent web and draft core`.
- GitHub Actions: `Functional baseline`, `audit`, `semgrep` y `trufflehog` aprobados sobre el vertical de borradores.

### Siguiente trabajo

1. Implementar la vinculación explícita cuenta web ↔ número de WhatsApp con códigos temporales.
2. Usar esa vinculación en el adaptador falso y validar el menú de texto.
3. Reemplazar el transporte falso por Meta cuando estén disponibles las credenciales.

## 2026-07-14 — Contratos canónicos y vertical web persistente

### Objetivo

Hacer funcionar el recorrido registro → paciente → sesión → recarga antes de conectar audio o WhatsApp.

### Trabajo realizado

- Tres agentes propusieron de forma independiente contratos para paciente, sesión y borrador.
- Se eligió la propuesta que separa fecha clínica de creación y duración clínica de duración de audio.
- Se documentaron los contratos en `docs/DOMAIN_CONTRACTS.md`.
- Se agregó la migración `002_canonical_sessions_and_drafts.sql` sin renombrar ni borrar columnas existentes.
- La migración prepara timestamps canónicos, campos de sesión y la tabla `session_drafts` con restricciones contra duplicados.
- SQLite ahora devuelve pacientes con totales y última sesión, y sesiones con el nombre real del paciente.
- La API responde IDs string y campos `camelCase`; acepta temporalmente aliases heredados en entradas.
- El registro devuelve JWT y la web restaura la sesión después de recargar.
- La web carga pacientes y sesiones desde la API, crea sesiones válidas y actualiza historial, filtros, indicadores y gráficos.
- El estado activo/inactivo del paciente se persiste en el servidor.
- La prueba visible detectó y corrigió que el formulario leía la contraseña desde un ID inexistente.

### Verificaciones

- `npm test`: migraciones y 45/45 pruebas funcionales aprobadas.
- La batería cubre registro utilizable, IDs canónicos, fecha clínica, JOIN de paciente, persistencia, filtros y compatibilidad temporal.
- Sintaxis de `server.js`, `services/sqlite.js` y los dos bloques JavaScript de `index.html`: aprobada.
- `git diff --check`: sin errores.
- Recorrido visible local aprobado: registro, activación simulada, paciente, sesión y recarga.
- Después de recargar: 1 paciente, 1 sesión, nombre y nota visibles.
- Consola del navegador: sin errores ni advertencias.
- Commit funcional publicado: `f193163` (`make web core persistent`).
- PR técnico [#2](https://github.com/Memu007/Aira.final/pull/2) actualizado.
- GitHub Actions: `Functional baseline`, `audit`, `semgrep` y `trufflehog` aprobados sobre el commit funcional.

### Siguiente trabajo

1. Implementar CRUD y confirmación idempotente de `SessionDraft`.
2. Hacer que un doble de WhatsApp cree borradores, nunca sesiones directas.
3. Validar el vertical completo con texto antes de incorporar audio.

## 2026-07-14 — Etapa 0: línea base reproducible

### Objetivo

Comenzar el primer bloque del roadmap con una prueba funcional confiable y ejecutable tanto en local como en GitHub Actions.

### Trabajo realizado

- Se creó la rama `agent/01-web-core` desde el estado documental publicado.
- Se instalaron las dependencias con `npm ci`.
- Se estableció Node.js 20 mediante `.nvmrc` y `package.json`.
- Se creó `scripts/run-functional-tests.js`.
- `npm test` ahora crea una base temporal, levanta el servidor, espera el health check, ejecuta la batería funcional y limpia el entorno.
- Se reemplazó el workflow principal por una CI sencilla que instala, prueba y verifica el build.
- Se archivaron cinco workflows que referenciaban servidores, scripts o procesos de despliegue inexistentes.
- Se corrigió la creación de sesiones para devolver `404` cuando el paciente no existe o no pertenece a la cuenta.
- Se actualizó la prueba correspondiente, que antes esperaba incorrectamente un error `500`.
- Se agregó un ejecutor de migraciones versionadas en `db/migrate.js`.
- Se movió el esquema inicial a `db/migrations/001_initial_schema.sql`.
- Se habilitaron claves foráneas al abrir SQLite.
- Se agregó una prueba que verifica aplicación única, esquema esperado y preservación de datos existentes.
- Se publicó la rama y se abrió el PR técnico en borrador [#2](https://github.com/Memu007/Aira.final/pull/2).

### Verificaciones

- `npm test`: 30/30 pruebas funcionales aprobadas.
- `npm run build`: aprobado.
- `npm run test:migrations`: aprobado sobre base nueva y base existente.
- `git diff --check`: sin errores.
- Los datos de prueba se almacenaron fuera del repositorio y se eliminaron al terminar.
- GitHub Actions: `Functional baseline` y `semgrep` aprobados.
- GitHub Actions: `trufflehog` falló porque el workflow pasa dos veces `--fail`; no reportó un secreto.
- GitHub Actions: `audit` detectó 30 vulnerabilidades heredadas, incluyendo 14 altas y 1 crítica.
- Tres agentes analizaron de forma independiente los fallos de CI.
- Se comparó una actualización conservadora del lockfile contra dos propuestas de poda de dependencias.
- Se eligió eliminar diez dependencias sin uso del código activo y volver a agregarlas solamente cuando exista una integración real.
- Se quitaron Firestore, Gemini SDK, Axios, Celebrate, Joi, Mongoose, Multer, node-fetch, Socket.IO y Winston.
- Se corrigió TruffleHog eliminando solamente el `--fail` duplicado; el gate sigue activo.
- El árbol auditado bajó de 349 a 174 paquetes.
- `npm audit`: 0 vulnerabilidades después del cambio, sin usar `--force`.
- `npm test`: migraciones y 30/30 pruebas aprobadas después de la limpieza.
- `npm run build`: aprobado después de la limpieza.
- GitHub Actions después del push: `Functional baseline`, `audit`, `semgrep` y `trufflehog` aprobados.

### Siguiente trabajo

1. Definir contratos canónicos de paciente, sesión y borrador.
2. Corregir el recorrido web de registro, carga y persistencia.

## 2026-07-14 — Revisión de producto y planificación del MVP

### Objetivo

Entender el estado real del repositorio y redefinir la implementación alrededor del recorrido web–WhatsApp acordado con el responsable del producto.

### Trabajo realizado

- Se descargó y revisó el repositorio `Memu007/Aira.final`.
- Se inspeccionaron la web, el servidor Express, SQLite, los endpoints de WhatsApp, los workflows de n8n, los prototipos archivados y las pruebas existentes.
- Se confirmó que el flujo real de audio por WhatsApp todavía no está implementado de punta a punta.
- Se definió el producto como un asistente para mantener fichas mediante notas breves posteriores a la sesión.
- Se descartó del MVP la grabación o interpretación de sesiones terapéuticas completas.
- Se decidió vincular explícitamente cada cuenta web con un número de WhatsApp.
- Se decidió seleccionar explícitamente al paciente antes de recibir audio o texto.
- Se decidió crear borradores y esperar confirmación antes de guardar una sesión.
- Se compararon alternativas actuales de transcripción y se propuso una interfaz intercambiable de proveedores.
- Se definió validar primero el flujo con texto y agregar audio después.
- Se preparó un roadmap por verticales, criterios de aceptación y estrategia de versiones.
- Se creó una estructura documental activa dentro de `docs/`.
- Se actualizó el README principal para reflejar el producto y el estado real.
- Se marcó el reporte de pruebas de 2025 como histórico.

### Verificaciones

- El repositorio estaba limpio y sincronizado con `origin/main` en `b78d708` antes de los cambios documentales.
- El servidor no pudo iniciarse porque las dependencias todavía no estaban instaladas localmente.
- Se detectó que varios workflows de GitHub referencian archivos o scripts archivados o inexistentes.
- Se detectó inicialmente que GitHub CLI no estaba instalado.
- Se instaló GitHub CLI y se autenticó la cuenta `Memu007` mediante el flujo oficial de dispositivo.
- Se creó y publicó la rama `agent/document-product-roadmap` sin escribir directamente sobre `main`.
- Se creó el commit `221522e` (`document product roadmap and handoff`).
- Se abrió el PR documental en borrador [#1](https://github.com/Memu007/Aira.final/pull/1).

### Resultado

La dirección del producto y el plan de implementación dejaron de depender de la conversación. La fuente operativa actual es `docs/HANDOFF.md` y el plan completo está en `docs/ROADMAP.md`.

### Siguiente trabajo

1. Crear `agent/01-web-core` desde el estado documentado.
2. Ejecutar la Etapa 0 y la Etapa 1 del roadmap.
