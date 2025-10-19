import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../stores/appStore';

// Mock data generator
const generateMockStats = () => ({
  totalPatients: Math.floor(Math.random() * 50) + 30,
  activePatients: Math.floor(Math.random() * 40) + 25,
  monthlySessions: Math.floor(Math.random() * 100) + 80,
  crisisDetected: Math.floor(Math.random() * 5) + 1,
  aiResponseRate: Math.floor(Math.random() * 10) + 90,
  patientsTrend: Math.floor(Math.random() * 20) - 10,
  sessionsTrend: Math.floor(Math.random() * 30) - 5,
  aiTrend: Math.floor(Math.random() * 10) - 5,
});

const generateMockRecentSessions = () => [
  { 
    id: '1', 
    patientName: 'Juan Pérez', 
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), 
    type: 'regular', 
    crisis: false 
  },
  { 
    id: '2', 
    patientName: 'María López', 
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), 
    type: 'followup', 
    crisis: false 
  },
  { 
    id: '3', 
    patientName: 'Carlos Rodríguez', 
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), 
    type: 'crisis', 
    crisis: true 
  },
  { 
    id: '4', 
    patientName: 'Ana Martínez', 
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), 
    type: 'regular', 
    crisis: false 
  },
  { 
    id: '5', 
    patientName: 'Pedro González', 
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), 
    type: 'regular', 
    crisis: false 
  },
];

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  isLoading?: boolean;
}> = ({ title, value, icon, trend, variant = 'default', isLoading = false }) => {
  const variantClasses = {
    default: 'bg-white border-blue-200',
    success: 'bg-white border-green-200',
    warning: 'bg-white border-yellow-200',
    danger: 'bg-white border-red-200',
  };

  const iconClasses = {
    default: 'bg-blue-100 text-blue-600',
    success: 'bg-green-100 text-green-600',
    warning: 'bg-yellow-100 text-yellow-600',
    danger: 'bg-red-100 text-red-600',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${variantClasses[variant]} border rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center">
        <div className={`${iconClasses[variant]} p-3 rounded-lg`}>
          {icon}
        </div>
        <div className="ml-5 flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {isLoading ? (
            <div className="h-8 bg-gray-200 rounded animate-pulse mt-1"></div>
          ) : (
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          )}
          
          {trend !== undefined && !isLoading && (
            <div className="flex items-center mt-1">
              {trend > 0 ? (
                <>
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span className="text-xs text-green-500 ml-1">+{trend}% vs. mes anterior</span>
                </>
              ) : trend < 0 ? (
                <>
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="text-xs text-red-500 ml-1">{trend}% vs. mes anterior</span>
                </>
              ) : (
                <span className="text-xs text-gray-500 ml-1">Sin cambios</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const RecentSessionsTable: React.FC<{ sessions: any[]; isLoading?: boolean }> = ({ sessions, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Sesiones Recientes</h3>
        </div>
        <div className="p-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 mb-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Sesiones Recientes</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paciente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.map((session) => (
              <motion.tr 
                key={session.id} 
                className="hover:bg-gray-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-aira-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-aira-primary font-medium">{session.patientName.charAt(0)}</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{session.patientName}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{new Date(session.date).toLocaleDateString()}</div>
                  <div className="text-sm text-gray-500">{new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {session.type === 'regular' && 'Regular'}
                    {session.type === 'followup' && 'Seguimiento'}
                    {session.type === 'crisis' && 'Crisis'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {session.crisis ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Crisis Detectada
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Normal
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-aira-primary hover:text-aira-secondary transition-colors">
                    Ver
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 border-t border-gray-200">
        <button className="text-sm font-medium text-aira-primary hover:text-aira-secondary transition-colors">
          Ver todas las sesiones →
        </button>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const addNotification = useAppStore((state) => state.addNotification);
  const [stats, setStats] = useState(generateMockStats());
  const [recentSessions, setRecentSessions] = useState(generateMockRecentSessions());
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Simulate data loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(generateMockStats());
      setRecentSessions(generateMockRecentSessions());
      setLastRefresh(new Date());
      
      // Show subtle notification in development
      if (process.env.NODE_ENV === 'development') {
        addNotification({
          type: 'info',
          title: 'Datos actualizados',
          message: 'Dashboard sincronizado',
          duration: 2000,
        });
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [addNotification]);

  const refreshData = () => {
    setIsLoading(true);
    setTimeout(() => {
      setStats(generateMockStats());
      setRecentSessions(generateMockRecentSessions());
      setLastRefresh(new Date());
      setIsLoading(false);
      
      addNotification({
        type: 'success',
        title: 'Datos actualizados',
        message: 'Dashboard sincronizado correctamente',
        duration: 3000,
      });
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenido, {user?.nombre || 'Doctor'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Aquí tienes un resumen de tu práctica profesional
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Última actualización: {lastRefresh.toLocaleTimeString()}
          </div>
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aira-primary disabled:opacity-50"
          >
            <svg 
              className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pacientes Activos"
          value={stats.activePatients}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>}
          trend={stats.patientsTrend}
          variant="default"
          isLoading={isLoading}
        />
        <StatCard
          title="Sesiones Este Mes"
          value={stats.monthlySessions}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>}
          trend={stats.sessionsTrend}
          variant="success"
          isLoading={isLoading}
        />
        <StatCard
          title="Crisis Detectadas"
          value={stats.crisisDetected}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>}
          variant="danger"
          isLoading={isLoading}
        />
        <StatCard
          title="Tasa de Respuesta IA"
          value={`${stats.aiResponseRate}%`}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>}
          trend={stats.aiTrend}
          variant="warning"
          isLoading={isLoading}
        />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentSessionsTable sessions={recentSessions} isLoading={isLoading} />
        </div>
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Acciones Rápidas</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center px-4 py-3 text-left text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 mr-3 text-aira-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Nuevo Paciente
              </button>
              <button className="w-full flex items-center px-4 py-3 text-left text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 mr-3 text-aira-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Nueva Sesión
              </button>
              <button className="w-full flex items-center px-4 py-3 text-left text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 mr-3 text-aira-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Ver Reportes
              </button>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Estado del Sistema</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Backend</span>
                <span className="flex items-center text-sm text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Operativo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Base de Datos</span>
                <span className="flex items-center text-sm text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Operativo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">IA Assistant</span>
                <span className="flex items-center text-sm text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Operativo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">WhatsApp Bot</span>
                <span className="flex items-center text-sm text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Operativo
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};