// Preload script for secure IPC communication with renderer process
import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, StorageSettings } from '../types/config';
import type { RecordingMetadata, RecordingStatistics, RecordingFilters, SerializedRecordingData } from '../types/recording';

// Type-safe wrapper for IPC calls with error handling
const safeInvoke = async (channel: string, ...args: unknown[]): Promise<any> => {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    console.error(`IPC Error on channel ${channel}:`, error);
    throw error;
  }
};

// Define available webcam device interface
interface WebcamDevice {
  deviceId: string;
  label: string;
  kind: string;
}

// Exposed API to renderer process
const electronAPI = {
  // App version info
  getVersion: (): Promise<string> => safeInvoke('app:getVersion'),

  // Config API
  config: {
    get: (): Promise<AppConfig> => safeInvoke('config:get'),
    set: (config: Partial<AppConfig>): Promise<void> => safeInvoke('config:set', config),
    reset: (): Promise<void> => safeInvoke('config:reset'),
    isFirstTimeSetup: (): Promise<boolean> => safeInvoke('config:isFirstTimeSetup'),
    
    // Tenant management
    getTenantId: (): Promise<string | null> => safeInvoke('config:getTenantId'),
    setTenantId: (tenantId: string): Promise<void> => safeInvoke('config:setTenantId', tenantId),
    
    // Webcam management
    getWebcamId: (): Promise<string | null> => safeInvoke('config:getWebcamId'),
    setWebcamId: (webcamId: string): Promise<void> => safeInvoke('config:setWebcamId', webcamId),
    getAvailableWebcams: (): Promise<WebcamDevice[]> => safeInvoke('config:getAvailableWebcams'),
    
    // Storage settings
    getStorageSettings: (): Promise<StorageSettings> => safeInvoke('config:getStorageSettings'),
    setStorageSettings: (settings: StorageSettings): Promise<void> => safeInvoke('config:setStorageSettings', settings),
    
    // Directory operations
    selectDirectory: (): Promise<string | null> => safeInvoke('config:selectDirectory'),
    validateDirectory: (path: string): Promise<boolean> => safeInvoke('config:validateDirectory', path),
  },

  // File system operations
  fs: {
    exists: (path: string): Promise<boolean> => safeInvoke('fs:exists', path),
    isDirectory: (path: string): Promise<boolean> => safeInvoke('fs:isDirectory', path),
    createDirectory: (path: string): Promise<void> => safeInvoke('fs:createDirectory', path),
    readFile: (path: string): Promise<Buffer> => safeInvoke('fs:readFile', path),
    writeFile: (path: string, data: Buffer): Promise<void> => safeInvoke('fs:writeFile', path, data),
    deleteFile: (path: string): Promise<void> => safeInvoke('fs:deleteFile', path),
    getStats: (path: string): Promise<{ size: number; isDirectory: boolean; modified: Date }> =>
      safeInvoke('fs:getStats', path),
  },

  // Storage API
  storage: {
    saveLocal: (recordingData: SerializedRecordingData, path: string): Promise<{ success: boolean; filePath?: string }> =>
      safeInvoke('storage:saveLocal', recordingData, path),
    uploadToS3: (recordingData: SerializedRecordingData, config: StorageSettings['s3Config']): Promise<{ success: boolean; s3Url?: string }> =>
      safeInvoke('storage:uploadToS3', recordingData, config),
    generateFileName: (metadata: RecordingMetadata): Promise<{ success: boolean; fileName?: string }> =>
      safeInvoke('storage:generateFileName', metadata),
    validateConfig: (settings: StorageSettings): Promise<{ success: boolean; isValid: boolean; error?: string }> =>
      safeInvoke('storage:validateConfig', settings),
    testS3Connection: (config: StorageSettings['s3Config']): Promise<{ success: boolean; isConnected: boolean; error?: string }> =>
      safeInvoke('storage:testS3Connection', config),
    getAvailableSpace: (path: string): Promise<{ success: boolean; availableSpace: number; error?: string }> =>
      safeInvoke('storage:getAvailableSpace', path),
  },

  // Recording API
  recording: {
    getMetadata: (recordingId: string): Promise<{ success: boolean; metadata?: RecordingMetadata }> =>
      safeInvoke('recording:getMetadata', recordingId),
    listRecordings: (filters?: RecordingFilters): Promise<{ success: boolean; recordings: RecordingMetadata[] }> =>
      safeInvoke('recording:listRecordings', filters),
    deleteRecording: (recordingId: string): Promise<{ success: boolean }> =>
      safeInvoke('recording:deleteRecording', recordingId),
    getStatistics: (): Promise<{
      success: boolean;
      statistics: RecordingStatistics;
    }> =>
      safeInvoke('recording:getStatistics'),
  },

  // Notification API
  notification: {
    show: (options: { title: string; body: string }): Promise<void> =>
      safeInvoke('notification:show', options),
  },
};

// Security validation - ensure we're in the correct context
if (!process.contextIsolated) {
  throw new Error('Context isolation must be enabled for security');
}

if (!contextBridge) {
  throw new Error('Context bridge is not available');
}

// Validate that we're running in a secure context - check for main world pollution
// In a properly isolated preload script, we shouldn't have access to renderer globals
// Note: In development mode, this warning may appear due to webpack hot reloading
if (typeof document !== 'undefined' || typeof window !== 'undefined') {
  if (process.env.NODE_ENV === 'development') {
    // This is expected in development due to webpack dev server setup
    // The warning can be safely ignored in development
  } else {
    console.warn('Preload script has access to renderer globals - context isolation may be compromised');
  }
}

// Expose the electron API to the renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);

export type ElectronHandler = typeof electronAPI;
