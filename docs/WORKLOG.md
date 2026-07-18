# Registro de trabajo de AIRA

Este archivo es acumulativo. Agregar entradas nuevas sin borrar el historial anterior. No incluir secretos, datos clínicos reales, audios ni transcripciones.

## 2026-07-18 — Reconciliación de proceso proporcional y PM no técnica

### Objetivo

Publicar la política de colaboración que había quedado solamente en el commit local `fa42c73`, reconciliándola con el hito posterior de la bandeja sin sobrescribir sus cambios ni sus resultados.

### Análisis adversarial

- Tres revisores trabajaron independientemente: uno intentó refutar la propuesta por burocrática, otro defendió calidad y mantenibilidad, y el tercero buscó el corte mínimo medible.
- Coincidieron en que una carpeta formal de ADR duplicaría `WORKLOG`, `PRODUCT`, `ROADMAP` y `DOMAIN_CONTRACTS`; también en que aprobar con una sola identidad de GitHub sería una apariencia de control y en que bugs detenidos antes del cierre no justifican un postmortem.
- El desacuerdo principal fue cuándo proteger `main`: inmediatamente o antes del piloto. Se eligió activación progresiva porque el proyecto sigue siendo un prototipo interno, con gatillo anticipado si un nuevo P0/P1 escapa a `main` después de haber sido declarado cerrado.
- Una revisión adversarial final no encontró bloqueantes y sí corrigió duplicación normativa, una métrica sin base, el dueño del gate prepiloto, la evidencia de independencia y el umbral de bypass.

### Decisión material

- **Decisión:** proceso dormido por umbral, sin documentos nuevos ni reuniones obligatorias.
- **Motivo:** conservar trazabilidad y prevención sin duplicar trabajo ni frenar el MVP.
- **Alternativas descartadas:** ADR por archivo; postmortem para todo P0/P1; PR obligatorio inmediato sin un smoke central estable.
- **Consecuencia:** decisiones materiales y mini-retrospectivas viven en `WORKLOG`; la protección de `main` se activa antes del piloto o ante un nuevo escape P0/P1.
- **Revisar o revertir si:** después de cuatro semanas desde la activación u ocho PR los checks no detectan defectos antes del merge, producen falsos fallos o agregan demora observable sin señal.

### Reglas adoptadas

- La PM no necesita programar ni arbitrar hechos técnicos: dev y lead los resuelven con evidencia y escalan sólo decisiones de producto, costo, prioridad, experiencia o riesgo, en lenguaje común y con una recomendación.
- Registrar una decisión material sólo si dura más de un hito y cambia contratos/datos, proveedor/costo, concurrencia/recuperación, conducta de producto o es costosa de revertir.
- Hacer mini-retrospectiva sin culpa sólo ante impacto externo/real o una segunda recurrencia sistémica; máximo 20 minutos y tres acciones verificables.
- Antes del piloto, dev y lead deben activar y probar PR, CI determinista, smoke del núcleo, revisión independiente de solo lectura y prohibición de `force-push`; la PM sólo autoriza iniciar el piloto.
- No convertir Gemini, servicios externos, cantidad de agentes, documentos o pruebas en gates ceremoniales.

### Reconciliación y verificación

- `fa42c73` no estaba publicado en ninguna rama remota. Se tomó el contenido del commit local real y se aplicó manualmente sobre el `main` vigente para conservar intactos el código, las pruebas y la documentación posterior de la bandeja.
- `PRODUCT` y `ROADMAP` ahora reflejan que la bandeja está aceptada y que el próximo objetivo técnico es grabación directa desde web móvil.
- `npm test`: **129/129** funcionales + **130/130** de edición de sesión, salida 0.
- `npm run test:session-edit:browser`: **108/108** en Chromium real, salida 0.
- `npm run test:runtime-supervisor`: health, upload, worker, estado `ready` y apagado limpio, salida 0.
- `npm run build`, `npm run lint` y `git diff --check`: aprobados.
- Gemini real: no ejecutado; no forma parte de este hito documental y el proveedor predeterminado sigue siendo `fake`.

## 2026-07-18 — Grabación directa desde web móvil

### Objetivo

Que el profesional grabe una nota post-sesión desde el celular y la envíe por el pipeline existente (almacenamiento temporal → worker → borrador → revisión → confirmación), sin crear otro pipeline.

### Qué se hizo

- UI de grabación en el modo audio del modal: `Grabar → Detener → escuchar → Regrabar/Usar`, con temporizador y reproducción. El micrófono se pide **sólo al tocar Grabar** (`getUserMedia` + `MediaRecorder`).
- La grabación se convierte en un `File` y se envía por el **mismo** `prepareWebAudioDraft` (idempotencia por huella + clave, polling acotado, recuperación). No hay pipeline nuevo ni conversión: WebM/Opus (Android/Chrome) y MP4/AAC (iOS/Safari) se aceptan tal cual; el store ya los sniff-ea y valida.
- Paciente y datos clínicos se exigen antes de grabar y quedan fijados mientras exista audio. El micrófono y el audio temporal se liberan al detener, regrabar, descartar, cambiar a texto, cerrar o salir (tracks `stop()` + `revokeObjectURL`).
- Permiso denegado o navegador incompatible: se explica el problema y quedan las alternativas de archivo y texto. Se advierte al cerrar el modal o recargar con una grabación sin enviar.
- Límite: la toma en curso no se persiste entre recargas (no guardamos audio crudo en el navegador, por privacidad/tamaño); la idempotencia evita duplicados si se reintenta la subida.

### Verificaciones (resultados exactos)

- `npm test`: **129/129** funcionales + **130/130** de edición + **15/15** de grabación móvil (`scripts/mobile-recording-tests.js`), salida con código 0.
- `npm run test:mobile-recording:browser`: **30/30** en Chromium con micrófono simulado (`--use-fake-device-for-media-stream`): grabar→usar→nota `fake`→confirmar→persistir tras recargar; micrófono liberado al detener; permiso denegado sin borrador/sesión y con alternativas; regrabar descarta la toma previa; preparar deshabilitado durante la subida; respuesta perdida + reintento sin duplicar; cerrar con grabación sin enviar advierte; **subida fallida deja paciente/datos bloqueados y el reintento conserva el paciente**; doble toque en adquisición lenta adquiere una vez; adquisición invalidada detiene el stream tardío; y logout apaga recorder/micrófono, libera el audio local y no crea sesión. El runner sale con código 0 (espera server/worker con `SIGKILL` acotado de respaldo).

### Ronda de verificación (correcciones tras auditoría)

