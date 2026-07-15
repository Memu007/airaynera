# Decisión y benchmark de proveedores de audio

Última revisión de precios: 2026-07-14.

## Decisión actual

El producto no queda acoplado todavía a Gemini, Groq ni OpenAI. El hito funcional usa dos proveedores falsos y deterministas detrás de interfaces intercambiables:

```text
audio → transcripción literal → limpieza conservadora → borrador revisable
```

Para el primer ensayo con audio real, la referencia de costo será **Groq Whisper Large v3 Turbo**. Gemini será el candidato de proveedor único y OpenAI el candidato de calidad. La elección final sale de un benchmark de 30 a 50 recortes creados para la prueba o correctamente anonimizados, no solamente del precio publicado.

## Costos publicados

| Alternativa | Precio publicado | Aproximación por 5 minutos | Observación |
|---|---:|---:|---|
| Groq `whisper-large-v3-turbo` | USD 0,04 por hora | USD 0,0033 | ASR dedicado y la referencia publicada más barata de este grupo. Facturación mínima de 10 segundos. |
| Groq `whisper-large-v3` | USD 0,111 por hora | USD 0,0093 | Más caro que Turbo; se conserva como candidato si mejora errores críticos. |
| Gemini 3.1 Flash-Lite | USD 0,50 por millón de tokens de audio de entrada; USD 1,50 por millón de tokens de texto de salida | Desde USD 0,0048 de entrada de audio, más salida | Google documenta 32 tokens por segundo de audio. Es una estimación de entrada, no un costo final de transcripción y limpieza. |
| OpenAI `gpt-4o-mini-transcribe` | Aproximadamente USD 0,003 por minuto | Aproximadamente USD 0,015 | Candidato a comparar por fidelidad, con costo superior a Groq Turbo. |

Fuentes oficiales:

- [Groq Speech to Text](https://console.groq.com/docs/speech-to-text) y [precios de Groq](https://groq.com/pricing).
- [Precios de Gemini API](https://ai.google.dev/gemini-api/docs/pricing), [audio en Gemini API](https://ai.google.dev/gemini-api/docs/audio) y [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite).
- [Precios de OpenAI API](https://developers.openai.com/api/docs/pricing) y [`gpt-4o-mini-transcribe`](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe).

Los precios cambian. Deben verificarse nuevamente el día en que se active un proveedor real.

## Qué se medirá

Cada recorte tendrá una referencia humana. Para cada proveedor se registrará:

- omisiones o cambios en negaciones;
- errores en nombres, números, horarios y dosis;
- palabras inventadas;
- tiempo de corrección del profesional;
- latencia total y fallos;
- costo real informado por el proveedor;
- diferencia entre transcripción literal y nota preparada.

No alcanza con medir WER general: un número o una negación incorrectos pesan más que un error de puntuación.

## Gate de elección

1. Ningún proveedor se conecta al flujo principal sin pasar la misma suite de contrato que el proveedor falso.
2. La transcripción literal siempre se conserva.
3. La limpieza no agrega diagnósticos, recomendaciones ni datos ausentes.
4. La persona revisa la nota limpia antes de guardar.
5. El proveedor elegido debe tener el menor costo entre los que no superen el umbral acordado de errores críticos y tiempo de corrección.

## Próxima implementación

1. Aceptar un archivo de audio real desde la web y guardarlo de forma temporal fuera de SQLite.
2. Implementar el adaptador Groq como baseline, sin cambiar `SessionDraft` ni las interfaces.
3. Ejecutar el mismo corpus con Gemini y OpenAI.
4. Elegir proveedor y política de fallback a partir de resultados medidos.
5. Recién después conectar la descarga de medios desde Meta.
