/**
 * Monitor de memoria para AIRA Bot
 * Verifica el uso de memoria cada 5 minutos y alerta cuando supera 500MB
 */
const { createLogger, transports, format } = require('winston');

// Logger específico para monitoreo de recursos
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new transports.File({ 
      filename: 'logs/recursos.log',
      maxsize: 5 * 1024 * 1024 // 5MB
    }),
    new transports.Console()
  ]
});

/**
 * Inicia el monitoreo de memoria
 */
function iniciarMonitoreoMemoria() {
  logger.info('🔍 Iniciando monitoreo de memoria');
  
  // Intervalo de chequeo: 5 minutos
  const intervaloChequeo = 5 * 60 * 1000;
  
  setInterval(() => {
    // Obtener uso actual de memoria en MB
    const usadaMB = process.memoryUsage().heapUsed / 1024 / 1024;
    const totalMB = process.memoryUsage().heapTotal / 1024 / 1024;
    const porcentaje = Math.round((usadaMB / totalMB) * 100);
    
    // Registrar uso normal
    logger.info(`Memoria: ${usadaMB.toFixed(2)}MB / ${totalMB.toFixed(2)}MB (${porcentaje}%)`);
    
    // Alertar si es alto (>500MB)
    if (usadaMB > 500) {
      logger.warn(`⚠️ ALERTA: Memoria alta ${usadaMB.toFixed(2)}MB (${porcentaje}%)`);
    }
  }, intervaloChequeo);
}

module.exports = {
  iniciarMonitoreoMemoria
};