- **B1:** en `prepareWebAudioDraft`, la falla de subida ya **no** desbloquea los campos si queda una grabación sin enviar (`!currentWebAudioDraftId && !hasUnsentRecording()`), así el reintento sigue atado al mismo paciente.
- **B2:** `startWebAudioRecording` deshabilita dobles toques con `webAudioAcquiringMic`; cada pedido lleva un `webAudioMicRequestId` monotónico; si se invalida mientras `getUserMedia` está pendiente (cerrar modal, cambiar a texto, logout, nueva toma), el stream que resuelve tarde se detiene de inmediato. `logout` aborta la subida, detiene recorder/tracks, libera el blob y limpia los punteros de borrador.
- **B3:** el runner de navegador ahora espera realmente el `exit` de server y worker con `SIGTERM`→`SIGKILL` acotado, y exige salida 0 (antes imprimía el total pero no terminaba).
- **Fixes:** aserción de limpieza por archivo grande ahora compara conteo antes/después (ya no es siempre verdadera); `DOMAIN_CONTRACTS` corregido (la grabación web ya existe y usa el mismo upload); `HANDOFF` apunta a los commits móviles como último hito.
- `npm run test:session-edit:browser`: **108/108** (sin regresiones). `npm run lint`: aprobado. `git diff --check`: limpio.
- `AUDIO_TRANSCRIBER=fake` por defecto. Gemini real: no ejecutado (sin credencial).

### Bloqueo de validación (declarado, no oculto)

- **Sin acceso a iPhone/Android reales** desde este entorno, no se ejecutó el smoke en dispositivos físicos. La grabación quedó verificada con micrófono simulado en Chromium headless; **no se declara soporte móvil completo** hasta correr el smoke real en Safari/iOS y Chrome/Android. Es el siguiente paso recomendado antes de pilotear.

## 2026-07-18 — Bandeja: aislamiento por cuenta, huérfanos y sync de reintento

### Objetivo

Dos correcciones acotadas antes de cerrar el hito de la bandeja: aislar el trabajo local por cuenta y mantener la bandeja sincronizada sin recargar. Fuera de alcance: repetir la auditoría general de concurrencia, grabación móvil, Gemini, reconstruir `fa42c73` (Codex reconcilia esa política aparte).

### Qué se hizo

- **Aislamiento por cuenta (P0 de fuga de datos).** Las claves locales ahora incluyen la cuenta autenticada: `aira:conflict:<cuenta>:<id>:<tab>` y `aira:pending:<cuenta>:<id>:<tab>`, con `<cuenta>` derivada del `sub` del JWT (`accountScope()`). La bandeja y la ficha sólo leen registros de la cuenta actual, así una nota/conflicto/recuperación de un profesional nunca se ve bajo otra cuenta en la misma pestaña. Al cerrar sesión se limpia el estado en memoria (`sessionSaveState`) y se vacía la bandeja.
- **Registros huérfanos.** Un registro cuya sesión fue borrada o es inaccesible ya no genera una tarjeta que no se puede abrir ni descartar: se muestra como `Sesión no disponible` con **sólo** un botón Descartar (no abre ficha), y descartarlo limpia el registro local.
- **Sync de reintento.** Tras un reintento exitoso de recuperación, la entrada y la bandeja desaparecen de inmediato (vía `finishSaveChain → renderDraftsTray`), sin recargar.

### Verificaciones (resultados exactos)

- `npm test`: **129/129** funcionales + **130/130** de edición de sesión, salida con código 0.
- `npm run test:session-edit:browser`: **108/108** en Chromium real, sin errores de página (93 previos + 15 nuevos). Secciones nuevas: 5t huérfano descartable (borra la sesión vía API, verifica tarjeta no-abrible, descarta), 5u reintento que limpia entrada+bandeja sin recargar, 5v aislamiento real (A deja `SECRETO-DE-A`, `window.logout()`, login de B en la misma pestaña vía formulario, B no ve texto ni entradas de A; el registro de A sigue en `localStorage`, sólo fuera de alcance por la cuenta).
- `npm run lint`: aprobado (sintaxis + contrato UI). `git diff --check`: limpio.
- Gemini real: no ejecutado (sin credencial); proveedor por defecto `fake`.

## 2026-07-18 — Bandeja de borradores y conflictos fuera del modal

### Objetivo

Que el profesional vea su trabajo sin confirmar sin tener que reabrir cada ficha. Cierra el pendiente de backlog "bandeja para recuperar borradores fuera del modal" (PRODUCT.md §Próximo dentro del núcleo). Fuera de alcance por pedido de la PM: grabación móvil directa y Gemini.

### Qué se hizo

- Panel `Trabajo sin confirmar` en el dashboard (`#draftsTrayRow`), oculto salvo que haya pendientes.
- `renderDraftsTray()` lee los mismos registros por pestaña de `localStorage` que usa la ficha (`aira:conflict:<id>:<tab>` y `aira:pending:<id>:<tab>`), la única fuente de verdad, así bandeja y modal nunca se contradicen.
- Cada entrada abre la ficha en su vista de conflicto o de recuperación (misma ruta `showSessionDetail`). Click y teclado (Enter/Espacio) mediante handlers delegados.
- Se re-renderiza al crear o resolver trabajo: `loadDashboardData` (arranque/recarga), conflicto nuevo, agotar reintentos, `clearSessionConflict` (incluye "Usar la del servidor") y `discardRecovery`.
- Reglas: un borrador cuyo guardado sigue en vuelo en la pestaña no aparece (no está atascado); un conflicto y un borrador de la misma sesión se muestran una sola vez (gana el conflicto); nombres y notas se renderizan con `.text()`, nunca como HTML.

### Verificaciones (resultados exactos)

- `npm test`: **129/129** funcionales + **130/130** de edición de sesión, salida con código 0.
- `npm run test:session-edit:browser`: **93/93** en Chromium real, sin errores de página (los 80 previos + 13 casos de la bandeja: aparece tras guardado agotado, lista y etiqueta el borrador, lo renderiza como texto y no como HTML, sobrevive a la recarga, abre la vista de recuperación al clickear, se limpia al descartar; muestra y etiqueta un conflicto pendiente, abre los ocho campos al clickear, y se oculta al resolver todo).
- `npm run lint`: aprobado (sintaxis + contrato UI). `git diff --check`: limpio.
- Gemini real: no ejecutado (sin credencial); proveedor por defecto `fake`.

### Nota honesta

Primera corrida de navegador: 91/93. Los dos rojos eran mis propias aserciones de "bandeja vacía", que suponían un `localStorage` limpio; sin embargo, secciones previas del suite dejan registros legítimos de otras sesiones. No era un defecto del producto: la bandeja mostraba correctamente ese trabajo pendiente. Se corrigió el test aislando la sección (limpia las claves de la pestaña antes de sus casos), no el comportamiento.

## 2026-07-16 — Modelo por intento: reverts, merge, recuperación y guardas

### Objetivo

Cerrar los bloqueantes de una sexta auditoría adversarial sobre `e3b7171`. Honestidad: la concurrencia de edición se declara cubierta **sólo** por los casos de aceptación de abajo, ahora en verde; ninguna entrada previa debe leerse como cierre definitivo.

### Bloqueantes resueltos

