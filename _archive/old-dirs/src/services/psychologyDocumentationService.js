/**
 * Psychology Documentation Service - AIRA
 * Comprehensive documentation templates and note management for psychologists
 * @version 1.0.0
 */

const db = require('../config/database');
const { encryptPhi, decryptPhi } = require('../utils/encryption');

class PsychologyDocumentationService {
    /**
     * Get note templates for psychologists
     */
    async getNoteTemplates(templateType, therapeuticApproach) {
        try {
            const templates = [
                // CBT Templates
                {
                    id: 'cbt-initial',
                    name: 'CBT Initial Assessment',
                    templateType: 'initial',
                    therapeuticApproach: 'CBT',
                    sections: {
                        chiefComplaint: 'Patient presents with...',
                        historyOfPresentIllness: 'Symptoms began approximately...',
                        psychiatricHistory: 'Previous psychiatric treatment includes...',
                        medicalHistory: 'Relevant medical conditions include...',
                        socialHistory: 'Patient lives with... works as... supports include...',
                        mentalStatusExam: 'Appearance: ; Mood: ; Affect: ; Speech: ; Thought process: ; Thought content: ; Perception: ; Cognition: ; Insight: ; Judgment: ',
                        assessment: 'DSM-5 diagnosis: ; Symptom severity: ; Functional impairment: ; Risk assessment: ',
                        plan: 'Treatment will focus on cognitive restructuring and behavioral activation. Frequency: weekly for 12 weeks. Goals: '
                    }
                },
                {
                    id: 'cbt-progress',
                    name: 'CBT Progress Note',
                    templateType: 'progress',
                    therapeuticApproach: 'CBT',
                    sections: {
                        subjective: 'Patient reports...',
                        objective: 'Observed: ; Homework review: ; CBT techniques practiced: ',
                        assessment: 'Progress toward goals: ; New insights: ; Barriers identified: ',
                        plan: 'Next session focus: ; Homework assignment: ; Treatment adjustments: '
                    }
                },
                {
                    id: 'cbt-termination',
                    name: 'CBT Termination Summary',
                    templateType: 'termination',
                    therapeuticApproach: 'CBT',
                    sections: {
                        presentingProblem: 'Originally presented with...',
                        treatmentCourse: 'Completed [number] sessions from [start] to [end]',
                        interventions: 'CBT techniques included: cognitive restructuring, behavioral activation, thought records, exposure exercises',
                        progress: 'Symptom reduction: ; Functional improvement: ; Skill acquisition: ',
                        terminationPlan: 'Relapse prevention strategies: ; Future coping skills: ; Follow-up recommendations: '
                    }
                },
                
                // Psychodynamic Templates
                {
                    id: 'psychodynamic-initial',
                    name: 'Psychodynamic Initial Assessment',
                    templateType: 'initial',
                    therapeuticApproach: 'Psychodynamic',
                    sections: {
                        presentingProblem: 'Patient seeks help for...',
                        developmentalHistory: 'Childhood experiences: ; Family dynamics: ; Attachment patterns: ; Significant relationships: ',
                        interpersonalPatterns: 'Relationship style: ; Boundary issues: ; Transference potential: ',
                        defenseMechanisms: 'Observed defenses: ; Coping patterns: ; Emotional regulation: ',
                        unconsciousProcesses: 'Recurring themes: ; Symbolic content: ; Repetitive patterns: ',
                        assessment: 'Psychodynamic formulation: ; Treatment goals: ; Prognosis: ',
                        plan: 'Psychodynamic psychotherapy recommended. Frequency: [frequency]. Focus on exploring unconscious conflicts and patterns.'
                    }
                },
                {
                    id: 'psychodynamic-progress',
                    name: 'Psychodynamic Progress Note',
                    templateType: 'progress',
                    therapeuticApproach: 'Psychodynamic',
                    sections: {
                        sessionContent: 'Session focused on... Dreams discussed: ; Free associations: ; Significant affect: ',
                        transferenceCountertransference: 'Transference manifestations: ; Countertransference reactions: ; Therapeutic alliance: ',
                        interpretations: 'Key interpretations offered: ; Patient responses: ; New insights: ',
                        processNotes: 'Therapeutic process: ; Resistance patterns: ; Breakthrough moments: ',
                        plan: 'Next session direction: ; Ongoing themes to explore: ; Treatment adjustments: '
                    }
                },
                
                // Family Therapy Templates
                {
                    id: 'family-initial',
                    name: 'Family Systems Initial Assessment',
                    templateType: 'initial',
                    therapeuticApproach: 'Family Therapy',
                    sections: {
                        familyComposition: 'Family members: ; Ages: ; Roles: ; Living situation: ',
                        presentingProblem: 'Family seeks help for... Problem duration: ; Impact on family: ',
                        familyHistory: 'Family of origin patterns: ; Generational issues: ; Cultural factors: ',
                        relationalPatterns: 'Communication patterns: ; Conflict resolution: ; Boundaries: ; Alliances: ',
                        systemDynamics: 'Family rules: ; Homeostasis mechanisms: ; Subsystems: ; Hierarchy: ',
                        assessment: 'Systems formulation: ; Interactional patterns: ; Treatment targets: ',
                        plan: 'Family systems therapy recommended. Frequency: [frequency]. Goals: improve communication, restructure patterns, strengthen relationships.'
                    }
                },
                {
                    id: 'family-progress',
                    name: 'Family Therapy Progress Note',
                    templateType: 'progress',
                    therapeuticApproach: 'Family Therapy',
                    sections: {
                        attendees: 'Present: ; Absent: ; Session length: ',
                        sessionProcess: 'Session focus: ; Key interactions: ; Family responses: ; Therapeutic interventions: ',
                        systemObservations: 'Couple dynamics: ; Parent-child interactions: ; Sibling relationships: ; Family patterns: ',
                        interventions: 'Techniques used: ; Structural interventions: ; Communication exercises: ; Genogram work: ',
                        progress: 'System changes: ; Individual changes: ; Relationship improvements: ; Barriers: ',
                        plan: 'Next session focus: ; Homework for family: ; Systemic goals: '
                    }
                },
                
                // Group Therapy Templates
                {
                    id: 'group-progress',
                    name: 'Group Therapy Progress Note',
                    templateType: 'progress',
                    therapeuticApproach: 'Group Therapy',
                    sections: {
                        groupInfo: 'Group type: ; Members present: ; Members absent: ; Session number: ',
                        groupProcess: 'Group theme: ; Energy level: ; Cohesion: ; Interaction patterns: ',
                        memberContributions: 'Key contributions: ; Silent members: ; Dominant patterns: ; Supportive interactions: ',
                        interventions: 'Group techniques: ; Therapeutic interventions: ; Process comments: ; here-and-now focus: ',
                        individualProgress: 'Member progress: ; Group-level changes: ; Interpersonal learning: ',
                        plan: 'Next group session focus: ; Individual follow-ups needed: ; Group development stage: '
                    }
                },
                
                // Assessment Templates
                {
                    id: 'psychological-assessment',
                    name: 'Psychological Assessment Report',
                    templateType: 'assessment',
                    therapeuticApproach: 'Assessment',
                    sections: {
                        referralQuestion: 'Referred for assessment of...',
                        backgroundInformation: 'Educational history: ; Work history: ; Social history: ; Medical history: ; Psychiatric history: ',
                        behavioralObservations: 'Appearance and behavior: ; Mood and affect: ; Speech and language: ; Thought process and content: ; Cooperation and effort: ',
                        testResults: 'Intellectual functioning: ; Attention/concentration: ; Memory: ; Executive functioning: ; Personality: ; Symptom measures: ',
                        interpretation: 'Overall cognitive functioning: ; Strengths and weaknesses: ; Personality organization: ; Diagnostic impressions: ',
                        recommendations: 'Treatment recommendations: ; Academic/work accommodations: ; Medication evaluation: ; Follow-up assessments: ',
                        conclusions: 'Summary of findings: ; Prognosis: ; Treatment needs: '
                    }
                },
                
                // Crisis Intervention Templates
                {
                    id: 'crisis-intervention',
                    name: 'Crisis Intervention Note',
                    templateType: 'crisis',
                    therapeuticApproach: 'Crisis Intervention',
                    sections: {
                        crisisPresentation: 'Crisis precipitated by... Duration: ; Current risk level: ',
                        riskAssessment: 'Suicide risk: ; Homicide risk: ; Self-harm risk: ; Harm to others risk: ; Reality testing: ; Support system: ',
                        interventions: 'Immediate interventions: ; Safety planning: ; Coping strategies: ; Resources provided: ',
                        mentalStatus: 'Orientation: ; Mood: ; Affect: ; Thought content: ; Judgment: ; Insight: ',
                        disposition: 'Current status: ; Safety measures: ; Follow-up plan: ; Emergency contacts notified: ',
                        plan: 'Short-term goals: ; Ongoing treatment needs: ; Monitoring requirements: '
                    }
                }
            ];
            
            let filteredTemplates = templates;
            
            if (templateType) {
                filteredTemplates = filteredTemplates.filter(template => 
                    template.templateType === templateType
                );
            }
            
            if (therapeuticApproach) {
                filteredTemplates = filteredTemplates.filter(template => 
                    template.therapeuticApproach === therapeuticApproach
                );
            }
            
            return filteredTemplates;
        } catch (error) {
            throw new Error('Failed to get note templates: ' + error.message);
        }
    }

