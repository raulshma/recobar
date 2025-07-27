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
  line?: Array<{ x: number; y: number }>;
  angle?: number;
  pattern?: number[]; // QuaggaJS pattern is an array of numbers representing bar widths
  threshold?: number;
};

export class BarcodeDetectionService implements IBarcodeDetectionService {
  private isDetectionActive = false;

  private detectionCallbacks: ((barcode: string) => void)[] = [];

  private videoElement: HTMLVideoElement | null = null;

  private lastDetectedBarcode: string | null = null;
  private lastDetectionTime: number = 0;
  private readonly DEBOUNCE_TIME = 1000; // 1 second debounce

  startDetection(videoElement: HTMLVideoElement): void {
    console.log('🔍 Starting barcode detection...');
    
    if (this.isDetectionActive) {
      console.log('⚠️ Detection already active, stopping previous detection');
      this.stopDetection();
    }

    // Enhanced video element checks
    if (!videoElement) {
      console.error('❌ No video element provided to barcode detection');
      return;
    }

    // Check if video element is ready
    if (videoElement.readyState < 2) {
      console.warn('⚠️ Video element not ready, readyState:', videoElement.readyState);
      // Wait for video to be ready
      const waitForReady = () => {
        if (videoElement.readyState >= 2) {
          console.log('✅ Video element is now ready, starting detection');
          this.startDetectionInternal(videoElement);
        } else {
          console.log('⏳ Waiting for video element to be ready...');
          setTimeout(waitForReady, 500);
        }
      };
      waitForReady();
      return;
    }

    this.startDetectionInternal(videoElement);
  }

  private startDetectionInternal(videoElement: HTMLVideoElement): void {
    this.videoElement = videoElement;
    this.isDetectionActive = true;

    const width = videoElement.videoWidth || 640;
    const height = videoElement.videoHeight || 480;
    
    console.log(`📐 Video dimensions: ${width}x${height}`);
    console.log('🎯 Video readyState:', videoElement.readyState);
    console.log('▶️ Video paused:', videoElement.paused);

    // SIMPLIFIED configuration for better compatibility
    const config = {
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: videoElement,
        constraints: {
          width,
          height,
          facingMode: 'environment', // Use back camera if available
        },
      },
      locator: {
        patchSize: 'medium',
        halfSample: true, // Enable half sampling for better performance
      },
      numOfWorkers: 2, // Reduce workers for stability
      frequency: 10, // Process every 10th frame for better performance
      decoder: {
        readers: [
          // More inclusive set of readers
          'code_128_reader',
          'ean_reader',
          'ean_8_reader',
          'upc_reader',
          'upc_e_reader',
          'code_39_reader',
          'code_39_vin_reader',
          'codabar_reader',
          'i2of5_reader',
        ],
        multiple: false, // Only detect one barcode at a time
      },
      locate: true,
      debug: {
        drawBoundingBox: false, // Disable debug drawing for better performance
        showFrequency: false,
        drawScanline: false,
        showPattern: false
      }
    };

    // Create a safe version of config for logging (without the video element)
    const safeConfig = {
      ...config,
      inputStream: {
        ...config.inputStream,
        target: '[HTMLVideoElement]' // Replace the actual element with a string representation
      }
    };
    console.log('⚙️ Quagga config:', JSON.stringify(safeConfig, null, 2));

    Quagga.init(
      config,
      (err) => {
        if (err) {
          console.error('❌ Failed to initialize Quagga:', err);
          this.isDetectionActive = false;
          return;
        }

        console.log('✅ Quagga initialized successfully');

        // Start the detection process
        Quagga.start();
        console.log('🚀 Quagga detection started');

        // Set up detection event handler
        Quagga.onDetected(this.handleBarcodeDetected.bind(this));
        console.log('👂 Barcode detection listener attached');
      },
    );
  }

  stopDetection(): void {
    if (!this.isDetectionActive) {
      return;
    }

    console.log('🛑 Stopping barcode detection');
    this.isDetectionActive = false;
    this.videoElement = null;

    try {
      // Remove event listeners
      Quagga.offDetected(this.handleBarcodeDetected.bind(this));

      // Stop Quagga - wrap in try-catch to handle any state issues
      Quagga.stop();
      console.log('✅ Barcode detection stopped');
    } catch (error) {
      console.warn('⚠️ Error during Quagga cleanup:', error);
      // Continue with cleanup even if stop() fails
    }
  }

  onBarcodeDetected(callback: (barcode: string) => void): void {
    this.detectionCallbacks.push(callback);
    console.log(`📝 Barcode callback registered. Total callbacks: ${this.detectionCallbacks.length}`);
  }

  private handleBarcodeDetected(result: BarcodeResult): void {
    console.log('🔍 RAW Barcode detection result:', result);
    
    if (!this.isDetectionActive || !result || !result.codeResult) {
      console.log('⚠️ Detection not active or invalid result');
      return;
    }

    const barcode = result.codeResult.code;
    const confidence = result.codeResult.confidence;
    const format = result.codeResult.format;
    const currentTime = Date.now();

    console.log(`📊 Barcode detected: "${barcode}" (confidence: ${confidence !== undefined ? confidence.toFixed(1) + '%' : 'undefined'}, format: ${format})`);

    // Service-level debouncing
    if (this.lastDetectedBarcode === barcode && 
        (currentTime - this.lastDetectionTime) < this.DEBOUNCE_TIME) {
      console.log(`🚫 Ignoring duplicate barcode detection within debounce period`);
      return;
    }

    // SIMPLIFIED validation with much lower threshold
    const confidenceThreshold = 30; // Much lower threshold for testing
    
    // Basic barcode validation
    if (!barcode || barcode.length < 3) {
      console.log('⚠️ Barcode too short or empty, ignoring');
      return;
    }

    // If confidence is available and too low, skip
    if (confidence !== undefined && confidence !== null && confidence < confidenceThreshold) {
      console.log(`⚠️ Barcode confidence (${confidence.toFixed(1)}%) below threshold (${confidenceThreshold}%), ignoring`);
      return;
    }

    // Accept the barcode with minimal validation
    console.log(`✅ Barcode accepted: "${barcode}" - notifying callbacks`);
    this.lastDetectedBarcode = barcode;
    this.lastDetectionTime = currentTime;
    this.notifyCallbacks(barcode);
  }

  private notifyCallbacks(barcode: string): void {
    // Notify all registered callbacks
    this.detectionCallbacks.forEach((callback, index) => {
      try {
        console.log(`📞 Calling callback ${index + 1}/${this.detectionCallbacks.length} with barcode: "${barcode}"`);
        callback(barcode);
      } catch (error) {
        console.error(`❌ Error in barcode detection callback ${index}:`, error);
      }
    });
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
