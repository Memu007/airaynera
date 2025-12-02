/**
 * MINIMAL SERVER TEST - AIRA Medical Bot
 * Test core functionality without complex dependencies
 */

require('dotenv').config();
const express = require('express');
const SessionStorageService = require('./src/services/sessionStorageService');

const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0-simple',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Real JWT authentication
const jwt = require('jsonwebtoken');

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Mock users database
  const users = [
    {
      id: 'professional-001',
      email: 'test@aira-medical.com',
      password: 'test123',
      role: 'professional',
      professionalType: 'psychologist',
      name: 'Dr. Ana García',
      license: 'MP-12345'
    },
    {
      id: 'professional-002',
      email: 'psychiatrist@aira-medical.com',
      password: 'test123',
      role: 'professional',
      professionalType: 'psychiatrist',
      name: 'Dr. Carlos Martínez',
      license: 'MN-67890'
    }
  ];
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    {
      sub: user.id,
      role: user.role,
      professionalType: user.professionalType,
      name: user.name
    },
    process.env.ENCRYPTION_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      professionalType: user.professionalType,
      name: user.name,
      license: user.license
    }
  });
});

// JWT token verification
app.post('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.ENCRYPTION_SECRET);
    res.json({
      success: true,
      user: decoded
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Session storage with mock auth
const sessionService = new SessionStorageService();

app.post('/api/sessions/store', async (req, res) => {
  try {
    console.log('📝 Storing session:', req.body);
    
    const sessionData = {
      sessionId: req.body.sessionId || `session_${Date.now()}`,
      professionalId: 'professional-001', // Mock
      professionalType: 'psychologist', // Mock
      patientId: req.body.patientId,
      sessionDate: req.body.sessionDate || new Date().toISOString(),
      sessionType: req.body.sessionType,
      sessionDuration: req.body.sessionDuration,
      notes: req.body.notes || ''
    };
    
    const result = await sessionService.storeSession(sessionData);
    console.log('✅ Session stored:', result.sessionId);
    
    res.status(201).json({
      success: true,
      message: 'Session stored successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Session storage error:', error.message);
    res.status(500).json({
      error: 'STORAGE_ERROR',
      message: error.message
    });
  }
});

app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log('📖 Retrieving session:', sessionId);
    
    const session = await sessionService.retrieveSession(sessionId, 'professional-001');
    console.log('✅ Session retrieved');
    
    res.json({
      success: true,
      message: 'Session retrieved successfully',
      data: session
    });
    
  } catch (error) {
    console.error('❌ Session retrieval error:', error.message);
    res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      message: error.message
    });
  }
});

// List all sessions endpoint
app.get('/api/sessions', async (req, res) => {
  try {
    console.log('📋 Listing all sessions...');
    
    const filters = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      sessionType: req.query.sessionType,
      professionalType: req.query.professionalType
    };
    
    const result = await sessionService.listSessions('professional-001', filters);
    console.log(`✅ ${result.total} sessions listed`);
    
    res.json({
      success: true,
      message: 'Sessions retrieved successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Session listing error:', error.message);
    res.status(500).json({
      error: 'LISTING_ERROR',
      message: error.message
    });
  }
});

// WhatsApp integration endpoints
app.post('/api/whatsapp/recognize-patient', async (req, res) => {
  try {
    const { phoneNumber, aiAnalysis, transcription } = req.body;
    console.log(`📱 WhatsApp patient recognition: ${phoneNumber}`);
    
    // Mock patient recognition
    const patientData = {
      id: 'whatsapp-patient-001',
      name: 'María González',
      phone: phoneNumber,
      status: 'active'
    };
    
    console.log('✅ Patient recognized:', patientData.name);
    
    res.json({
      success: true,
      professional: {
        id: 'professional-001',
        name: 'Dr. Test Professional',
        specialty: 'Psychology'
      },
      patient: patientData,
      confidence: 0.9,
      sessionAnalysis: {
        type: aiAnalysis?.sessionType || 'individual',
        emotionalTone: aiAnalysis?.emotionalTone || 'neutral',
        requiresUrgentAttention: aiAnalysis?.requiresUrgentAttention || false
      },
      requiresManualConfirmation: false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Patient recognition error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/whatsapp/create-session', async (req, res) => {
  try {
    const { patientData, sessionData, transcription, audioInfo } = req.body;
    console.log(`📝 Creating WhatsApp session for: ${patientData?.name}`);
    
    const newSession = await sessionService.storeSession({
      sessionId: `whatsapp_${Date.now()}`,
      professionalId: 'professional-001',
      professionalType: 'psychologist',
      patientId: patientData.id,
      sessionDate: new Date().toISOString(),
      sessionType: 'audio',
      sessionDuration: Math.ceil((audioInfo?.duration || 0) / 60),
      notes: transcription?.substring(0, 500) || 'WhatsApp voice message',
      audioFile: Buffer.from(transcription || '') // Mock audio file
    });
    
    console.log('✅ WhatsApp session created:', newSession.sessionId);
    
    res.json({
      success: true,
      sessionId: newSession.sessionId,
      session: newSession,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ WhatsApp session creation error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/whatsapp/save-session', async (req, res) => {
  try {
    const { sessionId, aiSummary, finalData } = req.body;
    console.log(`💾 Saving complete WhatsApp session: ${sessionId}`);
    
    // For now, just acknowledge - the session is already stored
    console.log('✅ WhatsApp session saved and completed');
    
    res.json({
      success: true,
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ WhatsApp session save error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/whatsapp/send-confirmation', async (req, res) => {
  try {
    const { phoneNumber, confirmationData } = req.body;
    console.log(`📱 Sending WhatsApp confirmation to: ${phoneNumber}`);
    
    const confirmationMessage = `
✅ **Sesión Registrada Exitosamente**

📋 **Resumen:**
👤 Paciente: ${confirmationData?.patient?.name || 'Identificado'}
🆔 ID Sesión: ${confirmationData?.sessionId || 'Generated'}
⏰ Fecha: ${new Date().toLocaleString('es-AR')}
🎤 Duración: ${confirmationData?.audioInfo?.duration || 0} segundos
📝 Transcripción: Procesada

💡 La sesión completa está disponible en tu dashboard web.
    `.trim();
    
    console.log('✅ WhatsApp confirmation sent');
    
    res.json({
      success: true,
      message: confirmationMessage,
      messageId: `whatsapp_msg_${Date.now()}`,
      status: 'sent',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ WhatsApp confirmation error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
🏥 SIMPLE AIRA SERVER STARTED!
📍 URL: http://localhost:${PORT}
🩺 Session Storage Only
🔒 Development Mode
⏰ Started at: ${new Date().toLocaleString()}

📋 Available Endpoints:
✅ GET /api/health
✅ POST /api/auth/verify (mock)
✅ POST /api/sessions/store
✅ GET /api/sessions/:sessionId

🧪 Ready for testing!
  `);
});

module.exports = app;