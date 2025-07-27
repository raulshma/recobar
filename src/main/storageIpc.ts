// Storage IPC handlers for file operations and S3 uploads
import { ipcMain } from 'electron';
import { StorageService } from '../services/StorageService';
import { RecordingResult, RecordingMetadata } from '../types/recording';
import { StorageSettings } from '../types/config';

// Interface for serialized recording data sent over IPC
interface SerializedRecordingData {
  metadata: RecordingMetadata;
  blobBuffer: number[]; // Array representation of Uint8Array
  blobType: string;
}

export class StorageIpcHandlers {
  private storageService: StorageService;

  constructor() {
    this.storageService = new StorageService();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Save recording locally
    ipcMain.handle('storage:saveLocal', async (_, recordingData: SerializedRecordingData, path: string) => {
      try {
        // Reconstruct blob from serialized data
        const recording: RecordingResult = {
          ...recordingData,
          blob: new Blob([Buffer.from(recordingData.blobBuffer)], { type: recordingData.blobType })
        };
        
        const filePath = await this.storageService.saveLocal(recording, path);
        return { success: true, filePath };
      } catch (error) {
        console.error('IPC Error saving recording locally:', error);
        throw error;
      }
    });

    // Upload recording to S3
    ipcMain.handle('storage:uploadToS3', async (_, recordingData: SerializedRecordingData, config: StorageSettings['s3Config']) => {
      try {
        if (!config) {
          throw new Error('S3 configuration is required');
        }

        // Reconstruct blob from serialized data
        const recording: RecordingResult = {
          ...recordingData,
          blob: new Blob([Buffer.from(recordingData.blobBuffer)], { type: recordingData.blobType })
        };
        
        const s3Url = await this.storageService.uploadToS3(recording, config);
        return { success: true, s3Url };
      } catch (error) {
        console.error('IPC Error uploading to S3:', error);
        throw error;
      }
    });

    // Generate file name
    ipcMain.handle('storage:generateFileName', async (_, metadata: RecordingMetadata) => {
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
        // Simple validation for now - can be extended
        const isValid = !!(settings.localPath || settings.s3Config);
        return { success: true, isValid };
      } catch (error) {
        console.error('IPC Error validating storage config:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, isValid: false, error: errorMessage };
      }
    });

    // Test S3 connection
    ipcMain.handle('storage:testS3Connection', async (_, config: StorageSettings['s3Config']) => {
      try {
        if (!config) {
          throw new Error('S3 configuration is required');
        }

        // Try to upload to S3 with the config to test connection
        // We'll catch any errors and return the connection status
        await this.storageService.uploadToS3({
          blob: new Blob(['test'], { type: 'text/plain' }),
          metadata: {
            id: 'test',
            tenantId: 'test',
            barcode: 'test',
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
            webcamId: 'test',
            resolution: { width: 640, height: 480 },
            hasAudio: false
          }
        }, config);
        
        return { success: true, isConnected: true };
      } catch (error) {
        console.error('IPC Error testing S3 connection:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, isConnected: false, error: errorMessage };
      }
    });

    // Get available storage space
    ipcMain.handle('storage:getAvailableSpace', async (_, path: string) => {
      try {
        // Use Node.js fs.statfs or similar to get available space
        const { statSync } = await import('fs');
        // For now, return a mock value - this would need proper implementation
        const availableSpace = 1024 * 1024 * 1024; // 1GB mock value
        return { success: true, availableSpace };
      } catch (error) {
        console.error('IPC Error getting available space:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, availableSpace: 0, error: errorMessage };
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
