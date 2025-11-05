/**
 * Psychology Service - AIRA
 * Core service for psychologist-specific workflows
 * @version 1.0.0
 */

const db = require('../config/database');
const logger = require('../utils/logger');

class PsychologyService {
    /**
     * Create SOAP note
     */
    async createSOAPNote(noteData) {
        try {
            const collection = db.collection('psychology_notes');
            const result = await collection.insertOne(noteData);
            
            logger.info('SOAP note created in service:', {
                noteId: result.insertedId,
                psychologistId: noteData.psychologistId,
                patientId: noteData.patientId,
                timestamp: new Date().toISOString()
            });
            
            return {
                id: result.insertedId,
                ...noteData
            };
        } catch (error) {
            logger.error('Failed to create SOAP note in service:', error);
            throw new Error('Failed to create SOAP note: ' + error.message);
        }
    }

    /**
     * Get patient notes
     */
    async getPatientNotes({ psychologistId, patientId, limit, offset, noteType }) {
        try {
            const collection = db.collection('psychology_notes');
            
            const query = {
                psychologistId,
                patientId
            };
            
            if (noteType) {
                query.noteType = noteType;
            }
            
            const notes = await collection
                .find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(offset)
                .toArray();
            
            const total = await collection.countDocuments(query);
            const hasMore = total > offset + limit;
            
            return {
                data: notes.map(note => ({
                    ...note,
                    id: note._id
                })),
                total,
                hasMore
            };
        } catch (error) {
            throw new Error('Failed to get patient notes: ' + error.message);
        }
    }

    /**
     * Get note by ID
     */
    async getNoteById(noteId, psychologistId) {
        try {
            const collection = db.collection('psychology_notes');
            const note = await collection.findOne({
                _id: new ObjectId(noteId),
                psychologistId
            });
            
            if (!note) return null;
            
            return {
                ...note,
                id: note._id
            };
        } catch (error) {
            throw new Error('Failed to get note: ' + error.message);
        }
    }

    /**
     * Update note
     */
    async updateNote(noteId, psychologistId, updates) {
        try {
            const collection = db.collection('psychology_notes');
            
            const result = await collection.updateOne(
                { _id: new ObjectId(noteId), psychologistId, isSigned: { $ne: true } },
                { $set: { ...updates, updatedAt: new Date() } }
            );
            
            if (result.matchedCount === 0) {
                return {
                    success: false,
                    error: 'Note not found or already signed',
                    code: 'NOTE_NOT_FOUND_OR_SIGNED'
                };
            }
            
            const updatedNote = await this.getNoteById(noteId, psychologistId);
            
            return {
                success: true,
                note: updatedNote
            };
        } catch (error) {
            throw new Error('Failed to update note: ' + error.message);
        }
    }

    /**
     * Sign note
     */
    async signNote(noteId, psychologistId, signatureTimestamp) {
        try {
            const collection = db.collection('psychology_notes');
            
            const result = await collection.updateOne(
                { _id: new ObjectId(noteId), psychologistId },
                { 
                    $set: { 
                        isSigned: true,
                        signatureTimestamp: new Date(signatureTimestamp),
                        signedBy: psychologistId,
                        updatedAt: new Date()
                    }
                }
            );
            
            if (result.matchedCount === 0) {
                return {
                    success: false,
                    error: 'Note not found',
                    code: 'NOTE_NOT_FOUND'
                };
            }
            
            const signedNote = await this.getNoteById(noteId, psychologistId);
            
            return {
                success: true,
                note: signedNote
            };
        } catch (error) {
            throw new Error('Failed to sign note: ' + error.message);
        }
    }

