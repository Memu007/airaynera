import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/appStore';
import { Toast } from '../molecules/Toast';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notifications, removeNotification } = useAppStore();

  return (
    <>
      {children}
      
      {/* Toast Container */}
      <div 
        aria-live="assertive" 
        className="fixed inset-0 flex items-end justify-center px-4 py-6 pointer-events-none sm:p-6 sm:items-start sm:justify-end z-50"
      >
        <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
          <AnimatePresence>
            {notifications.map((notification) => (
              <Toast
                key={notification.id}
                notification={notification}
                onRemove={removeNotification}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};