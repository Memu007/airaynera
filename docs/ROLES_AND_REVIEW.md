# Roles, desacuerdo y revisión en AIRA

Última actualización: 2026-07-18.

## Objetivo

Definir cómo colaboran la PM, la dev y el lead/auditor sin obediencia ciega, burocracia ni auditorías infinitas.

Principio central:

> Ningún rol tiene razón por jerarquía. La evidencia decide los hechos; la PM decide el valor, el alcance y los riesgos de producto.

Principio de proceso:

> Toda ceremonia debe prevenir un riesgo observable. Si sólo duplica documentación o aprobación, se elimina.

## Roles

### PM

Responsable de:

- problema de usuario y resultado esperado;
- prioridad y alcance del hito;
- experiencia de producto y posicionamiento;
- precio y mercado;
- costos, credenciales y acciones externas relevantes;
- aceptación consciente de riesgos comerciales o de producto.

La PM no decide por mayoría si un bug existe. Cuando el desacuerdo es factual o técnico, debe recibir la evidencia y las alternativas, no convertirse en árbitro de preferencias de implementación.

La PM no necesita saber programar ni revisar código para cumplir su rol. Dev y lead deben traducir toda escalación a lenguaje de producto y no pedirle que elija librerías, consultas, arquitectura o comandos.

### Dev

Responsable de:

- elegir la solución técnica más simple y reversible compatible con los contratos;
- implementar un único hito dentro de su alcance;
- agregar y ejecutar pruebas proporcionales al riesgo;
- probar la interfaz en navegador real cuando cambie UX;
- revisar recuperación, persistencia, duplicados, orden y concurrencia;
- documentar decisiones, resultados exactos y limitaciones;
- no publicar algo que no considera verificado.

La dev no es una ejecutora pasiva. Tiene el derecho y la obligación de cuestionar briefs, hallazgos o soluciones cuando encuentre evidencia de que son incorrectos, incompletos, contradictorios o desproporcionados. `Lo pidió el auditor` no justifica un cambio no verificado.

### Lead/auditor

Responsable de:

- convertir la prioridad de la PM en un hito verificable;
- separar objetivo, alcance, exclusiones y criterios de aceptación;
- inspeccionar código, contratos, pruebas y recorridos antes de afirmar;
- buscar fallos que el camino feliz no cubre;
- coordinar revisores independientes cuando el riesgo lo justifica;
- clasificar hallazgos por impacto y evidencia;
- arbitrar desacuerdos técnicos y reconocer cuando la dev lo refuta;
- recomendar cierre, iteración o escalamiento.

El lead/auditor no amplía el producto, no inventa requisitos y no puede exigir `hacelo igual` sin responder la evidencia de la dev.

## Quién decide qué

| Decisión | Responsable principal | Revisión o escalamiento |
|---|---|---|
| Problema, prioridad y alcance | PM | Lead lo vuelve verificable |
| UX o conducta visible | PM | Dev y lead aportan evidencia |
| Implementación técnica reversible | Dev | Lead revisa por contratos y riesgo |
| Contrato API o modelo persistente | Dev propone | Lead revisa; PM decide si cambia producto |
| Gates y evidencia de cierre | Lead + dev | PM resuelve sólo tradeoffs de producto |
| Precio, proveedor pago o costo externo | PM | Dev/lead aportan costo y riesgo |
| Publicación | Dev presenta evidencia; lead recomienda | No se publica con P0/P1 abiertos |

## Interfaz con una PM no técnica

Dev y lead resuelven entre sí los hechos técnicos mediante código, pruebas, contratos y reproducciones. Solamente escalan a la PM una decisión de producto, costo, prioridad, experiencia o riesgo aceptado.

Toda escalación a la PM debe poder entenderse sin abrir el repositorio y contener, en este orden:

```text
Qué cambia para la persona usuaria:
Qué comprobamos, en lenguaje común:
Riesgo o costo de no actuar:
Recomendación de dev y lead:
Decisión de producto necesaria, si existe:
```

No se le pide a la PM ejecutar comandos, interpretar un diff, elegir entre tecnologías equivalentes ni desempatar un hecho técnico. Si dev y lead discrepan sobre un hecho, deben producir mejor evidencia o convocar revisión independiente. Si discrepan sobre valor, alcance, costo o tolerancia al riesgo, presentan máximo dos opciones y una recomendación.

## Registro de decisiones materiales

No se crea una carpeta de ADR ni un documento nuevo por cada decisión. AIRA usa una única sección breve dentro de la entrada correspondiente de `WORKLOG.md` cuando la decisión:

- se espera que sobreviva a más de un hito; y
- cambia un contrato o dato persistente, proveedor o costo externo, estrategia de concurrencia/recuperación, conducta de producto, o costaría más de una jornada revertirla.

Formato máximo:

```text
Decisión material:
Motivo:
Alternativas descartadas: máximo dos
Consecuencia:
Revisar o revertir si:
```

