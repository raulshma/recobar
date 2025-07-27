// Type definitions for the preload API exposed to the renderer process
import { AppConfig, StorageSettings } from './config';
import { RecordingMetadata, RecordingStatistics, RecordingFilters, SerializedRecordingData } from './recording';

// Define available webcam device interface
interface WebcamDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export interface ElectronAPI {
  // App version info
  getVersion(): Promise<string>;

  // Config API
  config: {
    get(): Promise<AppConfig>;
    set(config: Partial<AppConfig>): Promise<void>;
    reset(): Promise<void>;
    isFirstTimeSetup(): Promise<boolean>;
    
    // Tenant management
    getTenantId(): Promise<string | null>;
    setTenantId(tenantId: string): Promise<void>;
    
    // Webcam management
    getWebcamId(): Promise<string | null>;
    setWebcamId(webcamId: string): Promise<void>;
    getAvailableWebcams(): Promise<WebcamDevice[]>;
    
    // Storage settings
    getStorageSettings(): Promise<StorageSettings>;
    setStorageSettings(settings: StorageSettings): Promise<void>;
    
    // Directory operations
    selectDirectory(): Promise<string | null>;
    validateDirectory(path: string): Promise<boolean>;
  };

  // File system operations
  fs: {
    exists(path: string): Promise<boolean>;
    isDirectory(path: string): Promise<boolean>;
    createDirectory(path: string): Promise<void>;
    readFile(path: string): Promise<Buffer>;
    writeFile(path: string, data: Buffer): Promise<void>;
    deleteFile(path: string): Promise<void>;
    getStats(path: string): Promise<{ size: number; isDirectory: boolean; modified: Date }>;
  };

  // Storage API
  storage: {
    saveLocal(recordingData: SerializedRecordingData, path: string): Promise<{ success: boolean; filePath?: string }>;
    uploadToS3(recordingData: SerializedRecordingData, config: StorageSettings['s3Config']): Promise<{ success: boolean; s3Url?: string }>;
    generateFileName(metadata: RecordingMetadata): Promise<{ success: boolean; fileName?: string }>;
    validateConfig(settings: StorageSettings): Promise<{ success: boolean; isValid: boolean; error?: string }>;
    testS3Connection(config: StorageSettings['s3Config']): Promise<{ success: boolean; isConnected: boolean; error?: string }>;
    getAvailableSpace(path: string): Promise<{ success: boolean; availableSpace: number; error?: string }>;
  };

  // Recording API
  recording: {
    getMetadata(recordingId: string): Promise<{ success: boolean; metadata?: RecordingMetadata }>;
    listRecordings(filters?: RecordingFilters): Promise<{ success: boolean; recordings: RecordingMetadata[] }>;
    deleteRecording(recordingId: string): Promise<{ success: boolean }>;
    getStatistics(): Promise<{
      success: boolean;
      statistics: RecordingStatistics;
    }>;
  };
}

// Extend the global Window interface
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
