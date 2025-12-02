/**
 * AIRA Voice Processor Module
 * Sistema de procesamiento de voz con integración N8N
 * Maneja grabación, transcripción y procesamiento automático de sesiones
 */

class VoiceProcessor {
    constructor() {
        this.isInitialized = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.audioContext = null;
        this.stream = null;
        this.transcriptionResult = null;

        // Configuración para grabación de alta calidad
        this.config = {
            sampleRate: 44100,
            channelCount: 1,
            bitRate: 128000,
            mimeType: 'audio/webm;codecs=opus',
            maxDuration: 30 * 60 * 1000, // 30 minutos máximo
            minDuration: 5 * 1000, // 5 segundos mínimo
            silenceThreshold: 0.01,
            silenceTimeout: 3000 // 3 segundos de silencio para detener
        };

        // callbacks
        this.onStartCallback = null;
        this.onStopCallback = null;
        this.onTranscriptionCallback = null;
        this.onErrorCallback = null;

        this.init();
    }

    async init() {
        try {
            console.log('🎤 Initializing Voice Processor...');

            // Verificar soporte del navegador
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Audio recording not supported in this browser');
            }

            // Inicializar AudioContext si es necesario
            if (!this.audioContext) {
                try {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    this.audioContext = new AudioContextClass();

                    // Reanudar si está suspendido
                    if (this.audioContext.state === 'suspended') {
                        await this.audioContext.resume();
                    }
                } catch (error) {
                    console.warn('AudioContext initialization failed:', error);
                }
            }

            this.isInitialized = true;
            console.log('✅ Voice Processor initialized successfully');

        } catch (error) {
            console.error('❌ Voice Processor initialization failed:', error);
            this.isInitialized = false;
        }
    }

    async requestMicrophonePermission() {
        try {
            // Solicitar permisos de micrófono
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.config.sampleRate,
                    channelCount: this.config.channelCount,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            return true;
        } catch (error) {
            console.error('❌ Microphone permission denied:', error);
            throw new Error('Microphone permission is required for voice recording');
        }
    }

    async startRecording(options = {}) {
        if (!this.isInitialized) {
            await this.init();
        }

        if (this.isRecording) {
            console.warn('⚠️ Recording already in progress');
            return false;
        }

        try {
            // Solicitar permisos si no hay stream activo
            if (!this.stream) {
                await this.requestMicrophonePermission();
            }

            // Configurar opciones específicas de la sesión
            const sessionConfig = { ...this.config, ...options };

            // Crear MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: sessionConfig.mimeType
            });

            this.audioChunks = [];
            this.recordingStartTime = Date.now();
            this.isRecording = true;

            // Event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.handleRecordingStop();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('❌ MediaRecorder error:', event.error);
                this.handleError('Recording error: ' + event.error.message);
            };

            // Iniciar grabación
            this.mediaRecorder.start(1000); // Recopilar datos cada segundo

            console.log('🎤 Recording started');
            if (this.onStartCallback) {
                this.onStartCallback({
                    startTime: this.recordingStartTime,
                    config: sessionConfig
                });
            }

            // Configurar detección automática por silencio
            this.setupSilenceDetection();

            return true;

        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.handleError('Failed to start recording: ' + error.message);
            return false;
        }
    }

    async stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            console.warn('⚠️ No recording in progress');
            return null;
        }

        console.log('⏹️ Stopping recording...');

        // Detener MediaRecorder
        this.mediaRecorder.stop();
        this.isRecording = false;

        // Limpiar detección de silencio
        this.clearSilenceDetection();

        // Esperar un momento para que se procesen los datos
        await new Promise(resolve => setTimeout(resolve, 100));

        // Detener stream del micrófono
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        const duration = Date.now() - this.recordingStartTime;
        console.log(`⏱️ Recording duration: ${duration}ms`);

        return {
            duration,
            startTime: this.recordingStartTime,
            endTime: Date.now()
        };
    }

    async handleRecordingStop() {
        try {
            const duration = Date.now() - this.recordingStartTime;

            // Validar duración mínima
            if (duration < this.config.minDuration) {
                throw new Error(`Recording too short: ${Math.round(duration / 1000)}s (minimum ${this.config.minDuration / 1000}s)`);
            }

            // Crear blob de audio
            const audioBlob = new Blob(this.audioChunks, { type: this.config.mimeType });
            const audioUrl = URL.createObjectURL(audioBlob);

            const recordingInfo = {
                blob: audioBlob,
                url: audioUrl,
                duration,
                size: audioBlob.size,
                type: this.config.mimeType,
                timestamp: new Date().toISOString()
            };

            console.log('✅ Recording processed successfully');
            console.log(`📊 Audio info: ${Math.round(audioBlob.size / 1024)}KB, ${Math.round(duration / 1000)}s`);

            // Llamar callback de parada
            if (this.onStopCallback) {
                this.onStopCallback(recordingInfo);
            }

            // Iniciar transcripción automática
            await this.transcribeAudio(recordingInfo);

        } catch (error) {
            console.error('❌ Error processing recording:', error);
            this.handleError('Recording processing failed: ' + error.message);
        }
    }

    async transcribeAudio(recordingInfo) {
        try {
            console.log('🤖 Starting audio transcription...');

            // En un entorno real, esto se enviaría al servicio de transcripción
            // Por ahora, simularemos el proceso
            const mockTranscription = await this.mockTranscriptionService(recordingInfo);

            this.transcriptionResult = {
                text: mockTranscription.text,
                confidence: mockTranscription.confidence,
                language: 'es',
                duration: recordingInfo.duration,
                words: mockTranscription.words,
                timestamp: new Date().toISOString()
            };

            console.log('✅ Transcription completed');
            console.log(`📝 Text preview: ${this.transcriptionResult.text.substring(0, 100)}...`);
            console.log(`🎯 Confidence: ${this.transcriptionResult.confidence}`);

            // Llamar callback de transcripción
            if (this.onTranscriptionCallback) {
                this.onTranscriptionCallback(this.transcriptionResult);
            }

            // Procesar con N8N si hay paciente seleccionado
            await this.processWithN8N(this.transcriptionResult, recordingInfo);

        } catch (error) {
            console.error('❌ Transcription failed:', error);
            this.handleError('Transcription failed: ' + error.message);
        }
    }

    async mockTranscriptionService(recordingInfo) {
        // Simular tiempo de procesamiento
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

        // Simular transcripción basada en la duración
        const baseText = "Hoy tuve una sesión terapéutica muy productiva. El paciente mostró avances significativos en cuanto a la gestión de sus emociones. Hablamos sobre las estrategias que hemos estado trabajando y cómo las está implementando en su vida diaria. También exploramos algunos desafíos nuevos que surgieron durante la semana y desarrollamos un plan para abordarlos en nuestras próximas sesiones.";

        const wordCount = Math.floor(recordingInfo.duration / 3000); // Aproximadamente 3 segundos por palabra
        const words = baseText.split(' ').slice(0, Math.max(10, wordCount));
        const text = words.join(' ');

        return {
            text,
            confidence: 0.85 + Math.random() * 0.14, // 85-99% de confianza
            words: words.map((word, index) => ({
                word,
                start: index * 1.5,
                end: (index + 1) * 1.5,
                confidence: 0.9 + Math.random() * 0.1
            }))
        };
    }

    async processWithN8N(transcription, recordingInfo) {
        try {
            console.log('🔄 Processing with N8N workflow...');

            // En un entorno real, esto enviaría los datos al workflow de N8N
            // Por ahora, simularemos el proceso completo

            const n8nPayload = {
                phoneNumber: window.AIRAApp?.SessionManager?.currentPatient?.phone || '+5491168901234',
                messageId: `msg_${Date.now()}`,
                audioUrl: recordingInfo.url,
                mimeType: recordingInfo.type,
                duration: recordingInfo.duration,
                timestamp: recordingInfo.timestamp,
                transcription: transcription.text,
                confidence: transcription.confidence
            };

            console.log('📤 Sending to N8N:', n8nPayload);

            // Simular procesamiento N8N
            const n8nResult = await this.mockN8NProcessing(n8nPayload);

            console.log('✅ N8N processing completed');
            console.log(`👤 Patient identified: ${n8nResult.patient?.name || 'Manual confirmation required'}`);
            console.log(`📊 Session ID: ${n8nResult.sessionId}`);

            // Actualizar SessionManager con los resultados
            if (window.AIRAApp?.SessionManager) {
                window.AIRAApp.SessionManager.processN8NResult(n8nResult);
            }

        } catch (error) {
            console.error('❌ N8N processing failed:', error);
            this.handleError('N8N processing failed: ' + error.message);
        }
    }

    async mockN8NProcessing(payload) {
        // Simular tiempo de procesamiento del workflow N8N
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));

        // Simular resultado del workflow
        return {
            success: true,
            sessionId: Math.floor(Math.random() * 10000) + 1,
            patient: {
                id: 1,
                name: 'María González',
                identified: true,
                confidence: 0.92
            },
            sessionType: 'individual',
            emotionalTone: 'positivo',
            requiresUrgentAttention: false,
            aiSummary: {
                summary: 'Sesión productiva con avances significativos en gestión emocional.',
                emotionalState: 4,
                topics: ['gestión emocional', 'estrategias', 'implementación'],
                interventions: ['técnicas de respiración', 'cognitivo-conductual'],
                progress: 'Buen progreso observado',
                alerts: [],
                recommendations: ['Continuar con estrategias actuales', 'Monitorear nuevos desafíos']
            },
            timestamp: new Date().toISOString()
        };
    }

    setupSilenceDetection() {
        if (!this.stream) return;

        // Implementar detección de silencio básica
        this.silenceDetectionTimer = setTimeout(() => {
            if (this.isRecording) {
                console.log('🔇 Silence detected, stopping recording...');
                this.stopRecording();
            }
        }, this.config.silenceTimeout);
    }

    clearSilenceDetection() {
        if (this.silenceDetectionTimer) {
            clearTimeout(this.silenceDetectionTimer);
            this.silenceDetectionTimer = null;
        }
    }

    // Métodos de configuración de callbacks
    onStart(callback) {
        this.onStartCallback = callback;
    }

    onStop(callback) {
        this.onStopCallback = callback;
    }

    onTranscription(callback) {
        this.onTranscriptionCallback = callback;
    }

    onError(callback) {
        this.onErrorCallback = callback;
    }

    handleError(errorMessage) {
        console.error('❌ VoiceProcessor Error:', errorMessage);
        if (this.onErrorCallback) {
            this.onErrorCallback({
                message: errorMessage,
                timestamp: new Date().toISOString(),
                type: 'recording_error'
            });
        }
    }

    // Métodos de utilidad
    getRecordingStatus() {
        return {
            isRecording: this.isRecording,
            isInitialized: this.isInitialized,
            duration: this.isRecording ? Date.now() - this.recordingStartTime : 0,
            hasTranscription: !!this.transcriptionResult,
            transcription: this.transcriptionResult
        };
    }

    getTranscriptionResult() {
        return this.transcriptionResult;
    }

    clearTranscriptionResult() {
        this.transcriptionResult = null;
    }

    async playAudio(audioUrl) {
        try {
            const audio = new Audio(audioUrl);
            await audio.play();
        } catch (error) {
            console.error('❌ Error playing audio:', error);
        }
    }

    async testMicrophone() {
        try {
            await this.requestMicrophonePermission();

            // Crear analizador de audio para probar el micrófono
            const source = this.audioContext.createMediaStreamSource(this.stream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkAudio = () => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

                if (average > 10) {
                    console.log('🎤 Microphone test: Audio detected');
                    return true;
                }

                return false;
            };

            // Probar por 3 segundos
            for (let i = 0; i < 30; i++) {
                if (checkAudio()) {
                    // Limpiar stream
                    this.stream.getTracks().forEach(track => track.stop());
                    this.stream = null;
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Limpiar stream
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;

            throw new Error('No audio detected from microphone');

        } catch (error) {
            console.error('❌ Microphone test failed:', error);
            throw error;
        }
    }

    destroy() {
        console.log('🗑️ Destroying Voice Processor...');

        // Detener grabación si está activa
        if (this.isRecording) {
            this.stopRecording();
        }

        // Limpiar timers
        this.clearSilenceDetection();

        // Limpiar stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Limpiar AudioContext
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Limpiar callbacks
        this.onStartCallback = null;
        this.onStopCallback = null;
        this.onTranscriptionCallback = null;
        this.onErrorCallback = null;

        // Limpiar datos
        this.audioChunks = [];
        this.transcriptionResult = null;
        this.isInitialized = false;

        console.log('✅ Voice Processor destroyed');
    }
}

// Exportar para uso global
window.VoiceProcessor = VoiceProcessor;

// Auto-inicialización segura
(() => {
    if (typeof window !== 'undefined') {
        window.AIRA = window.AIRA || {};
        window.AIRA.VoiceProcessor = new VoiceProcessor();

        console.log('🎤 AIRA Voice Processor module loaded');
    }
})();