// Storage service implementation
import { promises as fs } from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  StorageService as IStorageService,
  RecordingResult,
  S3Config,
  RecordingMetadata,
  StorageError,
  StorageResult,
  StorageOperationStatus,
} from '../types';

export class StorageService implements IStorageService {
  private s3Client: S3Client | null = null;
  private statusCallbacks: ((status: StorageOperationStatus) => void)[] = [];

  /**
   * Generate a standardized filename for recordings
   * Format: {tenantId}_{barcode}_{timestamp}.webm
   */
  generateFileName(metadata: RecordingMetadata): string {
    const timestamp = metadata.startTime.toISOString().replace(/[:.]/g, '-');
    const sanitizedBarcode = metadata.barcode.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedTenantId = metadata.tenantId.replace(/[^a-zA-Z0-9]/g, '_');

    return `${sanitizedTenantId}_${sanitizedBarcode}_${timestamp}.webm`;
  }

  /**
   * Validate storage configuration settings
   */
  private validateStorageConfig(config: any): void {
    if (!config) {
      throw this.createStorageError('validation', 'Storage configuration is required');
    }
  }

  /**
   * Validate S3 configuration
   */
  private validateS3Config(config: S3Config): void {
    const requiredFields = ['bucket', 'region', 'accessKeyId', 'secretAccessKey'];
    const missingFields = requiredFields.filter(field => !config[field as keyof S3Config]);

    if (missingFields.length > 0) {
      throw this.createStorageError(
        'validation',
        `Missing required S3 configuration fields: ${missingFields.join(', ')}`
      );
    }

    // Validate bucket name format (basic validation)
    if (!/^[a-z0-9.-]{3,63}$/.test(config.bucket)) {
      throw this.createStorageError(
        'validation',
        'Invalid S3 bucket name format'
      );
    }

    // Validate region format
    if (!/^[a-z0-9-]+$/.test(config.region)) {
      throw this.createStorageError(
        'validation',
        'Invalid S3 region format'
      );
    }
  }

  /**
   * Validate local storage path
   */
  private async validateLocalPath(localPath: string): Promise<void> {
    if (!localPath || typeof localPath !== 'string') {
      throw this.createStorageError(
        'validation',
        'Local storage path must be a non-empty string'
      );
    }

    // Resolve absolute path
    const absolutePath = path.resolve(localPath);

    try {
      // Check if path exists
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw this.createStorageError(
          'local',
          `Storage path exists but is not a directory: ${absolutePath}`
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist, try to create it
        try {
          await fs.mkdir(absolutePath, { recursive: true });
        } catch (mkdirError) {
          throw this.createStorageError(
            'local',
            `Cannot create storage directory: ${absolutePath}`,
            mkdirError as Error
          );
        }
      } else {
        throw this.createStorageError(
          'local',
          `Cannot access storage directory: ${absolutePath}`,
          error as Error
        );
      }
    }

    // Check write permissions by creating and deleting a test file
    try {
      const testFile = path.join(absolutePath, '.write-test-' + Date.now());
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
    } catch (error) {
      throw this.createStorageError(
        'local',
        `No write permission for storage directory: ${absolutePath}`,
        error as Error
      );
    }
  }

