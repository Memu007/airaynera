import React, { useState, useEffect } from 'react';
import { ReferralForm } from './ReferralForm';
import { ReferralList } from './ReferralList';
import { CareTeamManager } from './CareTeamManager';
import { EmergencyAlertManager } from './EmergencyAlertManager';
import { TeamCommunicationHub } from './TeamCommunicationHub';
import { ConsentManager } from './ConsentManager';
import { Button } from '../../atoms/Button/Button';
import { Toast } from '../../molecules/Toast/Toast';

interface CollaborationDashboardProps {
  professionalId: string;
}

export const CollaborationDashboard: React.FC<CollaborationDashboardProps> = ({
  professionalId
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Component state
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [referralViewMode, setReferralViewMode] = useState<'sent' | 'received'>('received');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, [refreshTrigger]);

  const fetchInitialData = async () => {
    try {
      // Fetch patients and professionals for forms
      const [patientsResponse, professionalsResponse] = await Promise.all([
        fetch('/api/patients', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('/api/users/professionals', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const patientsData = await patientsResponse.json();
      const professionalsData = await professionalsResponse.json();

      if (patientsData.success) {
        setPatients(patientsData.data.patients || []);
      }

      if (professionalsData.success) {
        setProfessionals(professionalsData.data || []);
      }

    } catch (err) {
      setError('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const handleReferralCreated = () => {
    setShowReferralForm(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCareTeamUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const tabs = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: '📊',
      description: 'Collaboration summary and quick actions'
    },
    { 
      id: 'referrals', 
      label: 'Referrals', 
      icon: '🔄',
      description: 'Manage patient referrals'
    },
    { 
      id: 'care-teams', 
      label: 'Care Teams', 
      icon: '👥',
      description: 'Manage patient care teams'
    },
    { 
      id: 'communication', 
      label: 'Communication', 
      icon: '💬',
      description: 'Team messaging and coordination'
    },
    { 
      id: 'emergency', 
      label: 'Emergency', 
      icon: '🚨',
      description: 'Emergency alerts and coordination'
    },
    { 
      id: 'consent', 
      label: 'Consent', 
      icon: '✅',
      description: 'Patient consent management'
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab 
          professionalId={professionalId}
          onNavigate={(tab) => setActiveTab(tab)}
          selectedPatient={selectedPatient}
          onSelectPatient={setSelectedPatient}
        />;
      
      case 'referrals':
        return (
          <div className="space-y-6">
            {showReferralForm ? (
              <ReferralForm
                onReferralCreated={handleReferralCreated}
                onCancel={() => setShowReferralForm(false)}
                patients={patients}
                professionals={professionals}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Referrals Management</h2>
                  <Button
                    variant="primary"
                    onClick={() => setShowReferralForm(true)}
                  >
                    Create Referral
                  </Button>
                </div>
                
                <div className="flex space-x-4 mb-6 border-b">
                  <button
                    className={`pb-2 px-4 font-medium ${
                      referralViewMode === 'received'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setReferralViewMode('received')}
                  >
                    Received ({referrals.filter(r => r.toUserId === professionalId).length})
                  </button>
                  <button
                    className={`pb-2 px-4 font-medium ${
                      referralViewMode === 'sent'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setReferralViewMode('sent')}
                  >
                    Sent ({referrals.filter(r => r.fromUserId === professionalId).length})
                  </button>
                </div>
                
                <ReferralList
                  professionalId={professionalId}
                  viewMode={referralViewMode}
                  onReferralUpdate={handleReferralCreated}
                />
              </div>
            )}
          </div>
        );
      
      case 'care-teams':
        return (
          <CareTeamManager
            patientId={selectedPatient || undefined}
            professionalId={professionalId}
            onCareTeamUpdate={handleCareTeamUpdate}
          />
        );
      
      case 'communication':
        return (
          <TeamCommunicationHub
            professionalId={professionalId}
            patientId={selectedPatient || undefined}
          />
        );
      
      case 'emergency':
        return (
          <EmergencyAlertManager
            professionalId={professionalId}
            patientId={selectedPatient || undefined}
          />
        );
      
      case 'consent':
        return (
          <ConsentManager
            patientId={selectedPatient || undefined}
            professionalId={professionalId}
          />
        );
      
      default:
        return <div>Tab not found</div>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Collaboration Center
          </h1>
          <p className="text-gray-600">
            Coordinate care with other healthcare professionals for comprehensive patient treatment
          </p>
        </div>

        {error && <Toast message={error} type="error" />}

        {/* Patient Selection */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">
              Focus Patient (Optional):
            </label>
            <select
              value={selectedPatient || ''}
              onChange={(e) => setSelectedPatient(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Patients</option>
              {patients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} - {patient.dni}
                </option>
              ))}
            </select>
            {selectedPatient && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedPatient(null)}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="flex flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`flex-1 min-w-[120px] px-4 py-4 text-center border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="text-2xl mb-1">{tab.icon}</div>
                <div className="font-medium">{tab.label}</div>
                <div className="text-xs text-gray-500 mt-1">{tab.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="space-y-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

// Overview Tab Component
interface OverviewTabProps {
  professionalId: string;
  onNavigate: (tab: string) => void;
  selectedPatient: string | null;
  onSelectPatient: (patientId: string | null) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  professionalId,
  onNavigate,
  selectedPatient,
  onSelectPatient
}) => {
  const [stats, setStats] = useState({
    referralsReceived: 0,
    referralsSent: 0,
    activeCareTeams: 0,
    urgentMessages: 0,
    emergencyAlerts: 0,
    pendingConsents: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [professionalId, selectedPatient]);

  const fetchStats = async () => {
    // This would typically call a stats endpoint
    // For now, we'll use placeholder data
    setTimeout(() => {
      setStats({
        referralsReceived: 12,
        referralsSent: 8,
        activeCareTeams: 15,
        urgentMessages: 3,
        emergencyAlerts: 1,
        pendingConsents: 5
      });
      setLoading(false);
    }, 1000);
  };

  const quickActions = [
    {
      title: 'Create Referral',
      description: 'Refer patient to another specialist',
      icon: '🔄',
      action: () => onNavigate('referrals')
    },
    {
      title: 'Emergency Alert',
      description: 'Create emergency alert for patient',
      icon: '🚨',
      action: () => onNavigate('emergency')
    },
    {
      title: 'Team Message',
      description: 'Send message to care team',
      icon: '💬',
      action: () => onNavigate('communication')
    },
    {
      title: 'Manage Care Team',
      description: 'Organize patient care team',
      icon: '👥',
      action: () => onNavigate('care-teams')
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <span className="text-2xl">🔄</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Referrals</h3>
              <p className="text-2xl font-bold text-blue-600">
                {stats.referralsReceived} received / {stats.referralsSent} sent
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <span className="text-2xl">👥</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Care Teams</h3>
              <p className="text-2xl font-bold text-green-600">
                {stats.activeCareTeams} active
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-full">
              <span className="text-2xl">💬</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Urgent Messages</h3>
              <p className="text-2xl font-bold text-orange-600">
                {stats.urgentMessages} pending
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full">
              <span className="text-2xl">🚨</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Emergency Alerts</h3>
              <p className="text-2xl font-bold text-red-600">
                {stats.emergencyAlerts} active
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Pending Consents</h3>
              <p className="text-2xl font-bold text-purple-600">
                {stats.pendingConsents} needed
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow text-left group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                {action.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {action.title}
              </h3>
              <p className="text-sm text-gray-600">
                {action.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity Summary */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-center p-3 bg-blue-50 rounded-lg">
            <span className="text-2xl mr-3">🔄</span>
            <div>
              <p className="font-medium text-gray-900">New referral received</p>
              <p className="text-sm text-gray-600">From Dr. Smith for patient John Doe - 2 hours ago</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-green-50 rounded-lg">
            <span className="text-2xl mr-3">👥</span>
            <div>
              <p className="font-medium text-gray-900">Care team updated</p>
              <p className="text-sm text-gray-600">Sarah Johnson added to Jane Smith's team - 4 hours ago</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-orange-50 rounded-lg">
            <span className="text-2xl mr-3">💬</span>
            <div>
              <p className="font-medium text-gray-900">Urgent team message</p>
              <p className="text-sm text-gray-600">Medication update needed for patient Mike Brown - 5 hours ago</p>
            </div>
          </div>
          
          {stats.emergencyAlerts > 0 && (
            <div className="flex items-center p-3 bg-red-50 rounded-lg border border-red-200">
              <span className="text-2xl mr-3 animate-pulse">🚨</span>
              <div>
                <p className="font-medium text-red-900">Active emergency alert</p>
                <p className="text-sm text-red-700">Crisis intervention required for patient Alex Johnson - 30 minutes ago</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Mock referrals data for overview
const referrals = [
  { id: '1', fromUserId: 'user1', toUserId: 'user2', status: 'pending' },
  { id: '2', fromUserId: 'user3', toUserId: 'user1', status: 'accepted' },
  { id: '3', fromUserId: 'user1', toUserId: 'user4', status: 'completed' }
];