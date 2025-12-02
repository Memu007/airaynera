import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/atoms/Button/Button';
import { Input } from '../../../components/atoms/Input/Input';
import { useApi } from '../../../hooks/useApi';

interface ClinicalNote {
  id: string;
  patientId: string;
  patientName: string;
  noteType: 'SOAP' | 'Progress' | 'Termination' | 'Intake' | 'Crisis';
  sessionData?: {
    sessionId: string;
    sessionDate: string;
    sessionType: string;
  };
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  content?: string;
  isSigned: boolean;
  signatureTimestamp?: string;
  createdAt: string;
  updatedAt?: string;
}

interface NoteTemplate {
  id: string;
  name: string;
  templateType: string;
  therapeuticApproach?: string;
  sections: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    content?: string;
  };
}

const ClinicalDocumentation: React.FC = () => {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ClinicalNote | null>(null);
  const [filters, setFilters] = useState({
    patientId: '',
    noteType: '',
    startDate: '',
    endDate: ''
  });
  const [loading, setLoading] = useState(false);

  const apiClient = useApi();

  useEffect(() => {
    loadNotes();
    loadTemplates();
  }, [filters]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      // This would need to be adjusted based on your actual API endpoints
      const response = await apiClient.get('/api/psychology/notes/all', { params: filters });
      setNotes(response.data.notes || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await apiClient.get('/api/psychology/resources/templates');
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const createSOAPNote = async (noteData: any) => {
    try {
      const response = await apiClient.post('/api/psychology/notes/soap', noteData);
      setNotes(prev => [response.data.note, ...prev]);
      setShowCreateForm(false);
      return response.data.note;
    } catch (error) {
      console.error('Error creating SOAP note:', error);
      throw error;
    }
  };

  const signNote = async (noteId: string) => {
    try {
      const response = await apiClient.post(`/api/psychology/notes/${noteId}/sign`, {
        signatureTimestamp: new Date().toISOString()
      });
      setNotes(prev => prev.map(note => 
        note.id === noteId ? response.data.note : note
      ));
      return response.data.note;
    } catch (error) {
      console.error('Error signing note:', error);
      throw error;
    }
  };

  const updateNote = async (noteId: string, updates: any) => {
    try {
      const response = await apiClient.put(`/api/psychology/notes/${noteId}`, updates);
      setNotes(prev => prev.map(note => 
        note.id === noteId ? response.data.note : note
      ));
      if (selectedNote?.id === noteId) {
        setSelectedNote(response.data.note);
      }
      return response.data.note;
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  };

  const applyTemplate = (template: NoteTemplate) => {
    if (selectedNote && template.sections) {
      const updates = { ...template.sections };
      updateNote(selectedNote.id, updates);
    }
  };

  const noteTypes = [
    { value: 'SOAP', label: 'SOAP Note' },
    { value: 'Progress', label: 'Progress Note' },
    { value: 'Termination', label: 'Termination Summary' },
    { value: 'Intake', label: 'Intake Assessment' },
    { value: 'Crisis', label: 'Crisis Note' }
  ];

  const getStatusColor = (isSigned: boolean) => {
    return isSigned 
      ? 'bg-green-100 text-green-800' 
      : 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Clinical Documentation</h2>
          <p className="text-sm text-gray-600">Manage clinical notes, SOAP documentation, and templates</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          New Note
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Filter by patient..."
            value={filters.patientId}
            onChange={(e) => setFilters(prev => ({ ...prev, patientId: e.target.value }))}
          />
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.noteType}
            onChange={(e) => setFilters(prev => ({ ...prev, noteType: e.target.value }))}
          >
            <option value="">All Types</option>
            {noteTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
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

      {/* Notes List */}
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
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Modified
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {notes.map((note) => (
                <tr key={note.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{note.patientName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{note.noteType}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(note.isSigned)}`}>
                      {note.isSigned ? 'Signed' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {note.updatedAt 
                        ? new Date(note.updatedAt).toLocaleDateString()
                        : new Date(note.createdAt).toLocaleDateString()
                      }
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedNote(note)}
                      >
                        Edit
                      </Button>
                      {!note.isSigned && (
                        <Button
                          size="sm"
                          onClick={() => signNote(note.id)}
                        >
                          Sign
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Note Modal */}
      {showCreateForm && (
        <CreateNoteModal
          onClose={() => setShowCreateForm(false)}
          onSubmit={createSOAPNote}
          noteTypes={noteTypes}
          templates={templates}
        />
      )}

      {/* Note Details/Edit Modal */}
      {selectedNote && (
        <NoteDetailsModal
          note={selectedNote}
          templates={templates}
          onClose={() => setSelectedNote(null)}
          onUpdate={updateNote}
          onSign={signNote}
          onApplyTemplate={applyTemplate}
        />
      )}
    </div>
  );
};

// Create Note Modal Component
const CreateNoteModal: React.FC<{
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  noteTypes: Array<{ value: string; label: string }>;
  templates: NoteTemplate[];
}> = ({ onClose, onSubmit, noteTypes, templates }) => {
  const [noteType, setNoteType] = useState('SOAP');
  const [formData, setFormData] = useState({
    patientId: '',
    sessionData: {
      sessionId: '',
      sessionDate: '',
      sessionType: ''
    },
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    content: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const submitData = {
        ...formData,
        noteType,
        sessionData: noteType === 'SOAP' ? formData.sessionData : undefined
      };
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Error creating note:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (template: NoteTemplate) => {
    if (template.sections) {
      setFormData(prev => ({ ...prev, ...template.sections }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Create Clinical Note</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Note Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note Type
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
            >
              {noteTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Patient Selection */}
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

          {/* Session Data for SOAP Notes */}
          {noteType === 'SOAP' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session ID
                </label>
                <Input
                  value={formData.sessionData.sessionId}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    sessionData: { ...prev.sessionData, sessionId: e.target.value }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Date
                </label>
                <Input
                  type="datetime-local"
                  value={formData.sessionData.sessionDate}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    sessionData: { ...prev.sessionData, sessionDate: e.target.value }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Type
                </label>
                <Input
                  value={formData.sessionData.sessionType}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    sessionData: { ...prev.sessionData, sessionType: e.target.value }
                  }))}
                />
              </div>
            </div>
          )}

          {/* Template Selection */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apply Template (Optional)
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                onChange={(e) => {
                  if (e.target.value) {
                    const template = templates.find(t => t.id === e.target.value);
                    if (template) applyTemplate(template);
                  }
                }}
              >
                <option value="">Select a template...</option>
                {templates
                  .filter(template => 
                    !template.templateType || template.templateType === noteType.toLowerCase()
                  )
                  .map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* SOAP Sections */}
          {noteType === 'SOAP' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subjective (S)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={formData.subjective}
                  onChange={(e) => setFormData(prev => ({ ...prev, subjective: e.target.value }))}
                  placeholder="Patient's reported symptoms, feelings, experiences..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Objective (O)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={formData.objective}
                  onChange={(e) => setFormData(prev => ({ ...prev, objective: e.target.value }))}
                  placeholder="Observable behaviors, measurements, clinician's observations..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assessment (A)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={formData.assessment}
                  onChange={(e) => setFormData(prev => ({ ...prev, assessment: e.target.value }))}
                  placeholder="Clinical diagnosis, impression, interpretation of findings..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan (P)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={formData.plan}
                  onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value }))}
                  placeholder="Treatment plan, follow-up, medications, referrals..."
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note Content
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={12}
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter note content here..."
              />
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Note'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Note Details Modal Component
const NoteDetailsModal: React.FC<{
  note: ClinicalNote;
  templates: NoteTemplate[];
  onClose: () => void;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onSign: (id: string) => Promise<void>;
  onApplyTemplate: (template: NoteTemplate) => void;
}> = ({ note, templates, onClose, onUpdate, onSign, onApplyTemplate }) => {
  const [formData, setFormData] = useState({
    subjective: note.subjective || '',
    objective: note.objective || '',
    assessment: note.assessment || '',
    plan: note.plan || '',
    content: note.content || ''
  });
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    try {
      setLoading(true);
      await onUpdate(note.id, formData);
    } catch (error) {
      console.error('Error updating note:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    try {
      setLoading(true);
      await onSign(note.id);
      onClose();
    } catch (error) {
      console.error('Error signing note:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Edit Clinical Note</h3>
              <p className="text-sm text-gray-600">
                {note.patientName} - {note.noteType} - {new Date(note.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
              note.isSigned ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {note.isSigned ? 'Signed' : 'Draft'}
            </span>
          </div>
        </div>
        
        <div className="px-6 py-4 space-y-4">
          {/* Template Selection */}
          {!note.isSigned && templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apply Template
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                onChange={(e) => {
                  if (e.target.value) {
                    const template = templates.find(t => t.id === e.target.value);
                    if (template) {
                      onApplyTemplate(template);
                      if (template.sections) {
                        setFormData(prev => ({ ...prev, ...template.sections }));
                      }
                    }
                  }
                }}
              >
                <option value="">Select a template...</option>
                {templates
                  .filter(template => 
                    !template.templateType || template.templateType === note.noteType.toLowerCase()
                  )
                  .map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* SOAP Sections */}
          {note.noteType === 'SOAP' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subjective (S)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={formData.subjective}
                  onChange={(e) => setFormData(prev => ({ ...prev, subjective: e.target.value }))}
                  disabled={note.isSigned}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Objective (O)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={formData.objective}
                  onChange={(e) => setFormData(prev => ({ ...prev, objective: e.target.value }))}
                  disabled={note.isSigned}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assessment (A)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={formData.assessment}
                  onChange={(e) => setFormData(prev => ({ ...prev, assessment: e.target.value }))}
                  disabled={note.isSigned}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan (P)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={formData.plan}
                  onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value }))}
                  disabled={note.isSigned}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note Content
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={12}
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                disabled={note.isSigned}
              />
            </div>
          )}

          {/* Signature Information */}
          {note.isSigned && note.signatureTimestamp && (
            <div className="bg-green-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-green-800">Signed Note</h4>
              <p className="text-sm text-green-700">
                This note was signed on {new Date(note.signatureTimestamp).toLocaleString()}
              </p>
              <p className="text-sm text-green-700">
                Signed notes cannot be edited.
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {!note.isSigned && (
              <>
                <Button onClick={handleUpdate} disabled={loading}>
                  {loading ? 'Updating...' : 'Update Note'}
                </Button>
                <Button onClick={handleSign} disabled={loading}>
                  {loading ? 'Signing...' : 'Sign Note'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicalDocumentation;