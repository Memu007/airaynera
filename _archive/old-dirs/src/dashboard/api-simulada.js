/**
 * API simulada para el dashboard técnico AIRA
 * Genera datos simulados para probar la integración con el dashboard
 */

// Importar Express
const express = require('express');
const router = express.Router();

// Función para generar datos aleatorios
function generarNumeroAleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Función para generar timestamps para los últimos N minutos
function generarTimestamps(minutos = 30, intervalo = 5) {
  const timestamps = [];
  const ahora = new Date();
  
  for (let i = minutos; i >= 0; i -= intervalo) {
    const tiempo = new Date(ahora.getTime() - i * 60000);
    timestamps.push(tiempo.toISOString());
  }
  
  return timestamps;
}

// Función para generar datos de CPU
function generarDatosCPU() {
  const labels = generarTimestamps();
  const valores = labels.map(() => generarNumeroAleatorio(10, 90));
  
  return {
    labels,
    valores
  };
}

// Función para generar datos de memoria
function generarDatosMemoria() {
  const labels = generarTimestamps();
  const valores = labels.map(() => generarNumeroAleatorio(20, 85));
  
  return {
    labels,
    valores
  };
}

// Función para generar datos de red
function generarDatosRed() {
  const labels = generarTimestamps();
  const entrada = labels.map(() => generarNumeroAleatorio(5, 50));
  const salida = labels.map(() => generarNumeroAleatorio(2, 30));
  
  return {
    labels,
    entrada,
    salida
  };
}

// Función para generar estadísticas generales
function generarEstadisticas() {
  return {
    serviciosActivos: generarNumeroAleatorio(3, 6),
    alertasActivas: generarNumeroAleatorio(0, 5),
    tareasPendientes: generarNumeroAleatorio(1, 10),
    usuariosConectados: generarNumeroAleatorio(1, 8)
  };
}

// Función para generar servicios
function generarServicios() {
  const servicios = [
    {
      id: 'api',
      nombre: 'API REST',
      icono: 'server',
      estado: ['Activo', 'Activo', 'Advertencia', 'Activo'][generarNumeroAleatorio(0, 3)],
      uptime: '14d 6h 32m',
      ultimaActualizacion: 'Hace 5 minutos'
    },
    {
      id: 'db',
      nombre: 'Base de Datos',
      icono: 'database',
      estado: ['Activo', 'Activo', 'Activo', 'Error'][generarNumeroAleatorio(0, 3)],
      uptime: '14d 6h 30m',
      ultimaActualizacion: 'Hace 5 minutos'
    },
    {
      id: 'auth',
      nombre: 'Autenticación',
      icono: 'lock',
      estado: ['Activo', 'Activo', 'Advertencia', 'Activo'][generarNumeroAleatorio(0, 3)],
      uptime: '14d 6h 32m',
      ultimaActualizacion: 'Hace 5 minutos'
    },
    {
      id: 'storage',
      nombre: 'Almacenamiento',
      icono: 'hdd',
      estado: ['Activo', 'Advertencia', 'Advertencia', 'Activo'][generarNumeroAleatorio(0, 3)],
      uptime: '14d 6h 32m',
      ultimaActualizacion: 'Hace 5 minutos'
    },
    {
      id: 'msg',
      nombre: 'Mensajería',
      icono: 'exchange-alt',
      estado: ['Activo', 'Activo', 'Activo', 'Activo'][generarNumeroAleatorio(0, 3)],
      uptime: '14d 6h 32m',
      ultimaActualizacion: 'Hace 5 minutos'
    }
  ];
  
  return servicios;
}

// Función para generar logs
function generarLogs(filtros = {}, pagina = 1) {
  const nivelesDisponibles = ['INFO', 'WARNING', 'ERROR', 'DEBUG'];
  const serviciosDisponibles = ['API REST', 'Base de Datos', 'Autenticación', 'Almacenamiento', 'Mensajería'];
  
  // Aplicar filtros
  let niveles = [...nivelesDisponibles];
  if (filtros.nivel && filtros.nivel !== 'todos') {
    niveles = [filtros.nivel.toUpperCase()];
  }
  
  let servicios = [...serviciosDisponibles];
  if (filtros.servicio && filtros.servicio !== 'todos') {
    servicios = [filtros.servicio];
  }
  
  // Generar logs aleatorios
  const totalLogs = 50;
  const logsPorPagina = 10;
  const totalPaginas = Math.ceil(totalLogs / logsPorPagina);
  
  const logs = [];
  const ahora = new Date();
  
  for (let i = 0; i < logsPorPagina; i++) {
    const nivel = niveles[generarNumeroAleatorio(0, niveles.length - 1)];
    const servicio = servicios[generarNumeroAleatorio(0, servicios.length - 1)];
    
    // Generar mensaje según nivel
    let mensaje = '';
    switch (nivel) {
      case 'ERROR':
        mensaje = [
          'Error de conexión a la base de datos',
          'Error al procesar la solicitud',
          'Timeout en la operación',
          'Error de autenticación'
        ][generarNumeroAleatorio(0, 3)];
        break;
      case 'WARNING':
        mensaje = [
          'Uso de CPU elevado',
          'Espacio en disco bajo',
          'Conexión inestable',
          'Reintentos múltiples'
        ][generarNumeroAleatorio(0, 3)];
        break;
      case 'INFO':
        mensaje = [
          'Operación completada correctamente',
          'Usuario autenticado',
          'Servicio iniciado',
          'Tarea programada ejecutada'
        ][generarNumeroAleatorio(0, 3)];
        break;
      case 'DEBUG':
        mensaje = [
          'Detalles de la operación: id=123',
          'Parámetros recibidos: {a: 1, b: 2}',
          'Tiempo de ejecución: 235ms',
          'Cache actualizado'
        ][generarNumeroAleatorio(0, 3)];
        break;
    }
    
    // Generar fecha aleatoria en las últimas 24 horas
    const minutos = generarNumeroAleatorio(1, 1440); // Hasta 24 horas
    const fecha = new Date(ahora.getTime() - minutos * 60000);
    
    logs.push({
      id: `log-${pagina}-${i}`,
      fecha: fecha.toLocaleString(),
      nivel,
      servicio,
      mensaje
    });
  }
  
  return {
    items: logs,
    pagina: parseInt(pagina),
    totalPaginas,
    totalItems: totalLogs
  };
}

