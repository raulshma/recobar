// UI-related type definitions

export interface StatusItem {
  id: string;
  status: 'ready' | 'recording' | 'paused' | 'error' | 'warning';
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp?: Date;
}

// Error type definitions
export interface SetupError extends Error {
  code: 'TENANT_ID_MISSING' | 'WEBCAM_NOT_FOUND' | 'STORAGE_CONFIG_INVALID';
  type: 'tenant' | 'webcam' | 'permission';
  context?: Record<string, unknown>;
}

export interface RuntimeError extends Error {
  code: 'RECORDING_FAILED' | 'BARCODE_DETECTION_FAILED' | 'STREAM_LOST';
  type: 'webcam' | 'barcode' | 'recording';
  context?: Record<string, unknown>;
}

// Error handler interface
export interface ErrorHandler {
  handleSetupError(error: SetupError): void;
  handleRuntimeError(error: RuntimeError): void;
  showUserNotification(
    message: string,
    type: 'error' | 'warning' | 'info' | 'success',
    options?: {
      persistent?: boolean;
      actionLabel?: string;
      onAction?: () => void;
    },
  ): void;
}
