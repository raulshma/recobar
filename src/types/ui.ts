// UI and application state-related type definitions
import type { VideoState } from './video';
import type { RecordingState } from './recording';
import type { BarcodeState } from './barcode';
import type { StorageError } from './storage';

export interface SetupState {
  isComplete: boolean;
  currentStep: 'tenant' | 'webcam' | 'complete';
}

export interface UIState {
  showSettings: boolean;
  showControls: boolean;
}

export interface AppState {
  setup: SetupState;
  video: VideoState;
  recording: RecordingState;
  barcode: BarcodeState;
  ui: UIState;
}

export interface ErrorHandler {
  handleSetupError(error: SetupError): void;
  handleRuntimeError(error: RuntimeError): void;
  handleStorageError(error: StorageError): void;
  showUserNotification(
    message: string,
    type: 'error' | 'warning' | 'info' | 'success',
  ): void;
}

export interface SetupError extends Error {
  type: 'tenant' | 'webcam' | 'permission';
}

export interface RuntimeError extends Error {
  type: 'webcam' | 'barcode' | 'recording';
}

// Re-export StorageError for convenience
export type { StorageError };
