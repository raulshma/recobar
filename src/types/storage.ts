// Storage-related type definitions
import type { RecordingResult, RecordingMetadata } from './recording';

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface StorageResult {
  success: boolean;
  localPath?: string;
  s3Path?: string;
  errors: StorageError[];
}

export interface StorageOperationStatus {
  local: {
    enabled: boolean;
    inProgress: boolean;
    completed: boolean;
    error?: StorageError;
    path?: string;
  };
  s3: {
    enabled: boolean;
    inProgress: boolean;
    completed: boolean;
    error?: StorageError;
    path?: string;
  };
}

export interface StorageService {
  saveLocal(recording: RecordingResult, path: string): Promise<string>;
  uploadToS3(recording: RecordingResult, config: S3Config): Promise<string>;
  generateFileName(metadata: RecordingMetadata): string;
  saveRecording(
    recording: RecordingResult,
    localPath?: string,
    s3Config?: S3Config
  ): Promise<StorageResult>;
  onStatusUpdate(callback: (status: StorageOperationStatus) => void): void;
  removeStatusCallback(callback: (status: StorageOperationStatus) => void): void;
  getStorageStatus(): StorageOperationStatus;
  clearS3Client(): void;
}

export interface StorageError extends Error {
  type: 'local' | 's3' | 'validation';
  originalError?: Error;
}

// Re-export RecordingResult and RecordingMetadata for convenience
export type { RecordingResult, RecordingMetadata };
