// Tests for the ErrorHandler service
import { ErrorHandler } from '../services/ErrorHandler';
import type { SetupError, RuntimeError, StorageError } from '../types';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockNotificationCallback: jest.Mock;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    mockNotificationCallback = jest.fn();
    errorHandler.setNotificationCallback(mockNotificationCallback);
  });

  afterEach(() => {
    errorHandler.clearErrorLog();
  });

  describe('Setup Error Handling', () => {
    it('should handle tenant setup errors', () => {
      const error = ErrorHandler.createSetupError('tenant', 'Invalid tenant ID');

      errorHandler.handleSetupError(error);

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        'Invalid tenant ID format. Please enter a valid tenant identifier.',
        'error',
        expect.objectContaining({
          persistent: true,
          actionLabel: 'Retry',
        })
      );
    });

    it('should handle webcam setup errors', () => {
      const error = ErrorHandler.createSetupError('webcam', 'Webcam not found');

      errorHandler.handleSetupError(error);

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        'Unable to access webcam. Please check your camera permissions and try again.',
        'error',
        expect.objectContaining({
          persistent: true,
          actionLabel: 'Check Permissions',
        })
      );
    });

    it('should handle permission setup errors', () => {
      const error = ErrorHandler.createSetupError('permission', 'Permission denied');

      errorHandler.handleSetupError(error);

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        'Camera permission denied. Please grant camera access to continue.',
        'error',
        expect.objectContaining({
          persistent: true,
          actionLabel: 'Grant Permission',
        })
      );
    });
  });

  describe('Runtime Error Handling', () => {
    it('should handle webcam runtime errors', () => {
      const error = ErrorHandler.createRuntimeError('webcam', 'Webcam disconnected');

      errorHandler.handleRuntimeError(error);

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        'Webcam disconnected. Attempting to reconnect...',
        'warning',
        expect.objectContaining({
          persistent: true,
          actionLabel: 'Retry Now',
        })
      );
    });

    it('should handle barcode detection errors', () => {
      const error = ErrorHandler.createRuntimeError('barcode', 'Barcode initialization failed');

      errorHandler.handleRuntimeError(error);

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        'Barcode detection failed to initialize. Some features may be limited.',
        'warning',
        undefined
      );
    });

    it('should handle recording errors', () => {
      const error = ErrorHandler.createRuntimeError('recording', 'Recording codec not supported');

      errorHandler.handleRuntimeError(error);

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        'Recording codec not supported. Please try a different browser.',
        'error',
        expect.objectContaining({
          persistent: true,
        })
      );
    });
  });

  describe('Storage Error Handling', () => {
    it('should handle local storage errors', () => {
      const error = new Error('Permission denied') as StorageError;
      error.type = 'local';

      errorHandler.handleStorageError(error);

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        'Cannot write to local storage directory. Please check folder permissions.',
        'error',
        expect.objectContaining({
          persistent: true,
          actionLabel: 'Change Location',
        })
      );
    });

    it('should handle S3 storage errors with fallback message', () => {
      const error = new Error('Invalid credentials') as StorageError;
      error.type = 's3';

      errorHandler.handleStorageError(error);

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        'S3 upload failed due to invalid credentials. Recording saved locally.',
        'warning',
        expect.objectContaining({
          persistent: true,
          actionLabel: 'Update Settings',
        })
      );
    });

    it('should handle storage validation errors', () => {
      const error = new Error('Invalid bucket name') as StorageError;
      error.type = 'validation';

      errorHandler.handleStorageError(error);

      expect(mockNotificationCallback).toHaveBeenCalledWith(
        'Invalid S3 bucket name format. Please use a valid bucket name.',
        'error',
        undefined
      );
    });
  });

  describe('Error Statistics and Health', () => {
    it('should track error statistics', () => {
      const setupError = ErrorHandler.createSetupError('tenant', 'Test error');
      const runtimeError = ErrorHandler.createRuntimeError('webcam', 'Test error');

      errorHandler.handleSetupError(setupError);
      errorHandler.handleRuntimeError(runtimeError);

      const stats = errorHandler.getErrorStats();

      expect(stats.total).toBe(2);
      expect(stats.byCategory.setup).toBe(1);
      expect(stats.byCategory.runtime).toBe(1);
      expect(stats.recentErrors).toHaveLength(2);
    });

    it('should determine system health based on recent errors', () => {
      // System should be healthy initially
      expect(errorHandler.isSystemHealthy()).toBe(true);

      // Add multiple errors to make system unhealthy
      for (let i = 0; i < 6; i++) {
        const error = ErrorHandler.createRuntimeError('webcam', `Error ${i}`);
        errorHandler.handleRuntimeError(error);
      }

      expect(errorHandler.isSystemHealthy()).toBe(false);
    });

    it('should provide recovery suggestions based on error patterns', () => {
      // Add multiple webcam errors
      for (let i = 0; i < 3; i++) {
        const error = ErrorHandler.createRuntimeError('webcam', `Webcam error ${i}`);
        errorHandler.handleRuntimeError(error);
      }

      const suggestions = errorHandler.getRecoverySuggestions();

      expect(suggestions).toContain('Consider restarting the application or checking webcam connections');
    });

    it('should clear error log', () => {
      const error = ErrorHandler.createSetupError('tenant', 'Test error');
      errorHandler.handleSetupError(error);

      expect(errorHandler.getErrorStats().total).toBe(1);

      errorHandler.clearErrorLog();

      expect(errorHandler.getErrorStats().total).toBe(0);
    });
  });

  describe('Error Creation Helpers', () => {
    it('should create setup errors with correct type', () => {
      const error = ErrorHandler.createSetupError('tenant', 'Test message');

      expect(error.type).toBe('tenant');
      expect(error.message).toBe('Test message');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create runtime errors with correct type', () => {
      const error = ErrorHandler.createRuntimeError('webcam', 'Test message');

      expect(error.type).toBe('webcam');
      expect(error.message).toBe('Test message');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('Notification Fallback', () => {
    it('should fallback to console when no notification callback is set', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const errorHandlerWithoutCallback = new ErrorHandler();

      errorHandlerWithoutCallback.showUserNotification('Test message', 'info');

      expect(consoleSpy).toHaveBeenCalledWith('[INFO] Test message');

      consoleSpy.mockRestore();
    });
  });
});
