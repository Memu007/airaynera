# Producto AIRA

Última actualización: 2026-07-16.

## Definición

AIRA ayuda a profesionales de salud mental a cerrar la documentación después de cada sesión mediante una nota breve de texto o audio enviada desde la web o, más adelante, WhatsApp.

No graba ni interpreta la sesión terapéutica completa. Convierte el relato posterior del profesional en un borrador clínico ordenado, editable y asociado al paciente correcto. El profesional revisa y confirma antes de guardar.

## Posicionamiento

Categoría elegida:

> Asistente de cierre clínico post-sesión por voz.

Promesa principal:

> Terminó la sesión. Contá lo importante. AIRA deja la nota lista para que la revises y guardes, sin grabar al paciente ni decidir por vos.

AIRA no se posiciona como historia clínica integral, agenda, sistema de diagnóstico ni transcriptor de la consulta completa. Es una capa liviana sobre las herramientas que el profesional ya usa.

## Problema

Después de atender, el profesional necesita mantener actualizada la documentación. Abrir un sistema, buscar la ficha y completar formularios agrega fricción y hace que las notas se posterguen.

AIRA reduce esa fricción permitiendo que el profesional:

1. parta de la sesión que acaba de terminar;
2. elija o confirme al paciente;
3. dicte o escriba una nota breve;
4. revise el borrador producido;
5. confirme su guardado.

La métrica principal no es solamente la precisión de transcripción: es el tiempo de documentación ahorrado por nota confirmada.

## Usuario inicial y expansión

### Validación inicial

- Psicólogos clínicos independientes de Argentina.
- Atención individual de adultos.
- Aproximadamente 15 a 30 sesiones semanales.
- Profesionales que acumulan notas y hoy usan Word, Drive, papel o audios propios.
- Usuarios que no quieren migrar agenda, cobros y facturación para resolver la documentación.

### Segunda cohorte

Psiquiatras independientes. El mismo núcleo de documentación puede servirles, pero medicación, indicaciones y seguimiento exigen mayor validación y no deben mezclarse con el primer piloto.

Centros, equipos grandes, parejas, grupos, menores y prácticas que necesiten una suite administrativa completa quedan fuera de la validación inicial.

## Lectura competitiva al 2026-07-16