1. **Modelo por intento.** Cada guardado es un registro `{seq, desired, base, appliedBase, wireDelta, revision}`. Se acabó el `editBase` global: la base del delta se **resetea en cada éxito**, así una v2 creada después de v1 compara su intención contra v1 y un **revert** de campo se envía (delta no vacío). Un delta vacío es no-op.
2. **"Editar mi versión" hace merge.** Diffea contra la base **original** del conflicto (no reenvía los ocho campos stale). Repro en verde: servidor cambia sólo modalidad→video, usuario cambia sólo nota, conflicto → Editar mi versión → Guardar → nota del usuario + modalidad video.
3. **Recuperación local real.** Persiste snapshot completo + base + revisión + secuencia por **pestaña** (`tabId` en `sessionStorage`); se ofrece al abrir la ficha con Reintentar/Descartar; no guarda sólo el delta; dos pestañas no se borran entre sí.
4. **No se limpia el conflicto hasta éxito o "Usar servidor".** Ante `400/500/red/segundo 409` reaparecen los ocho campos con acciones habilitadas.
5. **Respuesta perdida durante merge parcial.** Se compara el servidor contra el estado completo esperado `appliedBase + wireDelta`, no contra el delta ralo.
6. **Formularios sucios protegidos** al cerrar con X/backdrop y al recargar, incluso inválidos (fecha/nota vacías, duración incorrecta).

### Pruebas nuevas de navegador (obligatorias, todas en verde)

- v1 cambia A, v2 revierte A, tercero cambia B, `409` + retry → v2 y la B del tercero.
- Editar mi versión no pisa el campo remoto.
- Cinco PATCH abortados **contados** + recarga + recuperación de la versión completa.
- Conflicto → retry → respuesta perdida.
- Conflicto → retry → segundo `409`.
- Cerrar/reabrir formulario sucio **inválido**.
- Dos pestañas con recuperaciones distintas.
- Cancelar durante una solicitud en curso.

### Verificaciones (resultados exactos)

- `npm test`: **129/129** funcionales + **130/130** de edición de sesión, salida con código 0.
- `npm run test:session-edit:browser`: **80/80** en Chromium real, sin errores de página.
- `npm run lint`: aprobado. `git diff --check`: limpio. `npm audit`: 0 vulnerabilidades.
- Gemini real: no ejecutado (sin credencial); proveedor por defecto `fake`.

## 2026-07-16 — Roles, desacuerdo y revisión multiagente

### Objetivo

Establecer cómo colaboran PM, dev y lead/auditor, incluyendo autonomía, preguntas, desacuerdos con evidencia, revisión adversarial y multiagentes para ambos roles.

### Decisión

- La PM decide problema, prioridad, alcance, UX, precio y aceptación de riesgos de producto.
- La dev decide la implementación técnica reversible dentro de los contratos y conserva responsabilidad sobre lo que publica.
- El lead/auditor define gates, revisa evidencia y coordina revisiones; no amplía el producto ni tiene razón por jerarquía.
- La dev puede y debe discutir una instrucción de Codex o del auditor con reproducción, prueba, contrato, diff o medición. El auditor debe responder con evidencia y corregirse si fue refutado.
- La dev pregunta sólo ante cambios materiales de producto, UX, contratos, datos, costos, integraciones, acciones irreversibles, contradicciones o cambios ajenos. Las decisiones técnicas reversibles se toman y documentan sin frenar el hito.
- Tanto dev como lead pueden usar multiagentes para riesgos altos o frentes independientes. Los agentes trabajan primero de forma independiente; la síntesis se basa en evidencia, no en mayoría.
- Se formalizaron severidades P0–P3. P0/P1 bloquean con evidencia; P2/P3 pueden documentarse sin ampliar el hito.
- Se limitan las auditorías generales a una ronda completa y una de verificación. Sólo un P0/P1 nuevo dentro del alcance reabre el hito.

### Archivos

- `docs/ROLES_AND_REVIEW.md`: protocolo completo, matriz de decisiones, formatos de pregunta/discrepancia, multiagentes, auditoría y cierre.
- `AGENTS.md`: resumen obligatorio y enlace al protocolo.
- `docs/README.md` y `docs/HANDOFF.md`: orden de lectura y estado operativo actualizados.

### Verificación

- Dos revisiones independientes: perspectiva de la dev y perspectiva del auditor.
- `git diff --check` como gate documental.
- Sin cambios de código ni pruebas funcionales necesarias para este hito.

## 2026-07-16 — Protocolo permanente para agentes y briefs de desarrollo

### Objetivo

Versionar la forma de hablar con la PM y de darle instrucciones a la dev para evitar pedidos ambiguos, cierres prematuros y pérdida de contexto entre agentes.

### Trabajo realizado

- Se agregó `AGENTS.md` en la raíz para que los agentes lean primero HANDOFF, WORKLOG, PRODUCT, ROADMAP y DOMAIN_CONTRACTS, verifiquen `main` y no mezclen cambios ajenos.
- Se fijó comunicación en español, breve, objetiva y adversarial: diferenciar implementado, simulado, probado, pendiente e hipótesis; no actuar como *yes-man*.
- Cada brief para la dev debe cubrir un solo hito con objetivo, incluido, fuera de alcance, criterios observables, validación adversarial y entrega.
- Se exige probar recuperación, persistencia, duplicados, respuestas tardías o concurrencia cuando correspondan, y revisar el diff una segunda vez antes de declarar un hito cerrado.
- Se agregó una plantilla copiable y la regla de informar resultados exactos, límites y bloqueos sin inventar evidencia.
- `docs/README.md` enlaza las instrucciones permanentes antes del orden de lectura documental.

### Verificación

- `git diff --check` como gate documental.
- Sin cambios de código ni pruebas funcionales necesarias para este hito.

## 2026-07-16 — Posicionamiento, Calendar, precio y seguimiento futuro

### Objetivo

Convertir la discusión estratégica y la revisión competitiva en documentación versionada para que el producto no dependa de la memoria de una conversación.

### Decisiones registradas

- Se ratificó el foco original: AIRA optimiza la carga post-sesión mediante texto o audio breve del profesional. No es diagnóstico, grabación ambiental ni historia clínica integral.
- Se definió la categoría comercial como **asistente de cierre clínico post-sesión por voz** y el beachhead como psicólogos clínicos independientes de Argentina. Psiquiatría queda como segunda cohorte.
- La revisión adversarial confirmó que `audio → nota` no es diferenciador suficiente: Brauni ofrece un recorrido similar; Psik, MentalGest, Upheal y Mentalyc cubren partes relevantes. El diferencial a validar es flujo móvil breve, no grabar al paciente, español clínico local, revisión obligatoria, integración liviana y precio proporcional al uso.
- Google Calendar quedó aprobado como capa de contexto del núcleo, no como agenda propia. La V1 propuesta es de solo lectura: sesiones terminadas sin nota, vínculo evento–paciente confirmado y carga con paciente/fecha/duración precargados. Se implementa después del núcleo si al menos 3 de 5 pilotos usan Calendar.
- Se creó la hipótesis futura **AIRA Seguimiento** para psiquiatría: indicación confirmada → recordatorio discreto → autoinforme → resumen para la próxima consulta. No forma parte del MVP y no debe implementarse antes de entrevistas, voluntad de pago y validación de plantillas con Meta.
- Se dejó explícito que la IA nunca activa dosis u horarios, que `Tomada` es autoinforme y que la primera versión no ofrece monitoreo 24/7 ni consejo clínico automático.
- Hipótesis de precio local: 10 notas confirmadas sin cargo; luego `0,05 UP` por nota con tope mensual de `3 UP`. Calendar se incluye en AIRA Notas; Seguimiento se cobraría aparte por paciente activo. El precio queda sujeto a costos reales y margen mínimo de 70%.
- Gate del primer piloto: cinco psicólogos, dos semanas, 60% de sesiones elegibles documentadas, 80% de borradores confirmados en 24 horas, edición mediana menor a dos minutos, 85% con correcciones menores, cero errores críticos y 3 de 5 dispuestos a pagar.

