const config = require('../config/environment');
const logger = require('../utils/logger');

class CrisisDetectionService {
    constructor() {
        this.crisisKeywords = [
            'quiero matarme', 'me quiero matar', 'voy a suicidarme', 'me voy a suicidar',
            'no quiero vivir', 'prefiero estar muerto', 'no aguanto más', 'todo está perdido',
            'me quiero lastimar', 'voy a lastimarme', 'no vale la pena vivir', 'quiero desaparecer',
            // Variantes argentinas
            'me quiero hacer daño', 'quiero terminar con todo', 'no doy más',
            'estoy re mal', 'no la paso más', 'me quiero ir de acá', 'ya no banco más'
        ];

        this.urgentKeywords = [
            'crisis', 'pánico', 'emergency', 'emergencia', 'ayuda urgente', 'no puedo más'
        ];

        this.protectiveFactors = [
            'pero tengo apoyo', 'mi familia', 'en terapia', 'tomando medicación', 'no lo haría'
        ];

        this.confidenceThreshold = config.CRISIS.CONFIDENCE_THRESHOLD;
    }

    async detectCrisis(message, professionalId, fallbackMode = false) {
        try {
            // Fallback mode: be very conservative
            if (fallbackMode) {
                const hasAnyRisk = this.crisisKeywords.some(keyword => 
                    message.toLowerCase().includes(keyword)
                );
                
                if (hasAnyRisk) {
                    const detection = {
                        isCrisis: true,
                        severity: 'high',
                        confidence: 0.9,
                        response: this.getFallbackResponse(),
                        fallbackMode: true,
                        detectedKeywords: ['fallback_mode_detection']
                    };
                    
                    this.logCrisisEvent(message, detection, professionalId);
                    return detection;
                }
            }

            const lowerMessage = message.toLowerCase();
            let maxSeverity = 'none';
            let confidence = 0;
            let detectedKeywords = [];

            // Check crisis keywords
            for (const keyword of this.crisisKeywords) {
                if (lowerMessage.includes(keyword)) {
                    maxSeverity = 'high';
                    confidence = Math.max(confidence, 0.95);
                    detectedKeywords.push(keyword);
                }
            }

            // Check urgent keywords
            for (const keyword of this.urgentKeywords) {
                if (lowerMessage.includes(keyword)) {
                    if (maxSeverity === 'none') maxSeverity = 'medium';
                    confidence = Math.max(confidence, 0.75);
                    detectedKeywords.push(keyword);
                }
            }

            // Adjust for protective factors
            let protectiveCount = 0;
            for (const factor of this.protectiveFactors) {
                if (lowerMessage.includes(factor)) {
                    protectiveCount++;
                }
            }

            if (protectiveCount > 0) {
                confidence *= (1 - protectiveCount * 0.2);
            }

            const isCrisis = confidence >= this.confidenceThreshold;
            
            const detection = {
                isCrisis,
                severity: isCrisis ? maxSeverity : 'none',
                confidence,
                detectedKeywords,
                protectiveFactors: protectiveCount,
                response: isCrisis ? this.getCrisisResponse(maxSeverity) : null,
                fallbackMode: false
            };

            if (isCrisis) {
                this.logCrisisEvent(message, detection, professionalId);
            }

            return detection;

        } catch (error) {
            logger.error('Crisis detection error:', error);
            
            // Always err on the side of caution
            const errorDetection = {
                isCrisis: true,
                severity: 'high',
                confidence: 0.8,
                response: this.getErrorResponse(),
                error: true,
                detectedKeywords: ['system_error']
            };
            
            this.logCrisisEvent(message, errorDetection, professionalId);
            return errorDetection;
        }
    }

