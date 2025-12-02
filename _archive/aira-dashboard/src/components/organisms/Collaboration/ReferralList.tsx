import React, { useState, useEffect } from 'react';
import { Button } from '../../atoms/Button/Button';
import { Toast } from '../../molecules/Toast/Toast';

interface Referral {
  id: string;
  patientId: string;
  patientName?: string;
  fromUserId: string;
  fromUserName?: string;
  fromSpecialty: string;
  toUserId: string;
  toSpecialty: string;
  reasonForReferral: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  status: 'pending' | 'accepted' | 'rejected' | 'pending_review' | 'completed';
  clinicalNotes?: string;
  recommendations?: string;
  responseNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ReferralListProps {
  professionalId: string;
  viewMode: 'sent' | 'received';
  onReferralUpdate?: (referral: Referral) => void;
}

export const ReferralList: React.FC<ReferralListProps> = ({
  professionalId,
  viewMode,
  onReferralUpdate
}) => {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseNotes, setResponseNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchReferrals();
  }, [professionalId, viewMode]);

  const fetchReferrals = async () => {
    try {
      const response = await fetch(`/api/collaboration/referrals`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        // Filter based on view mode (sent/received)
        const filteredReferrals = data.data.referrals.filter((referral: Referral) => 
          viewMode === 'sent' ? referral.fromUserId === professionalId : referral.toUserId === professionalId
        );
        setReferrals(filteredReferrals);
      } else {
        setError(data.error || 'Failed to fetch referrals');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending_review': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'routine': return 'bg-gray-100 text-gray-800';
      case 'urgent': return 'bg-orange-100 text-orange-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusUpdate = async (referralId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/collaboration/referrals/${referralId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          status: newStatus,
          responseNotes: responseNotes || null
        })
      });

      const data = await response.json();

      if (data.success) {
        setReferrals(prev => prev.map(referral => 
          referral.id === referralId ? data.data : referral
        ));
        setShowResponseForm(false);
        setResponseNotes('');
        setSelectedReferral(null);
        if (onReferralUpdate) {
          onReferralUpdate(data.data);
        }
      } else {
        setError(data.error || 'Failed to update referral status');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setUpdating(false);
    }
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {viewMode === 'sent' ? 'Sent Referrals' : 'Received Referrals'}
        </h2>
        <div className="flex space-x-2">
          <span className="text-sm text-gray-500">
            Total: {referrals.length}
          </span>
        </div>
      </div>

      {error && <Toast message={error} type="error" />}

      {referrals.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">
            {viewMode === 'sent' ? 'No referrals sent' : 'No referrals received'}
          </div>
          <p className="text-gray-400 mt-2">
            {viewMode === 'sent' 
              ? 'Start referring patients to other professionals.'
              : 'Referrals from other professionals will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {referrals.map((referral) => (
            <div
              key={referral.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(referral.status)}`}>
                      {referral.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getUrgencyColor(referral.urgency)}`}>
                      {referral.urgency.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDate(referral.createdAt)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {viewMode === 'sent' 
                      ? `To: Dr. ${referral.toUserName || 'Unknown'} (${referral.toSpecialty})`
                      : `From: Dr. ${referral.fromUserName || 'Unknown'} (${referral.fromSpecialty})`
                    }
                  </h3>
                  <p className="text-sm text-gray-600">
                    Patient: {referral.patientName || 'Unknown Patient'}
                  </p>
                </div>
                {viewMode === 'received' && referral.status === 'pending' && (
                  <div className="flex space-x-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedReferral(referral);
                        setShowResponseForm(true);
                      }}
                      disabled={updating}
                    >
                      Respond
                    </Button>
                  </div>
                )}
              </div>

              <div className="mb-3">
                <h4 className="font-medium text-gray-700 mb-1">Reason for Referral:</h4>
                <p className="text-gray-600 text-sm">{referral.reasonForReferral}</p>
              </div>

              {referral.clinicalNotes && (
                <div className="mb-3">
                  <h4 className="font-medium text-gray-700 mb-1">Clinical Notes:</h4>
                  <p className="text-gray-600 text-sm">{referral.clinicalNotes}</p>
                </div>
              )}

              {referral.recommendations && (
                <div className="mb-3">
                  <h4 className="font-medium text-gray-700 mb-1">Recommendations:</h4>
                  <p className="text-gray-600 text-sm">{referral.recommendations}</p>
                </div>
              )}

              {referral.responseNotes && (
                <div className="mb-3 p-3 bg-blue-50 rounded-md">
                  <h4 className="font-medium text-blue-700 mb-1">Response Notes:</h4>
                  <p className="text-blue-600 text-sm">{referral.responseNotes}</p>
                </div>
              )}

              {showResponseForm && selectedReferral?.id === referral.id && (
                <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                  <h4 className="font-medium text-gray-700 mb-2">Add Response Notes:</h4>
                  <textarea
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                    placeholder="Add your response notes here..."
                  />
                  <div className="flex space-x-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleStatusUpdate(referral.id, 'accepted')}
                      disabled={updating || !responseNotes.trim()}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleStatusUpdate(referral.id, 'rejected')}
                      disabled={updating || !responseNotes.trim()}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowResponseForm(false);
                        setResponseNotes('');
                        setSelectedReferral(null);
                      }}
                      disabled={updating}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};