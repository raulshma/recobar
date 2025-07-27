// Configuration IPC handlers for secure communication between main and renderer processes
import { ipcMain, dialog } from 'electron';
import { promises as fs } from 'fs';
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
    ipcMain.handle('config:get', async () => {
      try {
        return await this.configManager.getConfig();
      } catch (error) {
        console.error('IPC Error getting full config:', error);
        throw new Error('Failed to get configuration');
      }
    });

    ipcMain.handle(
      'config:set',
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
    ipcMain.handle('config:reset', async () => {
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

    // Webcam enumeration handler
    ipcMain.handle('config:getAvailableWebcams', async () => {
      try {
        // Use navigator.mediaDevices.enumerateDevices() equivalent in main process
        // For now, return empty array - this would need platform-specific implementation
        console.warn('getAvailableWebcams not fully implemented - returning empty array');
        return [];
      } catch (error) {
        console.error('IPC Error getting available webcams:', error);
        return [];
      }
    });

    // Directory selection handler
    ipcMain.handle('config:selectDirectory', async () => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Select Storage Directory'
        });
        
        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }
        
        return result.filePaths[0];
      } catch (error) {
        console.error('IPC Error selecting directory:', error);
        return null;
      }
    });

    // Directory validation handler
    ipcMain.handle('config:validateDirectory', async (_, path: string) => {
      try {
        const stats = await fs.stat(path);
        return stats.isDirectory();
      } catch (error) {
        console.error('IPC Error validating directory:', error);
        return false;
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
      'config:get',
      'config:set',
      'config:reset',
      'config:isFirstTimeSetup',
      'config:getAvailableWebcams',
      'config:selectDirectory',
      'config:validateDirectory',
    ];

    handlers.forEach((handler) => {
      ipcMain.removeHandler(handler);
    });
  }
}