    getCrisisResponse(severity) {
        const responses = {
            high: `🚨 CRISIS DETECTADA - ACCIÓN INMEDIATA REQUERIDA

⚠️ PROTOCOLO DE EMERGENCIA ACTIVADO

🆘 RECURSOS INMEDIATOS:
• Línea de vida: ${config.CRISIS.EMERGENCY_PHONE} (24hs gratis)
• Emergencias: 911
• Hospital más cercano

📋 ACCIONES REQUERIDAS:
1. Evaluar riesgo inmediato
2. Contactar supervisor/colega
3. Considerar internación si es necesario
4. Documentar en historia clínica

⚡ Este mensaje requiere atención INMEDIATA`,

            medium: `⚠️ SITUACIÓN DE RIESGO DETECTADA

🔍 EVALUACIÓN REQUERIDA:
• Valorar nivel de riesgo actual
• Aplicar protocolo de contención
• Reforzar red de apoyo

📞 RECURSOS DISPONIBLES:
• Línea de vida: ${config.CRISIS.EMERGENCY_PHONE}
• Emergencias: 911

📝 Documentar evaluación en historia clínica`,

            low: `⚡ ALERTA PREVENTIVA

🔍 Se detectaron indicadores de malestar emocional
📋 Recomendaciones:
• Explorar estado emocional actual
• Reforzar estrategias de afrontamiento
• Evaluar necesidad de ajuste terapéutico`
        };

        return responses[severity] || responses.medium;
    }

    getFallbackResponse() {
        return `🚨 MODO SEGURO: Posible crisis detectada. Evaluar riesgo manualmente.

ACCIÓN INMEDIATA:
• Línea de vida: ${config.CRISIS.EMERGENCY_PHONE} (24hs gratis)
• Contactar supervisor inmediatamente
• Sistema en modo fallback - evaluación manual requerida`;
    }

    getErrorResponse() {
        return `🚨 ERROR EN DETECCIÓN: Evaluar riesgo manualmente por seguridad.

ACCIÓN INMEDIATA:
• Línea de vida: ${config.CRISIS.EMERGENCY_PHONE} (24hs gratis)
• Contactar supervisor
• Sistema de detección temporalmente inoperativo`;
    }

    logCrisisEvent(message, detection, professionalId) {
        const eventData = {
            message_hash: require('crypto').createHash('sha256')
                .update(message + config.SECURITY.LOG_SALT)
                .digest('hex').substring(0, 16),
            severity: detection.severity,
            confidence: detection.confidence,
            detected_keywords: detection.detectedKeywords,
            protective_factors: detection.protectiveFactors || 0,
            fallback_mode: detection.fallbackMode || false,
            error_mode: detection.error || false,
            timestamp: new Date().toISOString(),
            requires_immediate_review: detection.severity === 'high'
        };

        logger.medical.crisisDetection(professionalId, detection.severity, detection.confidence, eventData);

        // Additional alert for high severity
        if (detection.severity === 'high') {
            console.log('\n🚨🚨🚨 CRISIS ALERT 🚨🚨🚨');
            console.log(`Professional: ${professionalId}`);
            console.log(`Severity: ${detection.severity}`);
            console.log(`Confidence: ${detection.confidence}`);
            console.log(`Time: ${new Date().toLocaleString()}`);
            console.log('🚨🚨🚨 IMMEDIATE ATTENTION REQUIRED 🚨🚨🚨\n');
        }
    }

    // Get crisis statistics for monitoring
    getCrisisStats() {
        // This would typically query the database for crisis events
        return {
            total_detections: 0,
            high_severity: 0,
            medium_severity: 0,
            low_severity: 0,
            false_positives: 0,
            last_detection: null
        };
    }

    // Update crisis keywords (for admin use)
    updateKeywords(newKeywords, type = 'crisis') {
        if (type === 'crisis') {
            this.crisisKeywords = [...this.crisisKeywords, ...newKeywords];
        } else if (type === 'urgent') {
            this.urgentKeywords = [...this.urgentKeywords, ...newKeywords];
        } else if (type === 'protective') {
            this.protectiveFactors = [...this.protectiveFactors, ...newKeywords];
        }
        
        logger.info(`Updated ${type} keywords`, { count: newKeywords.length });
    }
}

module.exports = new CrisisDetectionService(); 