    /**
     * Get patient progress
     */
    async getPatientProgress({ psychologistId, patientId, timeframe }) {
        try {
            const collection = db.collection('psychology_notes');
            const goalsCollection = db.collection('psychology_goals');
            
            // Calculate date range based on timeframe
            const endDate = new Date();
            const startDate = new Date();
            
            switch (timeframe) {
                case '1month':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case '3months':
                    startDate.setMonth(startDate.getMonth() - 3);
                    break;
                case '6months':
                    startDate.setMonth(startDate.getMonth() - 6);
                    break;
                case '1year':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                default:
                    startDate.setMonth(startDate.getMonth() - 6);
            }
            
            // Get session notes
            const sessionNotes = await collection
                .find({
                    psychologistId,
                    patientId,
                    createdAt: { $gte: startDate, $lte: endDate }
                })
                .sort({ createdAt: 1 })
                .toArray();
            
            // Get goals
            const goals = await goalsCollection
                .find({
                    psychologistId,
                    patientId,
                    status: { $ne: 'completed' }
                })
                .toArray();
            
            // Calculate progress metrics
            const totalSessions = sessionNotes.length;
            const assessmentScores = this.extractAssessmentScores(sessionNotes);
            const goalProgress = this.calculateGoalProgress(goals);
            
            return {
                timeframe,
                dateRange: { startDate, endDate },
                totalSessions,
                sessionNotes: sessionNotes.map(note => ({
                    ...note,
                    id: note._id
                })),
                assessmentScores,
                goals: goals.map(goal => ({
                    ...goal,
                    id: goal._id
                })),
                goalProgress,
                trendAnalysis: this.analyzeProgressTrends(sessionNotes, assessmentScores)
            };
        } catch (error) {
            throw new Error('Failed to get patient progress: ' + error.message);
        }
    }

    /**
     * Create treatment goal
     */
    async createGoal(goalData) {
        try {
            const collection = db.collection('psychology_goals');
            const result = await collection.insertOne(goalData);
            
            return {
                ...goalData,
                id: result.insertedId
            };
        } catch (error) {
            throw new Error('Failed to create goal: ' + error.message);
        }
    }

    /**
     * Update goal
     */
    async updateGoal(goalId, psychologistId, updates) {
        try {
            const collection = db.collection('psychology_goals');
            
            const result = await collection.updateOne(
                { _id: new ObjectId(goalId), psychologistId },
                { $set: { ...updates, updatedAt: new Date() } }
            );
            
            if (result.matchedCount === 0) {
                return {
                    success: false,
                    error: 'Goal not found',
                    code: 'GOAL_NOT_FOUND'
                };
            }
            
            const updatedGoal = await collection.findOne({
                _id: new ObjectId(goalId),
                psychologistId
            });
            
            return {
                success: true,
                goal: {
                    ...updatedGoal,
                    id: updatedGoal._id
                }
            };
        } catch (error) {
            throw new Error('Failed to update goal: ' + error.message);
        }
    }

    /**
     * Generate progress report
     */
    async generateProgressReport({ psychologistId, patientId, startDate, endDate, format }) {
        try {
            const progress = await this.getPatientProgress({
                psychologistId,
                patientId,
                timeframe: 'custom'
            });
            
            // Filter by date range if provided
            if (startDate || endDate) {
                progress.sessionNotes = progress.sessionNotes.filter(note => {
                    const noteDate = new Date(note.createdAt);
                    if (startDate && noteDate < new Date(startDate)) return false;
                    if (endDate && noteDate > new Date(endDate)) return false;
                    return true;
                });
            }
            
            const report = {
                patientId,
                psychologistId,
                generatedAt: new Date(),
                reportPeriod: {
                    startDate: startDate || progress.dateRange.startDate,
                    endDate: endDate || progress.dateRange.endDate
                },
                summary: {
                    totalSessions: progress.totalSessions,
                    averageSessionRating: this.calculateAverageSessionRating(progress.sessionNotes),
                    goalCompletionRate: progress.goalProgress.completionRate,
                    overallProgress: this.calculateOverallProgress(progress)
                },
                detailedData: progress
            };
            
            return report;
        } catch (error) {
            throw new Error('Failed to generate progress report: ' + error.message);
        }
    }