### Archivos

- `docs/PRODUCT.md`: fuente de verdad completa para posicionamiento, mercado, arquitectura del producto, Calendar, Seguimiento, precio, orden y gates.
- `docs/ROADMAP.md`: secuencia actualizada, etapa Calendar condicional y discovery de Seguimiento.
- `docs/HANDOFF.md`: resumen operativo y siguiente objetivo alineados.
- `docs/DOMAIN_CONTRACTS.md`: sin cambios intencionalmente; no se documentaron contratos de funciones todavía no implementadas.

### Verificación

- Revisión cruzada de enlaces, términos y consistencia entre PRODUCT, ROADMAP y HANDOFF.
- `git diff --check` como gate documental.
- No se modificó código ni se ejecutaron pruebas funcionales porque el hito es exclusivamente documental.
## 2026-07-16 — Cola por secuencia, conflicto multicampo y recuperación agotada

### Objetivo

Cerrar los bloqueantes de una quinta auditoría adversarial sobre `e960352`. Nota honesta: las entradas anteriores describían avances de concurrencia, pero recién con los casos de abajo en verde la edición concurrente queda cubierta; ninguna entrada previa debe leerse como "concurrencia cerrada".

### Prioridad 1 — se podía perder la versión más nueva

- Repro confirmado: con la red caída durante más de cuatro reintentos quedaba una `pending` (v2) coexistiendo con `inFlight=false`; al guardar v3 la respuesta vieja de la cola hacía que la base terminara en v2.
- Cada edición ahora lleva una **secuencia monotónica**; la ranura `pending` guarda sólo la más nueva y un único `pump` es el emisor, así un payload viejo no puede sobrevivir ni pisar a uno nuevo.
- Al agotar `recoverLostSave` ya no queda `pending` con `inFlight=false`: la más nueva se guarda en `localStorage` y se limpia `pending`. Prueba nueva de navegador: 5 PATCH abortados + guardar v3 → interfaz y base terminan en **v3**.

### Prioridad 2 — conflicto recuperable y completo

- El panel de conflicto muestra servidor vs usuario para **los ocho campos editables**, con diferencias resaltadas.
- **Reintentar** hace un merge de 3 vías: envía sólo los campos que cambié respecto de mi base de edición, sin pisar un campo que tocó el otro cliente.
- El conflicto se **persiste** (`localStorage`): cerrar y reabrir la ficha, y recargar la página, lo vuelven a mostrar.
- `beforeunload` advierte con formulario modificado o conflicto pendiente.
- Las acciones de conflicto se deshabilitan mientras un reintento está en curso.
- Pruebas nuevas: conflicto multicampo, cerrar/reabrir, recargar, "Editar mi versión", "Usar la del servidor" y deshabilitado durante el reintento.

### Prioridad 3

- La revisión se valida como entero positivo seguro (`Number.isSafeInteger(revision) && revision > 0`): `0` y números enormes/inseguros dan `400`.
- HANDOFF: SHA del último hito (`48383a1`), fecha y descripción; cifras reales.

### Verificaciones (resultados exactos)

- `npm test`: **129/129** funcionales + **130/130** de edición de sesión, salida con código 0.
- `npm run test:session-edit:browser`: **64/64** en Chromium real, sin errores de página.
- `npm run lint`: aprobado. `git diff --check`: limpio. `npm audit`: 0 vulnerabilidades.
- Gemini real: no ejecutado (sin credencial); proveedor por defecto `fake`.

## 2026-07-16 — Precondición obligatoria, UI de conflicto y recuperación

### Objetivo

Cerrar los bloqueantes de una cuarta auditoría adversarial sobre `b9cde96`: el CAS estaba bien pero la concurrencia no podía declararse cerrada porque la precondición no era obligatoria, el formulario se cerraba antes de confirmar y no había recuperación ante respuesta perdida.

### Bloqueantes resueltos

1. **Revisión obligatoria:** `PATCH /api/sessions/:id` ahora exige `If-Match`. Falta → `428 REVISION_REQUIRED` sin cambios; malformada (no entero positivo) → `400 INVALID_REVISION`. Un cliente viejo o sin cabecera no puede sobrescribir. Un cuerpo vacío/ignorado (`{}`, `[]`, sólo campos ignorados) → `400 EMPTY_PATCH` sin tocar `revision`.
2. **No destruir el formulario antes de confirmar:** el guardado ya no cierra la edición de forma optimista; la ficha vuelve a solo lectura recién al confirmar. Ante `409` se muestra un panel de conflicto con la versión del servidor y "mi versión" íntegra, y botones para reintentar (sobrescribe con la revisión fresca), editar mi versión o usar la del servidor.
3. **Nunca perder v2:** un `409` de v1 mientras v2 está pendiente conserva v2 como "mi versión" (no ejecuta un `pending = null` que la pierda); queda visible y recuperable.
4. **Respuesta perdida:** ante un error de red sin respuesta, el cliente consulta la sesión; si el servidor ya contiene la edición (revisión +1 y contenido coincidente) adopta esa revisión y envía la pendiente; si no, reintenta; si otro cliente avanzó, abre el conflicto.
5. **Advertencia de salida:** `beforeunload` avisa mientras haya guardados en vuelo o pendientes.

### Contrato y pruebas

- Se agregaron casos inválidos para `inputType`, `rawTranscript` y `audioDurationSeconds` en la matriz de POST.
- Se renombró la prueba antes llamada "solicitudes reordenadas": ahora refleja que demuestra **serialización ante una primera solicitud lenta**, no que v2 llegue al servidor antes que v1.
- Se actualizaron las pruebas funcionales para enviar `If-Match` (la precondición es obligatoria).
- Nuevas pruebas de aceptación en navegador: respuesta de v1 cortada con `route.fetch()`+abort con v2 en cola → base e interfaz terminan en v2; `409` de v1 con v2 pendiente → v2 recuperable y visible; conflicto entre pestañas → no se pisa el cambio ajeno ni desaparece el texto local, y el reintento con mi versión persiste.

### Documentación

- `DOMAIN_CONTRACTS.md`: se agregó `revision` al contrato de `Session` y una sección de edición/concurrencia con `If-Match`, `428`, `409`, `EMPTY_PATCH`, tipos estrictos y comportamiento del cliente.
- `HANDOFF.md`: hito, checkbox de edición marcado y cifras reales.

### Verificaciones (resultados exactos)