La dev propone y explicita el costo técnico; el lead desafía supuestos y compatibilidad; la PM interviene solamente si cambia producto, costo o riesgo aceptado. La fuente de verdad afectada —`PRODUCT`, `ROADMAP` o `DOMAIN_CONTRACTS`— se actualiza sin repetir allí toda la justificación.

No se registra una decisión material por nombres, refactors locales, organización interna, estrategia de pruebas o elecciones técnicas reversibles dentro de un hito. No se reconstruyen decisiones históricas.

## Cuándo la dev pregunta

Debe preguntar antes de actuar si la respuesta:

- cambia alcance, UX o comportamiento observable;
- cambia contratos, datos o migraciones;
- incorpora un proveedor, costo o dependencia externa;
- implica una acción irreversible;
- contradice documentos activos;
- requiere credenciales o permisos faltantes;
- obliga a modificar cambios ajenos;
- acepta un riesgo P0/P1 conocido.

No debe preguntar por:

- nombres internos;
- organización local del código;
- estrategia de pruebas obvia;
- decisiones reversibles dentro del hito;
- algo ya resuelto por PRODUCT, ROADMAP, HANDOFF o DOMAIN_CONTRACTS.

Formato de pregunta:

```text
Tipo: bloqueante | no bloqueante
Decisión que falta:
Evidencia:
Impacto:
Opciones: máximo dos
Recomendación:
Qué puedo continuar mientras se resuelve:
```

Una pregunta no bloqueante no detiene el hito: la dev continúa con una suposición explícita y reversible.

## Derecho y deber de disentir

La dev puede discutirle al lead o a Codex. El lead puede cuestionar la implementación. Ambos deben atacar la afirmación y no a la persona.

Formato de discrepancia:

```text
DISCREPANCIA PARA DEV | LEAD
Afirmación cuestionada:
Evidencia reproducible: prueba, contrato, diff, medición o recorrido
Impacto real:
Alternativa recomendada:
Qué sigue sin estar bloqueado:
```

Respuesta obligatoria del receptor:

1. aceptar la evidencia y corregirse;
2. refutarla con evidencia más fuerte;
3. reducir o reclasificar el hallazgo;
4. convocar un revisor independiente;
5. escalar a la PM si la diferencia es de producto.

No se permite ignorar la discrepancia ni responder solamente `hacelo igual`.

Si la dev y el lead trabajan en entornos separados, la dev incluye `DISCREPANCIA PARA AUDITOR` en su entrega y la PM puede trasladarla. La PM no necesita decidir el detalle técnico: sólo asegurar que la respuesta vuelva al rol correcto.

## Uso de multiagentes

Tanto la dev como el lead pueden iniciar revisiones multiagente de solo lectura dentro del hito sin pedir autorización adicional a la PM.

Conviene usarlos en:

- persistencia, migraciones, concurrencia y recuperación;
- contratos compartidos entre frontend y backend;
- integraciones externas o proveedores;
- asociación de paciente, identidad o deduplicación;
- acciones clínicas o contenido con números, dosis o negaciones;
- decisiones estratégicas, de mercado o precio;
- desacuerdos técnicos que no se resuelven con una reproducción simple;
- hitos con frentes independientes de backend, UX y pruebas.

No conviene usarlos para:

- cambios triviales o mecánicos;
- sustituir pruebas reales;
- producir consenso aparente;
- aumentar el conteo de revisiones;
- editar simultáneamente los mismos archivos sin un responsable claro.

Protocolo:

1. Todos reciben el mismo brief y los mismos contratos.
2. Trabajan independientemente antes de ver conclusiones ajenas.
3. Se asignan perspectivas distintas cuando ayuda: defensor, crítico/adversarial y verificador de evidencia.
4. Cada agente entrega hallazgo, severidad, evidencia y recomendación.
5. El responsable del hito sintetiza coincidencias y desacuerdos; no cuenta votos.
6. Una mayoría de agentes no convierte una hipótesis en verdad.
7. Los revisores no editan el mismo código salvo asignación explícita.

## Revisión adversarial

La revisión adversarial intenta refutar la afirmación de que el hito está terminado. No consiste en agregar casos arbitrarios para aumentar números.

Antes de implementar:

- identificar invariantes y estados terminales;
- definir qué trabajo no puede perderse;
- enumerar dependencias externas y puntos de respuesta perdida;
- acordar criterios observables de salida.

Después de implementar, revisar cuando aplique:

- respuesta perdida después de persistir;
- duplicados y reintentos;
- solicitudes o eventos fuera de orden;
- dos pestañas o clientes concurrentes;
- reinicio entre etapas;
- estado local más nuevo que el remoto;
- payloads vacíos, malformados, arrays, objetos y límites;
- paciente ajeno, inactivo o equivocado;
- fallo parcial de proveedor externo;
- cancelación, timeout y cleanup;
- regresiones de teclado, filtros y render literal.

## Evidencia y severidad

Un hallazgo bloqueante necesita al menos una de estas evidencias:

