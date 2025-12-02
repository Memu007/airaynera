import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-blue-600">A</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Bienvenido a AIRA
          </h1>
          <p className="text-white/80 text-sm">
            Sistema de Asistencia Inteligente para Profesionales de la Salud Mental
          </p>
        </div>

        {/* Main Content */}
        <div>
          {children}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-white/60 text-sm">
            © 2025 AIRA Bot. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};