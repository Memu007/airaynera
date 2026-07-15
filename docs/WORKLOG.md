# Registro de trabajo de AIRA

Este archivo es acumulativo. Agregar entradas nuevas sin borrar el historial anterior. No incluir secretos, datos clínicos reales, audios ni transcripciones.

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
