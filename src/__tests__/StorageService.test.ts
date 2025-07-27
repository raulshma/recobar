// Comprehensive unit tests for StorageService
import { StorageService } from '../services/StorageService';
import { RecordingResult, RecordingMetadata, S3Config, StorageError } from '../types';
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

// Mock Node.js fs module
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn(),
    access: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

// Mock Blob for Node.js environment
class MockBlob {
  private data: ArrayBuffer;
  public size: number;
  public type: string;

  constructor(data: string[], options: { type: string }) {
    const encoder = new TextEncoder();
    const combined = data.join('');
    this.data = encoder.encode(combined).buffer;
    this.size = this.data.byteLength;
    this.type = options.type;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.data;
  }
}

// Replace global Blob with our mock
(global as any).Blob = MockBlob;

describe('StorageService', () => {
  let storageService: StorageService;
  let tempDir: string;
  let mockRecording: RecordingResult;
  let mockS3Config: S3Config;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    storageService = new StorageService();
    tempDir = '/tmp/storage-test';

    // Create mock recording data
    const mockBlob = new Blob(['test video data'], { type: 'video/webm' });
    const mockMetadata: RecordingMetadata = {
      id: 'test-id',
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
      bucket: 'test-bucket',
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    };

    // Setup default fs mocks
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
      size: 15, // Match the expected blob size
    } as any);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);
    // Mock fs.access to throw ENOENT by default (file doesn't exist)
    mockFs.access.mockRejectedValue({ code: 'ENOENT' });
    mockFs.unlink.mockResolvedValue(undefined);

    // Setup default S3 mocks
    mockS3Send.mockResolvedValue({});
  });

  describe('generateFileName', () => {
    it('should generate a valid filename with tenant, barcode, and timestamp', () => {
      const filename = storageService.generateFileName(mockRecording.metadata);

      expect(filename).toMatch(/^test_tenant_TEST123_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.webm$/);
    });

    it('should sanitize special characters in tenant ID and barcode', () => {
      const metadata = {
        ...mockRecording.metadata,
        tenantId: 'test@tenant.com',
        barcode: 'TEST-123/ABC',
      };

      const filename = storageService.generateFileName(metadata);

      expect(filename).toMatch(/^test_tenant_com_TEST_123_ABC_/);
    });

    it('should handle empty tenant ID and barcode', () => {
      const metadata = {
        ...mockRecording.metadata,
        tenantId: '',
        barcode: '',
      };

      const filename = storageService.generateFileName(metadata);

      expect(filename).toMatch(/^__\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.webm$/);
    });

    it('should handle special characters comprehensively', () => {
      const metadata = {
        ...mockRecording.metadata,
        tenantId: 'test!@#$%^&*()tenant',
        barcode: 'TEST[]{}|\\:";\'<>?,./barcode',
      };

      const filename = storageService.generateFileName(metadata);

      expect(filename).toMatch(/^test__________tenant_TEST_______________barcode_/);
    });

    it('should handle unicode characters', () => {
      const metadata = {
        ...mockRecording.metadata,
        tenantId: 'tëst-tènant',
        barcode: 'TËST123',
      };

      const filename = storageService.generateFileName(metadata);

      expect(filename).toMatch(/^t_st_t_nant_T_ST123_/);
    });
  });

  describe('saveLocal', () => {
    it('should save recording to local file system', async () => {
      const filePath = await storageService.saveLocal(mockRecording, tempDir);

      expect(filePath).toContain(tempDir);
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockFs.rename).toHaveBeenCalled();
      expect(mockFs.stat).toHaveBeenCalled();
    });

    it('should validate recording data', async () => {
      const invalidRecordings = [
        null,
        undefined,
        {},
        { blob: null, metadata: mockRecording.metadata },
        { blob: mockRecording.blob, metadata: null },
      ];

      for (const invalidRecording of invalidRecordings) {
        await expect(
          storageService.saveLocal(invalidRecording as any, tempDir)
        ).rejects.toThrow('Invalid recording data provided');
      }
    });

    it('should validate and create local path', async () => {
      await storageService.saveLocal(mockRecording, tempDir);

      expect(mockFs.stat).toHaveBeenCalledWith(path.resolve(tempDir));
    });

    it('should create directory if it does not exist', async () => {
      mockFs.stat.mockRejectedValueOnce({ code: 'ENOENT' });

      await storageService.saveLocal(mockRecording, tempDir);

      expect(mockFs.mkdir).toHaveBeenCalledWith(path.resolve(tempDir), { recursive: true });
    });

    it('should throw error if path exists but is not a directory', async () => {
      // Mock stat to return a file (not directory) for the main path check
      mockFs.stat.mockResolvedValueOnce({
        isDirectory: () => false,
      } as any);
      
      // But still throw ENOENT for the write test file check
      mockFs.access.mockImplementation((filePath: any) => {
        if (typeof filePath === 'string' && filePath.includes('.write-test-')) {
          throw { code: 'ENOENT' };
        }
        throw { code: 'ENOENT' };
      });

      await expect(
        storageService.saveLocal(mockRecording, tempDir)
      ).rejects.toThrow('Storage path exists but is not a directory');
    });

    it('should throw error if directory cannot be created', async () => {
      mockFs.stat.mockRejectedValueOnce({ code: 'ENOENT' });
      mockFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(
        storageService.saveLocal(mockRecording, tempDir)
      ).rejects.toThrow('Cannot create storage directory');
    });

    it('should check write permissions', async () => {
      await storageService.saveLocal(mockRecording, tempDir);

      // Should create and delete a test file
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.write-test-\d+$/),
        'test'
      );
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringMatching(/\.write-test-\d+$/)
      );
    });

    it('should throw error if no write permission', async () => {
      mockFs.writeFile.mockImplementation((filePath: any) => {
        if (typeof filePath === 'string' && filePath.includes('.write-test-')) {
          throw new Error('Permission denied');
        }
        return Promise.resolve();
      });

      await expect(
        storageService.saveLocal(mockRecording, tempDir)
      ).rejects.toThrow('No write permission for storage directory');
    });

    it('should throw error for empty recording blob', async () => {
      const emptyRecording = {
        ...mockRecording,
        blob: new Blob([], { type: 'video/webm' }),
      };

      await expect(
        storageService.saveLocal(emptyRecording, tempDir)
      ).rejects.toThrow('Recording blob is empty');
    });

    it('should throw error if file already exists', async () => {
      // Mock access to succeed (file exists)
      mockFs.access.mockImplementation((filePath: any) => {
        if (typeof filePath === 'string' && !filePath.includes('.write-test-')) {
          return Promise.resolve();
        }
        throw { code: 'ENOENT' };
      });

      await expect(
        storageService.saveLocal(mockRecording, tempDir)
      ).rejects.toThrow('File already exists');
    });

    it('should use atomic write with temporary file', async () => {
      await storageService.saveLocal(mockRecording, tempDir);

      const writeCall = mockFs.writeFile.mock.calls.find(call =>
        call[0].toString().endsWith('.tmp')
      );
      const renameCall = mockFs.rename.mock.calls[0];

      expect(writeCall).toBeDefined();
      expect(renameCall[0]).toMatch(/\.tmp$/);
      expect(renameCall[1]).not.toMatch(/\.tmp$/);
    });

    it('should clean up temporary file on write error', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Write failed'));

      await expect(
        storageService.saveLocal(mockRecording, tempDir)
      ).rejects.toThrow();

      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringMatching(/\.tmp$/)
      );
    });

    it('should verify file size after write', async () => {
      const expectedSize = Buffer.from('test video data').length;
      mockFs.stat.mockResolvedValueOnce({
        isDirectory: () => true,
      } as any);
      mockFs.stat.mockResolvedValueOnce({
        size: expectedSize,
      } as any);

      await storageService.saveLocal(mockRecording, tempDir);

      expect(mockFs.stat).toHaveBeenCalledTimes(2);
    });

    it('should throw error if file size mismatch', async () => {
      mockFs.stat.mockResolvedValueOnce({
        isDirectory: () => true,
      } as any);
      mockFs.stat.mockResolvedValueOnce({
        size: 999, // Wrong size
      } as any);

      await expect(
        storageService.saveLocal(mockRecording, tempDir)
      ).rejects.toThrow('File size mismatch after write');
    });

    it('should handle various file system errors', async () => {
      const errors = [
        { code: 'EACCES', expectedMessage: 'Cannot access storage directory' },
        { code: 'ENOSPC', expectedMessage: 'Cannot access storage directory' },
        { code: 'EMFILE', expectedMessage: 'Cannot access storage directory' },
      ];

      for (const { code, expectedMessage } of errors) {
        mockFs.stat.mockRejectedValueOnce({ code });

        await expect(
          storageService.saveLocal(mockRecording, tempDir)
        ).rejects.toThrow(expectedMessage);

        // Reset mock for next iteration
        mockFs.stat.mockResolvedValue({
          isDirectory: () => true,
        } as any);
      }
    });
  });

  describe('uploadToS3', () => {
    it('should upload recording to S3 successfully', async () => {
      const result = await storageService.uploadToS3(mockRecording, mockS3Config);

      expect(result).toBe('s3://test-bucket/recordings/test-tenant/test_tenant_TEST123_2023-01-01T10-00-00-000Z.webm');
      expect(mockS3Send).toHaveBeenCalled();
    });

    it('should validate S3 configuration', async () => {
      const invalidConfigs = [
        { ...mockS3Config, bucket: '' },
        { ...mockS3Config, region: '' },
        { ...mockS3Config, accessKeyId: '' },
        { ...mockS3Config, secretAccessKey: '' },
        { ...mockS3Config, bucket: 'invalid_bucket_name' },
        { ...mockS3Config, region: 'invalid-region!' },
      ];

      for (const invalidConfig of invalidConfigs) {
        await expect(
          storageService.uploadToS3(mockRecording, invalidConfig)
        ).rejects.toThrow();
      }
    });

    it('should validate recording data', async () => {
      const invalidRecordings = [
        null,
        undefined,
        {},
        { blob: null, metadata: mockRecording.metadata },
        { blob: mockRecording.blob, metadata: null },
      ];

      for (const invalidRecording of invalidRecordings) {
        await expect(
          storageService.uploadToS3(invalidRecording as any, mockS3Config)
        ).rejects.toThrow('Invalid recording data provided');
      }
    });

    it('should test S3 connection before upload', async () => {
      await storageService.uploadToS3(mockRecording, mockS3Config);

      // Should call ListObjectsV2Command for connection test
      expect(mockS3Send).toHaveBeenCalledWith(
        expect.objectContaining({ _type: 'ListObjectsV2Command' })
      );
    });

    it('should handle S3 connection errors', async () => {
      const s3Errors = [
        { message: 'NoSuchBucket', expectedError: 'S3 bucket does not exist' },
        { message: 'InvalidAccessKeyId', expectedError: 'Invalid S3 access key ID' },
        { message: 'SignatureDoesNotMatch', expectedError: 'Invalid S3 secret access key' },
        { message: 'AccessDenied', expectedError: 'Access denied to S3 bucket' },
        { message: 'Unknown error', expectedError: 'S3 connection test failed' },
      ];

      for (const { message, expectedError } of s3Errors) {
        mockS3Send.mockRejectedValueOnce(new Error(message));

        await expect(
          storageService.uploadToS3(mockRecording, mockS3Config)
        ).rejects.toThrow(expectedError);

        // Reset mock for next iteration
        mockS3Send.mockResolvedValue({});
      }
    });

    it('should retry upload on failure', async () => {
      mockS3Send
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({});

      const result = await storageService.uploadToS3(mockRecording, mockS3Config);

      expect(result).toBeDefined();
      expect(mockS3Send).toHaveBeenCalledTimes(4); // 1 connection test + 3 upload attempts
    });

    it('should fail after max retries', async () => {
      mockS3Send.mockRejectedValue(new Error('Persistent failure'));

      await expect(
        storageService.uploadToS3(mockRecording, mockS3Config)
      ).rejects.toThrow('Persistent failure');

      expect(mockS3Send).toHaveBeenCalledTimes(5); // 1 connection test + 4 upload attempts (3 retries + 1 initial)
    });

    it('should include metadata in S3 upload', async () => {
      await storageService.uploadToS3(mockRecording, mockS3Config);

      const putObjectCall = mockS3Send.mock.calls.find(call =>
        call[0]._type === 'PutObjectCommand'
      );

      expect(putObjectCall[0]).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'recordings/test-tenant/test_tenant_TEST123_2023-01-01T10-00-00-000Z.webm',
        ContentType: 'video/webm',
        Metadata: {
          tenantId: 'test-tenant',
          barcode: 'TEST123',
          startTime: '2023-01-01T10:00:00.000Z',
          endTime: '2023-01-01T10:05:00.000Z',
          duration: '300000',
          webcamId: 'test-webcam',
          hasAudio: 'true',
          resolution: '1920x1080',
        },
        Tagging: 'tenant=test-tenant&barcode=TEST123',
      });
    });

    it('should throw error for empty recording blob', async () => {
      const emptyRecording = {
        ...mockRecording,
        blob: new Blob([], { type: 'video/webm' }),
      };

      await expect(
        storageService.uploadToS3(emptyRecording, mockS3Config)
      ).rejects.toThrow('Recording blob is empty');
    });

    it('should clear S3 client when requested', () => {
      storageService.clearS3Client();

      // Should not throw
      expect(() => storageService.clearS3Client()).not.toThrow();
    });
  });

  describe('saveRecording', () => {
    it('should save to local storage only when S3 not configured', async () => {
      const result = await storageService.saveRecording(mockRecording, tempDir);

      expect(result.success).toBe(true);
      expect(result.localPath).toBeDefined();
      expect(result.s3Path).toBeUndefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should save to S3 only when local not configured', async () => {
      const result = await storageService.saveRecording(mockRecording, undefined, mockS3Config);

      expect(result.success).toBe(true);
      expect(result.localPath).toBeUndefined();
      expect(result.s3Path).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should save to both local and S3 when both configured', async () => {
      const result = await storageService.saveRecording(mockRecording, tempDir, mockS3Config);

      expect(result.success).toBe(true);
      expect(result.localPath).toBeDefined();
      expect(result.s3Path).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial failures gracefully', async () => {
      // Mock S3 to fail
      mockS3Send.mockRejectedValue(new Error('S3 upload failed'));

      const result = await storageService.saveRecording(mockRecording, tempDir, mockS3Config);

      expect(result.success).toBe(false);
      expect(result.localPath).toBeDefined(); // Local should succeed
      expect(result.s3Path).toBeUndefined(); // S3 should fail
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('s3');

      // Reset mock
      mockS3Send.mockResolvedValue({});
    });

    it('should handle local storage failure', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Local write failed'));

      const result = await storageService.saveRecording(mockRecording, tempDir, mockS3Config);

      expect(result.success).toBe(false);
      expect(result.localPath).toBeUndefined(); // Local should fail
      expect(result.s3Path).toBeDefined(); // S3 should succeed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('local');

      // Reset mock
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should handle both storage methods failing', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Local write failed'));
      mockS3Send.mockRejectedValue(new Error('S3 upload failed'));

      const result = await storageService.saveRecording(mockRecording, tempDir, mockS3Config);

      expect(result.success).toBe(false);
      expect(result.localPath).toBeUndefined();
      expect(result.s3Path).toBeUndefined();
      expect(result.errors).toHaveLength(2);
      expect(result.errors.some(e => e.type === 'local')).toBe(true);
      expect(result.errors.some(e => e.type === 's3')).toBe(true);

      // Reset mocks
      mockFs.writeFile.mockResolvedValue(undefined);
      mockS3Send.mockResolvedValue({});
    });

    it('should return error when no storage options provided', async () => {
      const result = await storageService.saveRecording(mockRecording);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('At least one storage option');
    });

    it('should execute storage operations concurrently', async () => {
      const startTime = Date.now();

      // Add delays to both operations
      mockFs.writeFile.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      );
      mockS3Send.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      );

      await storageService.saveRecording(mockRecording, tempDir, mockS3Config);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take less than 200ms if concurrent (vs 200ms+ if sequential)
      expect(duration).toBeLessThan(180);

      // Reset mocks
      mockFs.writeFile.mockResolvedValue(undefined);
      mockS3Send.mockResolvedValue({});
    });
  });

  describe('status callbacks', () => {
    it('should notify callbacks of storage status updates', async () => {
      const statusCallback = jest.fn();
      storageService.onStatusUpdate(statusCallback);

      await storageService.saveRecording(mockRecording, tempDir);

      expect(statusCallback).toHaveBeenCalled();

      // Check that status updates were called with correct structure
      const calls = statusCallback.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toHaveProperty('local');
      expect(calls[0][0]).toHaveProperty('s3');
    });

    it('should notify callbacks with correct status progression', async () => {
      const statusCallback = jest.fn();
      storageService.onStatusUpdate(statusCallback);

      await storageService.saveRecording(mockRecording, tempDir, mockS3Config);

      const calls = statusCallback.mock.calls;

      // Should have multiple calls showing progression
      expect(calls.length).toBeGreaterThan(1);

      // First call should show operations starting
      expect(calls[0][0].local.inProgress).toBe(true);
      expect(calls[0][0].s3.inProgress).toBe(true);

      // Last call should show operations completed
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.local.completed).toBe(true);
      expect(lastCall.s3.completed).toBe(true);
    });

    it('should notify callbacks of errors', async () => {
      const statusCallback = jest.fn();
      storageService.onStatusUpdate(statusCallback);

      mockFs.writeFile.mockRejectedValue(new Error('Local error'));

      await storageService.saveRecording(mockRecording, tempDir);

      const calls = statusCallback.mock.calls;
      const errorCall = calls.find(call => call[0].local.error);

      expect(errorCall).toBeDefined();
      expect(errorCall[0].local.error.type).toBe('local');

      // Reset mock
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();

      storageService.onStatusUpdate(errorCallback);
      storageService.onStatusUpdate(normalCallback);

      // Should not throw despite callback error
      await expect(
        storageService.saveRecording(mockRecording, tempDir)
      ).resolves.toBeDefined();

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    it('should remove callbacks correctly', async () => {
      const statusCallback = jest.fn();
      storageService.onStatusUpdate(statusCallback);
      storageService.removeStatusCallback(statusCallback);

      await storageService.saveRecording(mockRecording, tempDir);

      // Callback should not be called after removal
      expect(statusCallback).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent callback', () => {
      const callback = jest.fn();

      expect(() => {
        storageService.removeStatusCallback(callback);
      }).not.toThrow();
    });

    it('should return default storage status', () => {
      const status = storageService.getStorageStatus();

      expect(status).toEqual({
        local: {
          enabled: false,
          inProgress: false,
          completed: false,
        },
        s3: {
          enabled: false,
          inProgress: false,
          completed: false,
        },
      });
    });
  });

  describe('error handling', () => {
    it('should create storage errors with correct type', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const result = await storageService.saveRecording(mockRecording, tempDir);

      expect(result.errors[0]).toHaveProperty('type', 'local');
      expect(result.errors[0]).toHaveProperty('message');
      expect(result.errors[0]).toHaveProperty('originalError');
    });

    it('should handle validation errors', async () => {
      const result = await storageService.saveRecording(null as any);

      expect(result.errors[0].type).toBe('validation');
      expect(result.errors[0].message).toContain('At least one storage option');
    });

    it('should handle S3 validation errors', async () => {
      const invalidS3Config = {
        bucket: '',
        region: 'us-east-1',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
      };

      await expect(
        storageService.uploadToS3(mockRecording, invalidS3Config)
      ).rejects.toThrow();
    });

    it('should handle local path validation errors', async () => {
      mockFs.stat.mockRejectedValue({ code: 'EACCES' });

      await expect(
        storageService.saveLocal(mockRecording, '/invalid/path')
      ).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle very large recordings', async () => {
      const largeData = 'x'.repeat(1000000); // 1MB of data
      const largeRecording = {
        ...mockRecording,
        blob: new Blob([largeData], { type: 'video/webm' }),
      };

      const result = await storageService.saveRecording(largeRecording, tempDir);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in paths', async () => {
      const specialPath = '/tmp/test with spaces & special chars!';

      const result = await storageService.saveRecording(mockRecording, specialPath);

      expect(result.success).toBe(true);
    });

    it('should handle concurrent save operations', async () => {
      const promises = [
        storageService.saveRecording(mockRecording, tempDir),
        storageService.saveRecording(mockRecording, tempDir),
        storageService.saveRecording(mockRecording, tempDir),
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle metadata with extreme values', async () => {
      const extremeMetadata = {
        ...mockRecording.metadata,
        duration: Number.MAX_SAFE_INTEGER,
        resolution: { width: 0, height: 0 },
        barcode: '',
        tenantId: 'a'.repeat(1000),
      };

      const extremeRecording = {
        ...mockRecording,
        metadata: extremeMetadata,
      };

      const result = await storageService.saveRecording(extremeRecording, tempDir);

      expect(result.success).toBe(true);
    });

    it('should handle network timeouts for S3', async () => {
      mockS3Send.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      await expect(
        storageService.uploadToS3(mockRecording, mockS3Config)
      ).rejects.toThrow('Network timeout');

      // Reset mock
      mockS3Send.mockResolvedValue({});
    });
  });
});
