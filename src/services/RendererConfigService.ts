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
      const result = await window.electron.config.setTenantId(tenantId);
      if (!result.success) {
        throw new Error('Failed to set tenant ID');
      }
    } catch (error) {
      console.error('Renderer: Error setting tenant ID:', error);
      throw error;
    }
  }

  async getWebcamId(): Promise<string | null> {
    try {
      return await window.electron.config.getWebcamId();
    } catch (error) {
      console.error('Renderer: Error getting webcam ID:', error);
      throw new Error('Failed to get webcam ID');
    }
  }

  async setWebcamId(webcamId: string): Promise<void> {
    try {
      const result = await window.electron.config.setWebcamId(webcamId);
      if (!result.success) {
        throw new Error('Failed to set webcam ID');
      }
    } catch (error) {
      console.error('Renderer: Error setting webcam ID:', error);
      throw error;
    }
  }

  async getStorageSettings(): Promise<StorageSettings> {
    try {
      return await window.electron.config.getStorageSettings();
    } catch (error) {
      console.error('Renderer: Error getting storage settings:', error);
      throw new Error('Failed to get storage settings');
    }
  }

  async setStorageSettings(settings: StorageSettings): Promise<void> {
    try {
      const result = await window.electron.config.setStorageSettings(settings);
      if (!result.success) {
        throw new Error('Failed to set storage settings');
      }
    } catch (error) {
      console.error('Renderer: Error setting storage settings:', error);
      throw error;
    }
  }

  async getConfig(): Promise<AppConfig> {
    try {
      return await window.electron.config.getConfig();
    } catch (error) {
      console.error('Renderer: Error getting config:', error);
      throw new Error('Failed to get configuration');
    }
  }

  async setConfig(config: Partial<AppConfig>): Promise<void> {
    try {
      const result = await window.electron.config.setConfig(config);
      if (!result.success) {
        throw new Error('Failed to set configuration');
      }
    } catch (error) {
      console.error('Renderer: Error setting config:', error);
      throw error;
    }
  }

  async resetConfig(): Promise<void> {
    try {
      const result = await window.electron.config.resetConfig();
      if (!result.success) {
        throw new Error('Failed to reset configuration');
      }
    } catch (error) {
      console.error('Renderer: Error resetting config:', error);
      throw error;
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
