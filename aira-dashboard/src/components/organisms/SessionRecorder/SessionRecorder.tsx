/**
 * SESSION RECORDER COMPONENT - AIRA Medical Bot
 * ONLY for recording and storing sessions
 * NO medical advice or treatment recommendations
 */

import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../providers/AuthProvider';

interface SessionRecorderProps {
  patientId: string;
  professionalType: 'psychologist' | 'psychiatrist';
  onSessionStored?: (sessionId: string) => void;
}

interface SessionData {
  sessionId: string;
  patientId: string;
  sessionType: 'audio' | 'text';
  sessionDate: string;
  sessionDuration: number;
  notes: string;
  audioBlob?: Blob;
}

export const SessionRecorder: React.FC<SessionRecorderProps> = ({
  patientId,
  professionalType,
  onSessionStored
}) => {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionType, setSessionType] = useState<'audio' | 'text'>('audio');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate session ID
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setSuccess(null);
      
      if (sessionType === 'audio') {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          } 
        });
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: 'audio/webm;codecs=opus' 
          });
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        setIsRecording(true);
        
        // Start timer
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        
      } else {
        setIsRecording(true);
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      }
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('No se pudo iniciar la grabación. Verifique los permisos del micrófono.');
    }
  }, [sessionType]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  }, [isPaused]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    } else if (isRecording) {
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording]);

  // Save session
  const saveSession = useCallback(async () => {
    if (!user) {
      setError('Usuario no autenticado');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const sessionData: SessionData = {
        sessionId: generateSessionId(),
        patientId,
        sessionType,
        sessionDate: new Date().toISOString(),
        sessionDuration: recordingTime,
        notes: notes.trim()
      };

      if (sessionType === 'audio' && audioChunksRef.current.length > 0) {
        sessionData.audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm;codecs=opus'
        });
      }

      // Create form data for file upload
      const formData = new FormData();
      formData.append('sessionId', sessionData.sessionId);
      formData.append('patientId', sessionData.patientId);
      formData.append('sessionDate', sessionData.sessionDate);
      formData.append('sessionType', sessionData.sessionType);
      formData.append('sessionDuration', sessionData.sessionDuration.toString());
      formData.append('notes', sessionData.notes);
      
      if (sessionData.audioBlob) {
        formData.append('audioFile', sessionData.audioBlob, `${sessionData.sessionId}.webm`);
      }

      // Send to backend
      const response = await fetch('/api/sessions/upload-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar la sesión');
      }

      const result = await response.json();
      
      setSuccess('Sesión guardada exitosamente');
      onSessionStored?.(result.data.sessionId);
      
      // Reset form
      setRecordingTime(0);
      setNotes('');
      audioChunksRef.current = [];
      
    } catch (error) {
      console.error('Error saving session:', error);
      setError(error instanceof Error ? error.message : 'Error al guardar la sesión');
    } finally {
      setIsSaving(false);
    }
  }, [user, patientId, sessionType, recordingTime, notes, onSessionStored]);

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Reset recording
  const resetRecording = () => {
    setRecordingTime(0);
    setNotes('');
    setError(null);
    setSuccess(null);
    setIsRecording(false);
    setIsPaused(false);
    audioChunksRef.current = [];
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Grabar Sesión - {professionalType === 'psychologist' ? 'Psicólogo' : 'Psiquiatra'}
        </h2>
        <p className="text-gray-600">
          Paciente: {patientId}
        </p>
      </div>

      {/* Session Type Selection */}
      {!isRecording && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Sesión
          </label>
          <div className="flex space-x-4">
            <button
              onClick={() => setSessionType('audio')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sessionType === 'audio'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🎤 Sesión de Audio
            </button>
            <button
              onClick={() => setSessionType('text')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                sessionType === 'text'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📝 Sesión de Texto
            </button>
          </div>
        </div>
      )}

      {/* Recording Interface */}
      <div className="space-y-6">
        {/* Recording Controls */}
        <div className="flex items-center justify-center">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-colors flex items-center space-x-2"
            >
              <span className="text-2xl">🔴</span>
              <span>Iniciar Grabación</span>
            </button>
          ) : (
            <div className="text-center">
              <div className="text-4xl font-bold text-red-600 mb-4">
                {formatTime(recordingTime)}
              </div>
              
              <div className="flex justify-center space-x-4 mb-4">
                {!isPaused ? (
                  <button
                    onClick={pauseRecording}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-full font-medium transition-colors"
                  >
                    ⏸️ Pausar
                  </button>
                ) : (
                  <button
                    onClick={resumeRecording}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full font-medium transition-colors"
                  >
                    ▶️ Reanudar
                  </button>
                )}
                
                <button
                  onClick={stopRecording}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-full font-medium transition-colors"
                >
                  ⏹️ Detener
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas de la Sesión (sin consejos médicos)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Registre solo observaciones y datos de la sesión. No incluya consejos médicos o recomendaciones de tratamiento."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={2000}
          />
          <div className="text-right text-sm text-gray-500">
            {notes.length}/2000 caracteres
          </div>
        </div>

        {/* Save Button */}
        {!isRecording && recordingTime > 0 && (
          <div className="flex justify-center space-x-4">
            <button
              onClick={saveSession}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {isSaving ? 'Guardando...' : '💾 Guardar Sesión'}
            </button>
            
            <button
              onClick={resetRecording}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              🔄 Reiniciar
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">❌ {error}</p>
        </div>
      )}
      
      {success && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 font-medium">✅ {success}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Instrucciones:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Solo registre observaciones y datos de la sesión</li>
          <li>• No incluya consejos médicos o recomendaciones de tratamiento</li>
          <li>• Las sesiones se cifrarán y almacenarán de forma segura</li>
          <li>• Se mantendrán por 10 años (adultos) o 28 años (menores)</li>
          <li>• Acceso restringido al profesional que registró la sesión</li>
        </ul>
      </div>
    </div>
  );
};

export default SessionRecorder;