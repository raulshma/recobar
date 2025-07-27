// Configuration IPC handlers for secure communication between main and renderer processes
import { ipcMain } from 'electron';
import { ConfigManager } from '../services/ConfigManager';
import { AppConfig, StorageSettings } from '../types/config';

export class ConfigIpcHandlers {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tenant ID handlers
    ipcMain.handle('config:getTenantId', async () => {
      try {
        return await this.configManager.getTenantId();
      } catch (error) {
        console.error('IPC Error getting tenant ID:', error);
        throw new Error('Failed to get tenant ID');
      }
    });

    ipcMain.handle('config:setTenantId', async (_, tenantId: string) => {
      try {
        await this.configManager.setTenantId(tenantId);
        return { success: true };
      } catch (error) {
        console.error('IPC Error setting tenant ID:', error);
        throw error;
      }
    });

    // Webcam ID handlers
    ipcMain.handle('config:getWebcamId', async () => {
      try {
        return await this.configManager.getWebcamId();
      } catch (error) {
        console.error('IPC Error getting webcam ID:', error);
        throw new Error('Failed to get webcam ID');
      }
    });

    ipcMain.handle('config:setWebcamId', async (_, webcamId: string) => {
      try {
        await this.configManager.setWebcamId(webcamId);
        return { success: true };
      } catch (error) {
        console.error('IPC Error setting webcam ID:', error);
        throw error;
      }
    });

    // Storage settings handlers
    ipcMain.handle('config:getStorageSettings', async () => {
      try {
        return await this.configManager.getStorageSettings();
      } catch (error) {
        console.error('IPC Error getting storage settings:', error);
        throw new Error('Failed to get storage settings');
      }
    });

    ipcMain.handle(
      'config:setStorageSettings',
      async (_, settings: StorageSettings) => {
        try {
          await this.configManager.setStorageSettings(settings);
          return { success: true };
        } catch (error) {
          console.error('IPC Error setting storage settings:', error);
          throw error;
        }
      },
    );

    // Full configuration handlers
    ipcMain.handle('config:getConfig', async () => {
      try {
        return await this.configManager.getConfig();
      } catch (error) {
        console.error('IPC Error getting full config:', error);
        throw new Error('Failed to get configuration');
      }
    });

    ipcMain.handle(
      'config:setConfig',
      async (_, config: Partial<AppConfig>) => {
        try {
          await this.configManager.setConfig(config);
          return { success: true };
        } catch (error) {
          console.error('IPC Error setting config:', error);
          throw error;
        }
      },
    );

    // Utility handlers
    ipcMain.handle('config:resetConfig', async () => {
      try {
        await this.configManager.resetConfig();
        return { success: true };
      } catch (error) {
        console.error('IPC Error resetting config:', error);
        throw new Error('Failed to reset configuration');
      }
    });

    ipcMain.handle('config:isFirstTimeSetup', async () => {
      try {
        return await this.configManager.isFirstTimeSetup();
      } catch (error) {
        console.error('IPC Error checking first time setup:', error);
        return true; // Default to first time setup on error
      }
    });
  }

  // Method to remove all handlers (useful for cleanup)
  removeHandlers(): void {
    const handlers = [
      'config:getTenantId',
      'config:setTenantId',
      'config:getWebcamId',
      'config:setWebcamId',
      'config:getStorageSettings',
      'config:setStorageSettings',
      'config:getConfig',
      'config:setConfig',
      'config:resetConfig',
      'config:isFirstTimeSetup',
    ];

    handlers.forEach((handler) => {
      ipcMain.removeHandler(handler);
    });
  }
}
