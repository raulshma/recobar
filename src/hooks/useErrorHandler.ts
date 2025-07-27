// Error handling hook that integrates with notification system
import { useCallback } from 'react';
import type { NotificationSystemRef } from '../components/ui/NotificationSystem';

export interface UseErrorHandlerReturn {
  showNotification: (
    message: string,
    type?: 'error' | 'warning' | 'info' | 'success',
    options?: {
      persistent?: boolean;
      actionLabel?: string;
      onAction?: () => void;
      duration?: number;
    }
  ) => void;
  handleError: (error: Error | unknown, context?: string) => void;
  handleSuccess: (message: string) => void;
  handleWarning: (message: string) => void;
  handleInfo: (message: string) => void;
}

export const useErrorHandler = (
  notificationSystemRef: React.RefObject<NotificationSystemRef | null>
): UseErrorHandlerReturn => {
  const showNotification = useCallback(
    (
      message: string,
      type: 'error' | 'warning' | 'info' | 'success' = 'error',
      options?: {
        persistent?: boolean;
        actionLabel?: string;
        onAction?: () => void;
        duration?: number;
      }
    ) => {
      if (notificationSystemRef.current) {
        notificationSystemRef.current.addNotification(message, type, options);
      } else {
        // Fallback to console if notification system is not available
        console[type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info'](message);
      }
    },
    [notificationSystemRef]
  );

  const handleError = useCallback(
    (error: Error | unknown, context?: string) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const fullMessage = context ? `${context}: ${errorMessage}` : errorMessage;
      
      console.error('Error:', error);
      showNotification(fullMessage, 'error', { persistent: true });
    },
    [showNotification]
  );

  const handleSuccess = useCallback(
    (message: string) => {
      showNotification(message, 'success');
    },
    [showNotification]
  );

  const handleWarning = useCallback(
    (message: string) => {
      showNotification(message, 'warning');
    },
    [showNotification]
  );

  const handleInfo = useCallback(
    (message: string) => {
      showNotification(message, 'info');
    },
    [showNotification]
  );

  return {
    showNotification,
    handleError,
    handleSuccess,
    handleWarning,
    handleInfo,
  };
};