- `npm test`: **129/129** funcionales + **128/128** de edición de sesión, salida con código 0.
- `npm run test:session-edit:browser`: **53/53** en Chromium real, sin errores de página.
- `npm run lint`: aprobado. `git diff --check`: limpio. `npm audit`: 0 vulnerabilidades.
- Gemini real: no ejecutado (sin credencial); el proveedor por defecto sigue `fake`.

## 2026-07-16 — Concurrencia real de edición y contrato estricto

### Objetivo

Cerrar los hallazgos de una tercera auditoría adversarial sobre `ef2d639`: el control `sessionSaveSeq` sólo protegía la pantalla y una solicitud vieja tardía podía sobrescribir en SQLite una edición nueva. Además endurecer el contrato contra arrays/objetos y ampliar la matriz a POST.

### Prioridad 1 — concurrencia

- **Revisión optimista en el backend:** migración `007_session_revision.sql` agrega `revision` (default 1) a `sessions`; `updateSession` actualiza de forma condicional (`WHERE ... AND revision = ?`) e incrementa. `PATCH /api/sessions/:id` lee `If-Match`; ante revisión obsoleta responde `409` con la sesión actual y **no** sobrescribe. `normalizeSession` expone `revision`.
- **Serialización en el cliente:** los guardados de una misma sesión ya no salen en paralelo; si hay uno en curso se conserva sólo la última edición pendiente y se envía al terminar, con la revisión fresca devuelta por el guardado anterior. Así el último guardado gana también en la base, no sólo en la interfaz.
- **Protección de formulario sucio:** una respuesta tardía sólo redibuja la modal si sigue mostrando esa sesión y no está en modo edición, de modo que no cierra ni descarta una edición reabierta con cambios sin guardar.
- **Conflicto entre pestañas:** el cliente adopta la versión del servidor y avisa; nunca pisa el cambio ajeno.

### Prioridad 2 — contrato estricto

- **Rechazo de arrays/objetos antes de coercionar:** nuevo middleware `validateRawSessionTypes` corre antes de `normalizeSessionInput` (que coercionaba `["individual"]` → `"individual"` por acceso de clave). IDs y textos deben ser strings (id de paciente además admite número), duración y ánimo enteros JSON reales, seguimiento booleano real. Un `patientId` objeto da `400`, nunca `500`.
- **Fecha de calendario real** (rechaza `2026-02-31`), tipos/modalidades por lista, con `typeof` estricto en vez de coerción de express-validator.
- **`inputType`, `rawTranscript` y `audioDurationSeconds` validados en POST.**
- La misma matriz adversaria (34 casos, incluidos arrays y objetos) se aplica **por caso** a POST y PATCH; se verifica que ningún campo —incluida medicación y `revision`— cambie y que ninguna sesión se cree.

### Prioridad 3 — UX y documentación

- La notificación de alta de paciente usa `escapeHtml`: muestra `Paciente <Equipo>` literal.
- `HANDOFF.md` y `AUDIO_PROVIDER_BENCHMARK.md` actualizados (hito, cifras reales, CI, cleanup de 3 s, portabilidad honesta del corpus TTS y del runner de navegador).

### Verificaciones (resultados exactos)

- `npm test`: **129/129** funcionales + **108/108** de edición de sesión, salida con código 0. Incluye migración `007` y la columna `revision`.
- `npm run test:session-edit:browser`: **46/46** en Chromium real, con las pruebas deterministas de concurrencia: A-v2 sobre A-v1 demorada, **A-v2 con solicitudes reordenadas (la primera llega tarde al servidor)**, `409` entre clientes sin sobrescribir, y formulario sucio preservado.
- `npm run lint`: aprobado. `git diff --check`: limpio. `npm audit`: 0 vulnerabilidades.
- No se ejecutó Gemini real: sigue sin credencial y el proveedor por defecto continúa `fake`.

## 2026-07-16 — Segunda auditoría de edición + integración de Gemini

### Objetivo

Cerrar los hallazgos de una auditoría adversarial independiente sobre `main` y, con todo en verde, integrar el arreglo de Gemini `user_input`.

### Trabajo realizado

- **Reasignación de paciente bloqueada:** `PATCH /api/sessions/:id` rechaza `patientId`/`pacienteId` con `400` (middleware `rejectPatientReassignment`) y además los elimina de los cambios; una sesión ya no puede moverse a otro paciente.
- **Contrato POST/PATCH unificado de verdad:** se extrajo `clinicalSessionValidators()` compartido; la fecha se valida contra el calendario real (rechaza `2026-02-31` y `not-a-date`), y `normalizeSessionInput` dejó de inyectar defaults en PATCH, así `null`, `false` o tipos inválidos llegan al validador en vez de coercionarse. Todo cuerpo inválido devuelve `400` sin persistir.
- **Carrera A→A:** el guard por `id` no bastaba; se agregó una secuencia monotónica por sesión (`sessionSaveSeq`) de modo que una respuesta vieja (A-v1) demorada no pisa una más nueva (A-v2) ni en la interfaz ni en la base.
- **Escaping de nombres y notas:** se agregó `escapeHtml` y se aplicó en tarjetas de sesión, actividad reciente del dashboard, modal de "hoy", tarjetas de paciente y los selectores de paciente; `Paciente <Equipo>` y una nota con HTML se muestran literales en todos lados.
- **Prueba de navegador reproducible:** el runner resuelve el navegador por `PLAYWRIGHT_CHROMIUM_PATH`/`CHROMIUM_PATH`, instalaciones del sistema (macOS/Linux) o el canal `chrome`, en vez de asumir `/opt/pw-browsers`. Se agregó un job de CI en ubuntu con el Chrome del sistema. La cobertura de filtros ahora incluye paciente **y** fecha.
- **Integración de Gemini:** se integró `536c11c` (`fix gemini v1 audio input shape`) desde la rama remota `gemini-user-input-fix`: envuelve texto y audio en un paso `user_input`, corrige la aserción contractual, agrega un `--probe` de un audio y amplía el timeout de cleanup remoto a 3s. Se conserva el reporte fallido `benchmarks/audio/results/gemini-smoke-20260715-failed-input-shape.json` como artefacto de auditoría; **0/40 es un fallo de contrato, no evidencia de calidad**, y el smoke debe repetirse (probe y luego completo) cuando exista credencial.

### Pruebas agregadas / ampliadas

- `scripts/session-edit-tests.js`: rechazo de reasignación de paciente y los casos de contrato `not-a-date`, `2026-02-31`, `telepathy`, `"false"`, medicación de 5001 caracteres, `sessionType:null` y `cleanNote:false`. 27 checks.
- `scripts/session-edit-browser-tests.js`: carrera A→A determinista (UI y base conservan A-v2), render literal de nombre y nota en listado y dashboard, y conservación del filtro de fecha además del de paciente; runner de navegador portable. 38 checks.

### Verificaciones (resultados exactos)

- `npm test`: **129/129** funcionales + **27/27** de edición de sesión, salida con código 0.
- `npm run test:session-edit:browser`: **38/38** en Chromium real, sin errores de página.
- `npm run lint`: aprobado. `git diff --check`: limpio.
- `npm audit`: 0 vulnerabilidades. El reporte de Gemini y el árbol se revisaron: no contienen claves.

