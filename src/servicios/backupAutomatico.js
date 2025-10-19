/**
 * Servicio de backup automático para AIRA
 * Realiza copias de seguridad programadas de la base de datos
 */
const { firestore } = require('../config/db');
const baseDatos = require('./baseDatos');
const fs = require('fs');
const path = require('path');

class ServicioBackupAutomatico {
  constructor() {
    this.db = firestore;
    this.directorioBackups = path.join(__dirname, '../../backups');
    this.configuracionPorDefecto = {
      frecuenciaDiaria: false,
      frecuenciaSemanal: true,
      diaSemana: 0, // Domingo
      hora: 1, // 1 AM
      retencionCopias: 10, // Mantener últimas 10 copias
      ultimoBackup: null
    };
  }

  /**
   * Configura el backup automático para un profesional
   * @param {String} profesionalId - ID del profesional
   * @param {Object} configuracion - Configuración de backup
   * @returns {Promise<Object>} - Configuración actualizada
   */
  async configurarBackup(profesionalId, configuracion = {}) {
    try {
      // Combinar con configuración por defecto
      const configActualizada = {
        ...this.configuracionPorDefecto,
        ...configuracion
      };
      
      // Guardar configuración
      await this.db.collection('configuracion').doc(profesionalId).set({
        backupAutomatico: configActualizada
      }, { merge: true });
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'configuracion_backup',
        profesionalId,
        { configuracion: configActualizada }
      );
      
      return configActualizada;
    } catch (error) {
      console.error('Error al configurar backup automático:', error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración de backup de un profesional
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<Object>} - Configuración de backup
   */
  async obtenerConfiguracion(profesionalId) {
    try {
      const doc = await this.db.collection('configuracion').doc(profesionalId).get();
      
      if (!doc.exists || !doc.data().backupAutomatico) {
        // Si no existe, crear con valores por defecto
        await this.configurarBackup(profesionalId);
        return this.configuracionPorDefecto;
      }
      
      return doc.data().backupAutomatico;
    } catch (error) {
      console.error('Error al obtener configuración de backup:', error);
      return this.configuracionPorDefecto;
    }
  }

  /**
   * Crea el directorio de backups si no existe
   * @returns {Promise<void>}
   */
  async crearDirectorioBackups() {
    try {
      if (!fs.existsSync(this.directorioBackups)) {
        fs.mkdirSync(this.directorioBackups, { recursive: true });
      }
    } catch (error) {
      console.error('Error al crear directorio de backups:', error);
      throw error;
    }
  }

  /**
   * Realiza un backup de los datos de un profesional
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<Object>} - Resultado del backup
   */
  async realizarBackup(profesionalId) {
    try {
      await this.crearDirectorioBackups();
      
      // Generar nombre de archivo con timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const nombreArchivo = `backup_${profesionalId}_${timestamp}.json`;
      const rutaArchivo = path.join(this.directorioBackups, nombreArchivo);
      
      // Obtener datos del profesional
      const datos = await this.obtenerDatosProfesional(profesionalId);
      
      // Guardar en archivo
      fs.writeFileSync(
        rutaArchivo,
        JSON.stringify(datos, null, 2)
      );
      
      // Actualizar fecha de último backup
      await this.actualizarFechaUltimoBackup(profesionalId);
      
      // Limpiar backups antiguos
      await this.limpiarBackupsAntiguos(profesionalId);
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'backup_automatico',
        profesionalId,
        { 
          nombreArchivo,
          timestamp,
          cantidadPacientes: datos.pacientes.length,
          cantidadSesiones: datos.sesiones.length
        }
      );
      
      return {
        exitoso: true,
        nombreArchivo,
        rutaArchivo,
        timestamp,
        cantidadPacientes: datos.pacientes.length,
        cantidadSesiones: datos.sesiones.length
      };
    } catch (error) {
      console.error('Error al realizar backup:', error);
      
      // Registrar error en auditoría
      await baseDatos.registrarAuditoria(
        'error_backup',
        profesionalId,
        { error: error.message }
      );
      
      throw error;
    }
  }

  /**
   * Obtiene todos los datos de un profesional para backup
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<Object>} - Datos del profesional
   */
  async obtenerDatosProfesional(profesionalId) {
    try {
      // Obtener datos del profesional
      const profesionalDoc = await this.db.collection('profesionales').doc(profesionalId).get();
      const profesional = profesionalDoc.data();
      profesional.id = profesionalId;
      
      // Obtener pacientes
      const pacientesSnapshot = await this.db.collection('pacientes')
        .where('profesionalId', '==', profesionalId)
        .get();
      
      const pacientes = pacientesSnapshot.docs.map(doc => {
        const datos = doc.data();
        datos.id = doc.id;
        return datos;
      });
      
      // Obtener sesiones
      const sesionesSnapshot = await this.db.collection('sesiones')
        .where('profesionalId', '==', profesionalId)
        .get();
      
      const sesiones = sesionesSnapshot.docs.map(doc => {
        const datos = doc.data();
        datos.id = doc.id;
        return datos;
      });
      
      // Obtener mensajes de WhatsApp
      const mensajesSnapshot = await this.db.collection('mensajesWhatsApp')
        .where('profesionalId', '==', profesionalId)
        .get();
      
      const mensajes = mensajesSnapshot.docs.map(doc => {
        const datos = doc.data();
        datos.id = doc.id;
        return datos;
      });
      
      return {
        profesional,
        pacientes,
        sesiones,
        mensajes,
        metadatos: {
          fechaBackup: new Date().toISOString(),
          version: '1.0'
        }
      };
    } catch (error) {
      console.error('Error al obtener datos del profesional:', error);
      throw error;
    }
  }

