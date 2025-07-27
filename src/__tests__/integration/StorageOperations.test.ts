// Integration tests for storage operations with mock S3 and file system
import { StorageService } from '../../services/StorageService';
import { RecordingManager } from '../../services/RecordingManager';
import { RecordingResult, RecordingMetadata, S3Config } from '../../types';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock AWS SDK
const mockS3Send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'PutObjectCommand' })),
  ListObjectsV2Command: jest.fn().mockImplementation((params) => ({ ...params, _type: 'ListObjectsV2Command' })),
}));

// Mock Node.js fs module for controlled testing
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn(),
    access: jest.fn(),
    rm: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

// Mock MediaRecorder for recording integration
class MockMediaRecorder {
  public state: 'inactive' | 'recording' | 'paused' = 'inactive';
  public mimeType: string;
  public ondataavailable: ((event: BlobEvent) => void) | null = null;
  public onstop: (() => void) | null = null;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType || 'video/webm';
  }

  start() {
    this.state = 'recording';
    setTimeout(() => {
      if (this.ondataavailable) {
        const mockBlob = new Blob(['test video data'], { type: this.mimeType });
        this.ondataavailable({ data: mockBlob } as BlobEvent);
      }
    }, 10);
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      setTimeout(() => this.onstop!(), 10);
    }
  }

  static isTypeSupported(): boolean {
    return true;
  }
}

// Mock MediaStream
class MockMediaStream {
  getTracks() {
    return [
      { kind: 'video', getSettings: () => ({ width: 1920, height: 1080 }) },
      { kind: 'audio', getSettings: () => ({}) },
    ];
  }

  getVideoTracks() {
    return [{ getSettings: () => ({ width: 1920, height: 1080 }) }];
  }

  getAudioTracks() {
    return [{}];
  }
}

// Setup global mocks
(global as any).MediaRecorder = MockMediaRecorder;
(global as any).MediaStream = MockMediaStream;
(global as any).Blob = class MockBlob {
  public size: number;
  public type: string;
  private data: any[];

  constructor(data: any[], options: { type: string }) {
    this.data = data;
    this.size = data.reduce((acc, item) => acc + (item.length || 0), 0);
    this.type = options.type;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const combined = this.data.join('');
    return encoder.encode(combined).buffer;
  }
};

// Mock window.electron API
const mockElectronConfig = {
  getTenantId: jest.fn(),
  getWebcamId: jest.fn(),
};

Object.defineProperty(global, 'window', {
  value: {
    electron: {
      config: mockElectronConfig,
    },
  },
  writable: true,
});

