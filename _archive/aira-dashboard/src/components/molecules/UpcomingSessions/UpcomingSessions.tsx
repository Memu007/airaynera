import React from 'react';
import { Button } from '../../../components/atoms/Button/Button';

interface Session {
  id: string;
  patientId: string;
  patientName: string;
  sessionType: string;
  sessionDate: string;
  status: string;
  duration: number;
}

interface UpcomingSessionsProps {
  sessions: Session[];
  onEditSession: (sessionId: string) => void;
}

const UpcomingSessions: React.FC<UpcomingSessionsProps> = ({ 
  sessions, 
  onEditSession 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatSessionType = (type: string) => {
    // Return shorter version for display
    if (type.includes('CBT')) return 'CBT';
    if (type.includes('Psychodynamic')) return 'Psychodynamic';
    if (type.includes('Family')) return 'Family';
    return type;
  };

  const isToday = (dateString: string) => {
    const today = new Date();
    const sessionDate = new Date(dateString);
    return today.toDateString() === sessionDate.toDateString();
  };

  const isTomorrow = (dateString: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sessionDate = new Date(dateString);
    return tomorrow.toDateString() === sessionDate.toDateString();
  };

  const getRelativeTime = (dateString: string) => {
    if (isToday(dateString)) return 'Today';
    if (isTomorrow(dateString)) return 'Tomorrow';
    return new Date(dateString).toLocaleDateString();
  };

  const getTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Sessions</h3>
        <div className="text-center text-gray-500 py-8">
          <div className="text-3xl mb-2">📅</div>
          <p className="text-sm">No upcoming sessions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Upcoming Sessions</h3>
        <p className="text-sm text-gray-600">Your scheduled therapy sessions</p>
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
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-gray-600">
                        {formatSessionType(session.sessionType)}
                      </p>
                      <span className="text-gray-300">•</span>
                      <p className="text-sm text-gray-600">
                        {session.duration} min
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(session.status)}`}>
                    {session.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center space-x-2">
                  <p className="text-xs text-gray-500">
                    {getRelativeTime(session.sessionDate)} at {getTime(session.sessionDate)}
                  </p>
                  {isToday(session.sessionDate) && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                      Today
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEditSession(session.id)}
                >
                  {isToday(session.sessionDate) ? 'Start' : 'Edit'}
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

export default UpcomingSessions;