import { RendererStorageService } from '../services/RendererStorageService';
import { RecordingMetadata } from '../types';

// Mock window.electron
const mockElectronStorage = {
  generateFileName: jest.fn(),
  saveLocal: jest.fn(),
  uploadToS3: jest.fn(),
};

Object.defineProperty(global, 'window', {
  value: {
    electron: {
      storage: mockElectronStorage,
    },
  },
  writable: true,
});

describe('RendererStorageService', () => {
  let service: RendererStorageService;
  let mockMetadata: RecordingMetadata;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RendererStorageService();

    mockMetadata = {
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
  });

  describe('generateFileName', () => {
    it('should generate filename synchronously', () => {
      const filename = service.generateFileName(mockMetadata);

      expect(filename).toMatch(/^test_tenant_TEST123_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.webm$/);
    });

    it('should sanitize special characters', () => {
      const metadata = {
        ...mockMetadata,
        tenantId: 'test@tenant.com',
        barcode: 'TEST-123/ABC',
      };

      const filename = service.generateFileName(metadata);

      expect(filename).toMatch(/^test_tenant_com_TEST_123_ABC_/);
    });

    it('should handle empty values', () => {
      const metadata = {
        ...mockMetadata,
        tenantId: '',
        barcode: '',
      };

      const filename = service.generateFileName(metadata);

      expect(filename).toMatch(/^__\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.webm$/);
    });
  });

  describe('saveLocal', () => {
    it('should call electron IPC for local save', async () => {
      const mockRecording = {
        blob: new Blob(['test'], { type: 'video/webm' }),
        metadata: mockMetadata,
      };

      mockElectronStorage.saveLocal.mockResolvedValue({
        success: true,
        filePath: '/test/path/file.webm',
      });

      const result = await service.saveLocal(mockRecording, '/test/path');

      expect(mockElectronStorage.saveLocal).toHaveBeenCalledWith(mockRecording, '/test/path');
      expect(result).toBe('/test/path/file.webm');
    });

    it('should throw error on invalid recording data', async () => {
      await expect(service.saveLocal(null as any, '/test/path')).rejects.toThrow('Invalid recording data provided');
    });

    it('should throw error on IPC failure', async () => {
      const mockRecording = {
        blob: new Blob(['test'], { type: 'video/webm' }),
        metadata: mockMetadata,
      };

      mockElectronStorage.saveLocal.mockResolvedValue({
        success: false,
      });

      await expect(service.saveLocal(mockRecording, '/test/path')).rejects.toThrow('Failed to save recording locally');
    });
  });

  describe('uploadToS3', () => {
    it('should call electron IPC for S3 upload', async () => {
      const mockRecording = {
        blob: new Blob(['test'], { type: 'video/webm' }),
        metadata: mockMetadata,
      };

      const mockS3Config = {
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      };

      mockElectronStorage.uploadToS3.mockResolvedValue({
        success: true,
        s3Url: 's3://test-bucket/test-file.webm',
      });

      const result = await service.uploadToS3(mockRecording, mockS3Config);

      expect(mockElectronStorage.uploadToS3).toHaveBeenCalledWith(mockRecording, mockS3Config);
      expect(result).toBe('s3://test-bucket/test-file.webm');
    });

    it('should throw error on invalid recording data', async () => {
      const mockS3Config = {
        bucket: 'test-bucket',
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      };

      await expect(service.uploadToS3(null as any, mockS3Config)).rejects.toThrow('Invalid recording data provided');
    });
  });

  describe('saveRecording', () => {
    it('should save to local only when S3 not configured', async () => {
      const mockRecording = {
        blob: new Blob(['test'], { type: 'video/webm' }),
        metadata: mockMetadata,
      };

      mockElectronStorage.saveLocal.mockResolvedValue({
        success: true,
        filePath: '/test/path/file.webm',
      });

      const result = await service.saveRecording(mockRecording, '/test/path');

      expect(result.success).toBe(true);
      expect(result.localPath).toBe('/test/path/file.webm');
      expect(result.s3Path).toBeUndefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should return error when no storage options provided', async () => {
      const mockRecording = {
        blob: new Blob(['test'], { type: 'video/webm' }),
        metadata: mockMetadata,
      };

      const result = await service.saveRecording(mockRecording);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('At least one storage option');
    });
  });

  describe('status callbacks', () => {
    it('should register and call status callbacks', async () => {
      const callback = jest.fn();
      service.onStatusUpdate(callback);

      const mockRecording = {
        blob: new Blob(['test'], { type: 'video/webm' }),
        metadata: mockMetadata,
      };

      mockElectronStorage.saveLocal.mockResolvedValue({
        success: true,
        filePath: '/test/path/file.webm',
      });

      await service.saveRecording(mockRecording, '/test/path');

      expect(callback).toHaveBeenCalled();
    });

    it('should remove status callbacks', () => {
      const callback = jest.fn();
      service.onStatusUpdate(callback);
      service.removeStatusCallback(callback);

      // Should not throw
      expect(() => service.removeStatusCallback(callback)).not.toThrow();
    });
  });

  describe('getStorageStatus', () => {
    it('should return default storage status', () => {
      const status = service.getStorageStatus();

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

  describe('clearS3Client', () => {
    it('should not throw when called', () => {
      expect(() => service.clearS3Client()).not.toThrow();
    });
  });
});
