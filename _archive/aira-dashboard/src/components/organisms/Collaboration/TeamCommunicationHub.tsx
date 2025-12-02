import React, { useState, useEffect } from 'react';
import { Button } from '../../atoms/Button/Button';
import { Toast } from '../../molecules/Toast/Toast';

interface TeamMessage {
  id: string;
  fromUserId: string;
  fromUserName?: string;
  careTeamId: string;
  patientId: string;
  patientName?: string;
  message: string;
  messageType: 'general' | 'urgent' | 'clinical_update' | 'coordination' | 'emergency';
  priority: 'normal' | 'high' | 'urgent';
  status: 'active';
  createdAt: string;
}

interface TeamCommunicationHubProps {
  professionalId: string;
  careTeamId?: string;
  patientId?: string;
}

export const TeamCommunicationHub: React.FC<TeamCommunicationHubProps> = ({
  professionalId,
  careTeamId,
  patientId
}) => {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [replyingTo, setReplyingTo] = useState<TeamMessage | null>(null);
  
  const [formData, setFormData] = useState({
    careTeamId: careTeamId || '',
    patientId: patientId || '',
    message: '',
    messageType: 'general' as TeamMessage['messageType'],
    priority: 'normal' as TeamMessage['priority']
  });

  const [careTeams, setCareTeams] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  useEffect(() => {
    if (careTeamId) {
      fetchMessages(careTeamId);
    }
    fetchCareTeams();
    if (!patientId) {
      fetchPatients();
    }
  }, [careTeamId, patientId]);

  const fetchMessages = async (teamId: string) => {
    try {
      const response = await fetch(`/api/collaboration/team-messages/${teamId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setMessages(data.data.messages);
      } else {
        setError(data.error || 'Failed to fetch messages');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const fetchCareTeams = async () => {
    try {
      // This would need an endpoint to get care teams for the professional
      // For now, we'll use a placeholder
      setCareTeams([]);
    } catch (err) {
      console.error('Failed to fetch care teams:', err);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await fetch('/api/patients', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setPatients(data.data.patients || []);
      }
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.careTeamId) return 'Please select a care team';
    if (!formData.patientId) return 'Please select a patient';
    if (!formData.message || formData.message.trim().length < 1) {
      return 'Please enter a message';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/collaboration/team-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Message sent successfully!');
        setFormData({
          careTeamId: careTeamId || '',
          patientId: patientId || '',
          message: '',
          messageType: 'general',
          priority: 'normal'
        });
        setShowMessageForm(false);
        setReplyingTo(null);
        
        if (careTeamId) {
          fetchMessages(careTeamId);
        }
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMessageTypeColor = (messageType: string) => {
    switch (messageType) {
      case 'general': return 'bg-blue-100 text-blue-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'clinical_update': return 'bg-green-100 text-green-800';
      case 'coordination': return 'bg-purple-100 text-purple-800';
      case 'emergency': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'normal': return 'bg-gray-100 text-gray-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isRecent = (dateString: string) => {
    const messageTime = new Date(dateString).getTime();
    const now = new Date().getTime();
    const diffInHours = (now - messageTime) / (1000 * 60 * 60);
    return diffInHours < 1;
  };

  const messageTypeOptions = [
    { value: 'general', label: 'General Communication', icon: '💬' },
    { value: 'urgent', label: 'Urgent Message', icon: '🚨' },
    { value: 'clinical_update', label: 'Clinical Update', icon: '🏥' },
    { value: 'coordination', label: 'Care Coordination', icon: '🤝' },
    { value: 'emergency', label: 'Emergency', icon: '🆘' }
  ];

  const priorityOptions = [
    { value: 'normal', label: 'Normal Priority', color: 'text-gray-600' },
    { value: 'high', label: 'High Priority', color: 'text-orange-600' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600 font-bold' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Team Communication Hub</h2>
        <div className="flex space-x-2">
          <Button
            variant="primary"
            onClick={() => setShowMessageForm(true)}
          >
            Send Message
          </Button>
        </div>
      </div>

      {error && <Toast message={error} type="error" />}
      {success && <Toast message={success} type="success" />}

      {/* Communication Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{messages.length}</div>
          <div className="text-sm text-blue-800">Total Messages</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-600">
            {messages.filter(m => m.priority === 'urgent').length}
          </div>
          <div className="text-sm text-red-800">Urgent Messages</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {messages.filter(m => isRecent(m.createdAt)).length}
          </div>
          <div className="text-sm text-green-800">Recent (Last Hour)</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {messages.filter(m => m.messageType === 'clinical_update').length}
          </div>
          <div className="text-sm text-purple-800">Clinical Updates</div>
        </div>
      </div>

      {/* Message List */}
      <div className="space-y-4 mb-6">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No messages yet</div>
            <p className="text-gray-400 mt-2">
              Start communicating with your care team here.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`border rounded-lg p-4 ${
                message.priority === 'urgent' 
                  ? 'border-red-300 bg-red-50' 
                  : message.priority === 'high'
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getMessageTypeColor(message.messageType)}`}>
                      {messageTypeOptions.find(opt => opt.value === message.messageType)?.icon}{' '}
                      {message.messageType.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(message.priority)}`}>
                      {message.priority.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDate(message.createdAt)}
                    </span>
                    {isRecent(message.createdAt) && (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="flex items-center mb-1">
                    <h3 className="font-semibold text-gray-900 mr-2">
                      {message.fromUserName || 'Unknown Professional'}
                    </h3>
                    <span className="text-sm text-gray-600">
                      regarding {message.patientName || 'Unknown Patient'}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setReplyingTo(message);
                      setShowMessageForm(true);
                      setFormData(prev => ({
                        ...prev,
                        careTeamId: message.careTeamId,
                        patientId: message.patientId,
                        messageType: 'general',
                        priority: 'normal'
                      }));
                    }}
                  >
                    Reply
                  </Button>
                </div>
              </div>

              <div className="bg-white p-3 rounded-md border border-gray-200">
                <p className="text-gray-700 whitespace-pre-wrap">{message.message}</p>
              </div>

              {replyingTo?.id === message.id && (
                <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                  <div className="text-sm text-blue-700 mb-2">
                    Replying to {message.fromUserName}'s message:
                  </div>
                  <div className="text-sm text-gray-600 italic">
                    "{message.message.substring(0, 100)}{message.message.length > 100 ? '...' : ''}"
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Send Message Form */}
      {showMessageForm && (
        <div className="mt-6 p-6 border-2 border-blue-200 rounded-lg bg-blue-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {replyingTo ? `Reply to ${replyingTo.fromUserName}` : 'Send Team Message'}
          </h3>

          {error && <Toast message={error} type="error" />}
          {success && <Toast message={success} type="success" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!careTeamId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Care Team *
                </label>
                <select
                  name="careTeamId"
                  value={formData.careTeamId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select care team</option>
                  {careTeams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.teamName} - {team.patientName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!patientId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient *
                </label>
                <select
                  name="patientId"
                  value={formData.patientId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select patient</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} - {patient.dni}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message Type *
                </label>
                <select
                  name="messageType"
                  value={formData.messageType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {messageTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.icon} {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority *
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {priorityOptions.map(option => (
                    <option key={option.value} value={option.value} className={option.color}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message *
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={replyingTo 
                  ? `Type your reply to ${replyingTo.fromUserName}...`
                  : "Type your message to the care team..."
                }
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Be clear and concise. All team members will be notified.
              </p>
            </div>

            {formData.messageType === 'emergency' && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <h4 className="font-semibold text-red-900">Emergency Message</h4>
                </div>
                <p className="text-red-800 mt-2 text-sm">
                  This will send an urgent notification to all care team members. Use only for true emergencies requiring immediate attention.
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowMessageForm(false);
                  setReplyingTo(null);
                  setError('');
                  setSuccess('');
                  setFormData({
                    careTeamId: careTeamId || '',
                    patientId: patientId || '',
                    message: '',
                    messageType: 'general',
                    priority: 'normal'
                  });
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={formData.messageType === 'emergency' ? 'danger' : 'primary'}
                disabled={loading}
              >
                {loading 
                  ? 'Sending...' 
                  : formData.messageType === 'emergency'
                    ? '🚨 Send Emergency Message'
                    : 'Send Message'
                }
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};