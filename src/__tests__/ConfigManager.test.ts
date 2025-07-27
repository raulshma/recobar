// Comprehensive unit tests for ConfigManager service
import { ConfigManager } from '../services/ConfigManager';
import { StorageSettings, AppConfig } from '../types/config';

// Mock electron-store
const mockStore = {
  get: jest.fn(),
  set: jest.fn(),
  clear: jest.fn(),
  store: {},
};

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => mockStore);
});

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Reset store state
    mockStore.store = {};

    // Create new instance
    configManager = new ConfigManager();
  });

  describe('Tenant ID management', () => {
    it('should get tenant ID from store', async () => {
      mockStore.get.mockReturnValue('test-tenant');

      const result = await configManager.getTenantId();

      expect(result).toBe('test-tenant');
      expect(mockStore.get).toHaveBeenCalledWith('tenantId');
    });

    it('should return null when tenant ID is not set', async () => {
      mockStore.get.mockReturnValue(undefined);

      const result = await configManager.getTenantId();

      expect(result).toBeNull();
    });

    it('should return null when store throws error', async () => {
      mockStore.get.mockImplementation(() => {
        throw new Error('Store error');
      });

      const result = await configManager.getTenantId();

      expect(result).toBeNull();
    });

    it('should set valid tenant ID', async () => {
      await configManager.setTenantId('valid-tenant-123');

      expect(mockStore.set).toHaveBeenCalledWith(
        'tenantId',
        'valid-tenant-123',
      );
    });

    it('should accept tenant ID with hyphens and underscores', async () => {
      await configManager.setTenantId('valid_tenant-123');

      expect(mockStore.set).toHaveBeenCalledWith(
        'tenantId',
        'valid_tenant-123',
      );
    });

    it('should reject invalid tenant ID formats', async () => {
      const invalidIds = [
        '',
        'invalid tenant',
        'tenant@invalid',
        'tenant.invalid',
        'tenant/invalid',
        'tenant\\invalid',
        'tenant:invalid',
        'tenant;invalid',
        'tenant,invalid',
        'tenant<invalid',
        'tenant>invalid',
        'tenant|invalid',
        'tenant?invalid',
        'tenant*invalid',
        'tenant+invalid',
        'tenant=invalid',
        'tenant[invalid',
        'tenant]invalid',
        'tenant{invalid',
        'tenant}invalid',
        'tenant(invalid',
        'tenant)invalid',
        'tenant"invalid',
        "tenant'invalid",
        'tenant`invalid',
        'tenant~invalid',
        'tenant!invalid',
        'tenant#invalid',
        'tenant$invalid',
        'tenant%invalid',
        'tenant^invalid',
        'tenant&invalid',
      ];

      for (const invalidId of invalidIds) {
        await expect(configManager.setTenantId(invalidId)).rejects.toThrow(
          'Invalid tenant ID format',
        );
      }
    });

    it('should handle store errors when setting tenant ID', async () => {
      mockStore.set.mockImplementation(() => {
        throw new Error('Store write error');
      });

      await expect(configManager.setTenantId('valid-tenant')).rejects.toThrow(
        'Failed to save tenant ID',
      );
    });
  });

  describe('Webcam ID management', () => {
    it('should get webcam ID from store', async () => {
      mockStore.get.mockReturnValue('webcam-123');

      const result = await configManager.getWebcamId();

      expect(result).toBe('webcam-123');
      expect(mockStore.get).toHaveBeenCalledWith('webcamId');
    });

    it('should return null when webcam ID is not set', async () => {
      mockStore.get.mockReturnValue(undefined);

      const result = await configManager.getWebcamId();

      expect(result).toBeNull();
    });

    it('should return null when store throws error', async () => {
      mockStore.get.mockImplementation(() => {
        throw new Error('Store error');
      });

      const result = await configManager.getWebcamId();

      expect(result).toBeNull();
    });

    it('should set valid webcam ID', async () => {
      await configManager.setWebcamId('webcam-456');

      expect(mockStore.set).toHaveBeenCalledWith('webcamId', 'webcam-456');
    });

    it('should reject empty webcam ID', async () => {
      await expect(configManager.setWebcamId('')).rejects.toThrow(
        'Webcam ID cannot be empty',
      );
      await expect(configManager.setWebcamId('   ')).rejects.toThrow(
        'Webcam ID cannot be empty',
      );
      await expect(configManager.setWebcamId('\t\n')).rejects.toThrow(
        'Webcam ID cannot be empty',
      );
    });

    it('should handle store errors when setting webcam ID', async () => {
      mockStore.set.mockImplementation(() => {
        throw new Error('Store write error');
      });

      await expect(configManager.setWebcamId('valid-webcam')).rejects.toThrow(
        'Failed to save webcam ID',
      );
    });
  });

  describe('Storage settings management', () => {
    it('should get storage settings with local path only', async () => {
      mockStore.get.mockReturnValue({
        local: { enabled: true, path: '/local/path' },
        s3: { enabled: false },
      });

      const result = await configManager.getStorageSettings();

      expect(result).toEqual({
        localPath: '/local/path',
      });
    });

    it('should get storage settings with S3 config only', async () => {
      mockStore.get.mockReturnValue({
        local: { enabled: false },
        s3: {
          enabled: true,
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'key123',
          secretAccessKey: 'secret123',
        },
      });

      const result = await configManager.getStorageSettings();

      expect(result).toEqual({
        s3Config: {
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'key123',
          secretAccessKey: 'secret123',
        },
      });
    });

    it('should get storage settings with both local and S3', async () => {
      mockStore.get.mockReturnValue({
        local: { enabled: true, path: '/local/path' },
        s3: {
          enabled: true,
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'key123',
          secretAccessKey: 'secret123',
        },
      });

      const result = await configManager.getStorageSettings();

      expect(result).toEqual({
        localPath: '/local/path',
        s3Config: {
          bucket: 'test-bucket',
          region: 'us-east-1',
          accessKeyId: 'key123',
          secretAccessKey: 'secret123',
        },
      });
    });

    it('should return empty settings when nothing is configured', async () => {
      mockStore.get.mockReturnValue({
        local: { enabled: false },
        s3: { enabled: false },
      });

      const result = await configManager.getStorageSettings();

      expect(result).toEqual({});
    });

    it('should handle missing storage configuration', async () => {
      mockStore.get.mockReturnValue(undefined);

      const result = await configManager.getStorageSettings();

      expect(result).toEqual({});
    });

    it('should handle store errors when getting storage settings', async () => {
      mockStore.get.mockImplementation(() => {
        throw new Error('Store error');
      });

      const result = await configManager.getStorageSettings();

      expect(result).toEqual({});
    });

    it('should set storage settings with local path only', async () => {
      const settings: StorageSettings = {
        localPath: '/new/path',
      };

      mockStore.get.mockReturnValue({});

      await configManager.setStorageSettings(settings);

      expect(mockStore.set).toHaveBeenCalledWith('storage', {
        local: { enabled: true, path: '/new/path' },
      });
    });

    it('should set storage settings with S3 config only', async () => {
      const settings: StorageSettings = {
        s3Config: {
          bucket: 'new-bucket',
          region: 'us-west-2',
          accessKeyId: 'newkey',
          secretAccessKey: 'newsecret',
        },
      };

      mockStore.get.mockReturnValue({});

      await configManager.setStorageSettings(settings);

      expect(mockStore.set).toHaveBeenCalledWith('storage', {
        s3: {
          enabled: true,
          bucket: 'new-bucket',
          region: 'us-west-2',
          accessKeyId: 'newkey',
          secretAccessKey: 'newsecret',
        },
      });
    });

    it('should set storage settings with both local and S3', async () => {
      const settings: StorageSettings = {
        localPath: '/new/path',
        s3Config: {
          bucket: 'new-bucket',
          region: 'us-west-2',
          accessKeyId: 'newkey',
          secretAccessKey: 'newsecret',
        },
      };

      mockStore.get.mockReturnValue({});

      await configManager.setStorageSettings(settings);

      expect(mockStore.set).toHaveBeenCalledWith('storage', {
        local: { enabled: true, path: '/new/path' },
        s3: {
          enabled: true,
          bucket: 'new-bucket',
          region: 'us-west-2',
          accessKeyId: 'newkey',
          secretAccessKey: 'newsecret',
        },
      });
    });

    it('should disable local storage when empty path is provided', async () => {
      const settings: StorageSettings = {
        localPath: '',
      };

      mockStore.get.mockReturnValue({});

      await configManager.setStorageSettings(settings);

      expect(mockStore.set).toHaveBeenCalledWith('storage', {
        local: { enabled: false, path: '' },
      });
    });

    it('should reject incomplete S3 config', async () => {
      const invalidConfigs = [
        {
          s3Config: {
            bucket: '',
            region: 'us-east-1',
            accessKeyId: 'key',
            secretAccessKey: 'secret',
          },
        },
        {
          s3Config: {
            bucket: 'bucket',
            region: '',
            accessKeyId: 'key',
            secretAccessKey: 'secret',
          },
        },
        {
          s3Config: {
            bucket: 'bucket',
            region: 'us-east-1',
            accessKeyId: '',
            secretAccessKey: 'secret',
          },
        },
        {
          s3Config: {
            bucket: 'bucket',
            region: 'us-east-1',
            accessKeyId: 'key',
            secretAccessKey: '',
          },
        },
      ];

      for (const invalidConfig of invalidConfigs) {
        await expect(
          configManager.setStorageSettings(invalidConfig),
        ).rejects.toThrow(
          'S3 configuration requires bucket, region, accessKeyId, and secretAccessKey',
        );
      }
    });

    it('should handle store errors when setting storage settings', async () => {
      mockStore.get.mockReturnValue({});
      mockStore.set.mockImplementation(() => {
        throw new Error('Store write error');
      });

      const settings: StorageSettings = {
        localPath: '/path',
      };

      await expect(configManager.setStorageSettings(settings)).rejects.toThrow(
        'Failed to save storage settings',
      );
    });
  });

  describe('Full configuration management', () => {
    it('should get complete configuration with all values', async () => {
      mockStore.get
        .mockReturnValueOnce('test-tenant') // getTenantId
        .mockReturnValueOnce('webcam-123') // getWebcamId
        .mockReturnValueOnce({
          // storage
          local: { enabled: true, path: '/path' },
          s3: {
            enabled: true,
            bucket: 'bucket',
            region: 'us-east-1',
            accessKeyId: 'key',
            secretAccessKey: 'secret',
          },
        })
        .mockReturnValueOnce({
          // ui
          theme: 'dark',
          showControls: false,
        });

      const result = await configManager.getConfig();

      expect(result).toEqual({
        tenantId: 'test-tenant',
        webcamId: 'webcam-123',
        storage: {
          local: { enabled: true, path: '/path' },
          s3: {
            enabled: true,
            bucket: 'bucket',
            region: 'us-east-1',
            accessKeyId: 'key',
            secretAccessKey: 'secret',
          },
        },
        ui: { theme: 'dark', showControls: false },
      });
    });

    it('should get configuration with default values when not set', async () => {
      mockStore.get
        .mockReturnValueOnce(null) // getTenantId
        .mockReturnValueOnce(null) // getWebcamId
        .mockReturnValueOnce(undefined) // storage
        .mockReturnValueOnce(undefined); // ui

      const result = await configManager.getConfig();

      expect(result).toEqual({
        tenantId: '',
        webcamId: '',
        storage: {
          local: { enabled: false, path: '' },
          s3: {
            enabled: false,
            bucket: '',
            region: 'us-east-1',
            accessKeyId: '',
            secretAccessKey: '',
          },
        },
        ui: { theme: 'light', showControls: true },
      });
    });

    it('should handle errors when getting full config', async () => {
      mockStore.get.mockImplementation(() => {
        throw new Error('Store error');
      });

      await expect(configManager.getConfig()).rejects.toThrow(
        'Failed to retrieve configuration',
      );
    });

    it('should set partial configuration', async () => {
      const partialConfig: Partial<AppConfig> = {
        tenantId: 'new-tenant',
        ui: {
          theme: 'dark',
          showControls: false,
        },
      };

      mockStore.get.mockReturnValue({});

      await configManager.setConfig(partialConfig);

      expect(mockStore.set).toHaveBeenCalledWith('tenantId', 'new-tenant');
      expect(mockStore.set).toHaveBeenCalledWith('ui', {
        theme: 'dark',
        showControls: false,
      });
    });

    it('should handle errors when setting config', async () => {
      mockStore.set.mockImplementation(() => {
        throw new Error('Store write error');
      });

      const config: Partial<AppConfig> = {
        tenantId: 'test',
      };

      await expect(configManager.setConfig(config)).rejects.toThrow(
        'Failed to save configuration',
      );
    });

    it('should check first time setup when tenant ID is missing', async () => {
      mockStore.get
        .mockReturnValueOnce(null) // tenantId
        .mockReturnValueOnce('webcam-123'); // webcamId

      const result = await configManager.isFirstTimeSetup();

      expect(result).toBe(true);
    });

    it('should check first time setup when webcam ID is missing', async () => {
      mockStore.get
        .mockReturnValueOnce('test-tenant') // tenantId
        .mockReturnValueOnce(null); // webcamId

      const result = await configManager.isFirstTimeSetup();

      expect(result).toBe(true);
    });

    it('should check first time setup when both are missing', async () => {
      mockStore.get
        .mockReturnValueOnce(null) // tenantId
        .mockReturnValueOnce(null); // webcamId

      const result = await configManager.isFirstTimeSetup();

      expect(result).toBe(true);
    });

    it('should check first time setup when both are present', async () => {
      mockStore.get
        .mockReturnValueOnce('test-tenant') // tenantId
        .mockReturnValueOnce('webcam-123'); // webcamId

      const result = await configManager.isFirstTimeSetup();

      expect(result).toBe(false);
    });

    it('should handle errors when checking first time setup', async () => {
      mockStore.get.mockImplementation(() => {
        throw new Error('Store error');
      });

      const result = await configManager.isFirstTimeSetup();

      expect(result).toBe(true);
    });

    it('should reset configuration', async () => {
      await configManager.resetConfig();

      expect(mockStore.clear).toHaveBeenCalled();
      expect(mockStore.store).toEqual({
        storage: {
          local: {
            enabled: true,
            path: '',
          },
          s3: {
            enabled: false,
            bucket: '',
            region: 'us-east-1',
            accessKeyId: '',
            secretAccessKey: '',
          },
        },
        ui: {
          theme: 'light',
          showControls: true,
        },
      });
    });

    it('should handle errors when resetting config', async () => {
      mockStore.clear.mockImplementation(() => {
        throw new Error('Store clear error');
      });

      await expect(configManager.resetConfig()).rejects.toThrow(
        'Failed to reset configuration',
      );
    });
  });
});
