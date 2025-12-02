/**
 * Tareas programadas para AIRA
 * Ejecuta procesos automáticos en intervalos definidos
 */
const { integrarServicios, verificarNecesidadBackup, verificarDatosParaArchivar } = require('../servicios/integracionServicios');
const baseDatos = require('../servicios/baseDatos');

// Configuración de intervalos (en milisegundos)
const INTERVALOS = {
  BACKUP: 24 * 60 * 60 * 1000, // 24 horas
  ARCHIVADO: 7 * 24 * 60 * 60 * 1000, // 7 días
  VERIFICACION_ALERTAS: 60 * 60 * 1000 // 1 hora
};

// Timers para las tareas
let timerBackup = null;
let timerArchivado = null;
let timerAlertasSeguridad = null;

/**
 * Inicia todas las tareas programadas
 */
function iniciarTareasProgramadas() {
  try {
    console.log('Iniciando tareas programadas...');
    
    // Integrar servicios primero
    integrarServicios();
    
    // Iniciar tareas individuales
    iniciarTareaBackup();
    iniciarTareaArchivado();
    iniciarTareaVerificacionAlertas();
    
    console.log('Tareas programadas iniciadas correctamente');
    return true;
  } catch (error) {
    console.error('Error al iniciar tareas programadas:', error);
    return false;
  }
}

/**
 * Detiene todas las tareas programadas
 */
function detenerTareasProgramadas() {
  try {
    console.log('Deteniendo tareas programadas...');
    
    // Detener timers
    if (timerBackup) clearInterval(timerBackup);
    if (timerArchivado) clearInterval(timerArchivado);
    if (timerAlertasSeguridad) clearInterval(timerAlertasSeguridad);
    
    // Resetear variables
    timerBackup = null;
    timerArchivado = null;
    timerAlertasSeguridad = null;
    
    console.log('Tareas programadas detenidas correctamente');
    return true;
  } catch (error) {
    console.error('Error al detener tareas programadas:', error);
    return false;
  }
}

/**
 * Inicia la tarea de backup automático
 */
function iniciarTareaBackup() {
  // Ejecutar inmediatamente al inicio
  verificarNecesidadBackup().catch(error => {
    console.error('Error en verificación inicial de backup:', error);
  });
  
  // Programar ejecuciones periódicas
  timerBackup = setInterval(() => {
    verificarNecesidadBackup().catch(error => {
      console.error('Error en verificación periódica de backup:', error);
    });
  }, INTERVALOS.BACKUP);
  
  console.log('Tarea de backup automático iniciada');
}

/**
 * Inicia la tarea de archivado automático
 */
function iniciarTareaArchivado() {
  // Ejecutar inmediatamente al inicio
  verificarDatosParaArchivar().catch(error => {
    console.error('Error en verificación inicial de archivado:', error);
  });
  
  // Programar ejecuciones periódicas
  timerArchivado = setInterval(() => {
    verificarDatosParaArchivar().catch(error => {
      console.error('Error en verificación periódica de archivado:', error);
    });
  }, INTERVALOS.ARCHIVADO);
  
  console.log('Tarea de archivado automático iniciada');
}

/**
 * Inicia la tarea de verificación de alertas de seguridad
 */
function iniciarTareaVerificacionAlertas() {
  // Importar servicio
  const alertasSeguridad = require('../servicios/alertasSeguridad');
  
  // Función para verificar alertas
  async function verificarAlertas() {
    try {
      // Obtener todos los profesionales
      const profesionales = await baseDatos.obtenerTodosProfesionales();
      
      for (const profesional of profesionales) {
        // Verificar logins fallidos
        await alertasSeguridad.monitorearLoginsFallidos(profesional.id);
      }
    } catch (error) {
      console.error('Error al verificar alertas de seguridad:', error);
    }
  }
  
  // Ejecutar inmediatamente al inicio
  verificarAlertas().catch(error => {
    console.error('Error en verificación inicial de alertas:', error);
  });
  
  // Programar ejecuciones periódicas
  timerAlertasSeguridad = setInterval(() => {
    verificarAlertas().catch(error => {
      console.error('Error en verificación periódica de alertas:', error);
    });
  }, INTERVALOS.VERIFICACION_ALERTAS);
  
  console.log('Tarea de verificación de alertas iniciada');
}

// Exportar funciones
module.exports = {
  iniciarTareasProgramadas,
  detenerTareasProgramadas
};
