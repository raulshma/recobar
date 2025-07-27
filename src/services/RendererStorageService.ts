// Renderer-side storage service that communicates with main process via IPC
import {
  StorageService as IStorageService,
  RecordingResult,
  S3Config,
  RecordingMetadata,
  StorageError,
  StorageResult,
  StorageOperationStatus,
} from '../types';

export class RendererStorageService implements IStorageService {
  private statusCallbacks: ((status: StorageOperationStatus) => void)[] = [];

  /**
   * Generate a standardized filename for recordings
   * Note: This is synchronous to match the interface, but uses a fallback implementation
   */
  generateFileName(metadata: RecordingMetadata): string {
    try {
      // Fallback implementation for synchronous filename generation
      const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
      const tenantId = sanitize(metadata.tenantId || '');
      const barcode = sanitize(metadata.barcode || '');
      const timestamp = metadata.startTime.toISOString().replace(/[:.]/g, '-');

      return `${tenantId}_${barcode}_${timestamp}.webm`;
    } catch (error) {
      throw this.createStorageError(
        'validation',
        `Failed to generate filename: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error as Error
      );
    }
  }

  /**
   * Create a standardized storage error
   */
  private createStorageError(
    type: 'local' | 's3' | 'validation',
    message: string,
    originalError?: Error
  ): StorageError {
    const error = new Error(message) as StorageError;
    error.type = type;
    error.originalError = originalError;
    return error;
  }

  /**
   * Save recording to local file system via IPC
   */
  async saveLocal(recording: RecordingResult, localPath: string): Promise<string> {
    try {
      // Validate recording data
      if (!recording || !recording.blob || !recording.metadata) {
        throw this.createStorageError(
          'validation',
          'Invalid recording data provided'
        );
      }

      const result = await window.electron.storage.saveLocal(recording, localPath);
      if (!result.success || !result.filePath) {
        throw new Error('Failed to save recording locally');
      }

      return result.filePath;
    } catch (error) {
      if (error instanceof Error && (error as StorageError).type) {
        throw error;
      }
      throw this.createStorageError(
        'local',
        `Failed to save recording locally: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error as Error
      );
    }
  }

  /**
   * Upload recording to S3 via IPC
   */
  async uploadToS3(recording: RecordingResult, config: S3Config): Promise<string> {
    try {
      // Validate recording data
      if (!recording || !recording.blob || !recording.metadata) {
        throw this.createStorageError(
          'validation',
          'Invalid recording data provided'
        );
      }

      const result = await window.electron.storage.uploadToS3(recording, config);
      if (!result.success || !result.s3Url) {
        throw new Error('Failed to upload recording to S3');
      }

      return result.s3Url;
    } catch (error) {
      if (error instanceof Error && (error as StorageError).type) {
        throw error;
      }
      throw this.createStorageError(
        's3',
        `Failed to upload recording to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error as Error
      );
    }
  }

  /**
   * Register callback for storage operation status updates
   */
  onStatusUpdate(callback: (status: StorageOperationStatus) => void): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * Remove status update callback
   */
  removeStatusCallback(callback: (status: StorageOperationStatus) => void): void {
    const index = this.statusCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all registered callbacks of status update
   */
  private notifyStatusUpdate(status: StorageOperationStatus): void {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in storage status callback:', error);
      }
    });
  }

  /**
   * Save recording to both local and S3 storage simultaneously
   */
  async saveRecording(
    recording: RecordingResult,
    localPath?: string,
    s3Config?: S3Config
  ): Promise<StorageResult> {
    const result: StorageResult = {
      success: false,
      errors: [],
    };

    const status: StorageOperationStatus = {
      local: {
        enabled: !!localPath,
        inProgress: false,
        completed: false,
      },
      s3: {
        enabled: !!s3Config,
        inProgress: false,
        completed: false,
      },
    };

    // Validate that at least one storage option is enabled
    if (!localPath && !s3Config) {
      const error = this.createStorageError(
        'validation',
        'At least one storage option (local or S3) must be configured'
      );
      result.errors.push(error);
      return result;
    }

    // Create promises for concurrent execution
    const storagePromises: Promise<void>[] = [];

    // Local storage promise
    if (localPath) {
      status.local.inProgress = true;
      this.notifyStatusUpdate(status);

      const localPromise = this.saveLocal(recording, localPath)
        .then(path => {
          result.localPath = path;
          status.local.completed = true;
          status.local.inProgress = false;
          status.local.path = path;
          this.notifyStatusUpdate(status);
        })
        .catch(error => {
          const storageError = error as StorageError;
          result.errors.push(storageError);
          status.local.error = storageError;
          status.local.inProgress = false;
          status.local.completed = false;
          this.notifyStatusUpdate(status);
        });

      storagePromises.push(localPromise);
    }

    // S3 storage promise
    if (s3Config) {
      status.s3.inProgress = true;
      this.notifyStatusUpdate(status);

      const s3Promise = this.uploadToS3(recording, s3Config)
        .then(path => {
          result.s3Path = path;
          status.s3.completed = true;
          status.s3.inProgress = false;
          status.s3.path = path;
          this.notifyStatusUpdate(status);
        })
        .catch(error => {
          const storageError = error as StorageError;
          result.errors.push(storageError);
          status.s3.error = storageError;
          status.s3.inProgress = false;
          status.s3.completed = false;
          this.notifyStatusUpdate(status);
        });

      storagePromises.push(s3Promise);
    }

    // Wait for all storage operations to complete
    await Promise.allSettled(storagePromises);

    // Determine overall success
    result.success = (
      (!localPath || result.localPath !== undefined) &&
      (!s3Config || result.s3Path !== undefined)
    );

    return result;
  }

  /**
   * Get current storage operation status
   */
  getStorageStatus(): StorageOperationStatus {
    return {
      local: {
        enabled: false,
        inProgress: false,
        completed: false,
      },
      s3: {
        enabled: false,
        inProgress: false,
        completed: false,
      },
    };
  }

  /**
   * Clear any cached S3 client (useful when credentials change)
   */
  clearS3Client(): void {
    // This is handled by the main process, so we don't need to do anything here
    // But we keep the method for interface compatibility
  }
}
