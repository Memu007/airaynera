# Documentación activa de AIRA

Este directorio contiene la documentación vigente del producto. Su objetivo es que una persona o agente pueda retomar el trabajo sin depender de la memoria de una conversación.

Antes de este orden, todo agente debe leer [`../AGENTS.md`](../AGENTS.md), que define la forma permanente de trabajar, auditar y redactar instrucciones para la dev.

## Orden de lectura

1. [HANDOFF.md](HANDOFF.md): estado actual, bloqueos y siguiente trabajo concreto.
2. [WORKLOG.md](WORKLOG.md): registro cronológico de lo realizado.
3. [PRODUCT.md](PRODUCT.md): problema, alcance y decisiones del producto.
4. [ROLES_AND_REVIEW.md](ROLES_AND_REVIEW.md): autoridad, autonomía, preguntas, desacuerdo, multiagentes y auditoría adversarial.
5. [ROADMAP.md](ROADMAP.md): etapas, entregables y criterios de aceptación.
6. [DOMAIN_CONTRACTS.md](DOMAIN_CONTRACTS.md): contratos funcionales vigentes.
7. [AUDIO_WORKER_BENCHMARK.md](AUDIO_WORKER_BENCHMARK.md): volumen, latencia y limpieza del pipeline operativo.
8. [AUDIO_PROVIDER_BENCHMARK.md](AUDIO_PROVIDER_BENCHMARK.md): costos, candidatos y gate para elegir transcripción real.

## Regla de mantenimiento

### Handoff

`HANDOFF.md` es un documento vivo. Debe actualizarse después de cada bloque importante con:

- fecha;
- rama y commit;
- trabajo terminado;
- verificaciones realizadas;
- problemas encontrados;
- siguiente tarea exacta;
- dependencias externas o decisiones pendientes.

Debe describir el estado presente, no conservar todas las versiones históricas.

### Worklog

`WORKLOG.md` es acumulativo. Cada jornada agrega una nueva entrada al principio o al final, pero no borra entradas anteriores. Allí se registra qué se hizo y por qué.

### Roadmap

`ROADMAP.md` se modifica cuando cambia el alcance, el orden de implementación o los criterios de aceptación. El progreso operativo diario pertenece al handoff.

### Producto

`PRODUCT.md` se modifica solamente cuando cambia la propuesta de valor, el usuario objetivo o una decisión de alcance relevante.

## Estado de otras fuentes

- El [README principal](../README.md) es la puerta de entrada al repositorio.
- [TESTING-REPORT.md](../TESTING-REPORT.md) es un informe histórico de noviembre de 2025. No representa una validación reproducida sobre el código actual.
- `_archive/` contiene referencias y prototipos. No se considera código activo.
- Los comentarios o documentos dispersos fuera de `docs/` no reemplazan este conjunto documental.

## Datos que no deben documentarse

No incluir:

- tokens o claves;
- números completos reales;
- audios o transcripciones clínicas;
- bases de datos;
- nombres o identificadores reales de pacientes;
- contenido de archivos `.env`.