  /**
   * Ensure directory exists and create if necessary
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
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
   * Convert blob to buffer with performance optimizations
   */
  private async blobToBuffer(blob: Blob): Promise<Buffer> {
    // Use background processing to avoid blocking the main thread
    return new Promise((resolve, reject) => {
      const processBlob = async () => {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          resolve(buffer);
        } catch (error) {
          reject(error);
        }
      };

      // Use requestIdleCallback if available, otherwise use setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => processBlob());
      } else {
        setTimeout(() => processBlob(), 0);
      }
    });
  }

  /**
   * Save recording to local file system
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

      // Validate and prepare local path
      await this.validateLocalPath(localPath);
      const absolutePath = path.resolve(localPath);

      // Generate filename and full path
      const filename = this.generateFileName(recording.metadata);
      const fullPath = path.join(absolutePath, filename);

      // Check if file already exists
      try {
        await fs.access(fullPath);
        throw this.createStorageError(
          'local',
          `File already exists: ${fullPath}`
        );
      } catch (error) {
        // File doesn't exist, which is what we want
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      // Convert blob to buffer
      const buffer = await this.blobToBuffer(recording.blob);

      // Validate buffer size
      if (buffer.length === 0) {
        throw this.createStorageError(
          'validation',
          'Recording blob is empty'
        );
      }

      // Write file atomically using temporary file
      const tempPath = fullPath + '.tmp';
      try {
        await fs.writeFile(tempPath, buffer);
        await fs.rename(tempPath, fullPath);
      } catch (error) {
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }

      // Verify file was written correctly
      const stats = await fs.stat(fullPath);
      if (stats.size !== buffer.length) {
        throw this.createStorageError(
          'local',
          `File size mismatch after write: expected ${buffer.length}, got ${stats.size}`
        );
      }

      return fullPath;
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
   * Initialize S3 client with configuration
   */
  private initializeS3Client(config: S3Config): void {
    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      maxAttempts: 3, // Built-in retry for AWS SDK
    });
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Test S3 connection and credentials
   */
  private async testS3Connection(config: S3Config): Promise<void> {
    try {
      if (!this.s3Client) {
        this.initializeS3Client(config);
      }

      // Test connection by attempting to list objects (with limit 1)
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const command = new ListObjectsV2Command({
        Bucket: config.bucket,
        MaxKeys: 1,
      });

      await this.s3Client!.send(command);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('NoSuchBucket')) {
        throw this.createStorageError(
          's3',
          `S3 bucket does not exist: ${config.bucket}`
        );
      } else if (errorMessage.includes('InvalidAccessKeyId')) {
        throw this.createStorageError(
          's3',
          'Invalid S3 access key ID'
        );
      } else if (errorMessage.includes('SignatureDoesNotMatch')) {
        throw this.createStorageError(
          's3',
          'Invalid S3 secret access key'
        );
      } else if (errorMessage.includes('AccessDenied')) {
        throw this.createStorageError(
          's3',
          'Access denied to S3 bucket. Check permissions.'
        );
      } else {
        throw this.createStorageError(
          's3',
          `S3 connection test failed: ${errorMessage}`,
          error as Error
        );
      }
    }
  }

  /**
   * Upload recording to S3 with retry logic
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

      // Validate S3 configuration
      this.validateS3Config(config);

      // Initialize S3 client if not already done or config changed
      if (!this.s3Client) {
        this.initializeS3Client(config);
      }

      // Test S3 connection
      await this.testS3Connection(config);

      // Generate filename and S3 key
      const filename = this.generateFileName(recording.metadata);
      const s3Key = `recordings/${recording.metadata.tenantId}/${filename}`;

      // Convert blob to buffer
      const buffer = await this.blobToBuffer(recording.blob);

      // Validate buffer size
      if (buffer.length === 0) {
        throw this.createStorageError(
          'validation',
          'Recording blob is empty'
        );
      }

      // Upload to S3 with retry logic
      const uploadOperation = async () => {
        const command = new PutObjectCommand({
          Bucket: config.bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: 'video/webm',
          ContentLength: buffer.length,
          Metadata: {
            tenantId: recording.metadata.tenantId,
            barcode: recording.metadata.barcode,
            startTime: recording.metadata.startTime.toISOString(),
            endTime: recording.metadata.endTime.toISOString(),
            duration: recording.metadata.duration.toString(),
            webcamId: recording.metadata.webcamId,
            hasAudio: recording.metadata.hasAudio.toString(),
            resolution: `${recording.metadata.resolution.width}x${recording.metadata.resolution.height}`,
          },
          Tagging: `tenant=${recording.metadata.tenantId}&barcode=${encodeURIComponent(recording.metadata.barcode)}`,
        });

        return await this.s3Client!.send(command);
      };

      await this.retryOperation(uploadOperation, 3, 1000);

      return `s3://${config.bucket}/${s3Key}`;
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
   * Save recording to both local and S3 storage simultaneously with background processing
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

    // Process storage operations in background to avoid blocking UI
    return new Promise((resolve) => {
      const processStorage = async () => {
        try {
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

          resolve(result);
        } catch (error) {
          console.error('Error in background storage processing:', error);
          resolve(result);
        }
      };

      // Use requestIdleCallback if available, otherwise use setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => processStorage());
      } else {
        setTimeout(() => processStorage(), 0);
      }
    });
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
    this.s3Client = null;
  }
}
