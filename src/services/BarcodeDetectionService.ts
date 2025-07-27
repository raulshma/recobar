// Barcode detection service implementation using QuaggaJS
import Quagga from 'quagga';
import { BarcodeDetectionService as IBarcodeDetectionService } from '../types';

// Import the BarcodeResult type from our type definitions
type BarcodeResult = {
  codeResult: {
    code: string;
    confidence: number;
    format: string;
  };
};

export class BarcodeDetectionService implements IBarcodeDetectionService {
  private isDetectionActive = false;

  private detectionCallbacks: ((barcode: string) => void)[] = [];

  private videoElement: HTMLVideoElement | null = null;

  startDetection(videoElement: HTMLVideoElement): void {
    if (this.isDetectionActive) {
      this.stopDetection();
    }

    this.videoElement = videoElement;
    this.isDetectionActive = true;

    // Configure Quagga for barcode detection
    Quagga.init(
      {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: videoElement,
          constraints: {
            width: videoElement.videoWidth || 640,
            height: videoElement.videoHeight || 480,
            facingMode: 'environment', // Use back camera if available
          },
        },
        locator: {
          patchSize: 'medium',
          halfSample: true,
        },
        numOfWorkers: 2,
        frequency: 10, // Process every 10th frame for performance
        decoder: {
          readers: [
            'code_128_reader',
            'ean_reader',
            'ean_8_reader',
            'code_39_reader',
            'code_39_vin_reader',
            'codabar_reader',
            'upc_reader',
            'upc_e_reader',
            'i2of5_reader',
          ],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error('Failed to initialize Quagga:', err);
          this.isDetectionActive = false;
          return;
        }

        // Start the detection process
        Quagga.start();

        // Set up detection event handler
        Quagga.onDetected(this.handleBarcodeDetected.bind(this));
      },
    );
  }

  stopDetection(): void {
    if (!this.isDetectionActive) {
      return;
    }

    this.isDetectionActive = false;
    this.videoElement = null;

    // Remove event listeners
    Quagga.offDetected(this.handleBarcodeDetected.bind(this));

    // Stop Quagga
    Quagga.stop();
  }

  onBarcodeDetected(callback: (barcode: string) => void): void {
    this.detectionCallbacks.push(callback);
  }

  private handleBarcodeDetected(result: BarcodeResult): void {
    if (!this.isDetectionActive || !result || !result.codeResult) {
      return;
    }

    const barcode = result.codeResult.code;
    const confidence = result.codeResult.confidence || 0;

    // Only process barcodes with sufficient confidence
    if (confidence > 75) {
      // Notify all registered callbacks
      this.detectionCallbacks.forEach((callback) => {
        try {
          callback(barcode);
        } catch (error) {
          console.error('Error in barcode detection callback:', error);
        }
      });
    }
  }

  // Additional utility methods
  isActive(): boolean {
    return this.isDetectionActive;
  }

  removeCallback(callback: (barcode: string) => void): void {
    const index = this.detectionCallbacks.indexOf(callback);
    if (index > -1) {
      this.detectionCallbacks.splice(index, 1);
    }
  }

  clearCallbacks(): void {
    this.detectionCallbacks = [];
  }
}
