/**
 * Integración de servicios para AIRA
 * Conecta los servicios existentes con las nuevas funcionalidades
 */
const baseDatos = require('./baseDatos');
const autenticacion = require('./autenticacion');
const gestorSesiones = require('./gestorSesiones');
const retencionDatos = require('./retencionDatos');
const historialCambios = require('./historialCambios');
const integracionCanales = require('./integracionCanales');
const exportacionDatos = require('./exportacionDatos');
const alertasSeguridad = require('./alertasSeguridad');
const backupAutomatico = require('./backupAutomatico');

// Integrar servicios
function integrarServicios() {
  // Inyectar dependencias
  baseDatos.historialCambios = historialCambios;
  baseDatos.alertasSeguridad = alertasSeguridad;
  
  // Conectar eventos entre servicios
  conectarEventos();
  
  console.log('Servicios integrados correctamente');
  return true;
}

// Conectar eventos entre servicios
function conectarEventos() {
  // Ejemplo: Monitorear modificaciones de datos sensibles
  const metodosOriginales = {
    actualizarPaciente: baseDatos.actualizarPaciente
  };
  
  // Sobrescribir método para añadir funcionalidad
  baseDatos.actualizarPaciente = async function(profesionalId, pacienteId, datos) {
    try {
      // Obtener datos originales para comparar cambios
      const pacienteOriginal = await baseDatos.obtenerPacientePorId(profesionalId, pacienteId);
      
      // Ejecutar método original
      const resultado = await metodosOriginales.actualizarPaciente.call(baseDatos, profesionalId, pacienteId, datos);
      
      // Detectar cambios en datos sensibles
      if (datos.telefono || datos.email || datos.obraSocial || datos.notas) {
        const cambios = {};
        
        if (datos.telefono) cambios.telefono = datos.telefono;
        if (datos.email) cambios.email = datos.email;
        if (datos.obraSocial) cambios.obraSocial = datos.obraSocial;
        if (datos.notas) cambios.notas = datos.notas;
        
        // Registrar en historial de cambios
        await historialCambios.registrarCambio(
          profesionalId,
          pacienteId,
          'paciente',
          { 
            accion: 'actualizacion',
            cambios: historialCambios.detectarCambios(
              {
                telefono: pacienteOriginal?.datosSensibles?.telefono,
                email: pacienteOriginal?.datosSensibles?.email,
                obraSocial: pacienteOriginal?.datosSensibles?.obraSocial,
                notas: pacienteOriginal?.datosSensibles?.notas
              },
              cambios
            )
          },
          'web'
        );
        
        // Monitorear cambios sensibles
        await alertasSeguridad.monitorearModificacionSensible(
          profesionalId,
          pacienteId,
          cambios
        );
      }
      
      return resultado;
    } catch (error) {
      console.error('Error en actualizarPaciente interceptado:', error);
      throw error;
    }
  };
}

// Verificar necesidad de backup
async function verificarNecesidadBackup() {
  try {
    // Obtener todos los profesionales
    const profesionales = await baseDatos.obtenerTodosProfesionales();
    
    for (const profesional of profesionales) {
      const necesitaBackup = await backupAutomatico.verificarNecesidadBackup(profesional.id);
      
      if (necesitaBackup) {
        console.log(`Realizando backup automático para profesional ${profesional.id}`);
        await backupAutomatico.realizarBackup(profesional.id);
      }
    }
  } catch (error) {
    console.error('Error al verificar necesidad de backup:', error);
  }
}

// Verificar datos para archivar
async function verificarDatosParaArchivar() {
  try {
    const estadisticas = await retencionDatos.verificarDatosParaArchivar();
    console.log('Verificación de datos para archivar completada:', estadisticas);
  } catch (error) {
    console.error('Error al verificar datos para archivar:', error);
  }
}

// Exportar funciones
module.exports = {
  integrarServicios,
  verificarNecesidadBackup,
  verificarDatosParaArchivar
};
