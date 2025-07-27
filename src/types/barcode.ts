// Barcode detection-related type definitions

export interface BarcodeDetectionService {
  startDetection(videoElement: HTMLVideoElement): void;
  stopDetection(): void;
  onBarcodeDetected(callback: (barcode: string) => void): void;
}

export interface BarcodeState {
  lastDetected: string | null;
  detectionActive: boolean;
}
