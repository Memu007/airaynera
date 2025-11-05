import React from 'react';
import { Button } from '../../../components/atoms/Button/Button';

interface Session {
  id: string;
  patientId: string;
  patientName: string;
  sessionType: string;
  sessionDate: string;
  status: string;
  presentingProblem?: string;
}

interface RecentSessionsProps {
  sessions: Session[];
  onViewSession: (sessionId: string) => void;
}

const RecentSessions: React.FC<RecentSessionsProps> = ({ 
  sessions, 
  onViewSession 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const formatSessionType = (type: string) => {
    // Return shorter version for display
    if (type.includes('CBT')) return 'CBT';
    if (type.includes('Psychodynamic')) return 'Psychodynamic';
    if (type.includes('Family')) return 'Family';
    return type;
  };

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Sessions</h3>
        <div className="text-center text-gray-500 py-8">
          <div className="text-3xl mb-2">🧠</div>
          <p className="text-sm">No recent sessions found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Recent Sessions</h3>
        <p className="text-sm text-gray-600">Your latest therapy sessions</p>
      </div>
      <div className="divide-y divide-gray-200">
        {sessions.slice(0, 5).map((session) => (
          <div key={session.id} className="px-6 py-4 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {session.patientName}
                    </p>
                    <p className="text-sm text-gray-600 truncate">
                      {formatSessionType(session.sessionType)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(session.status)}`}>
                    {session.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-1 flex items-center space-x-2">
                  <p className="text-xs text-gray-500">
                    {new Date(session.sessionDate).toLocaleDateString()}
                  </p>
                  {session.presentingProblem && (
                    <p className="text-xs text-gray-400 truncate">
                      • {session.presentingProblem}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewSession(session.id)}
                >
                  View
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {sessions.length > 5 && (
        <div className="px-6 py-3 border-t border-gray-200">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
          >
            View All {sessions.length} Sessions
          </Button>
        </div>
      )}
    </div>
  );
};

export default RecentSessions;