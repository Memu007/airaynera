# Handoff de AIRA

Este es el documento operativo que debe leerse primero al retomar el proyecto.

Última actualización: 2026-07-14.

## Estado actual

- Repositorio: `Memu007/Aira.final`.
- Rama actual: `agent/01-web-core`.
- Base de la rama: `41892d3` (`record green ci baseline`).
- Etapa de producto: planificación del MVP terminada; seguridad avanzada y estética están diferidas por decisión de producto.
- Etapa técnica: vertical web y recorrido completo de texto mediante WhatsApp simulado funcionando.
- Próximo objetivo: crear el doble de audio y comparar transcripción/costo con audios de prueba; Meta real se incorpora cuando existan credenciales.

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
- Quedan pendientes la edición visible de sesiones y la interfaz de borradores.

### WhatsApp

- Los endpoints `GET/POST/DELETE /api/whatsapp/link` administran el vínculo desde la cuenta web autenticada.
- `db/migrations/003_whatsapp_links.sql` persiste teléfono, estado, código de seis dígitos y vencimiento; `whatsapp_link_events` conserva la deduplicación aunque el vínculo se regenere o elimine.
- El código vence en diez minutos; regenerar invalida el anterior y repetir el mismo evento de vinculación es idempotente.
- El flujo funcional está en `POST /api/dev/whatsapp/inbound`: no acepta JWT ni `userId`; resuelve la cuenta exclusivamente desde `from`.
- El evento tampoco acepta `selectedPatientId`; la conversación exige `PACIENTE <id>` y persiste la selección.
- `db/migrations/004_whatsapp_conversations.sql` agrega el estado y un ledger de respuestas para todos los mensajes.
- Están implementados `MENÚ`, `NUEVA NOTA`, `BUSCAR`, selección de paciente, texto libre, `GUARDAR` y `CANCELAR`.
- La conversación sobrevive reinicios del proceso; `MENÚ` no descarta un borrador pendiente.
- El adaptador crea solamente `SessionDraft`; confirma mediante el mismo endpoint canónico que la web.
- Un `messageId` repetido devuelve el mismo borrador y no crea otra fila.
- Desvincular corta la resolución de identidad y libera el teléfono.
- Un pendiente puede retomarse después de recargar la web; un pendiente vencido libera el número incluso si su propietario abandonó el flujo.
- El deploy de prueba declara `WHATSAPP_ADAPTER=fake`; debe reemplazarse por Meta antes de producción real.
- No existe todavía un webhook real de Meta, envío real de respuestas, descarga de audio ni proveedor de transcripción.
- Los endpoints heredados que escribían directamente en `sessions` ahora devuelven `410`.
- El reconocimiento y envío n8n restantes siguen siendo prototipos y no forman parte del vertical nuevo.

### Código archivado

- `_archive/` contiene workflows de n8n, clientes parciales de Meta, un bot anterior y un grabador web.
- Sirven como referencia, pero contienen URLs, contratos y endpoints que no coinciden con la aplicación activa.
- No deben restaurarse completos sin revisión.

### Pruebas y CI

- Las dependencias quedaron instaladas con `npm ci`.
- `npm test` ahora levanta un servidor y una base SQLite temporales, ejecuta las pruebas y limpia el entorno al terminar.
- La batería actual pasa 91 de 91 pruebas funcionales con Node.js 20, además de migración, vínculo y reinicio conversacional.
- Crear una sesión para un paciente inexistente ahora devuelve `404` en lugar de `500`.
- Cinco workflows que referenciaban archivos o comandos inexistentes fueron movidos a `_archive/github-workflows/`.
- `.github/workflows/ci.yml` es la verificación funcional canónica para el MVP.
- SQLite ahora aplica migraciones versionadas desde `db/migrations/`.
- La migración `003_whatsapp_links.sql` fue probada sobre base nueva, base heredada y segunda ejecución vacía.
- La migración `004_whatsapp_conversations.sql` y la reapertura del estado desde otro proceso están probadas.
- La migración inicial es idempotente y fue probada contra una base nueva y una base con datos existentes.
- `TESTING-REPORT.md` refleja una ejecución de noviembre de 2025 y no debe interpretarse como una validación del código actual.

Estado remoto del PR técnico #2:

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
- El PR técnico #2 se titula ahora `Build the persistent web, draft, and WhatsApp link core` y refleja 78/78 pruebas.

## Decisiones técnicas vigentes

- Mantener Express y SQLite para el MVP.
- No reescribir el frontend completo antes de validar el producto.
- Extraer gradualmente rutas y servicios nuevos.
- Mantener identidad, conversaciones, borradores, confirmación y deduplicación dentro de AIRA.
- No usar n8n como fuente de verdad.
- Implementar proveedores intercambiables para transcripción y estructuración.
- Validar primero el recorrido completo con texto y después agregar audio.
- Conservar transcripción literal y nota limpia por separado.
- Usar una cola persistente sencilla en SQLite para el piloto.
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
- [ ] Crear el doble de transcripción para audio.

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

### Audio

- Credencial del primer proveedor de transcripción.
- Audios de prueba creados o anonimizados.

No bloquean el vertical de texto.

## Estado de publicación de esta documentación

- Los archivos documentales se prepararon y validaron localmente.
- GitHub CLI (`gh`) quedó instalado y autenticado como `Memu007`.
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
4. Confirmar el estado del [PR documental #1](https://github.com/Memu007/Aira.final/pull/1).
5. Retomar `agent/01-web-core`.
6. Ejecutar `npm test` para confirmar la línea base 91/91.
7. Definir el contrato del trabajo de audio sin acoplarlo a un proveedor.
8. Crear dobles de descarga/transcripción y probar `audio → borrador` con archivos no clínicos.
9. Comparar proveedores y conectar Meta solamente después de medir costo, calidad y latencia.

## Regla para el próximo handoff

Actualizar este archivo antes de finalizar cada bloque. Debe quedar explícito:

- qué cambió;
- qué se verificó;
- qué falló;
- qué archivos son relevantes;
- cuál es la siguiente acción exacta;
- qué necesita aportar el usuario.