El recorrido `audio breve post-sesión → borrador revisable` no es único. [Brauni](https://brauni.io/) ya comunica un flujo similar en Argentina; [Psik](https://www.psik.com.ar/) y [MentalGest](https://mentalgest.com/) combinan documentación con funciones de gestión; [Upheal](https://www.upheal.io/pricing) y [Mentalyc](https://www.mentalyc.com/pricing) ofrecen alternativas internacionales de dictado o notas asistidas.

Google Calendar tampoco es un diferencial aislado: Brauni, MentalGest, Upheal y otras suites ya ofrecen alguna sincronización. Para AIRA su valor es operativo: aprovechar la agenda existente para eliminar pasos antes de grabar, sin obligar al profesional a migrar.

Los recordatorios de medicación por WhatsApp tampoco son inéditos globalmente. [Dear Patient](https://www.dearpatient.in/), [PillMitra](https://pillmitra.in/for-doctors/) y [TakeIt](https://takeit.care/) ya ofrecen recordatorios y autoinformes. En la oferta argentina revisada predominan recordatorios de turnos, por lo que podría existir una oportunidad local, pero no un monopolio funcional.

Conclusión competitiva: audio, Calendar, IA o WhatsApp por separado son copiables. La diferenciación que debe validarse es la combinación de:

- no grabar al paciente ni la consulta completa;
- cerrar la nota desde el celular en pocos minutos;
- español clínico local y una nota de evolución excelente;
- documentar sin inventar, diagnosticar ni activar acciones automáticamente;
- revisión humana obligatoria;
- integrarse con la agenda existente en vez de reemplazarla;
- aprender formatos y preferencias sólo desde correcciones confirmadas;
- precio de entrada proporcional al uso real.

## Arquitectura de producto

### 1. AIRA Notas — núcleo actual

```text
Sesión terminada
→ texto o audio posterior
→ borrador
→ revisión profesional
→ confirmación
→ historial
```

La web es la fuente de verdad. WhatsApp es un canal adicional de entrada sobre los mismos pacientes, borradores y sesiones.

### 2. Google Calendar — capa de contexto aprobada

Calendar forma parte de la dirección del producto porque reduce directamente la fricción del núcleo, pero no convierte a AIRA en una agenda.

V1 propuesta:

- conexión de solo lectura y selección del calendario;
- Google Calendar continúa como fuente de verdad de los turnos;
- bandeja `Sesiones terminadas sin nota`;
- primer vínculo evento–paciente confirmado explícitamente por el profesional;
- reutilización posterior del vínculo confirmado;
- paciente, fecha y duración precargados al abrir la grabación;
- estado pendiente o documentada;
- recordatorio opcional al profesional después del turno.

No incluye inicialmente reservas, disponibilidad, Meet, recurrencias, reprogramaciones, recordatorios al paciente ni sincronización bidireccional.

Gate: validar primero que al menos 3 de 5 profesionales piloto usen Google Calendar. Conservar y profundizar la integración si al menos 60% la conecta y mejora en 15 puntos porcentuales la proporción de sesiones documentadas o reduce claramente el tiempo hasta iniciar la nota.

### 3. AIRA Seguimiento — hipótesis futura, no comprometida

El seguimiento de medicación convertiría a AIRA de una herramienta B2B de documentación en un producto B2B2C con interacción directa con pacientes. Puede ser una expansión coherente para psiquiatría, pero no pertenece al MVP actual.

Hipótesis de valor:

```text
Nota confirmada
→ plan cargado y confirmado por el psiquiatra
→ consentimiento del paciente
→ recordatorios discretos
→ Tomada / Posponer / No tomada / Dejar de recibir
→ resumen de autoinforme para la próxima consulta
```

El diferencial potencial no es el recordatorio aislado, sino el circuito entre la indicación confirmada, la respuesta del paciente y el resumen disponible en la siguiente consulta.

Reglas mínimas de producto:

- la IA nunca activa por sí sola una dosis, horario o cambio de medicación;
- el psiquiatra confirma paciente, medicamento, dosis, frecuencia, inicio, fin y cada modificación;
- `Tomada` representa un autoinforme, no prueba de adherencia;
- el mensaje es discreto y no muestra medicamento o dosis por defecto;
- el paciente puede pausar o cancelar;
- V1 no promete monitoreo 24/7, consejo clínico automático ni respuesta de emergencia;
- excluir inicialmente medicación a demanda, titulación, retirada, casos agudos y menores.

Meta exige opt-in, plantillas aprobadas para mensajes iniciados por la empresa y opt-out. Su [política vigente](https://whatsappbusiness.com/policy/) trata medicamentos y productos médicos como vertical regulada; la excepción pública para Argentina menciona medicamentos de venta libre, por lo que una plantilla sobre medicación prescrita debe prevalidarse con Meta o un BSP antes de construir o prometer el canal.

Gate de descubrimiento: entrevistar cinco psiquiatras y avanzar sólo si al menos tres lo usarían semanalmente y pagarían un adicional. Después, y sólo con una plantilla viable, ejecutar un piloto acotado con dos psiquiatras, 10 a 15 adultos, cuatro semanas y un esquema estable por participante.

## Hipótesis de precio

El precio puede facilitar la adopción, pero no debe ser la única propuesta de valor ni competir solamente por ser barato.

Hipótesis para Argentina, pendiente de validar con costos reales:

- primeras 10 notas confirmadas sin cargo;
- después, `0,05 UP` por nota confirmada;
- tope mensual de `3 UP`;
- fallos y borradores no confirmados no se cobran;
- Calendar se incluye en AIRA Notas;
- AIRA Seguimiento se cobraría aparte por paciente activo y consumo de mensajes.

La UP permite mantener una referencia local transparente. Con un arancel mínimo de 6 UP, el mensaje sería: `AIRA cuesta como máximo media sesión por mes`. El valor vigente debe verificarse antes de publicar precios; referencia: [Colegio de Psicólogos de la Provincia de Buenos Aires](https://colegiodepsicologos.org.ar/arancel-minimo-profesional-5/).

El piloto debe requerir una señal económica real —depósito acreditable o aceptación de renovación— y no medir intención de pago solamente con encuestas. El precio definitivo depende de que el margen de contribución sea al menos 70% incluyendo transcripción, estructuración, almacenamiento temporal, reintentos, cobro y mensajes.

## Alcance del MVP actual

### Incluido

- Registro e ingreso desde la web.
- Gestión básica de pacientes.
- Selección explícita del paciente.
- Nota breve de texto.
- Audio posterior a la sesión, con duración objetivo de 2 a 10 minutos.
- Carga de archivo real y, como próximo paso, grabación directa desde web móvil.
- Transcripción literal separada de la nota limpia.
- Borrador antes del guardado definitivo.
- Guardar, cancelar, reintentar y editar.
- Historial visible en la ficha web.
- Vinculación y recorrido de WhatsApp mediante adaptador simulado.

### Próximo dentro del núcleo

- Bandeja visible de borradores y conflictos fuera del modal.
- Grabación directa desde web móvil.
- Smoke real y benchmark humano del proveedor de audio.
- Un formato de nota validado con profesionales.
- Copiar/exportar e instrumentar tiempos, correcciones, confirmaciones y abandono.
- Piloto humano medible.
- Google Calendar V1 después de confirmar su uso en el piloto.

### Fuera del MVP

- Grabación o interpretación de sesiones terapéuticas completas.
- Identificación automática del paciente a partir del audio.
- Diagnósticos o evaluación automática de riesgo.
- Inferencias clínicas no dichas por el profesional.
- Agenda propia, reservas, cobros, facturación y teleconsulta.
- Portal del paciente o monitoreo clínico en tiempo real.
- AIRA Seguimiento y recordatorios de medicación en producción.
- Rediseño visual completo.

## Principios del producto

1. La web es la fuente de verdad para cuentas, pacientes, borradores y sesiones.
2. WhatsApp y Calendar son canales o capas de contexto, no sistemas paralelos.
3. El paciente siempre se selecciona o confirma explícitamente.
4. Toda nota genera primero un borrador.
5. Una sesión definitiva existe solamente después de la confirmación profesional.
6. El texto literal y el texto limpio se conservan por separado.
7. Los campos no mencionados quedan vacíos.
8. La IA documenta; no diagnostica, prescribe ni activa indicaciones.
9. El proveedor debe poder reemplazarse sin cambiar el flujo del producto.
10. Antes de ampliar funciones se valida uso sostenido, ahorro y voluntad de pago.

## Orden de implementación y validación

1. Cerrar la bandeja de borradores y la grabación móvil.
2. Repetir el smoke de Gemini y ejecutar el benchmark humano.
3. Validar un formato de nota y agregar copiar/exportar e instrumentación.
4. Pilotear AIRA Notas con cinco psicólogos durante dos semanas.
5. Implementar Calendar V1 si pasa el gate de uso.
6. Evaluar WhatsApp real como canal de entrada sólo después de validar el núcleo.
7. Hacer discovery de AIRA Seguimiento con psiquiatras; no implementarlo antes del gate.

## Gate del primer piloto

Continuar si:

- al menos 60% de las sesiones elegibles pasan por AIRA;
- al menos 80% de los borradores se confirman dentro de 24 horas;
- la edición mediana demora menos de dos minutos;
- al menos 85% de las notas requiere sólo correcciones menores;
- no hay pérdidas de notas, pacientes equivocados ni contenido clínico material inventado;
- al menos 3 de 5 profesionales aceptan pagar el precio completo.

Si el uso queda debajo de 40%, la documentación no ahorra al menos 20–30% del tiempo o los usuarios piden primero agenda, cobros y facturación, no se agregan funciones para ocultar el problema: se reposiciona AIRA como integración o se detiene esa línea.

## Métricas

- sesiones elegibles y porcentaje documentado con AIRA;
- porcentaje de borradores listos y confirmados;
- tiempo desde el fin del turno hasta iniciar y confirmar la nota;
- segundos de edición y proporción de texto modificado;
- errores clínicamente materiales y errores de paciente;
- abandonos, reintentos y recuperaciones;
- costo por nota confirmada y margen por nivel de uso;
- uso de Calendar y mejora atribuible;
- voluntad de pago medida con dinero o renovación, no sólo opinión.
