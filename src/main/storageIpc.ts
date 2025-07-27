// Storage IPC handlers for file operations and S3 uploads
import { ipcMain } from 'electron';
import { StorageService } from '../services/StorageService';
import { RecordingResult } from '../types/recording';
import { StorageSettings } from '../types/config';

export class StorageIpcHandlers {
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Save recording locally
    ipcMain.handle('storage:saveLocal', async (_, recording: RecordingResult, path: string) => {
      try {
        const filePath = await this.storageService.saveLocal(recording, path);
        return { success: true, filePath };
      } catch (error) {
        console.error('IPC Error saving recording locally:', error);
        throw error;
      }
    });

    // Upload recording to S3
    ipcMain.handle('storage:uploadToS3', async (_, recording: RecordingResult, config: StorageSettings['s3']) => {
      try {
        const s3Url = await this.storageService.uploadToS3(recording, config);
        return { success: true, s3Url };
      } catch (error) {
        console.error('IPC Error uploading to S3:', error);
        throw error;
      }
    });

    // Generate file name
    ipcMain.handle('storage:generateFileName', async (_, metadata: RecordingResult['metadata']) => {
      try {
        const fileName = this.storageService.generateFileName(metadata);
        return { success: true, fileName };
      } catch (error) {
        console.error('IPC Error generating file name:', error);
        throw error;
      }
    });

    // Validate storage configuration
    ipcMain.handle('storage:validateConfig', async (_, settings: StorageSettings) => {
      try {
        const isValid = await this.storageService.validateStorageConfig(settings);
        return { success: true, isValid };
      } catch (error) {
        console.error('IPC Error validating storage config:', error);
        return { success: false, isValid: false, error: error.message };
      }
    });

    // Test S3 connection
    ipcMain.handle('storage:testS3Connection', async (_, config: StorageSettings['s3']) => {
      try {
        const isConnected = await this.storageService.testS3Connection(config);
        return { success: true, isConnected };
      } catch (error) {
        console.error('IPC Error testing S3 connection:', error);
        return { success: false, isConnected: false, error: error.message };
      }
    });

    // Get available storage space
    ipcMain.handle('storage:getAvailableSpace', async (_, path: string) => {
      try {
        const availableSpace = await this.storageService.getAvailableSpace(path);
        return { success: true, availableSpace };
      } catch (error) {
        console.error('IPC Error getting available space:', error);
        return { success: false, availableSpace: 0, error: error.message };
      }
    });
  }

  // Method to remove all handlers (useful for cleanup)
  removeHandlers(): void {
    const handlers = [
      'storage:saveLocal',
      'storage:uploadToS3',
      'storage:generateFileName',
      'storage:validateConfig',
      'storage:testS3Connection',
      'storage:getAvailableSpace',
    ];

    handlers.forEach((handler) => {
      ipcMain.removeHandler(handler);
    });
  }
}
