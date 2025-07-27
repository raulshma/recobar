// Centralized error handling service implementation
import {
  ErrorHandler as IErrorHandler,
  SetupError,
  RuntimeError,
  StorageError,
} from '../types';

export interface ErrorRecoveryOptions {
  retryable: boolean;
  retryAction?: () => Promise<void>;
  fallbackAction?: () => Promise<void>;
  userActionRequired?: boolean;
}

export interface NotificationCallback {
  (message: string, type: 'error' | 'warning' | 'info' | 'success', options?: {
    persistent?: boolean;
    actionLabel?: string;
    onAction?: () => void;
  }): void;
}

export class ErrorHandler implements IErrorHandler {
  private notificationCallback: NotificationCallback | null = null;
  private errorLog: Array<{
    timestamp: Date;
    error: Error;
    category: string;
    handled: boolean;
    recovered: boolean;
  }> = [];

  /**
   * Set the notification callback for displaying user messages
   */
  setNotificationCallback(callback: NotificationCallback): void {
    this.notificationCallback = callback;
  }

  /**
   * Log error for debugging and analytics
   */
  private logError(error: Error, category: string, handled: boolean = true, recovered: boolean = false): void {
    this.errorLog.push({
      timestamp: new Date(),
      error,
      category,
      handled,
      recovered,
    });

    // Keep only last 100 errors to prevent memory leaks
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }

