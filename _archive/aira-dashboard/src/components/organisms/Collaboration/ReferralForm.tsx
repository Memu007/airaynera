import React, { useState, useEffect } from 'react';
import { Button } from '../../atoms/Button/Button';
import { Input } from '../../atoms/Input/Input';
import { Toast } from '../../molecules/Toast/Toast';

interface ReferralFormProps {
  onReferralCreated: (referral: any) => void;
  onCancel: () => void;
  patients: any[];
  professionals: any[];
}

export const ReferralForm: React.FC<ReferralFormProps> = ({
  onReferralCreated,
  onCancel,
  patients,
  professionals
}) => {
  const [formData, setFormData] = useState({
    patientId: '',
    toUserId: '',
    fromSpecialty: '',
    toSpecialty: '',
    reasonForReferral: '',
    urgency: 'routine',
    clinicalNotes: '',
    recommendations: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.patientId) return 'Please select a patient';
    if (!formData.toUserId) return 'Please select a professional to refer to';
    if (!formData.fromSpecialty) return 'Please specify your specialty';
    if (!formData.toSpecialty) return 'Please specify the target specialty';
    if (!formData.reasonForReferral || formData.reasonForReferral.length < 10) {
      return 'Please provide a detailed reason for referral (min 10 characters)';
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
      const response = await fetch('/api/collaboration/referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Referral created successfully!');
        onReferralCreated(data.data);
        setTimeout(() => {
          setFormData({
            patientId: '',
            toUserId: '',
            fromSpecialty: '',
            toSpecialty: '',
            reasonForReferral: '',
            urgency: 'routine',
            clinicalNotes: '',
            recommendations: ''
          });
          setSuccess('');
        }, 2000);
      } else {
        setError(data.error || 'Failed to create referral');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const specialtyOptions = [
    { value: 'psychology', label: 'Psychology' },
    { value: 'psychiatry', label: 'Psychiatry' },
    { value: 'general_practice', label: 'General Practice' },
    { value: 'neurology', label: 'Neurology' },
    { value: 'other', label: 'Other' }
  ];

  const urgencyOptions = [
    { value: 'routine', label: 'Routine (1-2 weeks)' },
    { value: 'urgent', label: 'Urgent (24-48 hours)' },
    { value: 'emergency', label: 'Emergency (Immediate)' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Create Patient Referral</h2>
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>

      {error && <Toast message={error} type="error" />}
      {success && <Toast message={success} type="success" />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Patient Selection */}
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

          {/* Professional to Refer To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Refer To *
            </label>
            <select
              name="toUserId"
              value={formData.toUserId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a professional</option>
              {professionals.map(prof => (
                <option key={prof.id} value={prof.id}>
                  Dr. {prof.name} - {prof.specialty}
                </option>
              ))}
            </select>
          </div>

          {/* From Specialty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Specialty *
            </label>
            <select
              name="fromSpecialty"
              value={formData.fromSpecialty}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select your specialty</option>
              {specialtyOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* To Specialty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Specialty *
            </label>
            <select
              name="toSpecialty"
              value={formData.toSpecialty}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select target specialty</option>
              {specialtyOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Urgency Level *
            </label>
            <select
              name="urgency"
              value={formData.urgency}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {urgencyOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reason for Referral */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Referral *
          </label>
          <textarea
            name="reasonForReferral"
            value={formData.reasonForReferral}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Please provide detailed reasons for this referral..."
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Minimum 10 characters. Be specific about symptoms, duration, and why referral is needed.
          </p>
        </div>

        {/* Clinical Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Clinical Notes (Optional)
          </label>
          <textarea
            name="clinicalNotes"
            value={formData.clinicalNotes}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Relevant clinical history, current medications, previous treatments..."
          />
          <p className="text-sm text-gray-500 mt-1">
            Maximum 2000 characters. Include information relevant to the referral.
          </p>
        </div>

        {/* Recommendations */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recommendations (Optional)
          </label>
          <textarea
            name="recommendations"
            value={formData.recommendations}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Specific questions for the receiving professional or suggested approaches..."
          />
          <p className="text-sm text-gray-500 mt-1">
            Maximum 1000 characters.
          </p>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
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
            {loading ? 'Creating Referral...' : 'Create Referral'}
          </Button>
        </div>
      </form>
    </div>
  );
};