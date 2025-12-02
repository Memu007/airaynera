import React, { useState, useEffect } from 'react';
import { Button } from '../../atoms/Button/Button';
import { Toast } from '../../molecules/Toast/Toast';

interface EmergencyAlert {
  id: string;
  patientId: string;
  patientName?: string;
  reporterId: string;
  reporterName?: string;
  alertType: 'suicide_risk' | 'medical_emergency' | 'crisis' | 'medication_adverse' | 'behavioral_crisis';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  immediateAction?: string;
  status: 'active' | 'investigating' | 'resolved' | 'false_alarm';
  createdAt: string;
  updatedAt: string;
}

interface EmergencyAlertManagerProps {
  professionalId: string;
  patientId?: string;
}

export const EmergencyAlertManager: React.FC<EmergencyAlertManagerProps> = ({
  professionalId,
  patientId
}) => {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    patientId: patientId || '',
    alertType: 'crisis' as EmergencyAlert['alertType'],
    severity: 'high' as EmergencyAlert['severity'],
    description: '',
    immediateAction: ''
  });

  const [patients, setPatients] = useState<any[]>([]);

  useEffect(() => {
    fetchAlerts();
    if (!patientId) {
      fetchPatients();
    }
  }, [professionalId, patientId]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/collaboration/emergency-alerts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setAlerts(data.data);
      } else {
        setError(data.error || 'Failed to fetch emergency alerts');
      }
    } catch (err) {
      setError('Network error. Please try again.');
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
    if (!formData.patientId) return 'Please select a patient';
    if (!formData.description || formData.description.length < 10) {
      return 'Please provide detailed description (minimum 10 characters)';
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
      const response = await fetch('/api/collaboration/emergency-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Emergency alert created successfully! All team members have been notified.');
        setFormData({
          patientId: patientId || '',
          alertType: 'crisis',
          severity: 'high',
          description: '',
          immediateAction: ''
        });
        setShowCreateForm(false);
        fetchAlerts(); // Refresh the list
      } else {
        setError(data.error || 'Failed to create emergency alert');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertTypeColor = (alertType: string) => {
    switch (alertType) {
      case 'suicide_risk': return 'bg-purple-100 text-purple-800';
      case 'medical_emergency': return 'bg-red-100 text-red-800';
      case 'crisis': return 'bg-orange-100 text-orange-800';
      case 'medication_adverse': return 'bg-green-100 text-green-800';
      case 'behavioral_crisis': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const alertTypeOptions = [
    { value: 'suicide_risk', label: 'Suicide Risk', urgent: true },
    { value: 'medical_emergency', label: 'Medical Emergency', urgent: true },
    { value: 'crisis', label: 'Crisis Situation', urgent: true },
    { value: 'medication_adverse', label: 'Medication Adverse Reaction', urgent: false },
    { value: 'behavioral_crisis', label: 'Behavioral Crisis', urgent: true }
  ];

  const severityOptions = [
    { value: 'low', label: 'Low - Monitor closely', color: 'text-blue-600' },
    { value: 'medium', label: 'Medium - Contact team', color: 'text-yellow-600' },
    { value: 'high', label: 'High - Immediate action required', color: 'text-orange-600' },
    { value: 'critical', label: 'CRITICAL - Life threatening', color: 'text-red-600 font-bold' }
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Emergency Alerts</h2>
        <Button
          variant="danger"
          onClick={() => setShowCreateForm(true)}
        >
          Create Emergency Alert
        </Button>
      </div>

      {error && <Toast message={error} type="error" />}
      {success && <Toast message={success} type="success" />}

      {/* Active Alerts Summary */}
      {alerts.filter(alert => alert.status === 'active').length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900 mb-2">
            ⚠️ Active Emergency Alerts
          </h3>
          <p className="text-red-700">
            There are {alerts.filter(alert => alert.status === 'active').length} active emergency alert(s) requiring immediate attention.
          </p>
        </div>
      )}

      {/* Alert List */}
      <div className="space-y-4 mb-6">
        {alerts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No emergency alerts</div>
            <p className="text-gray-400 mt-2">
              Emergency alerts will appear here when created.
            </p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-lg p-4 ${
                alert.severity === 'critical' 
                  ? 'border-red-500 bg-red-50' 
                  : alert.status === 'active'
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getAlertTypeColor(alert.alertType)}`}>
                      {alert.alertType.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDate(alert.createdAt)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {alert.patientName || 'Unknown Patient'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Reported by: {alert.reporterName || 'Unknown Professional'}
                  </p>
                </div>
                {alert.severity === 'critical' && (
                  <div className="text-red-600">
                    <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="mb-3">
                <h4 className="font-medium text-gray-700 mb-1">Description:</h4>
                <p className="text-gray-600">{alert.description}</p>
              </div>

              {alert.immediateAction && (
                <div className="mb-3 p-3 bg-blue-50 rounded-md">
                  <h4 className="font-medium text-blue-700 mb-1">Immediate Action Taken:</h4>
                  <p className="text-blue-600">{alert.immediateAction}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  alert.status === 'active' 
                    ? 'bg-red-100 text-red-800'
                    : alert.status === 'investigating'
                      ? 'bg-yellow-100 text-yellow-800'
                      : alert.status === 'resolved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                }`}>
                  {alert.status.toUpperCase()}
                </span>
                {alert.status === 'active' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      // Handle response to alert
                      window.location.href = `/patients/${alert.patientId}`;
                    }}
                  >
                    View Patient
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Emergency Alert Form */}
      {showCreateForm && (
        <div className="mt-6 p-6 border-2 border-red-200 rounded-lg bg-red-50">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-bold text-red-900">Create Emergency Alert</h3>
          </div>

          {error && <Toast message={error} type="error" />}
          {success && <Toast message={success} type="success" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!patientId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient *
                </label>
                <select
                  name="patientId"
                  value={formData.patientId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="">Select patient in emergency</option>
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
                  Alert Type *
                </label>
                <select
                  name="alertType"
                  value={formData.alertType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  {alertTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.urgent ? '🚨 ' : ''}{option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Severity Level *
                </label>
                <select
                  name="severity"
                  value={formData.severity}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  {severityOptions.map(option => (
                    <option key={option.value} value={option.value} className={option.color}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Emergency Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Describe the emergency situation in detail..."
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Minimum 10 characters. Be specific about the situation, risks, and immediate concerns.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Immediate Action Taken (Optional)
              </label>
              <textarea
                name="immediateAction"
                value={formData.immediateAction}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Describe any immediate actions you have taken..."
              />
            </div>

            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <h4 className="font-semibold text-yellow-900">Important Notice</h4>
              </div>
              <p className="text-yellow-800 mt-2 text-sm">
                Creating an emergency alert will immediately notify all care team members. 
                Use this feature only for genuine emergency situations requiring immediate attention.
              </p>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  setError('');
                  setSuccess('');
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={loading}
              >
                {loading ? 'Creating Alert...' : '🚨 Create Emergency Alert'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};