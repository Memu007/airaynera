/**
 * Servicio de base de datos para AIRA
 * Conecta tanto la web como WhatsApp a la misma base de datos
 */
const { firestore, colecciones } = require('../config/db');
const { generarClaveDerivedada, configCifrado } = require('../config/seguridad');
const crypto = require('crypto');

class ServicioBaseDatos {
  constructor() {
    this.db = firestore;
    this.colecciones = colecciones;
  }

  /**
   * Cifra datos sensibles antes de guardarlos en la base de datos
   * @param {Object} datos - Datos a cifrar
   * @param {String} contexto - Contexto para la clave (ej: DNI del profesional)
   * @returns {Object} - Datos cifrados
   */
  cifrarDatos(datos, contexto = 'default') {
    try {
      const clave = generarClaveDerivedada(contexto);
      const iv = crypto.randomBytes(configCifrado.longitudIv);
      const cifrador = crypto.createCipheriv(configCifrado.algoritmo, clave, iv);
      
      const textoCifrado = Buffer.concat([
        cifrador.update(JSON.stringify(datos), 'utf8'),
        cifrador.final()
      ]);
      
      const authTag = cifrador.getAuthTag();
      
      return {
        iv: iv.toString('hex'),
        datos: textoCifrado.toString('hex'),
        tag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('Error al cifrar datos:', error);
      throw new Error('Error de seguridad al cifrar datos');
    }
  }

  /**
   * Descifra datos sensibles
   * @param {Object} datosCifrados - Datos cifrados
   * @param {String} contexto - Contexto para la clave (ej: DNI del profesional)
   * @returns {Object} - Datos descifrados
   */
  descifrarDatos(datosCifrados, contexto = 'default') {
    try {
      const clave = generarClaveDerivedada(contexto);
      const iv = Buffer.from(datosCifrados.iv, 'hex');
      const descifrador = crypto.createDecipheriv(configCifrado.algoritmo, clave, iv);
      
      descifrador.setAuthTag(Buffer.from(datosCifrados.tag, 'hex'));
      
      const textoDescifrado = Buffer.concat([
        descifrador.update(Buffer.from(datosCifrados.datos, 'hex')),
        descifrador.final()
      ]);
      
      return JSON.parse(textoDescifrado.toString('utf8'));
    } catch (error) {
      console.error('Error al descifrar datos:', error);
      throw new Error('Error de seguridad al descifrar datos');
    }
  }

  /**
   * Registra un nuevo profesional
   * @param {Object} datos - Datos del profesional
   * @returns {Promise<String>} - ID del profesional
   */
  async registrarProfesional(datos) {
    try {
      // Verificar si ya existe
      const profesionalRef = this.db.collection(this.colecciones.profesionales)
        .where('dni', '==', datos.dni);
      const snapshot = await profesionalRef.get();
      
      if (!snapshot.empty) {
        throw new Error('Ya existe un profesional con ese DNI');
      }
      
      // Crear nuevo profesional
      const nuevoDoc = this.db.collection(this.colecciones.profesionales).doc();
      await nuevoDoc.set({
        ...datos,
        creado: new Date(),
        ultimoAcceso: new Date()
      });
      
      return nuevoDoc.id;
    } catch (error) {
      console.error('Error al registrar profesional:', error);
      throw error;
    }
  }

  /**
   * Obtiene un profesional por su DNI
   * @param {String} dni - DNI del profesional
   * @returns {Promise<Object>} - Datos del profesional
   */
  async obtenerProfesionalPorDni(dni) {
    try {
      const profesionalRef = this.db.collection(this.colecciones.profesionales)
        .where('dni', '==', dni);
      const snapshot = await profesionalRef.get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const profesional = snapshot.docs[0].data();
      profesional.id = snapshot.docs[0].id;
      
      return profesional;
    } catch (error) {
      console.error('Error al obtener profesional:', error);
      throw error;
    }
  }

  /**
   * Registra un paciente nuevo
   * @param {String} profesionalId - ID del profesional
   * @param {Object} datos - Datos del paciente
   * @returns {Promise<String>} - ID del paciente creado
   */
  async registrarPaciente(profesionalId, datos) {
    try {
      // Verificar si ya existe un paciente con el mismo DNI
      const pacienteExistente = await this.obtenerPacientePorDni(profesionalId, datos.dni);
      if (pacienteExistente) {
        throw new Error(`Ya existe un paciente con DNI ${datos.dni}`);
      }
      
      // Cifrar datos sensibles
      const datosSensibles = {
        telefono: datos.telefono,
        email: datos.email,
        obraSocial: datos.obraSocial,
        notas: datos.notas
      };
      const datosCifrados = this.cifrarDatos(datosSensibles, profesionalId);
      
      // Crear documento de paciente
      const nuevoDoc = this.db.collection('pacientes').doc();
      
      const pacienteData = {
        profesionalId,
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        fechaNacimiento: datos.fechaNacimiento,
        datosSensibles: datosCifrados,
        fechaCreacion: new Date(),
        fechaActualizacion: new Date(),
        // Nuevos campos para retención y archivado
        archivado: false,
        fechaArchivado: null,
        eliminado: false,
        fechaEliminacion: null
      };
      
      await nuevoDoc.set(pacienteData);
      
      // Registrar en auditoría
      await this.registrarAuditoria(
        'registro_paciente',
        profesionalId,
        { pacienteId: nuevoDoc.id, dni: datos.dni }
      );
      
      // Registrar en historial de cambios si el servicio está disponible
      if (this.historialCambios) {
        await this.historialCambios.registrarCambio(
          profesionalId,
          nuevoDoc.id,
          'paciente',
          { accion: 'creacion', datos: { ...pacienteData, datosSensibles } },
          'web'
        );
      }
      
      return nuevoDoc.id;
    } catch (error) {
      console.error('Error al registrar paciente:', error);
      throw error;
    }
  }

  /**
   * Obtiene un paciente por su DNI
   * @param {String} profesionalId - ID del profesional
   * @param {String} dni - DNI del paciente
   * @returns {Promise<Object>} - Datos del paciente
   */
  async obtenerPacientePorDni(profesionalId, dni) {
    try {
      const pacienteRef = this.db.collection('pacientes')
        .where('profesionalId', '==', profesionalId)
        .where('dni', '==', dni);
      const snapshot = await pacienteRef.get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const paciente = snapshot.docs[0].data();
      paciente.id = snapshot.docs[0].id;
      
      return paciente;
    } catch (error) {
      console.error('Error al obtener paciente:', error);
      throw error;
    }
  }

  /**
   * Registra un nuevo paciente
   * @param {String} profesionalId - ID del profesional
   * @param {Object} datos - Datos del paciente
   * @returns {Promise<String>} - ID del paciente
   */
  async registrarPaciente(profesionalId, datos) {
    try {
      // Verificar si ya existe para este profesional
      const pacienteRef = this.db.collection(this.colecciones.pacientes)
        .where('dni', '==', datos.dni)
        .where('profesionalId', '==', profesionalId);
      const snapshot = await pacienteRef.get();
      
      if (!snapshot.empty) {
        throw new Error('Ya existe un paciente con ese DNI para este profesional');
      }
      
      // Cifrar datos sensibles
      const datosSensibles = {
        telefono: datos.telefono,
        email: datos.email,
        obraSocial: datos.obraSocial,
        notas: datos.notas
      };
      
      const datosCifrados = this.cifrarDatos(datosSensibles, profesionalId);
      
      // Crear nuevo paciente
      const nuevoDoc = this.db.collection(this.colecciones.pacientes).doc();
      await nuevoDoc.set({
        nombre: datos.nombre,
        dni: datos.dni,
        profesionalId,
        datosSensibles: datosCifrados,
        creado: new Date(),
        actualizado: new Date(),
        origen: datos.origen || 'web' // 'web' o 'whatsapp'
      });
      
      return nuevoDoc.id;
    } catch (error) {
      console.error('Error al registrar paciente:', error);
      throw error;
    }
  }

  /**
   * Obtiene los pacientes de un profesional
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<Array>} - Lista de pacientes
   */
  async obtenerPacientesPorProfesional(profesionalId) {
    try {
      const pacientesRef = this.db.collection(this.colecciones.pacientes)
        .where('profesionalId', '==', profesionalId);
      const snapshot = await pacientesRef.get();
      
      if (snapshot.empty) {
        return [];
      }
      
      return snapshot.docs.map(doc => {
        const paciente = doc.data();
        paciente.id = doc.id;
        
        // Descifrar datos sensibles
        if (paciente.datosSensibles) {
          try {
            paciente.datosSensibles = this.descifrarDatos(
              paciente.datosSensibles, 
              profesionalId
            );
          } catch (error) {
            console.error('Error al descifrar datos del paciente:', error);
            paciente.datosSensibles = { error: 'Error al descifrar datos' };
          }
        }
        
        return paciente;
      });
    } catch (error) {
      console.error('Error al obtener pacientes:', error);
      throw error;
    }
  }

  /**
   * Registra una nueva sesión
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {Object} datos - Datos de la sesión
   * @returns {Promise<String>} - ID de la sesión
   */
  async registrarSesion(profesionalId, pacienteId, datos) {
    try {
      // Cifrar observaciones
      const observacionesCifradas = this.cifrarDatos(
        { observaciones: datos.observaciones }, 
        profesionalId
      );
      
      // Crear nueva sesión
      const nuevoDoc = this.db.collection(this.colecciones.sesiones).doc();
      await nuevoDoc.set({
        profesionalId,
        pacienteId,
        fecha: new Date(datos.fecha) || new Date(),
        duracion: datos.duracion || 0,
        estadoAnimo: datos.estadoAnimo || '',
        observacionesCifradas,
        creado: new Date(),
        actualizado: new Date(),
        origen: datos.origen || 'web', // 'web' o 'whatsapp'
        resumen: datos.resumen || ''
      });
      
      return nuevoDoc.id;
    } catch (error) {
      console.error('Error al registrar sesión:', error);
      throw error;
    }
  }

  /**
   * Obtiene las sesiones de un paciente
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {Object} filtros - Filtros opcionales (fechaInicio, fechaFin)
   * @returns {Promise<Array>} - Lista de sesiones
   */
  async obtenerSesionesPorPaciente(profesionalId, pacienteId, filtros = {}) {
    try {
      let sesionesRef = this.db.collection(this.colecciones.sesiones)
        .where('profesionalId', '==', profesionalId)
        .where('pacienteId', '==', pacienteId);
      
      // Aplicar filtros de fecha si existen
      if (filtros.fechaInicio) {
        sesionesRef = sesionesRef.where('fecha', '>=', new Date(filtros.fechaInicio));
      }
      
      if (filtros.fechaFin) {
        sesionesRef = sesionesRef.where('fecha', '<=', new Date(filtros.fechaFin));
      }
      
      const snapshot = await sesionesRef.orderBy('fecha', 'desc').get();
      
      if (snapshot.empty) {
        return [];
      }
      
      return snapshot.docs.map(doc => {
        const sesion = doc.data();
        sesion.id = doc.id;
        
        // Descifrar observaciones
        if (sesion.observacionesCifradas) {
          try {
            const datosDescifrados = this.descifrarDatos(
              sesion.observacionesCifradas, 
              profesionalId
            );
            sesion.observaciones = datosDescifrados.observaciones;
          } catch (error) {
            console.error('Error al descifrar observaciones:', error);
            sesion.observaciones = 'Error al descifrar observaciones';
          }
        }
        
        delete sesion.observacionesCifradas;
        return sesion;
      });
    } catch (error) {
      console.error('Error al obtener sesiones:', error);
      throw error;
    }
  }

  /**
   * Registra un mensaje de WhatsApp
   * @param {String} profesionalId - ID del profesional (opcional)
   * @param {String} pacienteId - ID del paciente (opcional)
   * @param {Object} datos - Datos del mensaje
   * @returns {Promise<String>} - ID del mensaje
   */
  async registrarMensajeWhatsApp(profesionalId, pacienteId, datos) {
    try {
      const nuevoDoc = this.db.collection(this.colecciones.mensajes).doc();
      await nuevoDoc.set({
        profesionalId: profesionalId || null,
        pacienteId: pacienteId || null,
        telefono: datos.telefono,
        mensaje: datos.mensaje,
        tipo: datos.tipo || 'texto', // texto, audio, imagen
        direccion: datos.direccion || 'entrada', // entrada, salida
        timestamp: new Date(),
        estado: datos.estado || 'recibido', // recibido, procesado, respondido, error
        sesionId: datos.sesionId || null // Si está asociado a una sesión
      });
      
      return nuevoDoc.id;
    } catch (error) {
      console.error('Error al registrar mensaje de WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Registra un evento de auditoría
   * @param {String} tipo - Tipo de evento
   * @param {String} usuarioId - ID del usuario (profesional)
   * @param {Object} detalles - Detalles del evento
   * @returns {Promise<void>}
   */
  async registrarAuditoria(tipo, usuarioId, detalles = {}) {
    try {
      await this.db.collection(this.colecciones.registroAuditoria).add({
        tipo,
        usuarioId,
        detalles,
        ip: detalles.ip || '',
        userAgent: detalles.userAgent || '',
        timestamp: new Date(),
        origen: detalles.origen || 'web' // 'web' o 'whatsapp'
      });
    } catch (error) {
      console.error('Error al registrar auditoría:', error);
      // No lanzamos error para no interrumpir el flujo principal
    }
  }
}

module.exports = new ServicioBaseDatos();
