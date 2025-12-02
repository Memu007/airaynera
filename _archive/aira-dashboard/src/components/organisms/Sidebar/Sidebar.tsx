import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '../../../types/api';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
  onLogout?: () => void;
}

const menuItems = [
  { path: '/', icon: 'fas fa-chart-pie', label: 'Dashboard' },
  { path: '/patients', icon: 'fas fa-users', label: 'Pacientes' },
  { path: '/sessions', icon: 'fas fa-clipboard-list', label: 'Sesiones' },
  { path: '/analytics', icon: 'fas fa-chart-line', label: 'Análisis' },
  { path: '/profile', icon: 'fas fa-user-md', label: 'Mi Perfil' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, user, onLogout }) => {
  const location = useLocation();

  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.nav
        initial={false}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        className="lg:translate-x-0 fixed left-0 top-0 h-full w-64 bg-aira-dark text-white z-50 overflow-y-auto"
      >
        {/* Brand Logo */}
        <div className="p-6 border-b border-white border-opacity-10">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-aira-primary to-aira-secondary rounded-lg flex items-center justify-center mr-3">
              <span className="text-xl font-bold text-white">A</span>
            </div>
            <div>
              <h3 className="text-xl font-bold">AIRA</h3>
              <p className="text-sm text-white text-opacity-80">Panel de Salud Mental</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <ul className="mt-6 space-y-1 px-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center px-4 py-3 rounded-lg transition-all duration-200 font-medium
                    ${isActive 
                      ? 'bg-white bg-opacity-15 text-white shadow-lg backdrop-blur-sm' 
                      : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 hover:text-white'
                    }
                  `}
                >
                  <i className={`${item.icon} w-6 text-center mr-3`}></i>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>

        {/* User Profile & Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white border-opacity-10">
          {/* User Info */}
          {user && (
            <div className="p-4 border-b border-white border-opacity-10">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {user.nombre?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user.nombre || 'Usuario'}
                  </p>
                  <p className="text-xs text-white text-opacity-70 truncate">
                    {user.especialidad || 'Profesional'}
                  </p>
                </div>
                {onLogout && (
                  <button 
                    onClick={onLogout}
                    className="ml-2 text-white text-opacity-70 hover:text-white transition-colors"
                    title="Cerrar sesión"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* App Version */}
          <div className="p-4">
            <div className="text-xs text-white text-opacity-60 text-center">
              AIRA v2.0.0
              <br />
              Panel Médico Profesional
            </div>
          </div>
        </div>
      </motion.nav>
    </>
  );
};