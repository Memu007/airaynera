import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useAppStore } from '../../../stores/appStore';
import { Sidebar } from '../../organisms/Sidebar/Sidebar';
import { Dashboard } from '../../../pages/Dashboard';
import { Patients } from '../../../pages/Patients';
import { Sessions } from '../../../pages/Sessions';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useAppStore();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={toggleSidebar}
                  className="lg:hidden text-gray-500 hover:text-gray-700 mr-4"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h1 className="text-2xl font-semibold text-gray-800">Dashboard AIRA</h1>
              </div>
              <div className="flex items-center space-x-4">
                <button className="text-gray-500 hover:text-gray-700">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-aira-primary rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-white">
                      {user?.nombre?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-700 hidden md:block">
                    {user?.nombre || 'Usuario'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="patients" element={<Patients />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="profile" element={<div>Profile Page - Coming Soon</div>} />
            <Route path="settings" element={<div>Settings Page - Coming Soon</div>} />
          </Routes>
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};