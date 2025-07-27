// Configuration management service with electron-store integration
import Store from 'electron-store';
import {
  ConfigManager as IConfigManager,
  AppConfig,
  StorageSettings,
} from '../types';

interface StoreSchema {
  tenantId?: string;
  webcamId?: string;
  storage?: {
    local?: {
      enabled?: boolean;
      path?: string;
    };
    s3?: {
      enabled?: boolean;
      bucket?: string;
      region?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    };
  };
  ui?: {
    theme?: 'light' | 'dark';
    showControls?: boolean;
  };
}

export class ConfigManager implements IConfigManager {
  private store: Store<StoreSchema>;

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'barcode-video-recorder-config',
      defaults: this.getDefaultConfig(),
      schema: {
        tenantId: {
          type: 'string',
        },
        webcamId: {
          type: 'string',
        },
        storage: {
          type: 'object',
          properties: {
            local: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                path: { type: 'string' },
              },
            },
            s3: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                bucket: { type: 'string' },
                region: { type: 'string' },
                accessKeyId: { type: 'string' },
                secretAccessKey: { type: 'string' },
              },
            },
          },
        },
        ui: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: ['light', 'dark'] },
            showControls: { type: 'boolean' },
          },
        },
      },
    });
  }

  private getDefaultConfig(): StoreSchema {
    return {
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
    };
  }

  private validateTenantId(tenantId: string): boolean {
    // Tenant ID should be non-empty and contain only alphanumeric characters, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(tenantId) && tenantId.length > 0;
  }

  private validateStorageSettings(settings: StorageSettings): void {
    if (settings.s3Config) {
      const { bucket, region, accessKeyId, secretAccessKey } =
        settings.s3Config;
      if (!bucket || !region || !accessKeyId || !secretAccessKey) {
        throw new Error(
          'S3 configuration requires bucket, region, accessKeyId, and secretAccessKey',
        );
      }
    }
  }

  async getTenantId(): Promise<string | null> {
    try {
      return this.store.get('tenantId') || null;
    } catch (error) {
      console.error('Error getting tenant ID:', error);
      return null;
    }
  }

  async setTenantId(tenantId: string): Promise<void> {
    if (!this.validateTenantId(tenantId)) {
      throw new Error(
        'Invalid tenant ID format. Only alphanumeric characters, hyphens, and underscores are allowed.',
      );
    }

    try {
      this.store.set('tenantId', tenantId);
    } catch (error) {
      console.error('Error setting tenant ID:', error);
      throw new Error('Failed to save tenant ID');
    }
  }

  async getWebcamId(): Promise<string | null> {
    try {
      return this.store.get('webcamId') || null;
    } catch (error) {
      console.error('Error getting webcam ID:', error);
      return null;
    }
  }

  async setWebcamId(webcamId: string): Promise<void> {
    if (!webcamId || webcamId.trim().length === 0) {
      throw new Error('Webcam ID cannot be empty');
    }

    try {
      this.store.set('webcamId', webcamId);
    } catch (error) {
      console.error('Error setting webcam ID:', error);
      throw new Error('Failed to save webcam ID');
    }
  }

  async getStorageSettings(): Promise<StorageSettings> {
    try {
      const storage = this.store.get('storage');
      const result: StorageSettings = {};

      if (storage?.local?.enabled && storage.local.path) {
        result.localPath = storage.local.path;
      }

      if (
        storage?.s3?.enabled &&
        storage.s3.bucket &&
        storage.s3.region &&
        storage.s3.accessKeyId &&
        storage.s3.secretAccessKey
      ) {
        result.s3Config = {
          bucket: storage.s3.bucket,
          region: storage.s3.region,
          accessKeyId: storage.s3.accessKeyId,
          secretAccessKey: storage.s3.secretAccessKey,
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting storage settings:', error);
      return {};
    }
  }

  async setStorageSettings(settings: StorageSettings): Promise<void> {
    this.validateStorageSettings(settings);

    try {
      const currentStorage = this.store.get('storage') || {};

      // Update local storage settings
      if (settings.localPath !== undefined) {
        currentStorage.local = {
          enabled: settings.localPath.length > 0,
          path: settings.localPath,
        };
      }

      // Update S3 storage settings
      if (settings.s3Config) {
        currentStorage.s3 = {
          enabled: true,
          bucket: settings.s3Config.bucket,
          region: settings.s3Config.region,
          accessKeyId: settings.s3Config.accessKeyId,
          secretAccessKey: settings.s3Config.secretAccessKey,
        };
      }

      this.store.set('storage', currentStorage);
    } catch (error) {
      console.error('Error setting storage settings:', error);
      throw new Error('Failed to save storage settings');
    }
  }

  async getConfig(): Promise<AppConfig> {
    try {
      const tenantId = await this.getTenantId();
      const webcamId = await this.getWebcamId();
      const storage = this.store.get('storage');
      const ui = this.store.get('ui');

      return {
        tenantId: tenantId || '',
        webcamId: webcamId || '',
        storage: {
          local: {
            enabled: storage?.local?.enabled || false,
            path: storage?.local?.path || '',
          },
          s3: {
            enabled: storage?.s3?.enabled || false,
            bucket: storage?.s3?.bucket || '',
            region: storage?.s3?.region || 'us-east-1',
            accessKeyId: storage?.s3?.accessKeyId || '',
            secretAccessKey: storage?.s3?.secretAccessKey || '',
          },
        },
        ui: {
          theme: ui?.theme || 'light',
          showControls: ui?.showControls !== false,
        },
      };
    } catch (error) {
      console.error('Error getting full config:', error);
      throw new Error('Failed to retrieve configuration');
    }
  }

  async setConfig(config: Partial<AppConfig>): Promise<void> {
    try {
      if (config.tenantId !== undefined) {
        await this.setTenantId(config.tenantId);
      }

      if (config.webcamId !== undefined) {
        await this.setWebcamId(config.webcamId);
      }

      if (config.storage) {
        const currentStorage = this.store.get('storage') || {};

        if (config.storage.local) {
          currentStorage.local = {
            enabled: config.storage.local.enabled,
            path: config.storage.local.path,
          };
        }

        if (config.storage.s3) {
          currentStorage.s3 = {
            enabled: config.storage.s3.enabled,
            bucket: config.storage.s3.bucket,
            region: config.storage.s3.region,
            accessKeyId: config.storage.s3.accessKeyId,
            secretAccessKey: config.storage.s3.secretAccessKey,
          };
        }

        this.store.set('storage', currentStorage);
      }

      if (config.ui) {
        const currentUi = this.store.get('ui') || {};

        if (config.ui.theme !== undefined) {
          currentUi.theme = config.ui.theme;
        }

        if (config.ui.showControls !== undefined) {
          currentUi.showControls = config.ui.showControls;
        }

        this.store.set('ui', currentUi);
      }
    } catch (error) {
      console.error('Error setting config:', error);
      throw new Error('Failed to save configuration');
    }
  }

  // Additional utility methods for configuration management
  async resetConfig(): Promise<void> {
    try {
      this.store.clear();
      this.store.store = this.getDefaultConfig();
    } catch (error) {
      console.error('Error resetting config:', error);
      throw new Error('Failed to reset configuration');
    }
  }

  async isFirstTimeSetup(): Promise<boolean> {
    try {
      const tenantId = await this.getTenantId();
      const webcamId = await this.getWebcamId();
      return !tenantId || !webcamId;
    } catch (error) {
      console.error('Error checking first time setup:', error);
      return true;
    }
  }
}
