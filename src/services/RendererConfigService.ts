// Renderer-side configuration service that communicates with main process via IPC
import { AppConfig, StorageSettings, ConfigManager } from '../types/config';

export class RendererConfigService implements ConfigManager {
  async getTenantId(): Promise<string | null> {
    try {
      return await window.electron.config.getTenantId();
    } catch (error) {
      console.error('Renderer: Error getting tenant ID:', error);
      throw new Error('Failed to get tenant ID');
    }
  }

  async setTenantId(tenantId: string): Promise<void> {
    try {
      await window.electron.config.setTenantId(tenantId);
    } catch (error) {
      console.error('Failed to set tenant ID:', error);
      throw new Error('Failed to save tenant ID configuration');
    }
  }

  async getWebcamId(): Promise<string | null> {
    try {
      return await window.electron.config.getWebcamId();
    } catch (error) {
      console.error('Failed to get webcam ID:', error);
      throw new Error('Failed to load webcam ID configuration');
    }
  }

  async setWebcamId(webcamId: string): Promise<void> {
    try {
      await window.electron.config.setWebcamId(webcamId);
    } catch (error) {
      console.error('Failed to set webcam ID:', error);
      throw new Error('Failed to save webcam ID configuration');
    }
  }

  async getStorageSettings(): Promise<StorageSettings> {
    try {
      return await window.electron.config.getStorageSettings();
    } catch (error) {
      console.error('Failed to get storage settings:', error);
      throw new Error('Failed to load storage settings');
    }
  }

  async setStorageSettings(settings: StorageSettings): Promise<void> {
    try {
      await window.electron.config.setStorageSettings(settings);
    } catch (error) {
      console.error('Failed to set storage settings:', error);
      throw new Error('Failed to save storage settings');
    }
  }

  async getConfig(): Promise<AppConfig> {
    try {
      return await window.electron.config.get();
    } catch (error) {
      console.error('Failed to get config:', error);
      throw new Error('Failed to load configuration');
    }
  }

  async setConfig(config: Partial<AppConfig>): Promise<void> {
    try {
      await window.electron.config.set(config);
    } catch (error) {
      console.error('Failed to set config:', error);
      throw new Error('Failed to save configuration');
    }
  }

  async resetConfig(): Promise<void> {
    try {
      await window.electron.config.reset();
    } catch (error) {
      console.error('Failed to reset config:', error);
      throw new Error('Failed to reset configuration');
    }
  }

  async isFirstTimeSetup(): Promise<boolean> {
    try {
      return await window.electron.config.isFirstTimeSetup();
    } catch (error) {
      console.error('Renderer: Error checking first time setup:', error);
      return true; // Default to first time setup on error
    }
  }
}