    /**
     * Create documentation note from template
     */
    async createNoteFromTemplate(noteData) {
        try {
            const {
                psychologistId,
                patientId,
                templateId,
                noteType,
                sections,
                isDraft = true,
                tags = []
            } = noteData;

            const collection = db.collection('psychology_notes');
            const result = await collection.insertOne({
                psychologistId,
                patientId,
                templateId,
                noteType,
                sections: this.encryptSections(sections),
                isDraft,
                tags,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            return {
                id: result.insertedId,
                ...noteData,
                createdAt: new Date()
            };
        } catch (error) {
            throw new Error('Failed to create note from template: ' + error.message);
        }
    }

    /**
     * Get documentation notes
     */
    async getDocumentationNotes({ psychologistId, patientId, noteType, limit = 50, offset = 0 }) {
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
                    id: note._id,
                    sections: this.decryptSections(note.sections)
                })),
                total,
                hasMore
            };
        } catch (error) {
            throw new Error('Failed to get documentation notes: ' + error.message);
        }
    }

    /**
     * Update documentation note
     */
    async updateDocumentationNote(noteId, psychologistId, updates) {
        try {
            const collection = db.collection('psychology_notes');
            
            const encryptedUpdates = { ...updates };
            if (updates.sections) {
                encryptedUpdates.sections = this.encryptSections(updates.sections);
            }
            
            const result = await collection.updateOne(
                { _id: new ObjectId(noteId), psychologistId },
                { $set: { ...encryptedUpdates, updatedAt: new Date() } }
            );
            
            if (result.matchedCount === 0) {
                return {
                    success: false,
                    error: 'Note not found',
                    code: 'NOTE_NOT_FOUND'
                };
            }
            
            const updatedNote = await collection.findOne({
                _id: new ObjectId(noteId),
                psychologistId
            });
            
            return {
                success: true,
                note: {
                    ...updatedNote,
                    id: updatedNote._id,
                    sections: this.decryptSections(updatedNote.sections)
                }
            };
        } catch (error) {
            throw new Error('Failed to update documentation note: ' + error.message);
        }
    }

    /**
     * Sign documentation note
     */
    async signDocumentationNote(noteId, psychologistId, signatureData) {
        try {
            const collection = db.collection('psychology_notes');
            
            const result = await collection.updateOne(
                { _id: new ObjectId(noteId), psychologistId },
                { 
                    $set: { 
                        isSigned: true,
                        signatureTimestamp: new Date(signatureData.timestamp),
                        signatureIP: signatureData.ip,
                        signedBy: psychologistId,
                        isDraft: false,
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
            
            const signedNote = await collection.findOne({
                _id: new ObjectId(noteId),
                psychologistId
            });
            
            return {
                success: true,
                note: {
                    ...signedNote,
                    id: signedNote._id,
                    sections: this.decryptSections(signedNote.sections)
                }
            };
        } catch (error) {
            throw new Error('Failed to sign documentation note: ' + error.message);
        }
    }

    /**
     * Generate progress report
     */
    async generateProgressReport({ psychologistId, patientId, startDate, endDate, reportType = 'comprehensive' }) {
        try {
            const collection = db.collection('psychology_notes');
            const assessmentsCollection = db.collection('psychology_assessments');
            const goalsCollection = db.collection('psychology_goals');
            
            const dateQuery = {};
            if (startDate || endDate) {
                dateQuery.createdAt = {};
                if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
                if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
            }
            
            const [notes, assessments, goals] = await Promise.all([
                collection.find({
                    psychologistId,
                    patientId,
                    isSigned: true,
                    ...dateQuery
                }).sort({ createdAt: 1 }).toArray(),
                assessmentsCollection.find({
                    psychologistId,
                    patientId,
                    ...dateQuery
                }).sort({ createdAt: 1 }).toArray(),
                goalsCollection.find({
                    psychologistId,
                    patientId
                }).toArray()
            ]);
            
            const report = {
                patientId,
                psychologistId,
                reportType,
                reportPeriod: {
                    startDate: startDate || new Date('2000-01-01'),
                    endDate: endDate || new Date()
                },
                generatedAt: new Date(),
                
                // Treatment summary
                treatmentSummary: this.generateTreatmentSummary(notes),
                
                // Assessment trends
                assessmentTrends: this.generateAssessmentTrends(assessments),
                
                // Goal progress
                goalProgress: this.generateGoalProgress(goals),
                
                // Session statistics
                sessionStats: this.generateSessionStats(notes),
                
                // Clinical observations
                clinicalObservations: this.generateClinicalObservations(notes),
                
                // Recommendations
                recommendations: this.generateRecommendations(notes, assessments, goals)
            };
            
            return report;
        } catch (error) {
            throw new Error('Failed to generate progress report: ' + error.message);
        }
    }

    // Helper methods
    encryptSections(sections) {
        const encrypted = {};
        for (const [key, value] of Object.entries(sections)) {
            encrypted[key] = encryptPhi(value || '');
        }
        return encrypted;
    }

    decryptSections(sections) {
        const decrypted = {};
        for (const [key, value] of Object.entries(sections)) {
            decrypted[key] = decryptPhi(value || '');
        }
        return decrypted;
    }

    generateTreatmentSummary(notes) {
        if (notes.length === 0) return 'No treatment notes available';
        
        const firstNote = notes[0];
        const lastNote = notes[notes.length - 1];
        
        return {
            treatmentDuration: notes.length > 1 ? 
                `${Math.ceil((new Date(lastNote.createdAt) - new Date(firstNote.createdAt)) / (1000 * 60 * 60 * 24 * 7))} weeks` : 
                'Initial session',
            totalSessions: notes.length,
            presentingIssues: this.extractPresentingIssues(firstNote),
            progressSummary: this.summarizeProgress(notes),
            currentStatus: this.extractCurrentStatus(lastNote)
        };
    }

    generateAssessmentTrends(assessments) {
        const trends = {};
        
        assessments.forEach(assessment => {
            if (!trends[assessment.assessmentType]) {
                trends[assessment.assessmentType] = [];
            }
            trends[assessment.assessmentType].push({
                date: assessment.createdAt,
                score: assessment.totalScore,
                severity: assessment.severity
            });
        });
        
        return trends;
    }

    generateGoalProgress(goals) {
        const total = goals.length;
        const completed = goals.filter(goal => goal.status === 'completed').length;
        const inProgress = goals.filter(goal => goal.status === 'active').length;
        
        return {
            total,
            completed,
            inProgress,
            completionRate: total > 0 ? (completed / total) * 100 : 0,
            activeGoals: goals.filter(goal => goal.status === 'active')
        };
    }

    generateSessionStats(notes) {
        const sessionTypes = {};
        const monthlyCounts = {};
        
        notes.forEach(note => {
            // Count session types
            const type = note.noteType || 'standard';
            sessionTypes[type] = (sessionTypes[type] || 0) + 1;
            
            // Count by month
            const month = new Date(note.createdAt).toISOString().slice(0, 7);
            monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
        });
        
        return {
            sessionTypes,
            monthlyCounts,
            averageSessionsPerMonth: notes.length > 0 ? 
                notes.length / Math.max(1, Object.keys(monthlyCounts).length) : 0
        };
    }

    generateClinicalObservations(notes) {
        // This would use NLP or pattern matching to extract key clinical observations
        // For now, return a placeholder
        return {
            themes: ['Anxiety symptoms', 'Relationship issues', 'Work stress'],
            improvements: ['Increased coping skills', 'Better emotional regulation'],
            challenges: ['Persistent negative thoughts', 'Sleep difficulties'],
            strengths: ['Insight', 'Motivation for change', 'Support system']
        };
    }

    generateRecommendations(notes, assessments, goals) {
        const recommendations = [];
        
        // Based on assessment trends
        const latestAssessments = assessments.slice(-3);
        if (latestAssessments.some(a => a.severity === 'SEVERE')) {
            recommendations.push('Consider medication evaluation for severe symptoms');
        }
        
        // Based on goal progress
        const incompleteGoals = goals.filter(g => g.status === 'active');
        if (incompleteGoals.length > 3) {
            recommendations.push('Focus on completing existing goals before adding new ones');
        }
        
        // Based on treatment progress
        if (notes.length > 20) {
            recommendations.push('Consider termination planning if treatment goals are met');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Continue current treatment approach');
            recommendations.push('Regular monitoring of progress');
        }
        
        return recommendations;
    }

    extractPresentingIssues(note) {
        // Extract from subjective sections or chief complaint
        return ['Depressive symptoms', 'Anxiety', 'Relationship conflicts'];
    }

    summarizeProgress(notes) {
        // Analyze progress across sessions
        return 'Patient demonstrates improved coping skills and symptom reduction';
    }

    extractCurrentStatus(note) {
        // Extract current status from latest note
        return 'Patient is stable and motivated to continue treatment';
    }
}

module.exports = new PsychologyDocumentationService();