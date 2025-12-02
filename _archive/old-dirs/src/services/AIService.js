const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/environment');
const logger = require('../utils/logger');
const axios = require('axios');

class AIService {
    constructor() {
        this.genAI = null;
        this.backupGenAI = null;
        this.initializeAI();
    }

    redactSensitive(text) {
        if (typeof text !== 'string') return '';
        // Remove emails, phone numbers, obvious IDs
        return text
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
            .replace(/\b\+?\d[\d\s().-]{6,}\b/g, '[tel]')
            .replace(/\b\d{7,}\b/g, '[id]');
    }

    validateSummary(raw) {
        const text = String(raw || '').trim();
        if (!text) return null;
        // Content policy: reject URLs, prompt-injection phrases or meta-AI disclaimers
        if (this.violatesContentPolicy(text)) return null;
        // Must contain required headings
        const required = [
            '**Estado Emocional:**',
            '**Observaciones Clínicas:**',
            '**Intervenciones:**',
            '**Recomendaciones:**'
        ];
        const hasAll = required.every(h => text.includes(h));
        if (!hasAll) return null;
        // Enforce max ~200 words
        const words = text.split(/\s+/).filter(Boolean);
        const limited = words.slice(0, 220).join(' ');
        return this.redactSensitive(limited);
    }

