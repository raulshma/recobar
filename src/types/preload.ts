// Type definitions for the preload API exposed to the renderer process
import { AppConfig, StorageSettings } from './config';
import { RecordingResult } from './recording';

export interface ElectronAPI {
  ipcRenderer: {
    sendMessage(channel: string, ...args: unknown[]): void;
    on(channel: string, func: (...args: unknown[]) => void): () => void;
    once(channel: string, func: (...args: unknown[]) => void): void;
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  };

  app: {
    getVersion(): Promise<string>;
    getPlatform(): Promise<string>;
    isPackaged(): Promise<boolean>;
    getPath(name: string): Promise<string>;
  };

  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
    setFullScreen(fullscreen: boolean): Promise<void>;
    isFullScreen(): Promise<boolean>;
  };

  config: {
    getTenantId(): Promise<string | null>;
    setTenantId(tenantId: string): Promise<{ success: boolean }>;
    getWebcamId(): Promise<string | null>;
    setWebcamId(webcamId: string): Promise<{ success: boolean }>;
    getStorageSettings(): Promise<StorageSettings>;
    setStorageSettings(settings: StorageSettings): Promise<{ success: boolean }>;
    getConfig(): Promise<AppConfig>;
    setConfig(config: Partial<AppConfig>): Promise<{ success: boolean }>;
    resetConfig(): Promise<{ success: boolean }>;
    isFirstTimeSetup(): Promise<boolean>;
  };

  storage: {
    saveLocal(recording: RecordingResult, path: string): Promise<{ success: boolean; filePath?: string }>;
    uploadToS3(recording: RecordingResult, config: StorageSettings['s3']): Promise<{ success: boolean; s3Url?: string }>;
    generateFileName(metadata: RecordingResult['metadata']): Promise<{ success: boolean; fileName?: string }>;
    validateConfig(settings: StorageSettings): Promise<{ success: boolean; isValid: boolean; error?: string }>;
    testS3Connection(config: StorageSettings['s3']): Promise<{ success: boolean; isConnected: boolean; error?: string }>;
    getAvailableSpace(path: string): Promise<{ success: boolean; availableSpace: number; error?: string }>;
  };

  recording: {
    getMetadata(recordingId: string): Promise<{ success: boolean; metadata?: any }>;
    listRecordings(filters?: any): Promise<{ success: boolean; recordings: any[] }>;
    deleteRecording(recordingId: string): Promise<{ success: boolean }>;
    getStatistics(): Promise<{
      success: boolean;
      statistics: {
        totalRecordings: number;
        totalDuration: number;
        totalSize: number;
        lastRecording: any;
      }
    }>;
    exportRecording(recordingId: string, exportPath: string): Promise<{ success: boolean; exportPath?: string }>;
  };

  notification: {
    show(options: { title: string; body: string }): Promise<void>;
  };
}

// Extend the global Window interface
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