    /**
     * Get note templates
     */
    async getNoteTemplates(templateType) {
        try {
            const templates = [
                {
                    id: 'soap-cbt',
                    name: 'CBT Session Note',
                    templateType: 'soap',
                    therapeuticApproach: 'CBT',
                    sections: {
                        subjective: 'Patient reported mood improvement. Discussed challenging negative thoughts related to work stress.',
                        objective: 'Patient appeared alert and engaged. Demonstrated understanding of cognitive restructuring techniques.',
                        assessment: 'Patient shows progress in identifying cognitive distortions. Mood appears improved from last session.',
                        plan: 'Continue CBT techniques. Practice thought records between sessions. Focus on workplace stressors next session.'
                    }
                },
                {
                    id: 'soap-psychodynamic',
                    name: 'Psychodynamic Session Note',
                    templateType: 'soap',
                    therapeuticApproach: 'Psychodynamic',
                    sections: {
                        subjective: 'Patient explored childhood experiences related to current relationship patterns.',
                        objective: 'Patient showed emotional processing during discussion of early attachment experiences.',
                        assessment: 'Insight into transference patterns developing. Patient demonstrates capacity for self-reflection.',
                        plan: 'Continue exploration of early attachment. Monitor transference dynamics. Consider family systems work.'
                    }
                },
                {
                    id: 'soap-family-therapy',
                    name: 'Family Therapy Session Note',
                    templateType: 'soap',
                    therapeuticApproach: 'Family Therapy',
                    sections: {
                        subjective: 'Family discussed communication patterns. Adolescents expressed frustration with parental expectations.',
                        objective: 'Observed family dynamics during role-play exercise. Parents demonstrated improved listening skills.',
                        assessment: 'Family communication showing improvement. Boundary issues remain to be addressed.',
                        plan: 'Continue communication skills practice. Address generational boundaries. Assign family communication homework.'
                    }
                }
            ];
            
            if (templateType) {
                return templates.filter(template => template.templateType === templateType);
            }
            
            return templates;
        } catch (error) {
            throw new Error('Failed to get note templates: ' + error.message);
        }
    }

    /**
     * Create referral
     */
    async createReferral(referralData) {
        try {
            const collection = db.collection('psychology_referrals');
            const result = await collection.insertOne(referralData);
            
            return {
                ...referralData,
                id: result.insertedId
            };
        } catch (error) {
            throw new Error('Failed to create referral: ' + error.message);
        }
    }

    /**
     * Get referrals
     */
    async getReferrals({ psychologistId, status, limit, offset }) {
        try {
            const collection = db.collection('psychology_referrals');
            
            const query = { psychologistId };
            if (status) {
                query.status = status;
            }
            
            const referrals = await collection
                .find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(offset)
                .toArray();
            
            const total = await collection.countDocuments(query);
            const hasMore = total > offset + limit;
            
            return {
                data: referrals.map(referral => ({
                    ...referral,
                    id: referral._id
                })),
                total,
                hasMore
            };
        } catch (error) {
            throw new Error('Failed to get referrals: ' + error.message);
        }
    }

    /**
     * Update referral
     */
    async updateReferral(referralId, psychologistId, updates) {
        try {
            const collection = db.collection('psychology_referrals');
            
            const result = await collection.updateOne(
                { _id: new ObjectId(referralId), psychologistId },
                { $set: { ...updates, updatedAt: new Date() } }
            );
            
            if (result.matchedCount === 0) {
                return {
                    success: false,
                    error: 'Referral not found',
                    code: 'REFERRAL_NOT_FOUND'
                };
            }
            
            const updatedReferral = await collection.findOne({
                _id: new ObjectId(referralId),
                psychologistId
            });
            
            return {
                success: true,
                referral: {
                    ...updatedReferral,
                    id: updatedReferral._id
                }
            };
        } catch (error) {
            throw new Error('Failed to update referral: ' + error.message);
        }
    }

    /**
     * Get dashboard statistics
     */
    async getDashboardStats(psychologistId) {
        try {
            const notesCollection = db.collection('psychology_notes');
            const sessionsCollection = db.collection('psychology_sessions');
            const assessmentsCollection = db.collection('psychology_assessments');
            const goalsCollection = db.collection('psychology_goals');
            
            const [
                totalSessions,
                totalNotes,
                totalAssessments,
                activeGoals,
                recentSessions
            ] = await Promise.all([
                sessionsCollection.countDocuments({ psychologistId }),
                notesCollection.countDocuments({ psychologistId }),
                assessmentsCollection.countDocuments({ psychologistId }),
                goalsCollection.countDocuments({ psychologistId, status: 'active' }),
                sessionsCollection
                    .find({ psychologistId, status: 'completed' })
                    .sort({ sessionDate: -1 })
                    .limit(5)
                    .toArray()
            ]);
            
            const thisMonth = new Date();
            thisMonth.setDate(1);
            const thisMonthSessions = await sessionsCollection.countDocuments({
                psychologistId,
                sessionDate: { $gte: thisMonth }
            });
            
            return {
                totalSessions,
                totalNotes,
                totalAssessments,
                activeGoals,
                thisMonthSessions,
                recentSessions: recentSessions.map(session => ({
                    ...session,
                    id: session._id
                }))
            };
        } catch (error) {
            throw new Error('Failed to get dashboard stats: ' + error.message);
        }
    }

