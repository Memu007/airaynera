import React, { useState, useEffect } from 'react';
import { Button } from '../../atoms/Button/Button';
import { Input } from '../../atoms/Input/Input';
import { Toast } from '../../molecules/Toast/Toast';

interface Consent {
  id: string;
  patientId: string;
  patientName?: string;
  professionalId: string;
  professionalName?: string;
  consentType: 'share_info' | 'treatment' | 'emergency' | 'research';
  scope: 'specific' | 'all' | 'emergency_only' | 'limited';
  status: 'active' | 'expired' | 'revoked';
  grantedAt: string;
  expiresAt?: string;
  notes?: string;
}

interface ConsentManagerProps {
  patientId?: string;
  professionalId: string;
}

export const ConsentManager: React.FC<ConsentManagerProps> = ({
  patientId,
  professionalId
}) => {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    patientId: patientId || '',
    consentType: 'share_info' as Consent['consentType'],
    scope: 'limited' as Consent['scope'],
    expiresAt: '',
    notes: ''
  });

  const [patients, setPatients] = useState<any[]>([]);

  useEffect(() => {
    if (patientId) {
      fetchConsents(patientId);
    }
    if (!patientId) {
      fetchPatients();
    }
  }, [patientId]);

  const fetchConsents = async (patientId: string) => {
    try {
      const response = await fetch(`/api/collaboration/consent/patient/${patientId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setConsents(data.data);
      } else {
        setError(data.error || 'Failed to fetch consents');
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
    if (!formData.consentType) return 'Please select a consent type';
    if (!formData.scope) return 'Please select a consent scope';
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
      const submitData = {
        ...formData,
        expiresAt: formData.expiresAt || null
      };

      const response = await fetch('/api/collaboration/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(submitData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Consent recorded successfully!');
        setFormData({
          patientId: patientId || '',
          consentType: 'share_info',
          scope: 'limited',
          expiresAt: '',
          notes: ''
        });
        setShowCreateForm(false);
        if (patientId) {
          fetchConsents(patientId);
        }
      } else {
        setError(data.error || 'Failed to record consent');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkConsent = async (patientId: string, consentType: string) => {
    try {
      const response = await fetch(`/api/collaboration/consent/check/${patientId}?consentType=${consentType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        return data.data.hasConsent;
      }
      return false;
    } catch (err) {
      console.error('Error checking consent:', err);
      return false;
    }
  };

  const getConsentTypeColor = (consentType: string) => {
    switch (consentType) {
      case 'share_info': return 'bg-blue-100 text-blue-800';
      case 'treatment': return 'bg-green-100 text-green-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'research': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'specific': return 'bg-yellow-100 text-yellow-800';
      case 'all': return 'bg-green-100 text-green-800';
      case 'emergency_only': return 'bg-red-100 text-red-800';
      case 'limited': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'revoked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isConsentExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const consentTypeOptions = [
    { 
      value: 'share_info', 
      label: 'Information Sharing',
      description: 'Allows sharing patient information with care team members'
    },
    { 
      value: 'treatment', 
      label: 'Treatment Consent',
      description: 'General consent for medical treatment'
    },
    { 
      value: 'emergency', 
      label: 'Emergency Care',
      description: 'Consent for emergency medical treatment'
    },
    { 
      value: 'research', 
      label: 'Research Participation',
      description: 'Consent for participation in clinical research'
    }
  ];

  const scopeOptions = [
    { 
      value: 'specific', 
      label: 'Specific Purpose',
      description: 'Limited to specific disclosed purpose'
    },
    { 
      value: 'limited', 
      label: 'Limited Scope',
      description: 'Limited to necessary information only'
    },
    { 
      value: 'all', 
      label: 'All Information',
      description: 'Access to all relevant medical information'
    },
    { 
      value: 'emergency_only', 
      label: 'Emergency Only',
      description: 'Only in emergency situations'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Patient Consent Management</h2>
        <Button
          variant="primary"
          onClick={() => setShowCreateForm(true)}
        >
          Record Consent
        </Button>
      </div>

      {error && <Toast message={error} type="error" />}
      {success && <Toast message={success} type="success" />}

      {/* Consent Status Summary */}
      {patientId && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {consentTypeOptions.map(type => {
            const hasActiveConsent = consents.some(c => 
              c.consentType === type.value && 
              c.status === 'active' && 
              !isConsentExpired(c.expiresAt)
            );
            
            return (
              <div 
                key={type.value}
                className={`p-4 rounded-lg border-2 ${
                  hasActiveConsent 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{type.label}</h3>
                  <div className={`w-3 h-3 rounded-full ${
                    hasActiveConsent ? 'bg-green-500' : 'bg-gray-300'
                  }`}></div>
                </div>
                <p className="text-xs text-gray-600">{type.description}</p>
                <p className="text-xs mt-2 font-medium">
                  Status: {hasActiveConsent ? '✅ Active' : '❌ Not Active'}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Consent List */}
      <div className="space-y-4 mb-6">
        {consents.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No consents recorded</div>
            <p className="text-gray-400 mt-2">
              Patient consents will appear here when recorded.
            </p>
          </div>
        ) : (
          consents.map((consent) => {
            const isExpired = isConsentExpired(consent.expiresAt);
            
            return (
              <div
                key={consent.id}
                className={`border rounded-lg p-4 ${
                  isExpired || consent.status !== 'active'
                    ? 'border-gray-200 bg-gray-50'
                    : 'border-green-200 bg-green-50'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getConsentTypeColor(consent.consentType)}`}>
                        {consent.consentType.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getScopeColor(consent.scope)}`}>
                        {consent.scope.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(consent.status)}`}>
                        {consent.status.toUpperCase()}
                        {isExpired && ' (EXPIRED)'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(consent.grantedAt)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {consent.patientName || 'Unknown Patient'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Professional: {consent.professionalName || 'Unknown'}
                    </p>
                  </div>
                </div>

                {consent.expiresAt && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">
                      Expires: {formatDate(consent.expiresAt)}
                    </span>
                    {isExpired && (
                      <span className="ml-2 text-xs text-red-600 font-medium">
                        ⚠️ EXPIRED
                      </span>
                    )}
                  </div>
                )}

                {consent.notes && (
                  <div className="mb-3">
                    <h4 className="font-medium text-gray-700 mb-1">Notes:</h4>
                    <p className="text-gray-600 text-sm">{consent.notes}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      // Handle consent actions (revoke, modify, etc.)
                      console.log('Manage consent:', consent.id);
                    }}
                    disabled={isExpired}
                  >
                    Manage Consent
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Consent Form */}
      {showCreateForm && (
        <div className="mt-6 p-6 border-2 border-blue-200 rounded-lg bg-blue-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Record Patient Consent
          </h3>

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
                  Consent Type *
                </label>
                <select
                  name="consentType"
                  value={formData.consentType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {consentTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {consentTypeOptions.find(opt => opt.value === formData.consentType)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scope *
                </label>
                <select
                  name="scope"
                  value={formData.scope}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {scopeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {scopeOptions.find(opt => opt.value === formData.scope)?.description}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expiration Date (Optional)
              </label>
              <input
                type="datetime-local"
                name="expiresAt"
                value={formData.expiresAt}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank for no expiration. Minimum recommended for sensitive information.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional context or specific terms of consent..."
              />
            </div>

            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <h4 className="font-semibold text-yellow-900">Important Legal Notice</h4>
              </div>
              <div className="text-yellow-800 mt-2 text-sm space-y-1">
                <p>• Ensure you have documented verbal or written consent from the patient</p>
                <p>• The patient should understand what they are consenting to</p>
                <p>• Record how and when consent was obtained</p>
                <p>• Patient has the right to revoke consent at any time</p>
                <p>• All consents are logged for compliance and audit purposes</p>
              </div>
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
                variant="primary"
                disabled={loading}
              >
                {loading ? 'Recording...' : 'Record Consent'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};