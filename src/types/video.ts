// Video stream and device-related type definitions

export interface VideoStreamManager {
  getAvailableDevices(): Promise<MediaDeviceInfo[]>;
  startStream(deviceId: string): Promise<MediaStream>;
  stopStream(): void;
  getCurrentStream(): MediaStream | null;
  isStreamActive(): boolean;
  onDeviceChange(callback: () => void): void;
  removeDeviceChangeListener(callback: () => void): void;
  dispose(): void;
}

export interface VideoState {
  stream: MediaStream | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  isLoading?: boolean;
  error?: string;
}

export interface VideoDisplayProps {
  stream: MediaStream | null;
  onError?: (error: string) => void;
  className?: string;
  enableBarcodeDetection?: boolean;
  onBarcodeDetected?: (barcode: string) => void;
}