    /**
     * Get recent sessions
     */
    async getRecentSessions({ psychologistId, limit }) {
        try {
            const collection = db.collection('psychology_sessions');
            
            const sessions = await collection
                .find({ psychologistId })
                .sort({ sessionDate: -1 })
                .limit(limit)
                .toArray();
            
            return sessions.map(session => ({
                ...session,
                id: session._id
            }));
        } catch (error) {
            throw new Error('Failed to get recent sessions: ' + error.message);
        }
    }

    /**
     * Get upcoming sessions
     */
    async getUpcomingSessions({ psychologistId, days }) {
        try {
            const collection = db.collection('psychology_sessions');
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + days);
            
            const sessions = await collection
                .find({
                    psychologistId,
                    sessionDate: { $gte: startDate, $lte: endDate },
                    status: { $in: ['scheduled', 'confirmed'] }
                })
                .sort({ sessionDate: 1 })
                .toArray();
            
            return sessions.map(session => ({
                ...session,
                id: session._id
            }));
        } catch (error) {
            throw new Error('Failed to get upcoming sessions: ' + error.message);
        }
    }

    // Helper methods
    extractAssessmentScores(sessionNotes) {
        const scores = {};
        sessionNotes.forEach(note => {
            if (note.phq9Score) {
                if (!scores.phq9) scores.phq9 = [];
                scores.phq9.push({
                    date: note.createdAt,
                    score: note.phq9Score
                });
            }
            if (note.gad7Score) {
                if (!scores.gad7) scores.gad7 = [];
                scores.gad7.push({
                    date: note.createdAt,
                    score: note.gad7Score
                });
            }
        });
        return scores;
    }

    calculateGoalProgress(goals) {
        const total = goals.length;
        const completed = goals.filter(goal => goal.status === 'completed').length;
        const inProgress = goals.filter(goal => goal.status === 'in_progress').length;
        
        return {
            total,
            completed,
            inProgress,
            completionRate: total > 0 ? (completed / total) * 100 : 0
        };
    }

    analyzeProgressTrends(sessionNotes, assessmentScores) {
        const trends = {
            sessionFrequency: 'stable',
            moodTrend: 'stable',
            overallProgress: 'improving'
        };
        
        // Analyze session frequency
        if (sessionNotes.length > 4) {
            const recentSessions = sessionNotes.slice(-4);
            const olderSessions = sessionNotes.slice(-8, -4);
            
            if (recentSessions.length > olderSessions.length) {
                trends.sessionFrequency = 'increasing';
            } else if (recentSessions.length < olderSessions.length) {
                trends.sessionFrequency = 'decreasing';
            }
        }
        
        // Analyze assessment trends
        if (assessmentScores.phq9 && assessmentScores.phq9.length > 2) {
            const recent = assessmentScores.phq9.slice(-2);
            const earlier = assessmentScores.phq9.slice(-4, -2);
            
            const recentAvg = recent.reduce((sum, item) => sum + item.score, 0) / recent.length;
            const earlierAvg = earlier.reduce((sum, item) => sum + item.score, 0) / earlier.length;
            
            if (recentAvg < earlierAvg) {
                trends.moodTrend = 'improving';
            } else if (recentAvg > earlierAvg) {
                trends.moodTrend = 'declining';
            }
        }
        
        return trends;
    }

    calculateAverageSessionRating(sessionNotes) {
        const ratedSessions = sessionNotes.filter(note => note.sessionRating);
        if (ratedSessions.length === 0) return null;
        
        const total = ratedSessions.reduce((sum, note) => sum + note.sessionRating, 0);
        return (total / ratedSessions.length).toFixed(1);
    }

    calculateOverallProgress(progress) {
        const factors = [];
        
        if (progress.assessmentScores.phq9 && progress.assessmentScores.phq9.length > 1) {
            const scores = progress.assessmentScores.phq9;
            const improvement = scores[0].score - scores[scores.length - 1].score;
            factors.push(improvement > 2 ? 'improving' : improvement < -2 ? 'declining' : 'stable');
        }
        
        if (progress.goalProgress.completionRate > 50) {
            factors.push('improving');
        }
        
        const improvingCount = factors.filter(f => f === 'improving').length;
        const decliningCount = factors.filter(f => f === 'declining').length;
        
        if (improvingCount > decliningCount) return 'improving';
        if (decliningCount > improvingCount) return 'declining';
        return 'stable';
    }
}

module.exports = new PsychologyService();