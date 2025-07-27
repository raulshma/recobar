// Notification system with neobrutalism design
import React, { useState, useEffect, useCallback } from 'react';
import '../../styles/notification-system.scss';

export interface Notification {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  persistent?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number; // in milliseconds
  timestamp: Date;
}

export interface NotificationSystemProps {
  maxNotifications?: number;
  defaultDuration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  className?: string;
}

export interface NotificationSystemRef {
  addNotification: (
    message: string,
    type: 'error' | 'warning' | 'info' | 'success',
    options?: {
      persistent?: boolean;
      actionLabel?: string;
      onAction?: () => void;
      duration?: number;
    }
  ) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const NotificationSystem = React.forwardRef<NotificationSystemRef, NotificationSystemProps>(
  ({
    maxNotifications = 5,
    defaultDuration = 5000,
    position = 'top-right',
    className = ''
  }, ref) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback((
      message: string,
      type: 'error' | 'warning' | 'info' | 'success',
      options?: {
        persistent?: boolean;
        actionLabel?: string;
        onAction?: () => void;
        duration?: number;
      }
    ): string => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const notification: Notification = {
        id,
        message,
        type,
        persistent: options?.persistent || false,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
        duration: options?.duration || defaultDuration,
        timestamp: new Date(),
      };

      setNotifications(prev => {
        const updated = [notification, ...prev];
        // Keep only the most recent notifications
        return updated.slice(0, maxNotifications);
      });

      // Auto-remove non-persistent notifications
      if (!notification.persistent) {
        setTimeout(() => {
          removeNotification(id);
        }, notification.duration);
      }

      return id;
    }, [maxNotifications, defaultDuration]);

    const removeNotification = useCallback((id: string) => {
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    }, []);

    const clearAll = useCallback(() => {
      setNotifications([]);
    }, []);

    // Expose methods through ref
    React.useImperativeHandle(ref, () => ({
      addNotification,
      removeNotification,
      clearAll,
    }), [addNotification, removeNotification, clearAll]);

    const getNotificationIcon = (type: Notification['type']): string => {
      switch (type) {
        case 'error':
          return '✕';
        case 'warning':
          return '⚠';
        case 'info':
          return 'ℹ';
        case 'success':
          return '✓';
        default:
          return 'ℹ';
      }
    };

    const handleNotificationClick = (notification: Notification) => {
      if (notification.onAction) {
        notification.onAction();
      }
    };

    const handleDismiss = (id: string, event: React.MouseEvent) => {
      event.stopPropagation();
      removeNotification(id);
    };

    if (notifications.length === 0) {
      return null;
    }

    const containerClasses = [
      'neo-notification-system',
      `neo-notification-system--${position}`,
      className,
    ].filter(Boolean).join(' ');

    return (
      <div className={containerClasses}>
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`neo-notification neo-notification--${notification.type} ${
              notification.onAction ? 'neo-notification--clickable' : ''
            }`}
            onClick={() => handleNotificationClick(notification)}
          >
            <div className="neo-notification__content">
              <div className="neo-notification__header">
                <span className="neo-notification__icon">
                  {getNotificationIcon(notification.type)}
                </span>
                <span className="neo-notification__type">
                  {notification.type.toUpperCase()}
                </span>
                <button
                  className="neo-notification__dismiss"
                  onClick={(e) => handleDismiss(notification.id, e)}
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
              <div className="neo-notification__message">
                {notification.message}
              </div>
              {notification.actionLabel && (
                <div className="neo-notification__actions">
                  <button
                    className="neo-notification__action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (notification.onAction) {
                        notification.onAction();
                      }
                    }}
                  >
                    {notification.actionLabel}
                  </button>
                </div>
              )}
              {notification.persistent && (
                <div className="neo-notification__persistent-indicator">
                  PERSISTENT
                </div>
              )}
            </div>
            {!notification.persistent && (
              <div
                className="neo-notification__progress"
                style={{
                  animationDuration: `${notification.duration}ms`,
                }}
              />
            )}
          </div>
        ))}
        {notifications.length > 1 && (
          <div className="neo-notification-system__actions">
            <button
              className="neo-notification-system__clear-all"
              onClick={clearAll}
            >
              Clear All ({notifications.length})
            </button>
          </div>
        )}
      </div>
    );
  }
);

NotificationSystem.displayName = 'NotificationSystem';

export default NotificationSystem;
