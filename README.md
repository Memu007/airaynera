# AIRA Medical

AIRA ayuda a psicólogos y psiquiatras a mantener actualizadas las fichas de sus pacientes mediante notas breves enviadas desde la web o WhatsApp.

El flujo objetivo del MVP es:

```text
Cuenta web
→ WhatsApp vinculado
→ Selección explícita del paciente
→ Nota de texto o audio
→ Borrador editable
→ Confirmación
→ Sesión guardada en la ficha web
```

## Estado del proyecto

El proyecto está en una etapa de consolidación funcional. El recorrido web registro → paciente → borrador → sesión → recarga ya funciona localmente. La web también puede vincular un teléfono y simular el recorrido `MENÚ → paciente → nota → GUARDAR/CANCELAR`; la cuenta y el paciente salen del estado persistido, no del contenido. Los recortes de audio sintéticos ya recorren el mismo pipeline desde web y WhatsApp, conservan transcripción original y nota limpia por separado, permiten reintentar y solamente crean una sesión después de confirmar. Todavía no se reciben archivos reales ni se usa el transporte de Meta o un proveedor externo.

Las prioridades vigentes son:

1. Incorporar un archivo de audio real en la web sin cambiar el contrato probado.
2. Comparar Groq, Gemini y OpenAI con el mismo conjunto de recortes de prueba.
3. Conectar el webhook y la descarga de medios de Meta cuando existan credenciales.
4. Probar el producto con profesionales y medir tiempo de corrección, latencia y costo.

El detalle y el estado actualizado se encuentran en la [documentación activa](docs/README.md).

## Documentación principal

- [Definición del producto](docs/PRODUCT.md)
- [Roadmap del MVP](docs/ROADMAP.md)
- [Handoff actualizado](docs/HANDOFF.md)
- [Registro de trabajo](docs/WORKLOG.md)
- [Contratos funcionales del dominio](docs/DOMAIN_CONTRACTS.md)
- [Decisión y benchmark de proveedores de audio](docs/AUDIO_PROVIDER_BENCHMARK.md)

Al retomar el proyecto, empezar siempre por `docs/HANDOFF.md`.

## Tecnología actual

- Node.js y Express.
- Frontend HTML, CSS y JavaScript.
- SQLite con almacenamiento persistente.
- JWT para autenticación.
- Render como configuración de despliegue actual.

Para validar el producto no se planea reescribir toda la aplicación ni migrar de tecnología. Las funcionalidades nuevas se separarán gradualmente en rutas, servicios, proveedores y workers.

## Instalación local

Requisitos:

- Node.js 20 recomendado.
- npm 8 o superior.

```bash
npm ci
cp .env.example .env
npm run dev
```

`npm run dev` levanta servidor y worker de audio mediante el mismo supervisor usado en producción, y reinicia ambos cuando cambia el código activo del backend. `npm start` hace lo mismo sin autoreload.

Sin configurar `PORT`, el servidor usa el puerto `8080`. El archivo `.env.example` propone el puerto `3000` para desarrollo.

Las variables, tokens y credenciales reales nunca deben subirse al repositorio.

## Estructura activa

```text
server.js             servidor Express actual
index.html            interfaz web actual
services/sqlite.js    acceso y esquema SQLite actual
services/audioDraftPipeline.js  pipeline común de audio y borradores
services/audio/       proveedores falsos y futuros adaptadores reales
utils/                utilidades compartidas
js/ css/ images/      recursos de la interfaz
scripts/              scripts activos o pendientes de consolidación
docs/                 producto, roadmap y handoff vigentes
_archive/             prototipos y código histórico; no es producción
```

El contenido de `_archive/` puede servir como referencia, pero no debe considerarse parte del sistema activo sin revisión y adaptación.

## Forma de trabajo

- Una rama por vertical funcional.
- Commits pequeños y verificables.
- Pull request en borrador mientras la etapa está en curso.
- `main` representa la versión estable.
- Un tag por demostración aceptada.
- Actualizar `docs/HANDOFF.md` después de cada bloque relevante.
- Agregar una entrada a `docs/WORKLOG.md` sin borrar el historial anterior.

GitHub respalda el código y la documentación. Las bases de datos, audios, transcripciones, secretos y datos clínicos requieren un respaldo separado y nunca deben incluirse en Git.
