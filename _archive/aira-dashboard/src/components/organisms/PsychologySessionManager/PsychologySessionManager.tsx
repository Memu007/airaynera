import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/atoms/Button/Button';
import { Input } from '../../../components/atoms/Input/Input';
import { useApi } from '../../../hooks/useApi';
import { AudioRecorder } from '../../../components/molecules/AudioRecorder/AudioRecorder';

interface Session {
  id: string;
  patientId: string;
  patientName: string;
  sessionType: string;
  sessionDate: string;
  duration: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  presentingProblem?: string;
  sessionNotes?: string;
  interventions?: string;
  homeworkAssigned?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  audioRecording?: {
    id: string;
    filename: string;
    duration: number;
    recordedAt: string;
  };
}

interface NewSession {
  patientId: string;
  sessionType: string;
  sessionDate: string;
  duration: number;
  presentingProblem: string;
  therapeuticApproach: string;
  sessionGoals: string;
}

const PsychologySessionManager: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    patientId: '',
    status: '',
    sessionType: '',
    startDate: '',
    endDate: ''
  });

  const apiClient = useApi();

  useEffect(() => {
    loadSessions();
  }, [filters]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/psychology/sessions', { params: filters });
      setSessions(response.data.sessions || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (sessionData: NewSession) => {
    try {
      const response = await apiClient.post('/api/psychology/sessions', sessionData);
      setSessions(prev => [response.data.session, ...prev]);
      setShowCreateForm(false);
      return response.data.session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  };

  const updateSession = async (sessionId: string, updates: Partial<Session>) => {
    try {
      const response = await apiClient.put(`/api/psychology/sessions/${sessionId}`, updates);
      setSessions(prev => prev.map(session => 
        session.id === sessionId ? response.data.session : session
      ));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(response.data.session);
      }
      return response.data.session;
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  };

  const startSession = async (sessionId: string) => {
    await updateSession(sessionId, {
      status: 'in_progress',
      actualStartTime: new Date().toISOString()
    });
  };

  const completeSession = async (sessionId: string, sessionData: any) => {
    await updateSession(sessionId, {
      status: 'completed',
      actualEndTime: new Date().toISOString(),
      ...sessionData
    });
  };

  const handleAudioUpload = async (sessionId: string, audioFile: File, metadata: any) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('duration', metadata.duration);
      formData.append('recordedAt', metadata.recordedAt);

      const response = await apiClient.post(`/api/psychology/sessions/${sessionId}/audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, audioRecording: response.data.audioRecording }
          : session
      ));

      return response.data.audioRecording;
    } catch (error) {
      console.error('Error uploading audio:', error);
      throw error;
    }
  };

  const sessionTypes = [
    'Individual Therapy',
    'CBT Session',
    'Psychodynamic Therapy',
    'Family Therapy',
    'Group Therapy',
    'Assessment',
    'Crisis Intervention',
    'Termination Session'
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Therapy Sessions</h2>
          <p className="text-sm text-gray-600">Manage your therapy sessions and recordings</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          New Session
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Input
            placeholder="Filter by patient..."
            value={filters.patientId}
            onChange={(e) => setFilters(prev => ({ ...prev, patientId: e.target.value }))}
          />
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.sessionType}
            onChange={(e) => setFilters(prev => ({ ...prev, sessionType: e.target.value }))}
          >
            <option value="">All Types</option>
            {sessionTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <Input
            type="date"
            placeholder="Start date"
            value={filters.startDate}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
          />
          <Input
            type="date"
            placeholder="End date"
            value={filters.endDate}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Audio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{session.patientName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{session.sessionType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(session.sessionDate).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(session.sessionDate).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDuration(session.duration)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(session.status)}`}>
                      {session.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.audioRecording ? (
                      <button
                        onClick={() => {/* Handle audio playback */}}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        🎵 {formatDuration(session.audioRecording.duration)}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">No recording</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {session.status === 'scheduled' && (
                        <Button
                          size="sm"
                          onClick={() => startSession(session.id)}
                        >
                          Start
                        </Button>
                      )}
                      {session.status === 'in_progress' && (
                        <>
                          <AudioRecorder
                            sessionId={session.id}
                            onRecordingComplete={(audioFile, metadata) => 
                              handleAudioUpload(session.id, audioFile, metadata)
                            }
                          />
                          <Button
                            size="sm"
                            onClick={() => setSelectedSession(session)}
                          >
                            Complete
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSession(session)}
                      >
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateForm && (
        <CreateSessionModal
          onClose={() => setShowCreateForm(false)}
          onSubmit={createSession}
          sessionTypes={sessionTypes}
        />
      )}

      {/* Session Details/Edit Modal */}
      {selectedSession && (
        <SessionDetailsModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onUpdate={updateSession}
          onComplete={completeSession}
        />
      )}
    </div>
  );
};

// Create Session Modal Component
const CreateSessionModal: React.FC<{
  onClose: () => void;
  onSubmit: (data: NewSession) => Promise<void>;
  sessionTypes: string[];
}> = ({ onClose, onSubmit, sessionTypes }) => {
  const [formData, setFormData] = useState<NewSession>({
    patientId: '',
    sessionType: sessionTypes[0],
    sessionDate: '',
    duration: 50,
    presentingProblem: '',
    therapeuticApproach: '',
    sessionGoals: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Create New Session</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient ID
            </label>
            <Input
              required
              value={formData.patientId}
              onChange={(e) => setFormData(prev => ({ ...prev, patientId: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Type
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.sessionType}
              onChange={(e) => setFormData(prev => ({ ...prev, sessionType: e.target.value }))}
              required
            >
              {sessionTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Date & Time
            </label>
            <Input
              type="datetime-local"
              required
              value={formData.sessionDate}
              onChange={(e) => setFormData(prev => ({ ...prev, sessionDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <Input
              type="number"
              min="15"
              max="180"
              required
              value={formData.duration}
              onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Presenting Problem
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.presentingProblem}
              onChange={(e) => setFormData(prev => ({ ...prev, presentingProblem: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Therapeutic Approach
            </label>
            <Input
              value={formData.therapeuticApproach}
              onChange={(e) => setFormData(prev => ({ ...prev, therapeuticApproach: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Goals
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.sessionGoals}
              onChange={(e) => setFormData(prev => ({ ...prev, sessionGoals: e.target.value }))}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Session'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Session Details Modal Component
const SessionDetailsModal: React.FC<{
  session: Session;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Session>) => Promise<void>;
  onComplete: (id: string, data: any) => Promise<void>;
}> = ({ session, onClose, onUpdate, onComplete }) => {
  const [formData, setFormData] = useState({
    sessionNotes: session.sessionNotes || '',
    interventions: session.interventions || '',
    homeworkAssigned: session.homeworkAssigned || ''
  });
  const [loading, setLoading] = useState(false);

  const handleCompleteSession = async () => {
    try {
      setLoading(true);
      await onComplete(session.id, formData);
      onClose();
    } catch (error) {
      console.error('Error completing session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Session Details</h3>
          <p className="text-sm text-gray-600">
            {session.patientName} - {session.sessionType}
          </p>
        </div>
        
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Notes
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={6}
              value={formData.sessionNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, sessionNotes: e.target.value }))}
              placeholder="Document key themes, interventions, and patient responses..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interventions Used
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              value={formData.interventions}
              onChange={(e) => setFormData(prev => ({ ...prev, interventions: e.target.value }))}
              placeholder="Describe therapeutic techniques and interventions used..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Homework Assigned
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.homeworkAssigned}
              onChange={(e) => setFormData(prev => ({ ...prev, homeworkAssigned: e.target.value }))}
              placeholder="Assign homework or practice exercises..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {session.status === 'in_progress' && (
              <Button onClick={handleCompleteSession} disabled={loading}>
                {loading ? 'Completing...' : 'Complete Session'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PsychologySessionManager;