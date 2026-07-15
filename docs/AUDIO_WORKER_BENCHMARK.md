# Benchmark controlado del worker de audio

Última ejecución: 2026-07-15.

## Objetivo

Validar con volumen el recorrido operativo ya implementado:

```text
WAV real → HTTP → archivo temporal → draft/job SQLite → worker → ready → cleanup
```

Este benchmark mide transporte, persistencia, cola, procesamiento, aislamiento entre borrador y sesión, y limpieza. No mide reconocimiento de voz ni calidad clínica porque `AUDIO_TRANSCRIBER=fake` y `NOTE_CLEANER=fake` todavía no interpretan el contenido sonoro.

## Corpus controlado

El runner genera en memoria 40 WAV válidos y deterministas:

- PCM mono, 8 bits, 8 kHz;
- duraciones reales entre 2 y 10 minutos;
- 226 minutos y 103,5 MB por corrida;
- perfiles de señal estable, pausas, volumen bajo, ruido determinista y mayormente silencio;
- concurrencia HTTP de cinco cargas;
- ningún dato clínico, audio o transcripción real.

Los archivos existen solamente en el directorio temporal de cada ejecución y deben desaparecer al terminar el worker.

## Gates

- Las 40 cargas responden `202` y crean 40 borradores distintos.
- Más del 90% termina en `ready`; la ejecución vigente exige además 40/40.
- El acuse máximo queda por debajo de cinco segundos.
- El p95 extremo a extremo queda por debajo de dos minutos.
- Duración, transcripción simulada y nota limpia quedan persistidas.
- No se crea ninguna sesión antes de confirmar.
- El runtime continúa saludable y no registra `SQLITE_BUSY`.
- No queda ningún `.part` ni `.audio` temporal.

## Resultado reproducido

Se ejecutaron tres corridas independientes, cada una con base, archivos, puerto y runtime nuevos.

| Corrida | Listos | Acuse p95 / máx. | Extremo a extremo p95 / máx. | Residuos | Resultado |
|---|---:|---:|---:|---:|---|
| 1 | 40/40 | 308,4 / 334,8 ms | 1719,4 / 1729,2 ms | 0 | Aprobado |
| 2 | 40/40 | 323,6 / 338,8 ms | 1715,6 / 1726,0 ms | 0 | Aprobado |
| 3 | 40/40 | 290,8 / 365,0 ms | 1699,1 / 1709,1 ms | 0 | Aprobado |

Resultado agregado: 120/120 borradores listos, 678 minutos representados, 310,5 MB transferidos, cero fallos, cero timeouts, cero sesiones prematuras, cero errores de base y cero archivos residuales.

## Ejecución

```bash
npm run benchmark:audio-worker
```

El conteo permanece intencionalmente limitado al rango acordado:

```bash
npm run benchmark:audio-worker -- --count=30 --concurrency=4
npm run benchmark:audio-worker -- --count=50 --concurrency=8
```

El comando imprime un resumen legible y una línea JSON completa para conservar o comparar resultados fuera del repositorio. Los resultados no contienen audios ni datos clínicos.

## Interpretación y siguiente gate

La capacidad operativa del worker con un lote de 40 archivos queda aprobada para el proveedor falso. Esto no aprueba Groq, Gemini ni OpenAI y la velocidad observada no predice su latencia de red.

El siguiente benchmark debe usar 30 a 50 recortes hablados creados para la prueba, con transcripción humana, negaciones y entidades críticas marcadas. Antes de ejecutar un proveedor real, el pipeline debe aceptar adaptadores asíncronos sin bloquear el heartbeat del lease. La comparación de candidatos y sus gates está en [AUDIO_PROVIDER_BENCHMARK.md](AUDIO_PROVIDER_BENCHMARK.md).