## 2026-07-16 — Endurecimiento de la edición de sesiones

### Objetivo

Cerrar la revisión de la edición de sesiones: el camino feliz funcionaba pero faltaban validación de contrato, borrado de medicación, robustez de formulario, manejo de concurrencia, conservación de filtros, accesibilidad por teclado y pruebas que cubrieran todo esto.

### Trabajo realizado

- **Borrado de medicación:** `services/sqlite.js` (`updateSession`) distinguía mal "campo ausente" de "vaciado explícito" por usar `??`; ahora vaciar la medicación persiste `NULL` y desaparece de la ficha.
- **Validación del `PATCH /api/sessions/:id`:** se agregó el mismo contrato que el POST —fecha `YYYY-MM-DD`, tipos y modalidades permitidos, duración entera 1–480, ánimo 1–5 o nulo, booleano real para seguimiento y límites de texto—; un cuerpo fuera de contrato devuelve `400` y no persiste.
- **Formulario de edición:** pasó a guardarse por submit; rechaza duración decimal (`45.9`) y exponencial (`4e2`) en lugar de truncarlas, exige fecha no vacía en vez de conservar la anterior en silencio y valida en el mismo handler.
- **Carrera A/B:** la respuesta de una edición se vincula al `id` guardado; sólo redibuja la modal si sigue mostrando esa sesión, así una respuesta tardía de A no reemplaza el contenido de una B abierta. Título y cuerpo se renderizan juntos para que nunca queden desalineados.
- **Filtros:** guardar una edición ya no llama a `loadSessionsData` (que reseteaba el filtro); reaplica los filtros de paciente y fecha vigentes.
- **Teclado y XSS:** las tarjetas ya abrían con Enter y Espacio (handler delegado); se agregó cobertura. El nombre del paciente en el formulario se inserta con `.text()`, nunca interpolado como HTML.

### Pruebas agregadas (versionadas)

- `scripts/session-edit-tests.js` (headless, dentro de `npm test`): edición completa con persistencia tras recarga, borrado de medicación a `NULL`, doce cuerpos inválidos que devuelven `400` sin persistir, inmutabilidad de `rawTranscript`/`inputType`/`audioDurationSeconds` y limpieza de campos anulables.
- `scripts/session-edit-browser-tests.js` (Chromium por `playwright-core`, `npm run test:session-edit:browser`, fuera de `npm test` porque necesita navegador y los assets `vendor/`): edición completa con recarga real, borrado de medicación, rechazo de duración decimal/exponencial y de fecha vacía sin enviar PATCH, respuesta tardía de A que no altera la B abierta, conservación de filtros, apertura por teclado y nombre de paciente como texto.
- Se agregó `playwright-core` como `devDependency`; `npm audit` sigue en 0 vulnerabilidades.

### Verificaciones (resultados exactos)

- `npm test`: **129/129** funcionales + **23/23** de edición de sesión, salida con código 0 (Node.js 22).
- `npm run test:session-edit:browser`: **28/28** en Chromium real, sin errores de página.
- `npm run lint` (`check:syntax` + `test:ui-contract`): aprobado; 25 archivos Node y 2 scripts embebidos.
- `npm audit`: 0 vulnerabilidades.

### Pendiente explícito

- El commit local `536c11c` (arreglo Gemini `user_input`, sus pruebas y el reporte 0/40) **no estaba publicado ni era alcanzable** al momento de esta entrada. No se reconstruyó ni se fabricó su reporte. **Resuelto** más tarde el mismo día: se publicó como rama `gemini-user-input-fix` y se integró en `main`; ver la entrada superior "Segunda auditoría de edición + integración de Gemini".

## 2026-07-16 — Edición visible de sesiones guardadas

### Objetivo

Cerrar el pendiente de la ficha web: permitir editar una sesión ya guardada desde su propia modal de detalle sin salir del recorrido clínico, respetando los campos inmutables.

### Trabajo realizado

- La modal `#sessionDetailModal` pasó de ser solo lectura a tener un pie dinámico: el modo vista ofrece **Editar** y **Cerrar**; el modo edición ofrece **Cancelar** y **Guardar cambios**.
- `renderSessionDetailView` redibuja el detalle e inserta el texto clínico con `.text()`, de modo que la nota, la medicación y la transcripción original nunca se interpretan como HTML.
- `enterSessionEditMode` arma un formulario con los mismos controles clínicos explícitos que la carga nueva —fecha clínica, tipo, duración, modalidad, contenido, medicación, evaluación anímica opcional y un checkbox independiente de seguimiento— y precarga los valores por la API del DOM, no por interpolación.
- `saveSessionEdit` valida contenido y duración en el cliente, envía `PATCH /api/sessions/:id`, actualiza `appData` en el lugar conservando `patientName`, refresca dashboard y lista, y vuelve a la vista de solo lectura.
- El paciente se muestra fijo: la edición no reasigna la sesión a otra persona.
- `rawTranscript`, `inputType` y `audioDurationSeconds` no se envían desde el formulario; además el normalizador del servidor ya los ignora en PATCH, por lo que permanecen inmutables.
- El seguimiento sigue siendo una decisión explícita del checkbox y no se deriva del ánimo.

### Verificaciones

- `npm run check:syntax`: aprobado, incluidos los scripts embebidos de `index.html`.
- `npm run test:ui-contract`: aprobado; los campos clínicos explícitos y la no derivación del seguimiento siguen intactos.
- `npm test`: 129/129 pruebas funcionales aprobadas, más migración, vínculo, conversación, audio sintético y worker de uploads.
- Verificación en navegador real (Chromium + Playwright contra un servidor efímero con SQLite temporal): se sembró una sesión por API, se abrió la ficha haciendo clic en la tarjeta, se comprobó que el formulario precarga contenido, duración y fecha, se editaron todos los campos y, tras Guardar, la consulta `GET /api/sessions` confirmó la persistencia de contenido, duración, tipo, modalidad, ánimo, seguimiento y medicación, con `inputType` conservado y sin errores de página.

### Próximo paso

1. Construir la bandeja para recuperar borradores fuera del modal (último pendiente de la ficha web).
2. Retomar el smoke real de Gemini cuando exista `GEMINI_API_KEY` en el entorno.

## 2026-07-15 — Gemini detrás del worker asíncrono

### Objetivo

Integrar Gemini como primer proveedor real sin bloquear la web, sin romper fixtures y sin presentar un corpus sintético como validación clínica.

### Trabajo realizado