    violatesContentPolicy(raw) {
        const t = String(raw || '').toLowerCase();
        // Block URLs and obvious outbound contact/solicitation
        if (/(https?:\/\/|www\.)/i.test(t)) return true;
        if (/(sígueme|follow me|contáctame|contact me)/i.test(t)) return true;
        // Block prompt-injection/meta model content
        if (/(ignore (all )?previous instructions|olvida instrucciones previas)/i.test(t)) return true;
        if (/(como modelo de lenguaje|as an ai language model)/i.test(t)) return true;
        // Block code/injection markers that shouldn't appear in summaries
        if (/```/.test(t)) return true;
        return false;
    }

    initializeAI() {
        if (config.AI.PROVIDER === 'deepseek') {
            // OpenAI-compatible client via axios
            this.openAICompat = axios.create({
                baseURL: config.AI.OPENAI_COMPAT_BASE_URL,
                headers: { Authorization: `Bearer ${config.AI.OPENAI_COMPAT_API_KEY}` }
            });
        }

        if (config.GEMINI.API_KEY) {
            this.genAI = new GoogleGenerativeAI(config.GEMINI.API_KEY);
        }
        if (config.GEMINI.BACKUP_KEY) {
            this.backupGenAI = new GoogleGenerativeAI(config.GEMINI.BACKUP_KEY);
        }
    }

    async generateSummary(observaciones, fallbackMode = false) {
        if (config.AI.PROVIDER === 'deepseek') {
            try {
                const resp = await this.openAICompat.post('/chat/completions', {
                    model: config.AI.MODEL,
                    messages: [
                        { role: 'system', content: 'Eres un psicólogo clínico. Mantén confidencialidad, evita nombres reales.' },
                        { role: 'user', content: `Genera un resumen clínico profesional (máx 200 palabras) de la siguiente sesión:\n${observaciones}\nFormato:\n**Estado Emocional:** ...\n**Observaciones Clínicas:** ...\n**Intervenciones:** ...\n**Recomendaciones:** ...` }
                    ],
                    temperature: 0.4
                });
                const text = resp.data?.choices?.[0]?.message?.content || '';
                const validated = this.validateSummary(text);
                if (validated) return validated;
                logger.warn('DeepSeek summary rejected by validator');
            } catch (e) {
                logger.warn('DeepSeek primary failed:', e.message);
            }
            // Fallback a Gemini si DeepSeek falla
        }

        if (fallbackMode || !this.genAI) {
            return this.getFallbackSummary();
        }

        const prompt = `Como psicólogo clínico especializado, genera un resumen profesional de esta sesión terapéutica:

OBSERVACIONES DE LA SESIÓN:
${observaciones}

INSTRUCCIONES:
- Resumen conciso y profesional (máximo 200 palabras)
- Enfócate en aspectos clínicamente relevantes
- Identifica patrones emocionales y conductuales
- Menciona técnicas terapéuticas aplicadas si las hay
- Sugiere seguimiento si es necesario
- Usa terminología clínica apropiada
- Mantén confidencialidad (no uses nombres reales)

FORMATO DE RESPUESTA:
**Estado Emocional:** [descripción breve]
**Observaciones Clínicas:** [puntos clave]
**Intervenciones:** [técnicas aplicadas]
**Recomendaciones:** [seguimiento sugerido]`;

        try {
            const model = this.genAI.getGenerativeModel({ model: config.GEMINI.MODEL });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const summary = this.validateSummary(response.text());
            if (!summary) return this.getFallbackSummary();

            logger.info('AI summary generated successfully');
            return summary;

        } catch (error) {
            logger.warn('Primary AI failed, trying backup:', error.message);
            
            // Try backup API key
            if (this.backupGenAI) {
                try {
                    const backupModel = this.backupGenAI.getGenerativeModel({ model: config.GEMINI.MODEL });
                    const result = await backupModel.generateContent(prompt);
                    const response = await result.response;
                    const summary = response.text();
                    
                    logger.info('AI summary generated with backup key');
                    return summary;
                } catch (backupError) {
                    logger.error('Backup AI also failed:', backupError.message);
                }
            }
            
            // Return fallback summary
            return this.getFallbackSummary();
        }
    }

    async analyzeMood(observaciones, fallbackMode = false) {
        if (config.AI.PROVIDER === 'deepseek') {
            try {
                const resp = await this.openAICompat.post('/chat/completions', {
                    model: config.AI.MODEL,
                    messages: [
                        { role: 'system', content: 'Eres un psicólogo clínico. Devuelve solo un número 1..5.' },
                        { role: 'user', content: `Analiza el estado emocional de 1 a 5 (ver escala) para:\n${observaciones}\nResponde solo con 1..5.` }
                    ],
                    temperature: 0.2
                });
                const text = (resp.data?.choices?.[0]?.message?.content || '').trim();
                const moodScore = parseInt(text.match(/[1-5]/)?.[0]);
                if (moodScore >= 1 && moodScore <= 5) return moodScore;
            } catch (e) {
                logger.warn('DeepSeek mood failed:', e.message);
            }
            // Fallback a Gemini
        }

        if (fallbackMode || !this.genAI) {
            return this.getFallbackMood();
        }

        const promptMood = `Como psicólogo clínico, analiza el estado emocional del paciente basándote en estas observaciones:

OBSERVACIONES:
${observaciones}

Evalúa el estado emocional en una escala del 1 al 5:
1 = Muy bajo (depresión severa, ideación suicida, crisis)
2 = Bajo (depresión moderada, ansiedad alta, malestar significativo)
3 = Neutro (estado emocional estable, algunos altibajos normales)
4 = Bueno (estado positivo, manejo adecuado del estrés)
5 = Muy bueno (excelente estado emocional, alta funcionalidad)

RESPONDE SOLO CON UN NÚMERO DEL 1 AL 5, SIN EXPLICACIONES ADICIONALES.`;

        try {
            const model = this.genAI.getGenerativeModel({ model: config.GEMINI.MODEL });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const moodText = response.text().trim();
            
            // Extract number from response
            const moodScore = parseInt(moodText.match(/[1-5]/)?.[0]);
            
            if (moodScore >= 1 && moodScore <= 5) {
                logger.info(`AI mood analysis: ${moodScore}`);
                return moodScore;
            } else {
                logger.warn('Invalid mood score from AI, using fallback');
                return this.getFallbackMood();
            }

        } catch (error) {
            logger.warn('Mood analysis failed, trying backup:', error.message);
            
            // Try backup API key
            if (this.backupGenAI) {
                try {
                    const backupModel = this.backupGenAI.getGenerativeModel({ model: config.GEMINI.MODEL });
                    const result = await backupModel.generateContent(promptMood);
                    const response = await result.response;
                    const moodText = response.text().trim();
                    const moodScore = parseInt(moodText.match(/[1-5]/)?.[0]);
                    
                    if (moodScore >= 1 && moodScore <= 5) {
                        logger.info(`AI mood analysis with backup: ${moodScore}`);
                        return moodScore;
                    }
                } catch (backupError) {
                    logger.error('Backup mood analysis failed:', backupError.message);
                }
            }
            
            return this.getFallbackMood();
        }
    }

    getFallbackSummary() {
        return `**Resumen Automático No Disponible**

El sistema de resúmenes con IA está temporalmente inoperativo. 

**Acción Requerida:**
- Revisar observaciones manualmente
- Generar resumen clínico manual
- Documentar hallazgos relevantes

**Nota:** Las observaciones originales se mantienen íntegras y encriptadas para su revisión posterior.`;
    }

    getFallbackMood() {
        // Return neutral mood score when AI is unavailable
        return 3;
    }

    async processSessionWithAI(observaciones) {
        try {
            // Process summary and mood analysis in parallel
            const [summary, moodScore] = await Promise.all([
                this.generateSummary(observaciones),
                this.analyzeMood(observaciones)
            ]);

            return {
                success: true,
                summary,
                moodScore,
                aiProcessed: true
            };

        } catch (error) {
            logger.error('AI session processing failed:', error);
            
            return {
                success: false,
                summary: this.getFallbackSummary(),
                moodScore: this.getFallbackMood(),
                aiProcessed: false,
                error: error.message
            };
        }
    }

    // Generate therapeutic recommendations
    async generateRecommendations(observaciones, patientHistory = []) {
        if (!this.genAI) {
            return this.getFallbackRecommendations();
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: config.GEMINI.MODEL });
            
            const historyContext = patientHistory.length > 0 ? 
                `\nHISTORIAL RECIENTE:\n${patientHistory.slice(-3).map(s => s.resumen).join('\n')}` : '';
            
            const prompt = `Como psicólogo clínico, genera recomendaciones terapéuticas basadas en:

SESIÓN ACTUAL:
${observaciones}
${historyContext}

GENERA 3-5 RECOMENDACIONES ESPECÍFICAS:
- Técnicas terapéuticas apropiadas
- Ejercicios o tareas para casa
- Estrategias de afrontamiento
- Seguimiento recomendado
- Recursos adicionales si es necesario

Mantén un enfoque profesional y basado en evidencia científica.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const recommendations = response.text();

            logger.info('AI recommendations generated');
            return recommendations;

        } catch (error) {
            logger.error('Recommendations generation failed:', error);
            return this.getFallbackRecommendations();
        }
    }