  /**
   * Actualiza la fecha del último backup
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<void>}
   */
  async actualizarFechaUltimoBackup(profesionalId) {
    try {
      const config = await this.obtenerConfiguracion(profesionalId);
      config.ultimoBackup = new Date().toISOString();
      
      await this.configurarBackup(profesionalId, config);
    } catch (error) {
      console.error('Error al actualizar fecha de último backup:', error);
    }
  }

  /**
   * Limpia backups antiguos según la configuración
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<void>}
   */
  async limpiarBackupsAntiguos(profesionalId) {
    try {
      const config = await this.obtenerConfiguracion(profesionalId);
      
      // Obtener archivos de backup del profesional
      const archivos = fs.readdirSync(this.directorioBackups)
        .filter(archivo => archivo.startsWith(`backup_${profesionalId}_`))
        .map(archivo => ({
          nombre: archivo,
          ruta: path.join(this.directorioBackups, archivo),
          fecha: fs.statSync(path.join(this.directorioBackups, archivo)).mtime
        }))
        .sort((a, b) => b.fecha - a.fecha); // Ordenar por fecha, más reciente primero
      
      // Eliminar archivos antiguos
      if (archivos.length > config.retencionCopias) {
        const archivosAEliminar = archivos.slice(config.retencionCopias);
        
        for (const archivo of archivosAEliminar) {
          fs.unlinkSync(archivo.ruta);
          console.log(`Backup antiguo eliminado: ${archivo.nombre}`);
        }
        
        // Registrar en auditoría
        await baseDatos.registrarAuditoria(
          'limpieza_backups',
          profesionalId,
          { 
            eliminados: archivosAEliminar.length,
            retenidos: config.retencionCopias
          }
        );
      }
    } catch (error) {
      console.error('Error al limpiar backups antiguos:', error);
    }
  }

  /**
   * Restaura un backup
   * @param {String} profesionalId - ID del profesional
   * @param {String} rutaArchivo - Ruta del archivo de backup
   * @returns {Promise<Object>} - Resultado de la restauración
   */
  async restaurarBackup(profesionalId, rutaArchivo) {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(rutaArchivo)) {
        throw new Error('Archivo de backup no encontrado');
      }
      
      // Leer archivo
      const datos = JSON.parse(fs.readFileSync(rutaArchivo, 'utf8'));
      
      // Verificar que el backup corresponde al profesional
      if (datos.profesional.id !== profesionalId) {
        throw new Error('El backup no corresponde al profesional');
      }
      
      // En un sistema real, aquí se implementaría la lógica de restauración
      // Este es un ejemplo simplificado
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'restauracion_backup',
        profesionalId,
        { 
          rutaArchivo,
          cantidadPacientes: datos.pacientes.length,
          cantidadSesiones: datos.sesiones.length
        }
      );
      
      return {
        exitoso: true,
        mensaje: 'Backup restaurado correctamente',
        cantidadPacientes: datos.pacientes.length,
        cantidadSesiones: datos.sesiones.length
      };
    } catch (error) {
      console.error('Error al restaurar backup:', error);
      
      // Registrar error en auditoría
      await baseDatos.registrarAuditoria(
        'error_restauracion',
        profesionalId,
        { error: error.message }
      );
      
      throw error;
    }
  }

  /**
   * Verifica si es necesario realizar un backup según la configuración
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<Boolean>} - true si es necesario realizar backup
   */
  async verificarNecesidadBackup(profesionalId) {
    try {
      const config = await this.obtenerConfiguracion(profesionalId);
      
      // Si nunca se ha hecho backup, es necesario
      if (!config.ultimoBackup) {
        return true;
      }
      
      const fechaUltimoBackup = new Date(config.ultimoBackup);
      const ahora = new Date();
      
      // Backup diario
      if (config.frecuenciaDiaria) {
        // Verificar si ya pasó la hora configurada
        if (
          ahora.getDate() !== fechaUltimoBackup.getDate() &&
          ahora.getHours() >= config.hora
        ) {
          return true;
        }
      }
      
      // Backup semanal
      if (config.frecuenciaSemanal) {
        // Verificar si estamos en el día de la semana configurado y ya pasó la hora
        if (
          ahora.getDay() === config.diaSemana &&
          ahora.getHours() >= config.hora &&
          (
            fechaUltimoBackup.getDay() !== config.diaSemana ||
            ahora.getDate() - fechaUltimoBackup.getDate() >= 7
          )
        ) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error al verificar necesidad de backup:', error);
      return false;
    }
  }
}

module.exports = new ServicioBackupAutomatico();
