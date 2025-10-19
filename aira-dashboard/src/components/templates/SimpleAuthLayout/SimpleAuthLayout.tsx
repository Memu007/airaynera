import React from 'react';
import { motion } from 'framer-motion';

interface SimpleAuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
}

export const SimpleAuthLayout: React.FC<SimpleAuthLayoutProps> = ({
  children,
  title = "Bienvenido a AIRA",
  subtitle = "Sistema de Asistencia Inteligente para Profesionales de la Salud Mental",
  showLogo = true,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-aira-primary via-aira-secondary to-blue-600 flex items-center justify-center p-4">
      {/* Simple background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full blur-xl"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-white rounded-full blur-2xl"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-white rounded-full blur-xl"></div>
        <div className="absolute top-1/4 right-1/3 w-24 h-24 bg-white rounded-full blur-xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        {showLogo && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl font-bold bg-gradient-to-r from-aira-primary to-aira-secondary bg-clip-text text-transparent">
                A
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {title}
            </h1>
            <p className="text-white/80 text-sm leading-relaxed">
              {subtitle}
            </p>
          </motion.div>
        )}

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {children}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 text-center"
        >
          <p className="text-white/60 text-sm">
            © 2025 AIRA Bot. Todos los derechos reservados.
          </p>
          <div className="flex justify-center space-x-6 mt-4">
            <a 
              href="mailto:soporte@aira.com" 
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              Soporte
            </a>
            <a 
              href="#" 
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              Privacidad
            </a>
            <a 
              href="#" 
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              Términos
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};