// Función para generar información del sistema
function generarInfoSistema() {
  return {
    servidor: {
      nombre: 'AIRA-SERVER-01',
      so: 'Ubuntu Server 22.04 LTS',
      version: '5.15.0-58-generic',
      uptime: '14 días, 6 horas, 32 minutos',
      cpu: 'Intel Xeon E5-2680 v4 @ 2.40GHz (8 cores)',
      memoria: '32GB DDR4',
      almacenamiento: '2TB SSD (65% libre)'
    },
    versiones: [
      {
        componente: 'AIRA Core',
        actual: '2.5.3',
        ultima: '2.5.3',
        estado: 'Actualizado'
      },
      {
        componente: 'API REST',
        actual: '1.8.2',
        ultima: '1.9.0',
        estado: 'Actualización disponible'
      },
      {
        componente: 'Base de Datos',
        actual: '3.2.1',
        ultima: '3.2.1',
        estado: 'Actualizado'
      },
      {
        componente: 'Módulo de Seguridad',
        actual: '2.0.0',
        ultima: '2.1.5',
        estado: 'Desactualizado'
      },
      {
        componente: 'Dashboard',
        actual: '1.4.2',
        ultima: '1.4.2',
        estado: 'Actualizado'
      }
    ]
  };
}

// Rutas de la API

// Datos de monitoreo
router.get('/monitoreo', (req, res) => {
  res.json({
    cpu: generarDatosCPU(),
    memoria: generarDatosMemoria(),
    red: generarDatosRed(),
    estadisticas: generarEstadisticas()
  });
});

// Servicios
router.get('/servicios', (req, res) => {
  res.json(generarServicios());
});

// Reiniciar servicio
router.post('/servicios/:id/reiniciar', (req, res) => {
  const { id } = req.params;
  res.json({
    success: true,
    mensaje: `Servicio ${id} reiniciado correctamente`,
    timestamp: new Date().toISOString()
  });
});

// Logs
router.get('/logs', (req, res) => {
  const filtros = {
    nivel: req.query.nivel || 'todos',
    servicio: req.query.servicio || 'todos',
    fecha: req.query.fecha || ''
  };
  const pagina = parseInt(req.query.pagina) || 1;
  
  res.json(generarLogs(filtros, pagina));
});

// Configuración
router.post('/configuracion', (req, res) => {
  res.json({
    success: true,
    mensaje: 'Configuración guardada correctamente',
    timestamp: new Date().toISOString()
  });
});

// Información del sistema
router.get('/sistema/info', (req, res) => {
  res.json(generarInfoSistema());
});

// Verificar actualizaciones
router.get('/sistema/actualizaciones', (req, res) => {
  res.json({
    actualizacionesDisponibles: 2,
    componentes: [
      {
        nombre: 'API REST',
        versionActual: '1.8.2',
        versionDisponible: '1.9.0',
        prioridad: 'Media',
        cambios: 'Mejoras de rendimiento y corrección de errores'
      },
      {
        nombre: 'Módulo de Seguridad',
        versionActual: '2.0.0',
        versionDisponible: '2.1.5',
        prioridad: 'Alta',
        cambios: 'Parches de seguridad importantes'
      }
    ]
  });
});

// Backup
router.post('/sistema/backup', (req, res) => {
  // Simular un pequeño retraso
  setTimeout(() => {
    res.json({
      success: true,
      mensaje: 'Backup completado correctamente',
      timestamp: new Date().toISOString(),
      archivo: `backup-${new Date().toISOString().split('T')[0]}.zip`,
      tamaño: '256MB'
    });
  }, 1500);
});

module.exports = router;