    getFallbackRecommendations() {
        return `**Recomendaciones Estándar:**

1. **Seguimiento:** Programar próxima sesión según protocolo establecido
2. **Monitoreo:** Evaluar estado emocional entre sesiones
3. **Técnicas:** Aplicar técnicas de relajación y mindfulness
4. **Red de apoyo:** Fortalecer vínculos familiares y sociales
5. **Autocuidado:** Mantener rutinas saludables de sueño y ejercicio

*Nota: Recomendaciones generadas automáticamente. Personalizar según caso específico.*`;
    }

    // Test AI connectivity
    async testConnection() {
        try {
            if (!this.genAI) {
                return { success: false, error: 'AI not configured' };
            }

            const model = this.genAI.getGenerativeModel({ model: config.GEMINI.MODEL });
            const result = await model.generateContent("Test connection");
            const response = await result.response;
            
            return { 
                success: true, 
                message: 'AI connection successful',
                model: config.GEMINI.MODEL
            };

        } catch (error) {
            logger.error('AI connection test failed:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // Get AI service status
    getStatus() {
        return {
            primary_ai: !!this.genAI,
            backup_ai: !!this.backupGenAI,
            model: config.GEMINI.MODEL,
            features: {
                summary_generation: true,
                mood_analysis: true,
                recommendations: true
            }
        };
    }
}

module.exports = new AIService(); 