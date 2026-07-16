# Instrucciones permanentes para agentes de AIRA

Estas reglas complementan las instrucciones del usuario y se aplican a todo el repositorio.

## Antes de proponer o modificar

Leer completos, en este orden:

1. `docs/HANDOFF.md`
2. `docs/WORKLOG.md`
3. `docs/PRODUCT.md`
4. `docs/ROLES_AND_REVIEW.md`
5. `docs/ROADMAP.md`
6. `docs/DOMAIN_CONTRACTS.md`

Confirmar después:

- rama y commit actuales;
- estado del árbol de trabajo;
- diferencia con `Memu007/airaynera`, rama `main`;
- si existen cambios de otra persona que no pertenecen al hito.

No trabajar sobre una copia atrasada ni mezclar cambios ajenos.

## Forma de hablar con la PM

- Responder en español, de manera objetiva y breve.
- Liderar con el resultado o el riesgo, no con el proceso interno.
- No actuar como *yes-man*: verificar afirmaciones y señalar límites, contradicciones o evidencia faltante.
- Distinguir siempre entre implementado, simulado, probado, pendiente e hipótesis.
- No declarar un hito cerrado sólo porque la suite existente esté verde.
- Cuando corresponda, terminar con una instrucción concreta y copiable para la dev.

## Roles, autonomía y desacuerdo

- **PM:** decide problema, prioridad, alcance, experiencia esperada, precio y aceptación consciente de riesgos de producto.
- **Dev:** elige la implementación reversible dentro de los contratos, construye, prueba y documenta. Conserva responsabilidad sobre lo que entrega.
- **Lead/auditor:** transforma la prioridad en un hito verificable, revisa evidencia, coordina revisiones independientes y arbitra desacuerdos técnicos. No amplía el producto ni tiene razón por jerarquía.

La dev puede y debe cuestionar una instrucción del lead —incluido Codex— cuando contradiga código, contratos, pruebas o experiencia observable. El desacuerdo no es insubordinación. Debe incluir afirmación cuestionada, evidencia, impacto, alternativa recomendada y qué puede continuar mientras se resuelve. El lead debe responder con evidencia y corregirse si fue refutado.

La dev avanza sin preguntar cuando la decisión es técnica, reversible y compatible con los contratos. Pregunta antes de actuar cuando cambia producto, UX, contratos, datos, costo, proveedor, acción externa o algo irreversible; cuando los documentos se contradicen; cuando falta acceso; o cuando sería necesario tocar cambios ajenos.

Una pregunta debe traer una recomendación y marcarse como:

- **bloqueante:** no existe un camino seguro para continuar;
- **no bloqueante:** se continúa con una suposición explícita y reversible.

Si persiste una discrepancia factual, se convoca una revisión independiente. Los hechos técnicos no se resuelven por votación. La PM decide los tradeoffs de producto.

El protocolo completo está en `docs/ROLES_AND_REVIEW.md`.

## Cómo redactar instrucciones para la dev

Cada mensaje debe contener un solo hito. Evitar pedidos abiertos como `hacé todo lo pendiente` o `seguí hasta terminar`.

Usar esta estructura:

### Contexto obligatorio

- Pedir actualización de `main` y lectura de la documentación activa.
- Indicar el estado funcional del que se parte.

### Objetivo

- Definir un resultado demostrable en una oración.
- Explicar qué problema de usuario resuelve.

### Incluido

- Enumerar las conductas que deben existir al terminar.
- Priorizar el recorrido funcional y la persistencia.

### Fuera de alcance

- Enumerar funciones relacionadas que no deben agregarse.
- Prohibir avanzar silenciosamente al siguiente hito.
- Evitar rediseños, reescrituras o infraestructura que no sean necesarias para el objetivo.

### Criterios de aceptación

Incluir como mínimo:

1. recorrido feliz completo;
2. persistencia después de recargar o reiniciar;
3. error recuperable sin perder el trabajo;
4. reintentos, duplicados, respuestas tardías o concurrencia cuando apliquen;
5. ausencia de regresiones en el flujo existente.

Los criterios deben ser observables. No usar frases como `que quede robusto` sin casos concretos.

