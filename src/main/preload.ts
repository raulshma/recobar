// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { AppConfig, StorageSettings } from '../types/config';
import { RecordingResult } from '../types/recording';

export type Channels = 'ipc-example' | 'app:focus-changed' | 'app:before-quit' | 'notification:show';

// Helper function to safely invoke IPC with error handling
const safeInvoke = async (channel: string, ...args: unknown[]): Promise<any> => {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    console.error(`IPC Error on channel ${channel}:`, error);
    throw error;
  }
};

// Helper function to validate channel names for security
const validateChannel = (channel: string): boolean => {
  const allowedChannels = [
    'ipc-example',
    'app:focus-changed',
    'app:before-quit',
    'notification:show',
  ];

  const allowedPrefixes = [
    'config:',
    'storage:',
    'recording:',
    'app:',
    'window:',
    'notification:',
  ];

  return allowedChannels.includes(channel) ||
         allowedPrefixes.some(prefix => channel.startsWith(prefix));
};

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      if (!validateChannel(channel)) {
        throw new Error(`Invalid IPC channel: ${channel}`);
      }
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      if (!validateChannel(channel)) {
        throw new Error(`Invalid IPC channel: ${channel}`);
      }
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      if (!validateChannel(channel)) {
        throw new Error(`Invalid IPC channel: ${channel}`);
      }
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    // Generic invoke method for any IPC call
    invoke: (channel: string, ...args: unknown[]) => {
      if (!validateChannel(channel)) {
        throw new Error(`Invalid IPC channel: ${channel}`);
      }
      return safeInvoke(channel, ...args);
    },
  },

  // Application API
  app: {
    getVersion: (): Promise<string> => safeInvoke('app:getVersion'),
    getPlatform: (): Promise<string> => safeInvoke('app:getPlatform'),
    isPackaged: (): Promise<boolean> => safeInvoke('app:isPackaged'),
    getPath: (name: string): Promise<string> => safeInvoke('app:getPath', name),
  },

  // Window management API
  window: {
    minimize: (): Promise<void> => safeInvoke('window:minimize'),
    maximize: (): Promise<void> => safeInvoke('window:maximize'),
    close: (): Promise<void> => safeInvoke('window:close'),
    setFullScreen: (fullscreen: boolean): Promise<void> =>
      safeInvoke('window:setFullScreen', fullscreen),
    isFullScreen: (): Promise<boolean> => safeInvoke('window:isFullScreen'),
  },

  // Configuration API
  config: {
    getTenantId: (): Promise<string | null> =>
      safeInvoke('config:getTenantId'),
    setTenantId: (tenantId: string): Promise<{ success: boolean }> =>
      safeInvoke('config:setTenantId', tenantId),
    getWebcamId: (): Promise<string | null> =>
      safeInvoke('config:getWebcamId'),
    setWebcamId: (webcamId: string): Promise<{ success: boolean }> =>
      safeInvoke('config:setWebcamId', webcamId),
    getStorageSettings: (): Promise<StorageSettings> =>
      safeInvoke('config:getStorageSettings'),
    setStorageSettings: (settings: StorageSettings): Promise<{ success: boolean }> =>
      safeInvoke('config:setStorageSettings', settings),
    getConfig: (): Promise<AppConfig> =>
      safeInvoke('config:getConfig'),
    setConfig: (config: Partial<AppConfig>): Promise<{ success: boolean }> =>
      safeInvoke('config:setConfig', config),
    resetConfig: (): Promise<{ success: boolean }> =>
      safeInvoke('config:resetConfig'),
    isFirstTimeSetup: (): Promise<boolean> =>
      safeInvoke('config:isFirstTimeSetup'),
  },

  // Storage API
  storage: {
    saveLocal: (recording: RecordingResult, path: string): Promise<{ success: boolean; filePath?: string }> =>
      safeInvoke('storage:saveLocal', recording, path),
    uploadToS3: (recording: RecordingResult, config: StorageSettings['s3Config']): Promise<{ success: boolean; s3Url?: string }> =>
      safeInvoke('storage:uploadToS3', recording, config),
    generateFileName: (metadata: RecordingResult['metadata']): Promise<{ success: boolean; fileName?: string }> =>
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
    getMetadata: (recordingId: string): Promise<{ success: boolean; metadata?: any }> =>
      safeInvoke('recording:getMetadata', recordingId),
    listRecordings: (filters?: any): Promise<{ success: boolean; recordings: any[] }> =>
      safeInvoke('recording:listRecordings', filters),
    deleteRecording: (recordingId: string): Promise<{ success: boolean }> =>
      safeInvoke('recording:deleteRecording', recordingId),
    getStatistics: (): Promise<{
      success: boolean;
      statistics: {
        totalRecordings: number;
        totalDuration: number;
        totalSize: number;
        lastRecording: any;
      }
    }> =>
      safeInvoke('recording:getStatistics'),
    exportRecording: (recordingId: string, exportPath: string): Promise<{ success: boolean; exportPath?: string }> =>
      safeInvoke('recording:exportRecording', recordingId, exportPath),
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
contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
