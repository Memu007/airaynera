import React, { useState, useEffect } from 'react';
import { Button } from '../../atoms/Button/Button';
import { Input } from '../../atoms/Input/Input';
import { Toast } from '../../molecules/Toast/Toast';

interface CareTeamMember {
  userId: string;
  userName?: string;
  role: 'primary' | 'psychologist' | 'psychiatrist' | 'therapist' | 'counselor' | 'member';
  specialty?: string;
  addedAt: string;
}

interface CareTeam {
  id: string;
  patientId: string;
  patientName?: string;
  primaryProfessionalId: string;
  teamName: string;
  members: CareTeamMember[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    priority: 'primary' | 'secondary';
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CareTeamManagerProps {
  patientId?: string;
  professionalId: string;
  onCareTeamUpdate?: (careTeam: CareTeam) => void;
}

export const CareTeamManager: React.FC<CareTeamManagerProps> = ({
  patientId,
  professionalId,
  onCareTeamUpdate
}) => {
  const [careTeam, setCareTeam] = useState<CareTeam | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    patientId: patientId || '',
    teamName: '',
    members: [] as Omit<CareTeamMember, 'addedAt'>[],
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      priority: 'primary' as 'primary' | 'secondary'
    }
  });

  const [availableProfessionals, setAvailableProfessionals] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  useEffect(() => {
    if (patientId) {
      fetchCareTeam(patientId);
    }
    fetchProfessionals();
    if (!patientId) {
      fetchPatients();
    }
  }, [patientId]);

  const fetchCareTeam = async (patientId: string) => {
    try {
      const response = await fetch(`/api/collaboration/care-teams/patients/${patientId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setCareTeam(data.data);
      } else {
        setError(data.error || 'Failed to fetch care team');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const fetchProfessionals = async () => {
    try {
      const response = await fetch('/api/users/professionals', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setAvailableProfessionals(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch professionals:', err);
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
    
    if (name.startsWith('emergencyContact.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        emergencyContact: {
          ...prev.emergencyContact,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const addTeamMember = () => {
    setFormData(prev => ({
      ...prev,
      members: [...prev.members, { userId: '', role: 'member', specialty: '' }]
    }));
  };

  const removeTeamMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index)
    }));
  };

  const updateTeamMember = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.map((member, i) =>
        i === index ? { ...member, [field]: value } : member
      )
    }));
  };

  const validateForm = () => {
    if (!formData.patientId) return 'Please select a patient';
    if (!formData.teamName.trim()) return 'Please provide a team name';
    if (formData.members.length === 0) return 'Please add at least one team member';
    
    for (const member of formData.members) {
      if (!member.userId) return 'Please select a professional for all team members';
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
      const response = await fetch('/api/collaboration/care-teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Care team created successfully!');
        setCareTeam(data.data);
        setShowCreateForm(false);
        if (onCareTeamUpdate) {
          onCareTeamUpdate(data.data);
        }
      } else {
        setError(data.error || 'Failed to create care team');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'primary', label: 'Primary Professional' },
    { value: 'psychologist', label: 'Psychologist' },
    { value: 'psychiatrist', label: 'Psychiatrist' },
    { value: 'therapist', label: 'Therapist' },
    { value: 'counselor', label: 'Counselor' },
    { value: 'member', label: 'Team Member' }
  ];

  const specialtyOptions = [
    { value: 'psychology', label: 'Psychology' },
    { value: 'psychiatry', label: 'Psychiatry' },
    { value: 'general_practice', label: 'General Practice' },
    { value: 'neurology', label: 'Neurology' },
    { value: 'other', label: 'Other' }
  ];

  if (careTeam) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {careTeam.teamName}
          </h2>
          <Button
            variant="primary"
            onClick={() => setShowCreateForm(true)}
          >
            Update Team
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Members */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
            <div className="space-y-3">
              {careTeam.members.map((member, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">
                      {member.userName || 'Unknown Professional'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {member.role.replace('_', ' ')} - {member.specialty || 'Not specified'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Added: {new Date(member.addedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    member.role === 'primary' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {member.role.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h3>
            {careTeam.emergencyContact ? (
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="font-medium text-red-900 mb-2">
                  {careTeam.emergencyContact.name}
                </div>
                <div className="text-sm text-red-700 mb-1">
                  Relationship: {careTeam.emergencyContact.relationship}
                </div>
                <div className="text-sm text-red-700 mb-1">
                  Phone: {careTeam.emergencyContact.phone}
                </div>
                <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                  {careTeam.emergencyContact.priority.toUpperCase()} CONTACT
                </span>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                No emergency contact specified
              </div>
            )}
          </div>
        </div>

        {showCreateForm && (
          <CareTeamForm
            formData={formData}
            setFormData={setFormData}
            availableProfessionals={availableProfessionals}
            patients={patients}
            loading={loading}
            onSubmit={handleSubmit}
            onCancel={() => setShowCreateForm(false)}
            error={error}
            success={success}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Care Team Management</h2>
        {!patientId && (
          <Button
            variant="primary"
            onClick={() => setShowCreateForm(true)}
          >
            Create Care Team
          </Button>
        )}
      </div>

      {error && <Toast message={error} type="error" />}
      {success && <Toast message={success} type="success" />}

      {!patientId ? (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">
            Select a patient to manage their care team
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-4">
            No care team exists for this patient
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateForm(true)}
          >
            Create Care Team
          </Button>
        </div>
      )}

      {showCreateForm && (
        <CareTeamForm
          formData={formData}
          setFormData={setFormData}
          availableProfessionals={availableProfessionals}
          patients={patients}
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => setShowCreateForm(false)}
          error={error}
          success={success}
        />
      )}
    </div>
  );
};

// Separate component for the form
interface CareTeamFormProps {
  formData: any;
  setFormData: (data: any) => void;
  availableProfessionals: any[];
  patients: any[];
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  error: string;
  success: string;
}

const CareTeamForm: React.FC<CareTeamFormProps> = ({
  formData,
  setFormData,
  availableProfessionals,
  patients,
  loading,
  onSubmit,
  onCancel,
  error,
  success
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('emergencyContact.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        emergencyContact: {
          ...prev.emergencyContact,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const addTeamMember = () => {
    setFormData(prev => ({
      ...prev,
      members: [...prev.members, { userId: '', role: 'member', specialty: '' }]
    }));
  };

  const removeTeamMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index)
    }));
  };

  const updateTeamMember = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.map((member, i) =>
        i === index ? { ...member, [field]: value } : member
      )
    }));
  };

  const roleOptions = [
    { value: 'primary', label: 'Primary Professional' },
    { value: 'psychologist', label: 'Psychologist' },
    { value: 'psychiatrist', label: 'Psychiatrist' },
    { value: 'therapist', label: 'Therapist' },
    { value: 'counselor', label: 'Counselor' },
    { value: 'member', label: 'Team Member' }
  ];

  const specialtyOptions = [
    { value: 'psychology', label: 'Psychology' },
    { value: 'psychiatry', label: 'Psychiatry' },
    { value: 'general_practice', label: 'General Practice' },
    { value: 'neurology', label: 'Neurology' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="mt-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {formData.patientId ? 'Update Care Team' : 'Create Care Team'}
      </h3>
      
      {error && <Toast message={error} type="error" />}
      {success && <Toast message={success} type="success" />}

      <form onSubmit={onSubmit} className="space-y-4">
        {!formData.patientId && (
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
              <option value="">Select a patient</option>
              {patients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} - {patient.dni}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Team Name *
          </label>
          <input
            type="text"
            name="teamName"
            value={formData.teamName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Patient Care Team - Johnson Family"
            required
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Team Members *
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addTeamMember}
            >
              Add Member
            </Button>
          </div>
          <div className="space-y-2">
            {formData.members.map((member: any, index: number) => (
              <div key={index} className="flex items-center space-x-2 p-3 bg-white rounded-md">
                <select
                  value={member.userId}
                  onChange={(e) => updateTeamMember(index, 'userId', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select professional</option>
                  {availableProfessionals.map(prof => (
                    <option key={prof.id} value={prof.id}>
                      Dr. {prof.name} - {prof.specialty}
                    </option>
                  ))}
                </select>
                <select
                  value={member.role}
                  onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {roleOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => removeTeamMember(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-700 mb-3">Emergency Contact</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              name="emergencyContact.name"
              value={formData.emergencyContact.name}
              onChange={handleInputChange}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Contact name"
            />
            <input
              type="text"
              name="emergencyContact.relationship"
              value={formData.emergencyContact.relationship}
              onChange={handleInputChange}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Relationship to patient"
            />
            <input
              type="tel"
              name="emergencyContact.phone"
              value={formData.emergencyContact.phone}
              onChange={handleInputChange}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Phone number"
            />
            <select
              name="emergencyContact.priority"
              value={formData.emergencyContact.priority}
              onChange={handleInputChange}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="primary">Primary Contact</option>
              <option value="secondary">Secondary Contact</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Care Team'}
          </Button>
        </div>
      </form>
    </div>
  );
};