# Producto AIRA

Última actualización: 2026-07-14.

## Definición

AIRA ayuda a psicólogos y psiquiatras a mantener actualizadas las fichas de sus pacientes mediante notas breves de texto o audio enviadas desde WhatsApp o la web.

No busca reemplazar el criterio profesional ni procesar sesiones terapéuticas completas. Convierte el relato posterior del profesional en un borrador clínico ordenado, editable y guardado en el paciente correcto.

## Problema

Después de atender, el profesional necesita mantener al día la documentación de sus pacientes. Abrir un sistema, buscar la ficha y completar formularios agrega fricción y hace que las notas se posterguen.

AIRA reduce esa fricción permitiendo que el profesional:

1. elija al paciente;
2. dicte o escriba una nota breve;
3. revise el borrador producido;
4. confirme su guardado.

## Propuesta de valor

> Una nota breve del profesional se transforma en un borrador clínico editable, asociado explícitamente al paciente correcto y disponible en la web.

## Usuario inicial

- Psicólogos.
- Psiquiatras.
- Profesionales independientes o equipos pequeños.
- Usuarios que necesitan mantener fichas clínicas actualizadas con la menor fricción posible.

## Alcance del MVP

### Incluido

- Registro e ingreso desde la web.
- Gestión básica de pacientes.
- Vinculación de un número de WhatsApp con una cuenta web.
- Selección explícita del paciente desde la web o WhatsApp.
- Nota breve de texto.
- Audio posterior a la sesión, con una duración objetivo de 2 a 10 minutos.
- Transcripción literal separada de la nota limpia.
- Borrador antes del guardado definitivo.
- Guardar, cancelar, volver a grabar y abrir en la web para editar.
- Historial visible en la ficha web.
- Entrada equivalente mediante grabación o subida desde la web.

### Fuera del MVP

- Grabación o interpretación de sesiones terapéuticas completas.
- Identificación automática del paciente a partir del audio.
- Diagnósticos generados por IA.
- Evaluación automática de riesgo clínico.
- Inferencias clínicas no dichas por el profesional.
- Diarización de profesional y paciente.
- Edición avanzada de audio.
- Rediseño visual completo.
- Automatizaciones administrativas complejas.

## Principios del producto

1. La web es la fuente de verdad para cuentas, pacientes, borradores y sesiones.
2. WhatsApp es un canal de entrada sobre esos mismos datos, no un sistema independiente.
3. El número vinculado determina la cuenta; no se utiliza IA para reconocer al profesional.
4. El paciente siempre se selecciona explícitamente antes de enviar la nota.
5. Toda nota genera primero un borrador.
6. Una sesión definitiva existe solamente después de la confirmación del profesional.
7. El texto literal y el texto limpio se conservan por separado.
8. Los campos no mencionados quedan vacíos.
9. El proveedor de transcripción debe poder reemplazarse sin cambiar el flujo del producto.
10. La prioridad inicial es que el recorrido funcione, no la estética ni la optimización prematura.

## Recorrido principal

```text
Registro web
→ Crear paciente
→ Vincular WhatsApp
→ Nueva sesión
→ Elegir paciente
→ Enviar texto o audio
→ Recibir borrador
→ Guardar / Editar / Regrabar / Cancelar
→ Ver sesión en la ficha web
```

También debe poder iniciarse desde la ficha web:

```text
Ficha del paciente
→ Nueva sesión
→ Escribir, grabar o continuar por WhatsApp
```

## Contenido inicial de una nota

- Paciente.
- Fecha de atención.
- Nota de evolución.
- Temas tratados.
- Intervenciones mencionadas.
- Acuerdos, tareas o seguimiento.
- Medicación mencionada, si corresponde.
- Fragmentos dudosos o ininteligibles.
- Transcripción literal.
- Origen: web o WhatsApp.

## Métrica principal

La métrica principal no es solamente la precisión de transcripción:

> Tiempo de documentación ahorrado al profesional por nota confirmada.

Métricas complementarias:

- porcentaje de audios completados;
- porcentaje de borradores confirmados con cambios menores;
- segundos de edición por nota;
- tiempo total de procesamiento;
- costo por audio;
- cantidad de duplicados;
- cantidad de errores de selección de paciente.
