// Hook for integrating ErrorHandler with NotificationSystem
import { useRef, useEffect, useCallback } from 'react';
import { ErrorHandler } from '../services/ErrorHandler';
import type { NotificationSystemRef } from '../components/ui/NotificationSystem';
import type { SetupError, RuntimeError, StorageError } from '../types';

export interface UseErrorHandlerOptions {
  enableLogging?: boolean;
  maxRetries?: number;
}

export interface UseErrorHandlerReturn {
  errorHandler: ErrorHandler;
  handleSetupError: (error: SetupError) => void;
  handleRuntimeError: (error: RuntimeError) => void;
  handleStorageError: (error: StorageError) => void;
  showNotification: (
    message: string,
    type: 'error' | 'warning' | 'info' | 'success',
    options?: {
      persistent?: boolean;
      actionLabel?: string;
      onAction?: () => void;
      duration?: number;
    }
  ) => string | null;
  clearAllNotifications: () => void;
  getErrorStats: () => {
    total: number;
    byCategory: Record<string, number>;
    recentErrors: Array<{ timestamp: Date; message: string; category: string }>;
  };
  isSystemHealthy: () => boolean;
  getRecoverySuggestions: () => string[];
}

export const useErrorHandler = (
  notificationSystemRef: React.RefObject<NotificationSystemRef>,
  options: UseErrorHandlerOptions = {}
): UseErrorHandlerReturn => {
  const { enableLogging = true, maxRetries = 3 } = options;
  const errorHandlerRef = useRef<ErrorHandler | null>(null);

  // Initialize ErrorHandler
  useEffect(() => {
    if (!errorHandlerRef.current) {
      errorHandlerRef.current = new ErrorHandler();
    }

    const errorHandler = errorHandlerRef.current;

    // Set up notification callback when notification system is available
    if (notificationSystemRef.current) {
      errorHandler.setNotificationCallback((message, type, options) => {
        return notificationSystemRef.current?.addNotification(message, type, options) || null;
      });
    }

    return () => {
      // Cleanup if needed
      errorHandler.clearErrorLog();
    };
  }, [notificationSystemRef]);

  // Update notification callback when ref changes
  useEffect(() => {
    if (errorHandlerRef.current && notificationSystemRef.current) {
      errorHandlerRef.current.setNotificationCallback((message, type, options) => {
        return notificationSystemRef.current?.addNotification(message, type, options) || null;
      });
    }
  }, [notificationSystemRef.current]);

  const handleSetupError = useCallback((error: SetupError) => {
    if (errorHandlerRef.current) {
      errorHandlerRef.current.handleSetupError(error);
    }

    if (enableLogging) {
      console.error('Setup Error:', error);
    }
  }, [enableLogging]);

  const handleRuntimeError = useCallback((error: RuntimeError) => {
    if (errorHandlerRef.current) {
      errorHandlerRef.current.handleRuntimeError(error);
    }

    if (enableLogging) {
      console.error('Runtime Error:', error);
    }
  }, [enableLogging]);

  const handleStorageError = useCallback((error: StorageError) => {
    if (errorHandlerRef.current) {
      errorHandlerRef.current.handleStorageError(error);
    }

    if (enableLogging) {
      console.error('Storage Error:', error);
    }
  }, [enableLogging]);

  const showNotification = useCallback((
    message: string,
    type: 'error' | 'warning' | 'info' | 'success',
    options?: {
      persistent?: boolean;
      actionLabel?: string;
      onAction?: () => void;
      duration?: number;
    }
  ): string | null => {
    if (errorHandlerRef.current) {
      errorHandlerRef.current.showUserNotification(message, type, options);
    }

    return notificationSystemRef.current?.addNotification(message, type, options) || null;
  }, [notificationSystemRef]);

  const clearAllNotifications = useCallback(() => {
    notificationSystemRef.current?.clearAll();
  }, [notificationSystemRef]);

  const getErrorStats = useCallback(() => {
    return errorHandlerRef.current?.getErrorStats() || {
      total: 0,
      byCategory: {},
      recentErrors: [],
    };
  }, []);

  const isSystemHealthy = useCallback(() => {
    return errorHandlerRef.current?.isSystemHealthy() || true;
  }, []);

  const getRecoverySuggestions = useCallback(() => {
    return errorHandlerRef.current?.getRecoverySuggestions() || [];
  }, []);

  return {
    errorHandler: errorHandlerRef.current!,
    handleSetupError,
    handleRuntimeError,
    handleStorageError,
    showNotification,
    clearAllNotifications,
    getErrorStats,
    isSystemHealthy,
    getRecoverySuggestions,
  };
};

export default useErrorHandler;
