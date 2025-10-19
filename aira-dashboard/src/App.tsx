import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import { useAuthStore } from './stores/authStore';
import { LoginForm } from './components/organisms/LoginForm/LoginForm';
import { ProtectedRoute } from './components/organisms/ProtectedRoute';
import { SimpleAuthLayout } from './components/templates/SimpleAuthLayout';
import { AuthProvider } from './components/providers/AuthProvider';
import { NotificationProvider } from './components/providers/NotificationProvider';
import { DashboardLayout } from './components/templates/DashboardLayout';
import { useStoreInitialization } from './hooks/useStoreInitialization';
import { useBackgroundSync } from './hooks/useBackgroundSync';

const LoginPage = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <SimpleAuthLayout>
      <LoginForm />
    </SimpleAuthLayout>
  );
};

function App() {
  // Initialize all stores
  const { isInitialized } = useStoreInitialization();
  
  // Initialize background sync
  useBackgroundSync();

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route 
                path="/*" 
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