describe('Storage Operations Integration', () => {
  let storageService: StorageService;
  let recordingManager: RecordingManager;
  let mockRecording: RecordingResult;
  let mockS3Config: S3Config;
  let tempDir: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    storageService = new StorageService();
    recordingManager = new RecordingManager();
    tempDir = '/tmp/test-storage';

    // Setup mock electron config
    mockElectronConfig.getTenantId.mockResolvedValue('test-tenant');
    mockElectronConfig.getWebcamId.mockResolvedValue('test-webcam');

    // Create mock recording data
    const mockBlob = new Blob(['test video data'], { type: 'video/webm' });
    const mockMetadata: RecordingMetadata = {
      id: 'test-recording-id',
      tenantId: 'test-tenant',
      barcode: 'TEST123',
      startTime: new Date('2023-01-01T10:00:00Z'),
      endTime: new Date('2023-01-01T10:05:00Z'),
      duration: 300000,
      webcamId: 'test-webcam',
      resolution: { width: 1920, height: 1080 },
      hasAudio: true,
    };

    mockRecording = {
      blob: mockBlob,
      metadata: mockMetadata,
    };

    mockS3Config = {
      bucket: 'test-recordings-bucket',
      region: 'us-east-1',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    };

    // Setup default fs mocks
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
      size: 1024,
    } as any);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);

    // Setup default S3 mocks
    mockS3Send.mockResolvedValue({});
  });

  describe('End-to-end recording and storage workflow', () => {
    it('should complete full recording to storage workflow', async () => {
      // Step 1: Create a recording
      const mockStream = new MockMediaStream();
      await recordingManager.startRecording(mockStream as any, 'WORKFLOW123');

      // Wait for recording to collect data
      await new Promise(resolve => setTimeout(resolve, 50));

      const recordingResult = await recordingManager.stopRecording();

      // Step 2: Store the recording locally
      const localPath = await storageService.saveLocal(recordingResult, tempDir);

      expect(localPath).toContain(tempDir);
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockFs.rename).toHaveBeenCalled();

      // Step 3: Upload to S3
      const s3Path = await storageService.uploadToS3(recordingResult, mockS3Config);

      expect(s3Path).toMatch(/^s3:\/\/test-recordings-bucket\/recordings\/test-tenant\//);
      expect(mockS3Send).toHaveBeenCalledWith(
        expect.objectContaining({ _type: 'PutObjectCommand' })
      );

      // Verify metadata is preserved
      expect(recordingResult.metadata.barcode).toBe('WORKFLOW123');
      expect(recordingResult.metadata.tenantId).toBe('test-tenant');
    });

    it('should handle concurrent storage operations', async () => {
      // Create multiple recordings
      const recordings: RecordingResult[] = [];
      const mockStream = new MockMediaStream();

      for (let i = 0; i < 3; i++) {
        await recordingManager.startRecording(mockStream as any, `CONCURRENT${i}`);
        await new Promise(resolve => setTimeout(resolve, 20));
        const result = await recordingManager.stopRecording();
        recordings.push(result);
      }

      // Store all recordings concurrently
      const storagePromises = recordings.map(recording =>
        storageService.saveRecording(recording, tempDir, mockS3Config)
      );

      const results = await Promise.all(storagePromises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.localPath).toBeDefined();
        expect(result.s3Path).toBeDefined();
        expect(result.errors).toHaveLength(0);
      });

      // Verify all files were written
      expect(mockFs.writeFile).toHaveBeenCalledTimes(3);
      expect(mockS3Send).toHaveBeenCalledTimes(6); // 3 connection tests + 3 uploads
    });

    it('should handle storage with status callbacks', async () => {
      const statusUpdates: any[] = [];
      const statusCallback = jest.fn((status) => {
        statusUpdates.push(JSON.parse(JSON.stringify(status)));
      });

      storageService.onStatusUpdate(statusCallback);

      // Create and store recording
      const mockStream = new MockMediaStream();
      await recordingManager.startRecording(mockStream as any, 'STATUS123');
      await new Promise(resolve => setTimeout(resolve, 20));
      const recordingResult = await recordingManager.stopRecording();

      await storageService.saveRecording(recordingResult, tempDir, mockS3Config);

      // Should have received status updates
      expect(statusCallback).toHaveBeenCalled();
      expect(statusUpdates.length).toBeGreaterThan(0);

      // Check status progression
      const firstUpdate = statusUpdates[0];
      expect(firstUpdate.local.enabled).toBe(true);
      expect(firstUpdate.s3.enabled).toBe(true);

      const lastUpdate = statusUpdates[statusUpdates.length - 1];
      expect(lastUpdate.local.completed).toBe(true);
      expect(lastUpdate.s3.completed).toBe(true);
    });

    it('should handle partial storage failures gracefully', async () => {
      // Mock S3 failure
      mockS3Send.mockRejectedValue(new Error('S3 service unavailable'));

      const mockStream = new MockMediaStream();
      await recordingManager.startRecording(mockStream as any, 'PARTIAL123');
      await new Promise(resolve => setTimeout(resolve, 20));
      const recordingResult = await recordingManager.stopRecording();

      const result = await storageService.saveRecording(recordingResult, tempDir, mockS3Config);

      // Should succeed partially
      expect(result.success).toBe(false);
      expect(result.localPath).toBeDefined(); // Local should succeed
      expect(result.s3Path).toBeUndefined(); // S3 should fail
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('s3');

      // Recording should still be accessible locally
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle large recording files', async () => {
      // Create a large mock recording
      const largeData = 'x'.repeat(10000); // 10KB of data
      const largeMockRecording = {
        ...mockRecording,
        blob: new Blob([largeData], { type: 'video/webm' }),
      };

      // Mock file size verification
      mockFs.stat.mockResolvedValueOnce({
        isDirectory: () => true,
      } as any);
      mockFs.stat.mockResolvedValueOnce({
        size: largeData.length,
      } as any);

      const result = await storageService.saveRecording(largeMockRecording, tempDir, mockS3Config);

      expect(result.success).toBe(true);
      expect(result.localPath).toBeDefined();
      expect(result.s3Path).toBeDefined();

      // Verify S3 upload includes correct content length
      const s3UploadCall = mockS3Send.mock.calls.find(call =>
        call[0]._type === 'PutObjectCommand'
      );
      expect(s3UploadCall[0].ContentLength).toBe(largeData.length);
    });
  });

  describe('Storage resilience and recovery', () => {
    it('should retry failed S3 uploads', async () => {
      // Mock S3 to fail twice then succeed
      mockS3Send
        .mockResolvedValueOnce({}) // Connection test
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({}); // Success on third try

      const result = await storageService.uploadToS3(mockRecording, mockS3Config);

      expect(result).toBeDefined();
      expect(mockS3Send).toHaveBeenCalledTimes(4); // 1 connection test + 3 upload attempts
    });

    it('should handle file system permission errors', async () => {
      // Mock permission denied error
      mockFs.writeFile.mockImplementation((filePath: any) => {
        if (typeof filePath === 'string' && filePath.includes('.write-test-')) {
          throw { code: 'EACCES', message: 'Permission denied' };
        }
        return Promise.resolve();
      });

      await expect(
        storageService.saveLocal(mockRecording, tempDir)
      ).rejects.toThrow('No write permission');
    });

    it('should handle disk space errors', async () => {
      // Mock disk full error
      mockFs.writeFile.mockRejectedValue({ code: 'ENOSPC', message: 'No space left on device' });

      const result = await storageService.saveRecording(mockRecording, tempDir, mockS3Config);

      // Should fail locally but succeed on S3
      expect(result.success).toBe(false);
      expect(result.localPath).toBeUndefined();
      expect(result.s3Path).toBeDefined();
      expect(result.errors.some(e => e.type === 'local')).toBe(true);
    });

    it('should handle network timeouts for S3', async () => {
      // Mock network timeout
      mockS3Send.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      await expect(
        storageService.uploadToS3(mockRecording, mockS3Config)
      ).rejects.toThrow('Network timeout');
    });

    it('should handle corrupted recording data', async () => {
      // Create recording with corrupted blob
      const corruptedRecording = {
        ...mockRecording,
        blob: null as any,
      };

      await expect(
        storageService.saveLocal(corruptedRecording, tempDir)
      ).rejects.toThrow('Invalid recording data');

      await expect(
        storageService.uploadToS3(corruptedRecording, mockS3Config)
      ).rejects.toThrow('Invalid recording data');
    });

    it('should handle S3 credential errors', async () => {
      // Mock credential errors
      const credentialErrors = [
        { message: 'InvalidAccessKeyId', expectedError: 'Invalid S3 access key ID' },
        { message: 'SignatureDoesNotMatch', expectedError: 'Invalid S3 secret access key' },
        { message: 'AccessDenied', expectedError: 'Access denied to S3 bucket' },
      ];

      for (const { message, expectedError } of credentialErrors) {
        mockS3Send.mockRejectedValueOnce(new Error(message));

        await expect(
          storageService.uploadToS3(mockRecording, mockS3Config)
        ).rejects.toThrow(expectedError);

        // Reset for next iteration
        mockS3Send.mockResolvedValue({});
      }
    });
  });

  describe('Storage configuration and validation', () => {
    it('should validate storage paths before use', async () => {
      // Test various invalid paths
      const invalidPaths = [
        '', // Empty path
        '/root/restricted', // Restricted path
        '/nonexistent/deep/path', // Non-existent path
      ];

      for (const invalidPath of invalidPaths) {
        mockFs.stat.mockRejectedValueOnce({ code: 'ENOENT' });
        mockFs.mkdir.mockRejectedValueOnce(new Error('Cannot create directory'));

        await expect(
          storageService.saveLocal(mockRecording, invalidPath)
        ).rejects.toThrow();

        // Reset mocks for next iteration
        mockFs.stat.mockResolvedValue({
          isDirectory: () => true,
        } as any);
        mockFs.mkdir.mockResolvedValue(undefined);
      }
    });

    it('should validate S3 configuration before upload', async () => {
      const invalidConfigs = [
        { ...mockS3Config, bucket: '' },
        { ...mockS3Config, region: '' },
        { ...mockS3Config, accessKeyId: '' },
        { ...mockS3Config, secretAccessKey: '' },
        { ...mockS3Config, bucket: 'invalid_bucket_name!' },
      ];

      for (const invalidConfig of invalidConfigs) {
        await expect(
          storageService.uploadToS3(mockRecording, invalidConfig)
        ).rejects.toThrow();
      }
    });

    it('should test S3 connectivity before upload', async () => {
      // Mock S3 bucket not found
      mockS3Send.mockRejectedValueOnce(new Error('NoSuchBucket'));

      await expect(
        storageService.uploadToS3(mockRecording, mockS3Config)
      ).rejects.toThrow('S3 bucket does not exist');

      // Should have called ListObjectsV2Command for connection test
      expect(mockS3Send).toHaveBeenCalledWith(
        expect.objectContaining({ _type: 'ListObjectsV2Command' })
      );
    });

    it('should generate unique filenames for concurrent recordings', async () => {
      const recordings: RecordingResult[] = [];

      // Create multiple recordings with same barcode but different timestamps
      for (let i = 0; i < 5; i++) {
        const metadata = {
          ...mockRecording.metadata,
          id: `recording-${i}`,
          startTime: new Date(Date.now() + i * 1000), // Different timestamps
        };
        recordings.push({
          ...mockRecording,
          metadata,
        });
      }

      // Generate filenames
      const filenames = recordings.map(recording =>
        storageService.generateFileName(recording.metadata)
      );

      // All filenames should be unique
      const uniqueFilenames = new Set(filenames);
      expect(uniqueFilenames.size).toBe(filenames.length);

      // All should follow the expected pattern
      filenames.forEach(filename => {
        expect(filename).toMatch(/^test_tenant_TEST123_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.webm$/);
      });
    });
  });

  describe('Performance and scalability', () => {
    it('should handle high-frequency recording storage', async () => {
      const recordings: RecordingResult[] = [];
      const mockStream = new MockMediaStream();

      // Create many short recordings rapidly
      for (let i = 0; i < 10; i++) {
        await recordingManager.startRecording(mockStream as any, `RAPID${i}`);
        await new Promise(resolve => setTimeout(resolve, 10)); // Very short recordings
        const result = await recordingManager.stopRecording();
        recordings.push(result);
      }

      const startTime = Date.now();

      // Store all recordings concurrently
      const storagePromises = recordings.map(recording =>
        storageService.saveRecording(recording, tempDir)
      );

      const results = await Promise.all(storagePromises);
      const endTime = Date.now();

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete in reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle storage cleanup operations', async () => {
      // Create and store recording
      const mockStream = new MockMediaStream();
      await recordingManager.startRecording(mockStream as any, 'CLEANUP123');
      await new Promise(resolve => setTimeout(resolve, 20));
      const recordingResult = await recordingManager.stopRecording();

      await storageService.saveLocal(recordingResult, tempDir);

      // Verify temporary files are cleaned up
      const writeFileCalls = mockFs.writeFile.mock.calls;
      const tempFileCalls = writeFileCalls.filter(call =>
        call[0].toString().endsWith('.tmp')
      );

      expect(tempFileCalls.length).toBeGreaterThan(0);

      // Should have renamed temp file to final file
      expect(mockFs.rename).toHaveBeenCalled();
    });

    it('should maintain performance with large metadata', async () => {
      // Create recording with extensive metadata
      const largeMetadata = {
        ...mockRecording.metadata,
        barcode: 'A'.repeat(1000), // Very long barcode
        tenantId: 'B'.repeat(500), // Long tenant ID
      };

      const largeMetadataRecording = {
        ...mockRecording,
        metadata: largeMetadata,
      };

      const startTime = Date.now();
      const result = await storageService.saveRecording(largeMetadataRecording, tempDir, mockS3Config);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete quickly

      // Verify metadata is properly sanitized in filename
      const filename = storageService.generateFileName(largeMetadata);
      expect(filename.length).toBeLessThan(300); // Reasonable filename length
    });
  });
});
