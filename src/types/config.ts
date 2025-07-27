// Configuration-related type definitions

export interface StorageSettings {
  localPath?: string;
  s3Config?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface AppConfig {
  tenantId: string;
  webcamId: string;
  storage: {
    local: {
      enabled: boolean;
      path: string;
    };
    s3: {
      enabled: boolean;
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
  ui: {
    theme: 'light' | 'dark';
    showControls: boolean;
  };
}

export interface ConfigManager {
  getTenantId(): Promise<string | null>;
  setTenantId(tenantId: string): Promise<void>;
  getWebcamId(): Promise<string | null>;
  setWebcamId(webcamId: string): Promise<void>;
  getStorageSettings(): Promise<StorageSettings>;
  setStorageSettings(settings: StorageSettings): Promise<void>;
  getConfig(): Promise<AppConfig>;
  setConfig(config: Partial<AppConfig>): Promise<void>;
  resetConfig(): Promise<void>;
  isFirstTimeSetup(): Promise<boolean>;
}