- reproducción;
- prueba fallida;
- contrato violado;
- referencia precisa al diff;
- recorrido observable;
- medición relevante.

| Nivel | Definición | Efecto |
|---|---|---|
| P0 | Corrupción, paciente incorrecto, acción clínica incorrecta o secreto expuesto | Bloquea |
| P1 | Pérdida de trabajo, flujo principal roto o estado irrecuperable | Bloquea |
| P2 | Borde recuperable o degradación secundaria | Puede pasar al backlog |
| P3 | Estética, preferencia o mejora futura | No bloquea |

Una preocupación hipotética sin reproducción ni contrato violado se registra como riesgo; no bloquea por sí sola.

## Cierre y límite de auditoría

1. Primera ronda: auditoría completa contra el brief y sus hipótesis de riesgo.
2. Segunda ronda: verificación de correcciones y regresiones relacionadas.
3. Después de dos rondas no se inicia otra auditoría general del mismo hito.
4. Un hallazgo nuevo sólo reabre el hito si pertenece a su alcance y es P0/P1.
5. P2/P3 nuevos se documentan sin ampliar silenciosamente el hito.
6. Si quedan P0/P1 después de dos rondas, se escala a la PM con evidencia y opciones; no se declara cerrado.
7. Si el mismo tipo de fallo reaparece, se revisa la estrategia o arquitectura en vez de sumar parches y conteos de pruebas indefinidamente.

## Mini-retrospectiva sin culpa

No todo bug necesita un postmortem. Una mini-retrospectiva se activa únicamente si:

- un P0/P1 afectó a una persona externa, un piloto o datos reales; o
- la misma condición sistémica produjo por segunda vez un P1 después de que el hito anterior había sido declarado cerrado.

Un P0/P1 detenido por pruebas o por la revisión prevista antes del cierre significa que el proceso funcionó y no activa esta ceremonia. Tampoco la activan P2/P3, CI rojo ni riesgos hipotéticos.

La mini-retrospectiva vive en `WORKLOG.md`, tarda como máximo 20 minutos y registra:

```text
Impacto observable:
Cómo escapó:
Condición sistémica, no persona:
Corrección:
Prueba o gate que evita la recurrencia:
```

La dev aporta reproducción y corrección; el lead revisa qué faltó en brief, prueba o gate; la PM es informada en lenguaje común y sólo recibe una decisión si cambia prioridad, alcance, costo o riesgo aceptado. Debe terminar con un máximo de tres acciones verificables. No se usan culpables, reuniones obligatorias ni `faltó atención` como causa.

## Protección progresiva de `main`

Durante el prototipo interno continúa vigente la instrucción de la PM de publicar hitos verificados en `main`. La protección por pull request se activa antes del primer piloto externo o antes si, desde esta política, un nuevo P0/P1 escapa a `main` después de haber sido declarado cerrado. La PM sólo autoriza iniciar el piloto: dev y lead son responsables de activar y probar la protección antes de invitar o cargar a la primera persona externa.

La activación es un hito operativo separado y mínimo:

- todo cambio entra por pull request;
- sólo bloquean checks deterministas, estables y sin credenciales externas: suite funcional, sintaxis/contrato UI y navegador cuando corresponda;
- antes de activarla, CI debe cubrir al menos un smoke completo del núcleo: registro, paciente, texto o audio, borrador, confirmación y persistencia tras recarga;
- no se permite merge con checks requeridos en rojo, `force-push` ni borrado de `main`;
- la dev presenta alcance, resultados y riesgos; el lead resume en el PR una revisión de solo lectura realizada por otra persona o agente, incluidos hallazgos y resolución; el autor no puede ser su único revisor aunque compartan identidad de publicación;
- se exige aprobación formal sólo cuando existan dos identidades reales de GitHub; compartir cuenta no se disfraza de revisión independiente;
- Gemini, proveedores externos y checks dependientes de red o credenciales no bloquean `main`;
- un bypass sólo se permite para restaurar un flujo caído o detener un P0/P1 en curso, nunca para evitar un check rojo o acelerar una función; se documenta en `WORKLOG.md` y se revisa inmediatamente después.

Después de cuatro semanas desde la activación o de ocho pull requests, lo que ocurra primero, dev y lead revisan qué defectos detectaron los checks antes del merge, si hubo bypasses o falsos fallos y si agregaron demora observable. Se quitan o corrigen checks inestables o sin señal; no se debilitan gates P0/P1 sólo por comodidad. No se mide calidad por cantidad de documentos, pruebas, agentes o aprobaciones.

## Condición de entrega

Un hito puede publicarse cuando:

- cumple sus criterios de aceptación;
- las pruebas relevantes tienen resultados exactos;
- el navegador real fue usado si cambió UX;
- la revisión independiente no deja P0/P1 abiertos;
- discrepancias relevantes quedaron resueltas o escaladas;
- HANDOFF y WORKLOG reflejan qué se hizo, qué no y qué sigue;
- el diff contiene sólo cambios del hito y no incluye secretos.
