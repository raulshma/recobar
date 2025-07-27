// Recording orchestration service that connects barcode detection to recording management
import { BarcodeDetectionService } from './BarcodeDetectionService';
import { RecordingManager } from './RecordingManager';
import { RecordingResult } from '../types';

export interface RecordingOrchestratorCallbacks {
  onRecordingStarted?: (barcode: string) => void;
  onRecordingStopped?: (result: RecordingResult) => void;
  onRecordingError?: (error: Error) => void;
  onBarcodeDetected?: (barcode: string) => void;
}

export class RecordingOrchestrator {
  private barcodeService: BarcodeDetectionService;
  private recordingManager: RecordingManager;
  private currentStream: MediaStream | null = null;
  private lastDetectedBarcode: string | null = null;
  private isActive: boolean = false;
  private callbacks: RecordingOrchestratorCallbacks = {};

  constructor(
    barcodeService: BarcodeDetectionService,
    recordingManager: RecordingManager
  ) {
    this.barcodeService = barcodeService;
    this.recordingManager = recordingManager;
  }

  /**
   * Start the automatic recording orchestration
   */
  start(videoElement: HTMLVideoElement, stream: MediaStream, callbacks?: RecordingOrchestratorCallbacks): void {
    if (this.isActive) {
      throw new Error('Recording orchestrator is already active');
    }

    this.currentStream = stream;
    this.callbacks = callbacks || {};
    this.isActive = true;
    this.lastDetectedBarcode = null;

    // Start barcode detection
    this.barcodeService.startDetection(videoElement);

    // Register for barcode detection events
    this.barcodeService.onBarcodeDetected(this.handleBarcodeDetected.bind(this));

    console.log('Recording orchestrator started');
  }

  /**
   * Stop the automatic recording orchestration
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Stop barcode detection
    this.barcodeService.stopDetection();

    // Stop any active recording
    if (this.recordingManager.isRecording()) {
      try {
        const result = await this.recordingManager.stopRecording();
        this.callbacks.onRecordingStopped?.(result);
      } catch (error) {
        console.error('Error stopping recording during orchestrator shutdown:', error);
        this.callbacks.onRecordingError?.(error as Error);
      }
    }

    // Clear state
    this.currentStream = null;
    this.lastDetectedBarcode = null;
    this.callbacks = {};

    console.log('Recording orchestrator stopped');
  }

  /**
   * Handle barcode detection events
   */
  private async handleBarcodeDetected(barcode: string): Promise<void> {
    if (!this.isActive || !this.currentStream) {
      return;
    }

    try {
      // Notify callback about barcode detection
      this.callbacks.onBarcodeDetected?.(barcode);

      // Check if this is a new barcode
      if (barcode === this.lastDetectedBarcode) {
        // Same barcode detected, no action needed
        return;
      }

      console.log(`New barcode detected: ${barcode} (previous: ${this.lastDetectedBarcode})`);

      // If we're currently recording, stop the current recording
      if (this.recordingManager.isRecording()) {
        console.log('Stopping current recording due to new barcode');
        const result = await this.recordingManager.stopRecording();
        this.callbacks.onRecordingStopped?.(result);
      }

      // Start new recording with the new barcode
      this.lastDetectedBarcode = barcode;
      await this.recordingManager.startRecording(this.currentStream, barcode);
      this.callbacks.onRecordingStarted?.(barcode);

      console.log(`Started recording for barcode: ${barcode}`);

    } catch (error) {
      console.error('Error handling barcode detection:', error);
      this.callbacks.onRecordingError?.(error as Error);
    }
  }

  /**
   * Manually pause the current recording
   */
  pauseRecording(): void {
    if (!this.isActive) {
      throw new Error('Recording orchestrator is not active');
    }

    try {
      this.recordingManager.pauseRecording();
      console.log('Recording paused manually');
    } catch (error) {
      console.error('Error pausing recording:', error);
      this.callbacks.onRecordingError?.(error as Error);
    }
  }

  /**
   * Manually resume the current recording
   */
  resumeRecording(): void {
    if (!this.isActive) {
      throw new Error('Recording orchestrator is not active');
    }

    try {
      this.recordingManager.resumeRecording();
      console.log('Recording resumed manually');
    } catch (error) {
      console.error('Error resuming recording:', error);
      this.callbacks.onRecordingError?.(error as Error);
    }
  }

  /**
   * Manually stop the current recording
   */
  async stopRecording(): Promise<RecordingResult | null> {
    if (!this.isActive) {
      throw new Error('Recording orchestrator is not active');
    }

    if (!this.recordingManager.isRecording()) {
      return null;
    }

    try {
      const result = await this.recordingManager.stopRecording();
      this.callbacks.onRecordingStopped?.(result);
      console.log('Recording stopped manually');
      return result;
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.callbacks.onRecordingError?.(error as Error);
      throw error;
    }
  }

  /**
   * Get current recording state
   */
  getRecordingState() {
    return {
      isActive: this.isActive,
      isRecording: this.recordingManager.isRecording(),
      isPaused: this.recordingManager.isPaused(),
      lastDetectedBarcode: this.lastDetectedBarcode,
      detectionActive: this.barcodeService.isActive(),
    };
  }

  /**
   * Check if the orchestrator is active
   */
  isOrchestratorActive(): boolean {
    return this.isActive;
  }

  /**
   * Get the last detected barcode
   */
  getLastDetectedBarcode(): string | null {
    return this.lastDetectedBarcode;
  }

  /**
   * Update callbacks
   */
  updateCallbacks(callbacks: RecordingOrchestratorCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Force start recording with a specific barcode (for testing or manual triggers)
   */
  async forceStartRecording(barcode: string): Promise<void> {
    if (!this.isActive || !this.currentStream) {
      throw new Error('Recording orchestrator is not active or no stream available');
    }

    try {
      // Stop current recording if active
      if (this.recordingManager.isRecording()) {
        const result = await this.recordingManager.stopRecording();
        this.callbacks.onRecordingStopped?.(result);
      }

      // Start new recording
      this.lastDetectedBarcode = barcode;
      await this.recordingManager.startRecording(this.currentStream, barcode);
      this.callbacks.onRecordingStarted?.(barcode);

      console.log(`Force started recording for barcode: ${barcode}`);
    } catch (error) {
      console.error('Error force starting recording:', error);
      this.callbacks.onRecordingError?.(error as Error);
      throw error;
    }
  }
}