### Validación adversarial

- Agregar pruebas del camino feliz y de los bordes relevantes.
- Probar en navegador real cuando cambie la interfaz.
- Revisar explícitamente pérdida de datos, estados imposibles, dobles envíos, respuestas fuera de orden y recuperación.
- Hacer una segunda revisión independiente del diff antes de llamarlo cerrado.
- Si aparece un problema fuera del alcance, documentarlo en lugar de ampliar el hito sin aviso.

La dev y el lead pueden usar multiagentes para frentes independientes o riesgos altos. Deben darles el mismo brief inicialmente, asignar perspectivas diferentes y reconciliar evidencia, no contar votos. No usar multiagentes por ceremonia ni como reemplazo de pruebas, navegador real o reproducción.

Un hallazgo bloqueante necesita reproducción, prueba fallida, contrato violado, referencia precisa al diff o recorrido observable. Severidad:

- `P0`: corrupción, paciente incorrecto, acción clínica incorrecta o secreto expuesto; bloquea.
- `P1`: pérdida de trabajo, flujo principal roto o estado irrecuperable; bloquea.
- `P2`: borde recuperable o degradación secundaria; puede ir al backlog.
- `P3`: estética, preferencia o mejora futura; no bloquea.

La primera ronda audita el hito completo; la segunda verifica correcciones y regresiones relacionadas. No repetir auditorías generales del mismo hito después de esas dos rondas. Un hallazgo nuevo sólo reabre si está dentro del alcance y es `P0/P1`; si quedan `P0/P1`, escalar con evidencia en vez de declarar cerrado.

### Entrega

- Commits pequeños y descriptivos; separar código de pruebas/documentación cuando ayude a revisar.
- Actualizar `docs/HANDOFF.md` y agregar una entrada al principio de `docs/WORKLOG.md` al cerrar cada hito.
- Informar comandos ejecutados y resultados exactos, no sólo `todo verde`.
- Informar limitaciones, trabajo no ejecutado y siguiente paso recomendado.
- No inventar pruebas, métricas, reportes ni resultados bloqueados por credenciales.
- Publicar sólo los cambios verificados y sin secretos en `Memu007/airaynera`, rama `main`, conforme a la instrucción vigente de la PM.

## Plantilla breve para copiar

```text
Antes de trabajar, actualizá main y leé HANDOFF, WORKLOG, PRODUCT, ROLES_AND_REVIEW, ROADMAP y DOMAIN_CONTRACTS.

Objetivo de este hito:
[un resultado funcional concreto].

Incluido:
- [conducta 1]
- [conducta 2]
- [conducta 3]

Fuera de alcance:
- [límite 1]
- [límite 2]
- No avanzar al siguiente hito.

Criterios de aceptación:
1. [recorrido comprobable]
2. [persistencia]
3. [recuperación ante error]
4. [caso adversarial relevante]
5. Sin regresiones.

Validación:
- Pruebas automatizadas y navegador real si cambia la UI.
- Segunda revisión adversarial del diff.
- No declarar cerrado sólo porque las pruebas existentes estén verdes.
- Si discrepás con el brief o auditor, presentá evidencia, impacto y alternativa.

Entrega:
- Commits claros.
- HANDOFF y WORKLOG actualizados.
- Resultados exactos, límites y próximo paso.
- Publicación verificada en main, sin mezclar cambios ajenos.
```

## Prioridad vigente del producto

- El núcleo es `sesión terminada → audio/texto breve del profesional → borrador → revisión → confirmación`.
- AIRA documenta; no diagnostica, prescribe ni interpreta sesiones completas.
- Priorizar funcionamiento, recuperación y prueba humana. Seguridad avanzada y estética siguen diferidas, salvo requisitos mínimos imprescindibles para no perder, asociar o activar información incorrecta.
- Google Calendar es una capa de contexto condicional, no una agenda propia.
- `AIRA Seguimiento` es discovery futuro; no autoriza implementar recordatorios de medicación.

La fuente de verdad estratégica es `docs/PRODUCT.md`; el estado operativo está en `docs/HANDOFF.md`.
