// Configuration manager for persistent storage using electron-store
import { AppConfig, StorageSettings } from '../types/config';

export class ConfigManager {
  private store: any = null;
  private storePromise: Promise<any> | null = null;

  private async getStore() {
    if (this.store) {
      return this.store;
    }

    if (!this.storePromise) {
      this.storePromise = import('electron-store').then((module) => {
        const Store = module.default;
        this.store = new Store({
          name: 'recobar-config',
          defaults: {
            tenantId: '',
            webcamId: '',
            storage: {
              local: {
                enabled: true,
                path: '',
              },
              s3: {
                enabled: false,
                bucket: '',
                region: '',
                accessKeyId: '',
                secretAccessKey: '',
              },
            },
            ui: {
              theme: 'light' as const,
              showControls: true,
            },
          },
        });
        return this.store;
      });
    }

    return this.storePromise;
  }

  // Removed unused methods

  // Validation methods removed for simplicity

  async getTenantId(): Promise<string | null> {
    const store = await this.getStore();
    return store.get('tenantId') || null;
  }

  async setTenantId(tenantId: string): Promise<void> {
    const store = await this.getStore();
    store.set('tenantId', tenantId);
  }

  async getWebcamId(): Promise<string | null> {
    const store = await this.getStore();
    return store.get('webcamId') || null;
  }

  async setWebcamId(webcamId: string): Promise<void> {
    const store = await this.getStore();
    store.set('webcamId', webcamId);
  }

  async getStorageSettings(): Promise<StorageSettings> {
    const store = await this.getStore();
    const storage = store.get('storage', {});
    
    return {
      localPath: storage.local?.path,
      s3Config: storage.s3?.enabled ? {
        bucket: storage.s3.bucket,
        region: storage.s3.region,
        accessKeyId: storage.s3.accessKeyId,
        secretAccessKey: storage.s3.secretAccessKey,
      } : undefined,
    };
  }

  async setStorageSettings(settings: StorageSettings): Promise<void> {
    const store = await this.getStore();
    const storage: any = {
      local: {
        enabled: !!settings.localPath,
        path: settings.localPath || '',
      },
      s3: {
        enabled: !!settings.s3Config,
        bucket: settings.s3Config?.bucket || '',
        region: settings.s3Config?.region || '',
        accessKeyId: settings.s3Config?.accessKeyId || '',
        secretAccessKey: settings.s3Config?.secretAccessKey || '',
      },
    };
    
    store.set('storage', storage);
  }

  async getConfig(): Promise<AppConfig> {
    const store = await this.getStore();
    const config = store.store as any;
    
    return {
      tenantId: config.tenantId || '',
      webcamId: config.webcamId || '',
      storage: config.storage || {
        local: { enabled: true, path: '' },
        s3: { enabled: false, bucket: '', region: '', accessKeyId: '', secretAccessKey: '' },
      },
      ui: config.ui || { theme: 'light', showControls: true },
    };
  }

  async setConfig(config: Partial<AppConfig>): Promise<void> {
    const store = await this.getStore();
    Object.keys(config).forEach(key => {
      store.set(key, (config as any)[key]);
    });
  }

  async resetConfig(): Promise<void> {
    const store = await this.getStore();
    store.clear();
  }

  async isFirstTimeSetup(): Promise<boolean> {
    const store = await this.getStore();
    const tenantId = store.get('tenantId');
    const webcamId = store.get('webcamId');
    
    return !tenantId || !webcamId;
  }
}
