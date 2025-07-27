// Type definitions for Electron API exposed to renderer process
import { AppConfig, StorageSettings } from './config';

export interface ElectronAPI {
  ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    send(channel: string, ...args: any[]): void;
    on(channel: string, listener: (...args: any[]) => void): void;
    removeAllListeners(channel: string): void;
  };
  config: {
    getTenantId(): Promise<string | null>;
    setTenantId(tenantId: string): Promise<{ success: boolean }>;
    getWebcamId(): Promise<string | null>;
    setWebcamId(webcamId: string): Promise<{ success: boolean }>;
    getStorageSettings(): Promise<StorageSettings>;
    setStorageSettings(
      settings: StorageSettings,
    ): Promise<{ success: boolean }>;
    getConfig(): Promise<AppConfig>;
    setConfig(config: Partial<AppConfig>): Promise<{ success: boolean }>;
    resetConfig(): Promise<{ success: boolean }>;
    isFirstTimeSetup(): Promise<boolean>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
