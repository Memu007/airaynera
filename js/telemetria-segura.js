/**
 * SISTEMA DE TELEMETRÍA SEGURO - AIRA
 * Solo métricas anónimas, sin datos personales
 * Protegido contra ataques y manipulación
 */

(function() {
    'use strict';
    
    // Encapsulación para evitar acceso global
    const TelemetriaSegura = (function() {
        
        // Clave para hash (cambiar en producción)
        const SALT = 'aira-metrics-2024-secure';
        
        // Límites anti-abuso
        const LIMITES = {
            maxEventosPorMinuto: 100,
            maxTamañoEvento: 1024, // bytes
            tiempoRetencion: 7 * 24 * 60 * 60 * 1000 // 7 días
        };
        
        // Contadores de rate limiting
        let eventosUltimoMinuto = 0;
        let ultimoReset = Date.now();
        
        // Storage seguro
        const storage = {
            metricas: [],
            sesionId: generarIdSesion()
        };
        
        /**
         * Generar ID de sesión anónimo
         */
        function generarIdSesion() {
            // ID único sin datos identificables
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 9);
            return `${timestamp}-${random}`;
        }
        
        /**
         * Sanitizar datos para evitar inyección
         */
        function sanitizar(dato) {
            if (typeof dato !== 'string') return dato;
            // Eliminar caracteres peligrosos
            return dato
                .replace(/[<>'"]/g, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '')
                .slice(0, 100); // Límite de longitud
        }
        
        /**
         * Validar estructura del evento
         */
        function validarEvento(evento) {
            // Solo permitir campos específicos
            const camposPermitidos = [
                'tipo', 'categoria', 'duracion', 'exito', 
                'error_tipo', 'timestamp', 'version'
            ];
            
            const eventoLimpio = {};
            camposPermitidos.forEach(campo => {
                if (evento[campo] !== undefined) {
                    eventoLimpio[campo] = sanitizar(evento[campo]);
                }
            });
            
            return eventoLimpio;
        }
        
        /**
         * Rate limiting para prevenir DoS
         */
        function verificarRateLimit() {
            const ahora = Date.now();
            
            // Reset contador cada minuto
            if (ahora - ultimoReset > 60000) {
                eventosUltimoMinuto = 0;
                ultimoReset = ahora;
            }
            
            eventosUltimoMinuto++;
            
            if (eventosUltimoMinuto > LIMITES.maxEventosPorMinuto) {
                console.warn('⚠️ Rate limit excedido');
                return false;
            }
            
            return true;
        }
        
        /**
         * Registrar métrica de forma segura
         */
        function registrarMetrica(tipo, datos = {}) {
            try {
                // Verificar rate limit
                if (!verificarRateLimit()) {
                    return false;
                }
                
                // Validar y sanitizar
                const evento = validarEvento({
                    tipo: tipo,
                    timestamp: Date.now(),
                    sesion: storage.sesionId,
                    version: '1.0.0',
                    ...datos
                });
                
                // Verificar tamaño
                const tamaño = JSON.stringify(evento).length;
                if (tamaño > LIMITES.maxTamañoEvento) {
                    console.warn('⚠️ Evento muy grande, rechazado');
                    return false;
                }
                
                // Almacenar localmente
                storage.metricas.push(evento);
                
                // Limpiar métricas antiguas
                limpiarMetricasAntiguas();
                
                // Guardar en localStorage (encriptado)
                guardarMetricasSeguro();
                
                return true;
                
            } catch (error) {
                // Silenciar errores para no exponer info
                return false;
            }
        }
        
        /**
         * Limpiar métricas antiguas
         */
        function limpiarMetricasAntiguas() {
            const ahora = Date.now();
            storage.metricas = storage.metricas.filter(m => 
                ahora - m.timestamp < LIMITES.tiempoRetencion
            );
        }
        
        /**
         * Guardar métricas de forma segura
         */
        function guardarMetricasSeguro() {
            try {
                // Limitar cantidad de métricas guardadas
                const metricasRecientes = storage.metricas.slice(-1000);
                
                // "Encriptar" básico (ofuscar)
                const datos = btoa(JSON.stringify(metricasRecientes));
                
                localStorage.setItem('aira_metrics_v1', datos);
            } catch (e) {
                // Si localStorage está lleno, limpiar
                localStorage.removeItem('aira_metrics_v1');
            }
        }
        
        /**
         * Obtener resumen de métricas (sin datos sensibles)
         */
        function obtenerResumen() {
            const ahora = Date.now();
            const ultima24h = storage.metricas.filter(m => 
                ahora - m.timestamp < 24 * 60 * 60 * 1000
            );
            
            return {
                total_eventos: ultima24h.length,
                tipos: [...new Set(ultima24h.map(m => m.tipo))],
                errores: ultima24h.filter(m => m.error_tipo).length,
                sesion_duracion: ahora - parseInt(storage.sesionId.split('-')[0]),
                version: '1.0.0'
            };
        }
        
        // MÉTRICAS ESPECÍFICAS DE AIRA
        
        /**
         * Métrica: Grabación de voz
         */
        function metricaGrabacion(duracion, exito) {
            registrarMetrica('grabacion_voz', {
                categoria: 'interaccion',
                duracion: Math.min(duracion, 300000), // Max 5 min
                exito: Boolean(exito)
            });
        }
        
        /**
         * Métrica: Detección de paciente
         */
        function metricaDeteccionPaciente(encontrado) {
            registrarMetrica('deteccion_paciente', {
                categoria: 'funcionalidad',
                exito: Boolean(encontrado)
            });
        }
        
        /**
         * Métrica: Medicación detectada
         */
        function metricaMedicacion(cantidad) {
            registrarMetrica('medicacion_detectada', {
                categoria: 'funcionalidad',
                cantidad: Math.min(cantidad, 50) // Sin exponer detalles
            });
        }
        
        /**
         * Métrica: Error genérico
         */
        function metricaError(tipo) {
            // Solo el tipo, sin stack trace ni detalles
            const tiposPermitidos = [
                'api', 'validacion', 'red', 'timeout', 'otro'
            ];
            
            const tipoSeguro = tiposPermitidos.includes(tipo) ? tipo : 'otro';
            
            registrarMetrica('error', {
                categoria: 'sistema',
                error_tipo: tipoSeguro
            });
        }
        
        /**
         * Métrica: Performance
         */
        function metricaPerformance(operacion, tiempoMs) {
            if (tiempoMs < 0 || tiempoMs > 60000) return;
            
            registrarMetrica('performance', {
                categoria: 'rendimiento',
                operacion: sanitizar(operacion),
                duracion: Math.round(tiempoMs)
            });
        }
        
        // API pública (limitada)
        return {
            // Métodos seguros expuestos
            grabacion: metricaGrabacion,
            deteccionPaciente: metricaDeteccionPaciente,
            medicacion: metricaMedicacion,
            error: metricaError,
            performance: metricaPerformance,
            resumen: obtenerResumen,
            
            // Versión
            version: '1.0.0'
        };
    })();
    
    // Adjuntar a window de forma controlada
    if (typeof window !== 'undefined') {
        // Congelar objeto para evitar modificación
        Object.freeze(TelemetriaSegura);
        
        // Definir como propiedad no modificable
        Object.defineProperty(window, 'AiraTelemetria', {
            value: TelemetriaSegura,
            writable: false,
            configurable: false
        });
    }
    
    // Auto-reporte cada 5 minutos (opcional)
    setInterval(function() {
        const resumen = TelemetriaSegura.resumen();
        if (resumen.total_eventos > 0) {
            console.log('📊 Telemetría:', resumen);
        }
    }, 5 * 60 * 1000);
    
})();

// Ejemplos de uso seguro:
// AiraTelemetria.grabacion(3500, true);  // Grabación de 3.5 seg exitosa
// AiraTelemetria.deteccionPaciente(true); // Paciente detectado
// AiraTelemetria.medicacion(2); // 2 medicamentos detectados
// AiraTelemetria.error('red'); // Error de red
// AiraTelemetria.performance('carga_inicial', 250); // 250ms de carga
