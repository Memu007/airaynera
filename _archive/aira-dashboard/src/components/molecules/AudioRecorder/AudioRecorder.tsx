import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../atoms/Button';
import { LoadingSpinner } from '../atoms/LoadingSpinner';
import './AudioRecorder.css';

/**
 * Audio Recorder Component for Therapy Sessions
 * Provides professional voice recording with real-time visualization
 * and HIPAA-compliant secure handling
 */
const AudioRecorder = ({ 
  sessionId, 
  patientId, 
  onRecordingComplete, 
  onTranscriptionComplete,
  maxDuration = 30 * 60, // 30 minutes default
  disabled = false,
  className = ''
}) => {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(null);
  
  // Audio data
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcription, setTranscription] = useState(null);
  const [error, setError] = useState(null);
  
  // Refs
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerRef = useRef(null);
  
  // Configuration
  const audioConfig = {
    sampleRate: 44100,
    channelCount: 1,
    bitRate: 128000,
    mimeType: 'audio/webm;codecs=opus',
    maxDuration: maxDuration * 1000, // Convert to milliseconds
    minDuration: 5 * 1000, // 5 seconds minimum
    silenceThreshold: 0.01,
    silenceTimeout: 3000 // 3 seconds of silence to stop
  };

  /**
   * Initialize audio context and request microphone permission
   */
  const initializeAudio = useCallback(async () => {
    try {
      setError(null);
      
      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Audio recording not supported in this browser');
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: audioConfig.sampleRate,
          channelCount: audioConfig.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      setPermissionGranted(true);

      // Initialize audio context for visualization
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Set up analyser for audio level visualization
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;
        source.connect(analyserRef.current);
      }

      return true;
    } catch (error) {
      console.error('Audio initialization failed:', error);
      setPermissionGranted(false);
      setError(error.message || 'Failed to initialize audio recording');
      return false;
    }
  }, [audioConfig]);

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    if (disabled || isRecording) return;

    try {
      setError(null);
      setIsProcessing(true);

      // Initialize audio if not already done
      if (!permissionGranted) {
        const initialized = await initializeAudio();
        if (!initialized) {
          return;
        }
      }

      // Create MediaRecorder
      const options = {
        mimeType: audioConfig.mimeType
      };

      // Check if MIME type is supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'audio/ogg';
        }
      }

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      const chunks = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          setIsProcessing(true);
          const duration = Date.now() - timerRef.current.startTime;
          
          // Validate minimum duration
          if (duration < audioConfig.minDuration) {
            throw new Error(`Recording too short: ${Math.round(duration / 1000)}s (minimum ${audioConfig.minDuration / 1000}s)`);
          }

          // Create audio blob
          const blob = new Blob(chunks, { type: mediaRecorderRef.current.mimeType });
          const url = URL.createObjectURL(blob);
          
          setAudioBlob(blob);
          setAudioUrl(url);
          setIsProcessing(false);

          // Notify parent component
          if (onRecordingComplete) {
            onRecordingComplete({
              blob,
              url,
              duration,
              size: blob.size,
              type: mediaRecorderRef.current.mimeType,
              timestamp: new Date().toISOString()
            });
          }

          // Start transcription
          await transcribeAudio(blob);
        } catch (error) {
          console.error('Error processing recording:', error);
          setError(error.message);
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError(`Recording error: ${event.error.message}`);
        setIsRecording(false);
        setIsProcessing(false);
      };

      // Start recording
      mediaRecorderRef.current.start(1000); // Collect data every second
      timerRef.current = { startTime: Date.now() };
      
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      // Start timer
      startTimer();
      
      // Start audio level monitoring
      monitorAudioLevels();

      console.log('🎤 Recording started');

    } catch (error) {
      console.error('Failed to start recording:', error);
      setError(error.message || 'Failed to start recording');
      setIsProcessing(false);
    }
  }, [disabled, isRecording, permissionGranted, initializeAudio, audioConfig, onRecordingComplete]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;

    console.log('⏹️ Stopping recording...');
    
    // Stop MediaRecorder
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setIsPaused(false);
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current.interval);
      timerRef.current = null;
    }
    
    // Stop audio level monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isRecording]);

  /**
   * Pause/resume recording
   */
  const togglePause = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer();
      monitorAudioLevels();
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current.interval);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isRecording, isPaused]);

  /**
   * Delete recording
   */
  const deleteRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscription(null);
    setRecordingTime(0);
    setAudioLevel(0);
    setError(null);
  }, [audioUrl]);

  /**
   * Timer management
   */
  const startTimer = () => {
    if (timerRef.current) {
      timerRef.current.interval = setInterval(() => {
        const elapsed = Date.now() - timerRef.current.startTime;
        setRecordingTime(elapsed);
        
        // Auto-stop if max duration reached
        if (elapsed >= audioConfig.maxDuration) {
          stopRecording();
        }
      }, 100);
    }
  };

  /**
   * Monitor audio levels for visualization
   */
  const monitorAudioLevels = () => {
    if (!analyserRef.current || !isRecording || isPaused) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = average / 255; // Normalize to 0-1
    setAudioLevel(normalizedLevel);

    animationFrameRef.current = requestAnimationFrame(monitorAudioLevels);
  };

  /**
   * Transcribe audio using speech-to-text service
   */
  const transcribeAudio = async (blob) => {
    try {
      setIsProcessing(true);
      console.log('🤖 Starting transcription...');

      // Create form data for API call
      const formData = new FormData();
      formData.append('audio', blob, `recording_${sessionId}_${Date.now()}.webm`);
      formData.append('sessionId', sessionId);
      formData.append('patientId', patientId);
      formData.append('language', 'es-ES'); // Spanish for medical context

      // Call transcription service
      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      setTranscription(result);
      
      if (onTranscriptionComplete) {
        onTranscriptionComplete(result);
      }

      console.log('✅ Transcription completed');
      console.log(`📝 Confidence: ${result.confidence}%`);

    } catch (error) {
      console.error('Transcription failed:', error);
      setError(`Transcription failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Format time display
   */
  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Initialize on mount
   */
  useEffect(() => {
    return () => {
      // Cleanup
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timerRef.current?.interval) {
        clearInterval(timerRef.current.interval);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [isRecording, audioUrl]);

  return (
    <div className={`audio-recorder ${className}`}>
      <div className="audio-recorder__header">
        <h3 className="audio-recorder__title">Session Voice Recording</h3>
        {sessionId && (
          <span className="audio-recorder__session-id">Session: {sessionId}</span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="audio-recorder__error">
          <span className="audio-recorder__error-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Permission Status */}
      {permissionGranted === false && (
        <div className="audio-recorder__permission">
          <p>Microphone access is required for voice recording.</p>
          <Button onClick={initializeAudio} variant="primary">
            Grant Microphone Access
          </Button>
        </div>
      )}

      {/* Recording Controls */}
      <div className="audio-recorder__controls">
        {!isRecording && !audioBlob && (
          <Button
            onClick={startRecording}
            disabled={disabled || isProcessing || permissionGranted === false}
            variant="primary"
            size="large"
            className="audio-recorder__start-btn"
          >
            {isProcessing ? <LoadingSpinner size="small" /> : '🎤 Start Recording'}
          </Button>
        )}

        {isRecording && (
          <div className="audio-recorder__active-controls">
            <Button
              onClick={togglePause}
              variant="secondary"
              className="audio-recorder__pause-btn"
            >
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </Button>
            <Button
              onClick={stopRecording}
              variant="danger"
              className="audio-recorder__stop-btn"
            >
              ⏹️ Stop
            </Button>
          </div>
        )}

        {audioBlob && (
          <div className="audio-recorder__playback-controls">
            <audio src={audioUrl} controls className="audio-recorder__player" />
            <div className="audio-recorder__playback-actions">
              <Button onClick={deleteRecording} variant="danger" size="small">
                🗑️ Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Recording Status */}
      {(isRecording || isProcessing) && (
        <div className="audio-recorder__status">
          <div className="audio-recorder__timer">
            {formatTime(recordingTime)}
            {isRecording && (
              <span className="audio-recorder__live-indicator">
                <span className="audio-recorder__live-dot"></span>
                LIVE
              </span>
            )}
          </div>

          {/* Audio Level Visualization */}
          <div className="audio-recorder__level-meter">
            <div className="audio-recorder__level-bar">
              <div 
                className="audio-recorder__level-fill"
                style={{ width: `${audioLevel * 100}%` }}
              ></div>
            </div>
            <div className="audio-recorder__level-label">Audio Level</div>
          </div>

          {isProcessing && (
            <div className="audio-recorder__processing">
              <LoadingSpinner size="small" />
              <span>Processing recording...</span>
            </div>
          )}
        </div>
      )}

      {/* Transcription Results */}
      {transcription && (
        <div className="audio-recorder__transcription">
          <h4 className="audio-recorder__transcription-title">Transcription</h4>
          <div className="audio-recorder__transcription-content">
            <div className="audio-recorder__transcription-text">
              {transcription.text}
            </div>
            <div className="audio-recorder__transcription-meta">
              <span>Confidence: {transcription.confidence}%</span>
              <span>Language: {transcription.language}</span>
              <span>Duration: {formatTime(transcription.duration)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!isRecording && !audioBlob && permissionGranted !== false && (
        <div className="audio-recorder__instructions">
          <p>Click "Start Recording" to begin capturing the therapy session.</p>
          <ul>
            <li>Ensure you are in a quiet environment</li>
            <li>Speak clearly and at a moderate pace</li>
            <li>Maximum recording duration: {Math.floor(maxDuration / 60)} minutes</li>
            <li>Recording will automatically stop after the maximum duration</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;