- Se agregó un registry de proveedores: `fake` sigue siendo el valor predeterminado y `fixture://` nunca depende de una clave externa.
- El pipeline comparte persistencia y transiciones entre ruta síncrona y asíncrona; los uploads reales se verifican por stream y se procesan sólo desde el worker.
- `geminiAudioTranscriber` usa Files API e Interactions API v1 con Gemini 3.1 Flash-Lite, `store:false`, JSON estructurado y prompt literal.
- El adaptador espera el estado remoto `ACTIVE`, elimina el File en `finally`, acota timeouts y separa retries seguros de POST sin idempotencia.
- Heartbeat, backoff, upload e inferencia escuchan el abort del lease; `stop()` cancela el proveedor activo.
- El supervisor, el worker standalone y el smoke cargan `.env`, por lo que la clave no depende de exportar variables manualmente.
- Un fencing token obsoleto impide que un resultado asíncrono tardío persista raw, clean o el estado del job.
- Se agregó un smoke artificial de 40 WAV TTS con manifiesto, hashes, referencias y spans; los binarios y secretos quedan fuera de Git.
- La corrida real exige árbol Git limpio, manifiesto de bytes fijo y reporte. El reporte conserva commit, hash de corpus/prompt, referencia e hipótesis artificiales, request ID, usage y latencias.
- El smoke se diferencia del benchmark humano decisorio: las voces `es-MX/es-ES`, la corta duración y la ausencia de ruido no representan el uso clínico.

### Revisión multiagente

- Tres agentes revisaron por separado contrato Gemini, worker/leases y corpus/métricas.
- Encontraron polling `ACTIVE` ausente, retries ambiguos, shutdown con timers vivos, cleanup remoto, falta de fencing integrado, reporte no auditable y spans que podían aprobar una contradicción.
- Se corrigieron todos esos puntos y una tercera ronda no dejó bloqueantes de código.

### Verificaciones

- `npm test`: aprobado, incluida la batería funcional 129/129.
- `npm run test:gemini-provider`: aprobado con HTTP simulado, cancelación, heartbeat, shutdown y fencing tardío.
- `npm run test:audio-upload-worker`: aprobado con lease de prueba estable.
- `npm run test:runtime-supervisor`: aprobado.
- `npm run lint`, `npm run check:syntax` y `git diff --check`: aprobados.
- `npm run benchmark:audio-worker`: 40/40 `ready`, cero residuos y todos los gates aprobados después de introducir el pipeline asíncrono.
- `npm run smoke:gemini -- --validate-only`: 40/40 WAV generados y validados offline en macOS.
- En el cierre inicial el smoke real no se ejecutó porque faltaba una clave; la actualización posterior con credencial temporal se registra debajo.
- Commit funcional: `74a6ba3` (`add gemini audio worker integration`).

Actualización con credencial temporal:

- La credencial autenticó contra `models/gemini-3.1-flash-lite` con HTTP 200 y se mantuvo sólo en memoria del proceso.
- La primera corrida real completó 0/40: Interactions v1 rechazó cada request porque texto y audio estaban enviados como contenidos directos en vez de estar envueltos en un paso `user_input`.
- El reporte fallido quedó preservado en `benchmarks/audio/results/gemini-smoke-20260715-failed-input-shape.json`; no contiene la clave.
- Se corrigió el payload, se agregó la aserción contractual correspondiente y un `--probe` de un audio antes de repetir la corrida completa.
- Seis cleanup remotos superaron el timeout inicial de un segundo; se amplió a tres segundos, todavía por debajo de la gracia de apagado del supervisor.

### Decisión de uso

El Free Tier se usa solamente con contenido artificial. No se envía audio de pacientes hasta contar con Paid Tier y las revisiones de privacidad/contrato diferidas por producto. El proveedor predeterminado continúa siendo `fake`.

### Próximo paso

1. Generar un corpus fijo con `npm run corpus:audio:generate`.
2. Configurar la clave localmente, sin pegarla en chats ni versionarla.
3. Ejecutar `npm run smoke:gemini` con `--corpus-manifest` y `--report`.
4. Preparar el corpus humano decisorio y comparar los mismos bytes antes de aprobar proveedor.

## 2026-07-15 — Benchmark controlado del worker de audio

### Objetivo

Medir con 30 a 50 archivos el recorrido real de carga, almacenamiento, cola SQLite, worker y limpieza antes de integrar un proveedor externo.

### Trabajo realizado

- Tres agentes contrastaron diseño de corpus, métricas, concurrencia y límites del proveedor falso.
- Se agregó `npm run benchmark:audio-worker`, que crea un runtime aislado y 40 WAV deterministas de 2 a 10 minutos sin datos reales.
- Cada ejecución usa 226 minutos representados, 103,5 MB, cinco perfiles de señal y concurrencia HTTP cinco.
- El runner exige 40 drafts únicos, acuse menor a cinco segundos, p95 menor a dos minutos, metadata conservada, raw/clean presentes, cero sesiones antes de confirmar, health final, ausencia de errores SQLite y cleanup completo.
- El reporte diferencia explícitamente capacidad operativa de calidad de transcripción: el proveedor falso no escucha los bytes y no permite medir WER, negaciones ni entidades clínicas.

### Verificaciones

- Tres corridas independientes: 120/120 borradores `ready`, cero fallos y cero timeouts.
- Acuse p95: 308,4 ms, 323,6 ms y 290,8 ms; máximo global 365,0 ms.
- Extremo a extremo p95: 1719,4 ms, 1715,6 ms y 1699,1 ms; máximo global 1729,2 ms.
- Cero sesiones prematuras, errores de base o archivos `.part/.audio` residuales.
- `npm test`: aprobado, incluida la batería funcional 129/129.
- `npm run test:runtime-supervisor`: aprobado de health a `ready` y apagado limpio.
- `npm run build`, `npm run lint` y `git diff --check`: aprobados antes de cerrar el hito.
- Commit funcional: `6ebe43b` (`benchmark controlled audio worker throughput`).

### Próximo paso

Preparar 30 a 50 recortes hablados creados para la prueba con referencias humanas, hacer asíncrona la interfaz del proveedor y comparar Groq, Gemini y OpenAI con exactamente el mismo corpus. Meta continúa después del proveedor y requiere credenciales.

## 2026-07-15 — Supervisor verificable y contratos activos alineados

### Objetivo

Cerrar las brechas operativas de la auditoría: desarrollo sin worker, CI distinta del proceso desplegado y documentación activa que todavía describía el audio real como pendiente.

### Trabajo realizado

- `npm run dev` inicia el mismo supervisor servidor+worker que producción y reinicia ambos ante cambios del backend.
- Se agregó un smoke del supervisor que crea entorno temporal, espera health, registra cuenta/paciente, sube WAV real, espera `ready` y exige apagado limpio.
- Build dejó de ser un `echo`: valida sintaxis de servidor, worker, scripts y JavaScript embebido.
- Lint ejecuta además el contrato UI de metadatos clínicos y seguimiento explícito.
- CI corre batería funcional, smoke del supervisor, build y contrato UI.
- `ROADMAP.md` y `DOMAIN_CONTRACTS.md` reflejan carga binaria real, almacenamiento temporal, job SQLite y worker ya implementados.

### Verificaciones

- `npm test`: aprobado, 129/129 pruebas funcionales.
- `npm run test:runtime-supervisor`: aprobado de health a `ready` y apagado limpio.
- `npm run build`: 19 archivos Node y dos scripts embebidos aprobados.
- `npm run lint`: contrato UI y sintaxis aprobados.
- `git diff --check`: aprobado.
- Commit: `f1472c4` (`verify supervised runtime and current contracts`).

