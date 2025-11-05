const { Router } = require('express');
const { isPsychologist, isProfessional } = require('../middleware/auth');
const { createLimiter } = require('../middleware/security');
const { validateObjectId } = require('../middleware/validation');

// Import psychology controllers
const psychologyController = require('../controllers/psychologyController');
const sessionController = require('../controllers/psychologySessionController');
const assessmentController = require('../controllers/psychologyAssessmentController');
const treatmentController = require('../controllers/psychologyTreatmentController');

const router = Router();

// All psychology routes require psychologist role
router.use(isPsychologist);

// === SESSION MANAGEMENT ROUTES ===
router.post('/sessions', createLimiter, sessionController.createSession);
router.get('/sessions', sessionController.getSessions);
router.get('/sessions/:id', validateObjectId, sessionController.getSessionById);
router.put('/sessions/:id', validateObjectId, sessionController.updateSession);
router.post('/sessions/:id/audio', createLimiter, sessionController.uploadAudioRecording);
router.get('/sessions/:id/audio', sessionController.getAudioRecording);
router.delete('/sessions/:id', validateObjectId, sessionController.deleteSession);

// === ASSESSMENT TOOLS ROUTES ===
router.post('/assessments/phq9', assessmentController.createPHQ9Assessment);
router.post('/assessments/gad7', assessmentController.createGAD7Assessment);
router.post('/assessments/bdi', assessmentController.createBDIAssessment);
router.post('/assessments/bai', assessmentController.createBAIAssessment);
router.post('/assessments/ptsd', assessmentController.createPTSDAssessment);
router.post('/assessments/risk', assessmentController.createRiskAssessment);
router.get('/assessments/patient/:patientId', validateObjectId, assessmentController.getPatientAssessments);
router.get('/assessments/:id', validateObjectId, assessmentController.getAssessmentById);
router.put('/assessments/:id', validateObjectId, assessmentController.updateAssessment);
router.get('/assessments/trends/:patientId', validateObjectId, assessmentController.getAssessmentTrends);
router.get('/assessments/alerts', assessmentController.getHighRiskAlerts);

// === TREATMENT PLANNING ROUTES ===
router.post('/treatment-plans', createLimiter, treatmentController.createTreatmentPlan);
router.get('/treatment-plans', treatmentController.getTreatmentPlans);
router.get('/treatment-plans/:id', validateObjectId, treatmentController.getTreatmentPlanById);
router.put('/treatment-plans/:id', validateObjectId, treatmentController.updateTreatmentPlan);
router.post('/treatment-plans/:id/homework', createLimiter, treatmentController.addHomework);
router.get('/treatment-plans/:id/homework', treatmentController.getHomework);
router.put('/homework/:id/complete', validateObjectId, treatmentController.markHomeworkComplete);

// === DOCUMENTATION ROUTES ===
router.post('/notes/soap', createLimiter, psychologyController.createSOAPNote);
router.get('/notes/patient/:patientId', validateObjectId, psychologyController.getPatientNotes);
router.get('/notes/:id', validateObjectId, psychologyController.getNoteById);
router.put('/notes/:id', validateObjectId, psychologyController.updateNote);
router.post('/notes/:id/sign', validateObjectId, psychologyController.signNote);

// === PROGRESS TRACKING ROUTES ===
router.get('/progress/patient/:patientId', validateObjectId, psychologyController.getPatientProgress);
router.post('/progress/goals', createLimiter, psychologyController.createGoal);
router.put('/progress/goals/:id', validateObjectId, psychologyController.updateGoal);
router.get('/progress/reports/:patientId', validateObjectId, psychologyController.getProgressReport);

// === RESOURCES AND REFERRALS ===
router.get('/resources/templates', psychologyController.getNoteTemplates);
router.post('/referrals', createLimiter, psychologyController.createReferral);
router.get('/referrals', psychologyController.getReferrals);
router.put('/referrals/:id', validateObjectId, psychologyController.updateReferral);

// === PSYCHOLOGY DASHBOARD ===
router.get('/dashboard/stats', psychologyController.getDashboardStats);
router.get('/dashboard/recent-sessions', psychologyController.getRecentSessions);
router.get('/dashboard/upcoming-sessions', psychologyController.getUpcomingSessions);

module.exports = router;