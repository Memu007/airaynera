/**
 * Servicio de retención de datos para AIRA
 * Gestiona la política de retención de datos clínicos (mínimo 7 años)
 */
const baseDatos = require('./baseDatos');
const { firestore } = require('../config/db');

class ServicioRetencionDatos {
  constructor() {
    this.db = firestore;
    // Configuración por defecto (7 años)
    this.configuracionPorDefecto = {
      datosClinicosAnios: 7,
      datosAuditoriaMeses: 84, // 7 años en meses
      ultimaActualizacion: new Date()
    };
  }

  /**
   * Configura la política de retención para un profesional
   * @param {String} profesionalId - ID del profesional
   * @param {Object} configuracion - Configuración de retención
   * @returns {Promise<void>}
   */
  async configurarPolitica(profesionalId, configuracion = {}) {
    try {
      // Asegurar valores mínimos legales (7 años)
      const politicaRetencion = {
        datosClinicosAnios: Math.max(7, configuracion.datosClinicosAnios || 7),
        datosAuditoriaMeses: Math.max(84, configuracion.datosAuditoriaMeses || 84),
        ultimaActualizacion: new Date()
      };

      // Guardar configuración
      await this.db.collection('configuracion').doc(profesionalId).set({
        politicaRetencion
      }, { merge: true });

      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'configuracion_retencion',
        profesionalId,
        { politicaRetencion }
      );

      return politicaRetencion;
    } catch (error) {
      console.error('Error al configurar política de retención:', error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración de retención de un profesional
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<Object>} - Configuración de retención
   */
  async obtenerConfiguracion(profesionalId) {
    try {
      const doc = await this.db.collection('configuracion').doc(profesionalId).get();
      
      if (!doc.exists || !doc.data().politicaRetencion) {
        // Si no existe, crear con valores por defecto
        await this.configurarPolitica(profesionalId);
        return this.configuracionPorDefecto;
      }
      
      return doc.data().politicaRetencion;
    } catch (error) {
      console.error('Error al obtener configuración de retención:', error);
      return this.configuracionPorDefecto;
    }
  }

  /**
   * Marca datos para archivar según la política de retención
   * No elimina datos, solo los marca como archivados
   * @returns {Promise<Object>} - Estadísticas del proceso
   */
  async verificarDatosParaArchivar() {
    try {
      const estadisticas = {
        profesionalesRevisados: 0,
        sesionesArchivadas: 0,
        pacientesArchivados: 0,
        errores: 0
      };

      // Obtener todos los profesionales
      const profesionales = await this.db.collection('profesionales').get();
      
      for (const doc of profesionales.docs) {
        try {
          const profesionalId = doc.id;
          estadisticas.profesionalesRevisados++;
          
          // Obtener configuración de retención
          const config = await this.obtenerConfiguracion(profesionalId);
          
          // Calcular fecha límite según política
          const fechaLimite = new Date();
          fechaLimite.setFullYear(fechaLimite.getFullYear() - config.datosClinicosAnios);
          
          // Buscar sesiones antiguas no archivadas
          const sesionesAntiguas = await this.db.collection('sesiones')
            .where('profesionalId', '==', profesionalId)
            .where('fecha', '<', fechaLimite)
            .where('archivado', '==', false)
            .get();
          
          // Marcar sesiones como archivadas
          const batch = this.db.batch();
          sesionesAntiguas.docs.forEach(doc => {
            batch.update(doc.ref, { 
              archivado: true,
              fechaArchivado: new Date()
            });
            estadisticas.sesionesArchivadas++;
          });
          
          // Ejecutar batch
          if (sesionesAntiguas.docs.length > 0) {
            await batch.commit();
          }
          
          // Registrar en auditoría si hubo archivados
          if (sesionesAntiguas.docs.length > 0) {
            await baseDatos.registrarAuditoria(
              'archivado_automatico',
              profesionalId,
              { 
                sesionesArchivadas: sesionesAntiguas.docs.length,
                fechaLimite: fechaLimite.toISOString()
              }
            );
          }
        } catch (error) {
          console.error(`Error procesando profesional ${doc.id}:`, error);
          estadisticas.errores++;
        }
      }
      
      return estadisticas;
    } catch (error) {
      console.error('Error al verificar datos para archivar:', error);
      throw error;
    }
  }

  /**
   * Exporta datos archivados a almacenamiento frío
   * Útil para cumplimiento normativo y reducción de costos
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<Object>} - Estadísticas del proceso
   */
  async exportarDatosArchivados(profesionalId) {
    try {
      // Buscar datos archivados
      const sesionesArchivadas = await this.db.collection('sesiones')
        .where('profesionalId', '==', profesionalId)
        .where('archivado', '==', true)
        .get();
      
      // Preparar datos para exportación
      const datosExportacion = {
        profesionalId,
        fechaExportacion: new Date().toISOString(),
        sesiones: sesionesArchivadas.docs.map(doc => {
          const datos = doc.data();
          datos.id = doc.id;
          return datos;
        })
      };
      
      // En un sistema real, aquí se enviarían a almacenamiento frío
      // Por ejemplo: Amazon S3 Glacier, Google Cloud Storage Archive, etc.
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'exportacion_archivo_frio',
        profesionalId,
        { 
          cantidadSesiones: sesionesArchivadas.docs.length,
          fechaExportacion: datosExportacion.fechaExportacion
        }
      );
      
      return {
        sesionesExportadas: sesionesArchivadas.docs.length,
        fechaExportacion: datosExportacion.fechaExportacion
      };
    } catch (error) {
      console.error('Error al exportar datos archivados:', error);
      throw error;
    }
  }
}

module.exports = new ServicioRetencionDatos();