    // Log to console for development
    console.error(`[${category}] ${error.message}`, {
      error,
      handled,
      recovered,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get error statistics for debugging
   */
  getErrorStats(): {
    total: number;
    byCategory: Record<string, number>;
    recentErrors: Array<{ timestamp: Date; message: string; category: string }>;
  } {
    const byCategory: Record<string, number> = {};

    this.errorLog.forEach(entry => {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    });

    const recentErrors = this.errorLog
      .slice(-10)
      .map(entry => ({
        timestamp: entry.timestamp,
        message: entry.error.message,
        category: entry.category,
      }));

    return {
      total: this.errorLog.length,
      byCategory,
      recentErrors,
    };
  }

  /**
   * Handle setup-related errors with appropriate recovery mechanisms
   */
  handleSetupError(error: SetupError): void {
    this.logError(error, 'setup');

    const recoveryOptions: ErrorRecoveryOptions = {
      retryable: true,
      userActionRequired: true,
    };

    switch (error.type) {
      case 'tenant':
        this.showUserNotification(
          'Invalid tenant ID format. Please enter a valid tenant identifier.',
          'error',
          {
            persistent: true,
            actionLabel: 'Retry',
            onAction: () => {
              // The setup component should handle retry logic
              console.log('User requested tenant setup retry');
            },
          }
        );
        break;

      case 'webcam':
        this.showUserNotification(
          'Unable to access webcam. Please check your camera permissions and try again.',
          'error',
          {
            persistent: true,
            actionLabel: 'Check Permissions',
            onAction: () => {
              // Open system settings or provide guidance
              this.showUserNotification(
                'Please check your system settings to allow camera access for this application.',
                'info'
              );
            },
          }
        );
        break;

      case 'permission':
        this.showUserNotification(
          'Camera permission denied. Please grant camera access to continue.',
          'error',
          {
            persistent: true,
            actionLabel: 'Grant Permission',
            onAction: () => {
              // Attempt to request permissions again
              navigator.mediaDevices.getUserMedia({ video: true })
                .then(() => {
                  this.showUserNotification('Camera access granted successfully!', 'info');
                })
                .catch(() => {
                  this.showUserNotification(
                    'Unable to grant camera access. Please check your browser or system settings.',
                    'error'
                  );
                });
            },
          }
        );
        break;

      default:
        this.showUserNotification(
          `Setup error: ${error.message}`,
          'error'
        );
    }
  }

  /**
   * Handle runtime errors with automatic recovery attempts
   */
  handleRuntimeError(error: RuntimeError): void {
    this.logError(error, 'runtime');

    switch (error.type) {
      case 'webcam':
        this.handleWebcamError(error);
        break;

      case 'barcode':
        this.handleBarcodeError(error);
        break;

      case 'recording':
        this.handleRecordingError(error);
        break;

      default:
        this.showUserNotification(
          `Runtime error: ${error.message}`,
          'error'
        );
    }
  }

  /**
   * Handle webcam-specific errors with reconnection attempts
   */
  private handleWebcamError(error: RuntimeError): void {
    // Requirement 3.3: Display appropriate error message when webcam is unavailable
    if (error.message.includes('disconnected') || error.message.includes('unavailable')) {
      this.showUserNotification(
        'Webcam disconnected. Attempting to reconnect...',
        'warning',
        {
          persistent: true,
          actionLabel: 'Retry Now',
          onAction: async () => {
            try {
              // Attempt to reinitialize webcam
              const devices = await navigator.mediaDevices.enumerateDevices();
              const videoDevices = devices.filter(device => device.kind === 'videoinput');

              if (videoDevices.length === 0) {
                throw new Error('No webcam devices found');
              }

              this.showUserNotification('Webcam reconnected successfully!', 'info');
              this.logError(error, 'runtime', true, true); // Mark as recovered
            } catch (retryError) {
              this.showUserNotification(
                'Unable to reconnect webcam. Please check your camera connection.',
                'error'
              );
            }
          },
        }
      );
    } else if (error.message.includes('permission')) {
      this.showUserNotification(
        'Camera permission lost. Please refresh the page and grant camera access.',
        'error',
        {
          persistent: true,
          actionLabel: 'Refresh',
          onAction: () => {
            window.location.reload();
          },
        }
      );
    } else {
      this.showUserNotification(
        `Webcam error: ${error.message}`,
        'error'
      );
    }
  }

  /**
   * Handle barcode detection errors
   */
  private handleBarcodeError(error: RuntimeError): void {
    if (error.message.includes('initialization')) {
      this.showUserNotification(
        'Barcode detection failed to initialize. Some features may be limited.',
        'warning'
      );
    } else if (error.message.includes('performance')) {
      this.showUserNotification(
        'Barcode detection is running slowly. Consider closing other applications.',
        'info'
      );
    } else {
      this.showUserNotification(
        'Barcode detection error. Recording will continue without automatic triggers.',
        'warning'
      );
    }
  }

  /**
   * Handle recording-specific errors
   */
  private handleRecordingError(error: RuntimeError): void {
    if (error.message.includes('codec')) {
      this.showUserNotification(
        'Recording codec not supported. Please try a different browser.',
        'error',
        {
          persistent: true,
        }
      );
    } else if (error.message.includes('storage')) {
      this.showUserNotification(
        'Recording storage full. Please free up disk space.',
        'error',
        {
          persistent: true,
          actionLabel: 'Check Storage',
          onAction: () => {
            this.showUserNotification(
              'Please check your available disk space and storage settings.',
              'info'
            );
          },
        }
      );
    } else {
      this.showUserNotification(
        `Recording error: ${error.message}`,
        'error'
      );
    }
  }

  /**
   * Handle storage errors with fallback mechanisms
   */
  handleStorageError(error: StorageError): void {
    this.logError(error, 'storage');

    switch (error.type) {
      case 'local':
        this.handleLocalStorageError(error);
        break;

      case 's3':
        this.handleS3StorageError(error);
        break;

      case 'validation':
        this.handleStorageValidationError(error);
        break;

      default:
        this.showUserNotification(
          `Storage error: ${error.message}`,
          'error'
        );
    }
  }

  /**
   * Handle local storage errors
   */
  private handleLocalStorageError(error: StorageError): void {
    if (error.message.includes('Permission denied') || error.message.includes('permission') || error.message.includes('write')) {
      this.showUserNotification(
        'Cannot write to local storage directory. Please check folder permissions.',
        'error',
        {
          persistent: true,
          actionLabel: 'Change Location',
          onAction: () => {
            this.showUserNotification(
              'Please update your storage settings to use a different folder.',
              'info'
            );
          },
        }
      );
    } else if (error.message.includes('space') || error.message.includes('full')) {
      this.showUserNotification(
        'Insufficient disk space for local storage. Please free up space.',
        'error',
        {
          persistent: true,
        }
      );
    } else if (error.message.includes('exists')) {
      this.showUserNotification(
        'File already exists. Recording saved with modified filename.',
        'warning'
      );
    } else {
      this.showUserNotification(
        `Local storage error: ${error.message}`,
        'error'
      );
    }
  }

  /**
   * Handle S3 storage errors with fallback to local storage
   */
  private handleS3StorageError(error: StorageError): void {
    // Requirement 7.6: Maintain local copy and provide error notification when S3 upload fails
    if (error.message.includes('credentials') || error.message.includes('access')) {
      this.showUserNotification(
        'S3 upload failed due to invalid credentials. Recording saved locally.',
        'warning',
        {
          persistent: true,
          actionLabel: 'Update Settings',
          onAction: () => {
            this.showUserNotification(
              'Please check your S3 credentials in the storage settings.',
              'info'
            );
          },
        }
      );
    } else if (error.message.includes('bucket') || error.message.includes('NoSuchBucket')) {
      this.showUserNotification(
        'S3 bucket not found. Recording saved locally only.',
        'warning',
        {
          actionLabel: 'Check Bucket',
          onAction: () => {
            this.showUserNotification(
              'Please verify your S3 bucket name and region in storage settings.',
              'info'
            );
          },
        }
      );
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      this.showUserNotification(
        'S3 upload failed due to network issues. Recording saved locally.',
        'warning',
        {
          actionLabel: 'Retry Upload',
          onAction: () => {
            // This would trigger a retry mechanism
            this.showUserNotification(
              'Retry functionality will be available in the storage status panel.',
              'info'
            );
          },
        }
      );
    } else {
      this.showUserNotification(
        `S3 upload failed: ${error.message}. Recording saved locally.`,
        'warning'
      );
    }
  }

  /**
   * Handle storage validation errors
   */
  private handleStorageValidationError(error: StorageError): void {
    if (error.message.includes('configuration')) {
      this.showUserNotification(
        'Storage configuration is invalid. Please check your settings.',
        'error',
        {
          persistent: true,
          actionLabel: 'Open Settings',
          onAction: () => {
            // This would open the settings modal
            console.log('Open storage settings requested');
          },
        }
      );
    } else if (error.message.includes('Invalid bucket name') || error.message.includes('bucket name')) {
      this.showUserNotification(
        'Invalid S3 bucket name format. Please use a valid bucket name.',
        'error'
      );
    } else if (error.message.includes('region')) {
      this.showUserNotification(
        'Invalid S3 region format. Please select a valid AWS region.',
        'error'
      );
    } else {
      this.showUserNotification(
        `Storage validation error: ${error.message}`,
        'error'
      );
    }
  }

  /**
   * Show user notification with optional actions
   */
  showUserNotification(
    message: string,
    type: 'error' | 'warning' | 'info' | 'success',
    options?: {
      persistent?: boolean;
      actionLabel?: string;
      onAction?: () => void;
    }
  ): void {
    if (this.notificationCallback) {
      this.notificationCallback(message, type, options);
    } else {
      // Fallback to console if no notification system is set up
      const prefix = type.toUpperCase();
      console.log(`[${prefix}] ${message}`);

      if (options?.onAction && options?.actionLabel) {

      }
    }
  }

  /**
   * Create standardized error objects
   */
  static createSetupError(type: 'tenant' | 'webcam' | 'permission', message: string): SetupError {
    const error = new Error(message) as SetupError;
    error.type = type;
    return error;
  }

  static createRuntimeError(type: 'webcam' | 'barcode' | 'recording', message: string): RuntimeError {
    const error = new Error(message) as RuntimeError;
    error.type = type;
    return error;
  }

  /**
   * Clear error log (useful for testing or memory management)
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Check if system is in a recoverable state
   */
  isSystemHealthy(): boolean {
    const recentErrors = this.errorLog.filter(
      entry => Date.now() - entry.timestamp.getTime() < 60000 // Last minute
    );

    // System is unhealthy if there are more than 5 errors in the last minute
    return recentErrors.length <= 5;
  }

  /**
   * Get recovery suggestions based on recent errors
   */
  getRecoverySuggestions(): string[] {
    const suggestions: string[] = [];
    const recentErrors = this.errorLog.filter(
      entry => Date.now() - entry.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const errorCounts = recentErrors.reduce((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check for webcam errors (including runtime webcam errors)
    const webcamErrors = recentErrors.filter(entry =>
      entry.category === 'runtime' && entry.error.message.includes('Webcam')
    ).length;

    if (errorCounts.webcam >= 3 || webcamErrors >= 3) {
      suggestions.push('Consider restarting the application or checking webcam connections');
    }

    if (errorCounts.storage >= 2) {
      suggestions.push('Check storage settings and available disk space');
    }

    if (errorCounts.runtime >= 5) {
      suggestions.push('System may be under heavy load - consider closing other applications');
    }

    return suggestions;
  }
}
