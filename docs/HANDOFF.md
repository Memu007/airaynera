# Handoff de AIRA

Este es el documento operativo que debe leerse primero al retomar el proyecto.

Última actualización: 2026-07-14.

## Estado actual

- Repositorio: `Memu007/Aira.final`.
- Rama actual: `agent/01-web-core`.
- Base de este bloque: `41892d3` (`record green ci baseline`).
- Etapa de producto: planificación del MVP terminada; seguridad avanzada y estética están diferidas por decisión de producto.
- Etapa técnica: contratos canónicos definidos y vertical web principal funcionando.
- Próximo objetivo: implementar `SessionDraft` para texto y conectar un doble de WhatsApp al mismo servicio.

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

- Los endpoints activos de `/api/whatsapp/*` son receptores internos y simulaciones; no forman un webhook real de Meta.
- Utilizan un usuario fijo con ID `1`.
- Intentan asociar el teléfono del remitente con un paciente, aunque quien escribirá es el profesional.
- No descargan audio.
- No llaman a un proveedor real de transcripción.
- El envío de respuestas está simulado.
- Se guarda antes de confirmar y no hay protección completa contra duplicados.
- La transcripción se recorta en el flujo actual.

### Código archivado

- `_archive/` contiene workflows de n8n, clientes parciales de Meta, un bot anterior y un grabador web.
- Sirven como referencia, pero contienen URLs, contratos y endpoints que no coinciden con la aplicación activa.
- No deben restaurarse completos sin revisión.

### Pruebas y CI

- Las dependencias quedaron instaladas con `npm ci`.
- `npm test` ahora levanta un servidor y una base SQLite temporales, ejecuta las pruebas y limpia el entorno al terminar.
- La batería actual pasa 45 de 45 pruebas funcionales con Node.js 20.
- Crear una sesión para un paciente inexistente ahora devuelve `404` en lugar de `500`.
- Cinco workflows que referenciaban archivos o comandos inexistentes fueron movidos a `_archive/github-workflows/`.
- `.github/workflows/ci.yml` es la verificación funcional canónica para el MVP.
- SQLite ahora aplica migraciones versionadas desde `db/migrations/`.
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
- [ ] Crear dobles de prueba para WhatsApp y transcripción.

### Etapa 1

- [x] Corregir el recorrido de registro y autenticación.
- [x] Corregir creación y carga de pacientes.
- [x] Corregir creación, carga y detalle de sesiones.
- [ ] Incorporar edición visible de sesiones.
- [x] Hacer persistentes los datos después de recargar.
- [x] Corregir filtros e indicadores principales del dashboard.
- [ ] Incorporar el modelo inicial de borrador.
- [x] Preparar la tabla y restricciones del modelo de borrador.
- [x] Agregar pruebas automatizadas y una prueba visible del recorrido web completo.

## Criterio para cerrar el próximo bloque

> Un usuario nuevo se registra, crea un paciente, registra una sesión y continúa viéndola correctamente después de recargar la web.

Cumplido localmente el 2026-07-14. La prueba visible terminó con 1 paciente y 1 sesión antes y después de recargar, sin errores de consola.

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
6. Ejecutar `npm test` para confirmar la línea base 45/45.
7. Implementar el servicio y la API de `SessionDraft` usando `db/migrations/002_canonical_sessions_and_drafts.sql`.
8. Crear un doble de WhatsApp que produzca el mismo borrador sin escribir directamente en `sessions`.

## Regla para el próximo handoff

Actualizar este archivo antes de finalizar cada bloque. Debe quedar explícito:

- qué cambió;
- qué se verificó;
- qué falló;
- qué archivos son relevantes;
- cuál es la siguiente acción exacta;
- qué necesita aportar el usuario.