### Próximo paso

Preparar 30 a 50 recortes creados o anonimizados, ejecutar el benchmark Groq/Gemini/OpenAI y conectar el proveedor elegido dentro del worker existente. Meta real queda después y requiere credenciales.

## 2026-07-15 — Flujo clínico explícito y UX recuperable

### Objetivo

Eliminar valores clínicos inventados, decisiones automáticas y pérdidas silenciosas de trabajo detectadas en la auditoría de UX.

### Trabajo realizado

- El formulario muestra fecha clínica, tipo de sesión, duración clínica y modalidad; texto y audio envían esos valores canónicos.
- El ánimo pasó a ser opcional y seguimiento es una decisión explícita mediante checkbox.
- Cerrar conserva el borrador de audio; cambiar de modo o descartarlo exige confirmación. El polling se detiene después de dos minutos o tres fallos consecutivos y puede retomarse.
- Nuevas notas muestran sólo pacientes activos; formatos y límite de 25 MB se comunican antes de subir.
- Se unificó el menú móvil y las tarjetas principales admiten teclado.
- La evolución anímica se calcula desde sesiones reales y muestra un estado vacío sin datos.
- Registro entra directamente al panel sin pago ficticio; perfil, configuración y contraseña sin persistencia quedaron desactivados y rotulados en desarrollo.
- Landing y FAQ distinguen lo disponible, simulado y pendiente; se retiraron cifras, testimonios, precios y contactos no verificados.
- Se agregó un gate estático que exige los campos clínicos explícitos y prohíbe derivar seguimiento desde el ánimo.

### Verificaciones

- `node scripts/ui-contract-tests.js`: aprobado.
- `node scripts/check-syntax.js`: 19 archivos Node y dos scripts embebidos aprobados.
- `git diff --check -- index.html scripts/ui-contract-tests.js`: aprobado.
- Navegador: landing, login y modal clínico revisados; los controles nuevos y la señalización de funciones quedaron visibles.
- Commit: `e533eb9` (`make clinical web flow explicit and recoverable`).

### Próximo paso

Cerrar el arranque supervisado de desarrollo/producción, incorporarlo a CI y ejecutar la verificación integral antes de publicar.

## 2026-07-15 — Expiración atómica y pacientes inactivos

### Objetivo

Corregir los dos riesgos backend detectados en la auditoría funcional: la carrera entre expiración y persistencia de la transcripción, y la creación de notas nuevas para pacientes inactivos.

### Trabajo realizado

- `expireAudioUpload` marca primero el borrador mediante compare-and-set con precondiciones de referencia, retención, ausencia de transcripción y estado.
- El job se cancela y el archivo se elimina solamente cuando esa transición afectó exactamente una fila; si otro worker ya avanzó a `structuring`, no se toca el trabajo.
- Nuevas sesiones, borradores y confirmaciones exigen un paciente activo; sesiones históricas y lectura de borradores permanecen disponibles después de desactivarlo.
- La suite agrega límite de upload streamed, limpieza de parciales, expiración integral, reproducción de la carrera después del snapshot y recuperación de un lease desde un segundo proceso Node real.

### Verificaciones

- `npm run test:audio-upload-worker`: aprobado.
- `npm test`: aprobado, incluida la batería funcional 129/129.
- `npm run check:syntax` y `git diff --check`: aprobados.
- Commit: `4a0a082` (`harden audio expiry and inactive patient flow`).

### Próximo paso

Cerrar el formulario clínico explícito, la conservación del borrador de audio y los gates de supervisor/UI antes de retomar el benchmark de proveedores.

## 2026-07-15 — Archivo real, almacenamiento temporal y worker SQLite

### Objetivo

Aceptar un archivo de audio real desde la web y completar el recorrido asíncrono sin integrar todavía un proveedor pago ni Meta.

### Trabajo realizado

- Tres agentes compararon diseños independientes; se eligió carga binaria de un archivo, referencia opaca y almacenamiento fuera de SQLite.
- `POST /api/audio-drafts/upload` valida cuenta, paciente, clave idempotente, tamaño, MIME y firma del contenedor antes de crear el borrador.
- El archivo se escribe como parcial y se renombra al completar; borrador y `audio_processing_job` se crean atómicamente.
- La migración `006_audio_processing_jobs.sql` agrega metadata temporal, jobs, estados, reintentos y leases persistentes.
- Un proceso worker separado reclama con fencing token, renueva el lease, recupera jobs abandonados y deja visibles los fallos reintentables.
- El archivo se elimina después de persistir la transcripción o al confirmar/cancelar; el barrido reconcilia limpiezas interrumpidas, vencimientos y huérfanos.
- La web selecciona un archivo real, conserva la idempotencia ante respuesta perdida, sigue el job por polling y mantiene la transcripción simulada claramente identificada.
- `npm start` supervisa servidor y worker; Render dirige tanto SQLite como uploads al disco `/app/data`.
- Se mantuvo intacto el camino sintético de web/WhatsApp y no se incorporó ningún proveedor real.

### Revisión competitiva

- La primera ronda encontró persistencia incompleta en Render, cleanup optimista, cancelación no atómica, fallo no terminal del worker, retry sin polling, abort tardío, fencing sin cobertura y un shutdown incompleto.
- La segunda ronda detectó dos carreras intermitentes: upgrade de transacción SQLite frente al polling y snapshot `draft=failed/job=queued` inmediatamente después de retry.
- Se hicieron `IMMEDIATE` las transacciones read→write, el claim vacío quedó read-only, el polling prioriza el estado del job y se agregaron pruebas de contención y snapshot intermedio.
- Los tres revisores volvieron a auditar el diff corregido y no encontraron bloqueantes.

### Verificaciones

- `npm test`: migraciones, vínculo, conversación, audio sintético, upload/worker y 126/126 pruebas funcionales aprobadas.
- La prueba funcional se ejecutó tres veces consecutivas con polling del worker cada 10 ms; las tres terminaron 126/126.
- Cubiertos: upload real, deduplicación, conflicto de clave, bytes inválidos, aislamiento de cuenta, job separado, fallo/retry, lease abandonado, stale write rechazado, cancelación y cleanup.
- Cubierta la contención con 20 eventos entrantes concurrentes mientras el worker está activo.
- `/data/aira.db` devuelve 404; base y archivos temporales no quedan expuestos por el montaje estático.
- `npm run build`, sintaxis de los dos scripts embebidos y `git diff --check`: aprobados.
- Revisión visible: el modal muestra selección de archivo y aviso explícito de almacenamiento temporal/transcripción simulada; sin errores de consola.
- Commit funcional: `179c329` (`process real audio uploads in sqlite worker`).

### Próximo paso

1. Preparar 30 a 50 recortes creados o anonimizados.
2. Ejecutar el benchmark Groq/Gemini/OpenAI a través del worker existente.
3. Elegir e integrar el primer proveedor real sin mover la llamada al servidor web.
4. Conectar Meta después del benchmark y cuando estén disponibles sus credenciales.

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
