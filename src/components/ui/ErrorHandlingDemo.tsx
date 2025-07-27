// Demo component showing error handling and status indicators integration
import React, { useRef, useState } from 'react';
import NotificationSystem, { NotificationSystemRef } from './NotificationSystem';
import StatusDisplay, { StatusItem } from './StatusDisplay';
import StatusIndicator from './StatusIndicator';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { ErrorHandler } from '../../services/ErrorHandler';
import type { SetupError, RuntimeError, StorageError } from '../../types';
import '../../styles/error-handling-demo.scss';

export const ErrorHandlingDemo: React.FC = () => {
  const notificationRef = useRef<NotificationSystemRef>(null);
  const [statusItems, setStatusItems] = useState<StatusItem[]>([
    {
      id: 'system',
      status: 'ready',
      message: 'System Ready',
      priority: 'medium',
    },
  ]);

  const {
    showNotification,
    handleError,
    handleSuccess,
    handleWarning,
    handleInfo,
  } = useErrorHandler(notificationRef);

  const updateStatus = (id: string, status: StatusItem['status'], message: string, priority?: StatusItem['priority']) => {
    setStatusItems(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        return prev.map(item =>
          item.id === id
            ? { ...item, status, message, priority: priority || item.priority }
            : item
        );
      } else {
        return [...prev, { id, status, message, priority: priority || 'medium' }];
      }
    });
  };

  const removeStatus = (id: string) => {
    setStatusItems(prev => prev.filter(item => item.id !== id));
  };

  // Demo error handlers
  const triggerSetupError = (type: 'tenant' | 'webcam' | 'permission') => {
    const error = ErrorHandler.createSetupError(
      type,
      `Demo ${type} setup error occurred`
    );
    handleError(error);
    updateStatus('setup', 'error', `Setup Error: ${type}`, 'high');
  };

  const triggerRuntimeError = (type: 'webcam' | 'barcode' | 'recording') => {
    const error = ErrorHandler.createRuntimeError(
      type,
      `Demo ${type} runtime error occurred`
    );
    handleError(error);
    updateStatus('runtime', 'error', `Runtime Error: ${type}`, 'high');
  };

  const triggerStorageError = (type: 'local' | 's3' | 'validation') => {
    const storageError = new Error(`Demo ${type} storage error occurred`) as StorageError;
    storageError.type = type;
    handleError(storageError);
    updateStatus('storage', 'error', `Storage Error: ${type}`, 'high');
  };

  const simulateRecordingFlow = () => {
    // Simulate a recording workflow with status updates
    updateStatus('webcam', 'connecting', 'Connecting to webcam...', 'medium');

    setTimeout(() => {
      updateStatus('webcam', 'ready', 'Webcam connected', 'low');
      updateStatus('barcode', 'ready', 'Barcode detection active', 'low');
      showNotification('Webcam connected successfully', 'success');
    }, 1000);

    setTimeout(() => {
      updateStatus('recording', 'recording', 'Recording in progress', 'medium');
      showNotification('Recording started', 'info');
    }, 2000);

    setTimeout(() => {
      updateStatus('recording', 'paused', 'Recording paused', 'medium');
      showNotification('Recording paused', 'warning');
    }, 4000);

    setTimeout(() => {
      updateStatus('recording', 'ready', 'Recording stopped', 'low');
      updateStatus('storage', 'uploading', 'Uploading to storage...', 'medium');
      showNotification('Recording stopped, uploading...', 'info');
    }, 6000);

    setTimeout(() => {
      updateStatus('storage', 'success', 'Upload completed', 'low');
      showNotification('Recording uploaded successfully', 'success');
      removeStatus('recording');
    }, 8000);
  };

  const showSystemHealth = () => {
    const healthy = true; // Simplified for demo
    const stats = { total: 0, byCategory: {}, recentErrors: [] }; // Mock stats
    const suggestions: string[] = []; // Mock suggestions

    showNotification(
      `System Health: ${healthy ? 'Good' : 'Issues Detected'}`,
      healthy ? 'success' : 'warning',
      {
        persistent: true,
        actionLabel: 'View Details',
        onAction: () => {
          console.log('Error Stats:', stats);
          console.log('Recovery Suggestions:', suggestions);
          showNotification(
            `Total Errors: ${stats.total}. Check console for details.`,
            'info'
          );
        },
      }
    );

    updateStatus('health', healthy ? 'success' : 'warning',
      `System ${healthy ? 'Healthy' : 'Has Issues'}`, 'high');
  };

  return (
    <div className="error-handling-demo">
      <div className="error-handling-demo__header">
        <h2>Error Handling & Status System Demo</h2>
        <p>Demonstrates the neobrutalism error handling and status indicator system</p>
      </div>

      <div className="error-handling-demo__status">
        <h3>Current Status</h3>
        <StatusDisplay
          items={statusItems}
          layout="horizontal"
          size="medium"
          showTimestamp={true}
          onStatusClick={(item) => {
            showNotification(`Clicked status: ${item.message}`, 'info');
          }}
        />
      </div>

      <div className="error-handling-demo__controls">
        <div className="error-handling-demo__section">
          <h3>Setup Errors</h3>
          <div className="error-handling-demo__buttons">
            <button
              className="neo-button neo-button--danger"
              onClick={() => triggerSetupError('tenant')}
            >
              Tenant Error
            </button>
            <button
              className="neo-button neo-button--danger"
              onClick={() => triggerSetupError('webcam')}
            >
              Webcam Error
            </button>
            <button
              className="neo-button neo-button--danger"
              onClick={() => triggerSetupError('permission')}
            >
              Permission Error
            </button>
          </div>
        </div>

        <div className="error-handling-demo__section">
          <h3>Runtime Errors</h3>
          <div className="error-handling-demo__buttons">
            <button
              className="neo-button neo-button--danger"
              onClick={() => triggerRuntimeError('webcam')}
            >
              Webcam Error
            </button>
            <button
              className="neo-button neo-button--danger"
              onClick={() => triggerRuntimeError('barcode')}
            >
              Barcode Error
            </button>
            <button
              className="neo-button neo-button--danger"
              onClick={() => triggerRuntimeError('recording')}
            >
              Recording Error
            </button>
          </div>
        </div>

        <div className="error-handling-demo__section">
          <h3>Storage Errors</h3>
          <div className="error-handling-demo__buttons">
            <button
              className="neo-button neo-button--danger"
              onClick={() => triggerStorageError('local')}
            >
              Local Storage Error
            </button>
            <button
              className="neo-button neo-button--danger"
              onClick={() => triggerStorageError('s3')}
            >
              S3 Storage Error
            </button>
            <button
              className="neo-button neo-button--danger"
              onClick={() => triggerStorageError('validation')}
            >
              Validation Error
            </button>
          </div>
        </div>

        <div className="error-handling-demo__section">
          <h3>Workflow Simulation</h3>
          <div className="error-handling-demo__buttons">
            <button
              className="neo-button neo-button--success"
              onClick={simulateRecordingFlow}
            >
              Simulate Recording
            </button>
            <button
              className="neo-button neo-button--info"
              onClick={showSystemHealth}
            >
              Check System Health
            </button>
            <button
              className="neo-button"
              onClick={() => notificationRef.current?.clearAll()}
            >
              Clear Notifications
            </button>
          </div>
        </div>
      </div>

      <div className="error-handling-demo__individual-indicators">
        <h3>Individual Status Indicators</h3>
        <div className="error-handling-demo__indicator-grid">
          <StatusIndicator status="recording" message="Recording" pulse={true} />
          <StatusIndicator status="paused" message="Paused" />
          <StatusIndicator status="ready" message="Ready" />
          <StatusIndicator status="error" message="Error" />
          <StatusIndicator status="warning" message="Warning" />
          <StatusIndicator status="info" message="Info" />
          <StatusIndicator status="connecting" message="Connecting" pulse={true} />
          <StatusIndicator status="disconnected" message="Disconnected" />
          <StatusIndicator status="uploading" message="Uploading" pulse={true} />
          <StatusIndicator status="success" message="Success" />
        </div>
      </div>

      <NotificationSystem
        ref={notificationRef}
        position="top-right"
        maxNotifications={5}
        defaultDuration={5000}
      />
    </div>
  );
};

export default ErrorHandlingDemo;
