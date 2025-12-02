/**
 * Servicio de exportación de datos para AIRA
 * Permite exportar datos de pacientes y sesiones en formatos estándar
 */
const baseDatos = require('./baseDatos');
const { firestore } = require('../config/db');

class ServicioExportacionDatos {
  constructor() {
    this.db = firestore;
    this.formatosDisponibles = ['json', 'csv'];
  }

  /**
   * Exporta datos de un paciente
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {String} formato - Formato de exportación ('json' o 'csv')
   * @returns {Promise<Object>} - Datos exportados
   */
  async exportarPaciente(profesionalId, pacienteId, formato = 'json') {
    try {
      // Validar formato
      if (!this.formatosDisponibles.includes(formato)) {
        throw new Error(`Formato no válido. Formatos disponibles: ${this.formatosDisponibles.join(', ')}`);
      }
      
      // Obtener datos del paciente
      const paciente = await baseDatos.obtenerPacientePorId(profesionalId, pacienteId);
      
      if (!paciente) {
        throw new Error('Paciente no encontrado');
      }
      
      // Obtener sesiones del paciente
      const sesiones = await baseDatos.obtenerSesionesPorPaciente(profesionalId, pacienteId);
      
      // Descifrar datos sensibles
      const datosSensibles = await baseDatos.descifrarDatos(paciente.datosSensibles, profesionalId);
      
      // Construir objeto de datos
      const datos = {
        paciente: {
          id: pacienteId,
          nombre: paciente.nombre,
          apellido: paciente.apellido,
          dni: paciente.dni,
          fechaNacimiento: paciente.fechaNacimiento,
          telefono: datosSensibles.telefono,
          email: datosSensibles.email,
          obraSocial: datosSensibles.obraSocial
        },
        sesiones: sesiones.map(sesion => ({
          id: sesion.id,
          fecha: sesion.fecha,
          observaciones: sesion.observaciones,
          estadoAnimo: sesion.estadoAnimo,
          origen: sesion.origen
        }))
      };
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'exportacion_datos',
        profesionalId,
        { 
          pacienteId, 
          formato,
          cantidadSesiones: sesiones.length
        }
      );
      
      // Convertir al formato solicitado
      if (formato === 'json') {
        return this.convertirAJson(datos);
      } else if (formato === 'csv') {
        return this.convertirACsv(datos);
      }
    } catch (error) {
      console.error('Error al exportar datos del paciente:', error);
      throw error;
    }
  }

  /**
   * Exporta datos de todos los pacientes
   * @param {String} profesionalId - ID del profesional
   * @param {String} formato - Formato de exportación ('json' o 'csv')
   * @returns {Promise<Object>} - Datos exportados
   */
  async exportarTodosPacientes(profesionalId, formato = 'json') {
    try {
      // Validar formato
      if (!this.formatosDisponibles.includes(formato)) {
        throw new Error(`Formato no válido. Formatos disponibles: ${this.formatosDisponibles.join(', ')}`);
      }
      
      // Obtener todos los pacientes
      const pacientes = await baseDatos.obtenerPacientes(profesionalId);
      
      // Datos a exportar
      const datos = {
        profesionalId,
        fechaExportacion: new Date().toISOString(),
        pacientes: []
      };
      
      // Procesar cada paciente
      for (const paciente of pacientes) {
        // Descifrar datos sensibles
        const datosSensibles = await baseDatos.descifrarDatos(paciente.datosSensibles, profesionalId);
        
        // Obtener sesiones del paciente
        const sesiones = await baseDatos.obtenerSesionesPorPaciente(profesionalId, paciente.id);
        
        // Agregar a la lista
        datos.pacientes.push({
          id: paciente.id,
          nombre: paciente.nombre,
          apellido: paciente.apellido,
          dni: paciente.dni,
          fechaNacimiento: paciente.fechaNacimiento,
          telefono: datosSensibles.telefono,
          email: datosSensibles.email,
          obraSocial: datosSensibles.obraSocial,
          sesiones: sesiones.map(sesion => ({
            id: sesion.id,
            fecha: sesion.fecha,
            observaciones: sesion.observaciones,
            estadoAnimo: sesion.estadoAnimo,
            origen: sesion.origen
          }))
        });
      }
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'exportacion_masiva',
        profesionalId,
        { 
          cantidadPacientes: pacientes.length,
          formato
        }
      );
      
      // Convertir al formato solicitado
      if (formato === 'json') {
        return this.convertirAJson(datos);
      } else if (formato === 'csv') {
        return this.convertirACsv(datos);
      }
    } catch (error) {
      console.error('Error al exportar todos los pacientes:', error);
      throw error;
    }
  }

  /**
   * Convierte datos a formato JSON
   * @param {Object} datos - Datos a convertir
   * @returns {Object} - Datos en formato JSON
   */
  convertirAJson(datos) {
    return {
      formato: 'json',
      contenido: JSON.stringify(datos, null, 2),
      nombreArchivo: `exportacion_${new Date().toISOString().replace(/:/g, '-')}.json`
    };
  }

  /**
   * Convierte datos a formato CSV
   * @param {Object} datos - Datos a convertir
   * @returns {Object} - Datos en formato CSV
   */
  convertirACsv(datos) {
    try {
      // Función para convertir objeto a CSV
      const objetoACsv = (objeto, cabeceras) => {
        const fila = cabeceras.map(cabecera => {
          const valor = objeto[cabecera] || '';
          // Escapar comillas y encerrar en comillas si contiene comas
          return typeof valor === 'string' && (valor.includes(',') || valor.includes('"')) 
            ? `"${valor.replace(/"/g, '""')}"` 
            : valor;
        });
        return fila.join(',');
      };
      
      // Crear CSV para pacientes
      let csvPacientes = '';
      const cabecerasPaciente = ['id', 'nombre', 'apellido', 'dni', 'fechaNacimiento', 'telefono', 'email', 'obraSocial'];
      csvPacientes = cabecerasPaciente.join(',') + '\n';
      
      // Si es un solo paciente
      if (datos.paciente) {
        csvPacientes += objetoACsv(datos.paciente, cabecerasPaciente) + '\n';
      } 
      // Si son múltiples pacientes
      else if (datos.pacientes) {
        datos.pacientes.forEach(paciente => {
          csvPacientes += objetoACsv(paciente, cabecerasPaciente) + '\n';
        });
      }
      
      // Crear CSV para sesiones
      let csvSesiones = '';
      const cabecerasSesion = ['id', 'pacienteId', 'fecha', 'observaciones', 'estadoAnimo', 'origen'];
      csvSesiones = cabecerasSesion.join(',') + '\n';
      
      // Si es un solo paciente
      if (datos.paciente && datos.sesiones) {
        datos.sesiones.forEach(sesion => {
          // Agregar pacienteId a cada sesión
          const sesionConPaciente = { ...sesion, pacienteId: datos.paciente.id };
          csvSesiones += objetoACsv(sesionConPaciente, cabecerasSesion) + '\n';
        });
      } 
      // Si son múltiples pacientes
      else if (datos.pacientes) {
        datos.pacientes.forEach(paciente => {
          if (paciente.sesiones) {
            paciente.sesiones.forEach(sesion => {
              // Agregar pacienteId a cada sesión
              const sesionConPaciente = { ...sesion, pacienteId: paciente.id };
              csvSesiones += objetoACsv(sesionConPaciente, cabecerasSesion) + '\n';
            });
          }
        });
      }
      
      return {
        formato: 'csv',
        contenido: {
          pacientes: csvPacientes,
          sesiones: csvSesiones
        },
        nombreArchivo: `exportacion_${new Date().toISOString().replace(/:/g, '-')}.zip`
      };
    } catch (error) {
      console.error('Error al convertir a CSV:', error);
      throw error;
    }
  }

  /**
   * Genera un informe resumido de un paciente
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @returns {Promise<Object>} - Informe del paciente
   */
  async generarInformePaciente(profesionalId, pacienteId) {
    try {
      // Obtener datos del paciente
      const paciente = await baseDatos.obtenerPacientePorId(profesionalId, pacienteId);
      
      if (!paciente) {
        throw new Error('Paciente no encontrado');
      }
      
      // Descifrar datos sensibles
      const datosSensibles = await baseDatos.descifrarDatos(paciente.datosSensibles, profesionalId);
      
      // Obtener sesiones del paciente
      const sesiones = await baseDatos.obtenerSesionesPorPaciente(profesionalId, pacienteId);
      
      // Calcular estadísticas
      const estadisticas = {
        totalSesiones: sesiones.length,
        sesionesWeb: sesiones.filter(s => s.origen === 'web').length,
        sesionesWhatsapp: sesiones.filter(s => s.origen === 'whatsapp').length,
        primeraSesion: sesiones.length > 0 ? new Date(Math.min(...sesiones.map(s => new Date(s.fecha)))) : null,
        ultimaSesion: sesiones.length > 0 ? new Date(Math.max(...sesiones.map(s => new Date(s.fecha)))) : null
      };
      
      // Generar informe
      const informe = {
        paciente: {
          id: pacienteId,
          nombre: `${paciente.nombre} ${paciente.apellido}`,
          dni: paciente.dni,
          fechaNacimiento: paciente.fechaNacimiento,
          edad: this.calcularEdad(paciente.fechaNacimiento),
          contacto: {
            telefono: datosSensibles.telefono,
            email: datosSensibles.email
          },
          obraSocial: datosSensibles.obraSocial
        },
        estadisticas,
        sesionesRecientes: sesiones
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
          .slice(0, 5)
          .map(s => ({
            fecha: s.fecha,
            estadoAnimo: s.estadoAnimo,
            observaciones: s.observaciones,
            origen: s.origen
          }))
      };
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'generacion_informe',
        profesionalId,
        { pacienteId }
      );
      
      return informe;
    } catch (error) {
      console.error('Error al generar informe del paciente:', error);
      throw error;
    }
  }

  /**
   * Calcula la edad a partir de la fecha de nacimiento
   * @param {String} fechaNacimiento - Fecha de nacimiento
   * @returns {Number} - Edad en años
   */
  calcularEdad(fechaNacimiento) {
    const hoy = new Date();
    const fechaNac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    
    return edad;
  }
}

module.exports = new ServicioExportacionDatos();
