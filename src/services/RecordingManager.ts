// Recording management service with performance optimizations
import { RecordingManager as IRecordingManager, RecordingResult, RecordingMetadata } from '../types';
import { PerformanceMonitor } from './PerformanceMonitor';
import { BlobProcessorService } from './BlobProcessorService';

export class RecordingManager implements IRecordingManager {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private currentStream: MediaStream | null = null;
  private currentBarcode: string | null = null;
  private startTime: Date | null = null;
  private isRecordingActive: boolean = false;
  private isPausedState: boolean = false;
  private tenantId: string = '';
  private webcamId: string = '';
  private maxChunkSize: number = 50 * 1024 * 1024; // 50MB max memory usage
  private chunkCleanupInterval: NodeJS.Timeout | null = null;
  private performanceMonitor: PerformanceMonitor;
  private blobProcessor: BlobProcessorService;

  constructor() {
    this.loadConfiguration();
    this.performanceMonitor = new PerformanceMonitor();
    this.blobProcessor = new BlobProcessorService({ maxWorkerCount: 2 });
  }

  async startRecording(stream: MediaStream, barcode: string): Promise<void> {
    if (this.isRecordingActive) {
      throw new Error('Recording is already active');
    }

    try {
      // Get configuration for metadata
      await this.loadConfiguration();

      // Reset state
      this.recordedChunks = [];
      this.currentStream = stream;
      this.currentBarcode = barcode;
      this.startTime = new Date();
      this.isRecordingActive = true;
      this.isPausedState = false;

      // Create MediaRecorder with optimized options for performance
      const options: MediaRecorderOptions = {
        mimeType: this.getSupportedMimeType(),
        videoBitsPerSecond: 1000000, // Reduced to 1 Mbps for better performance
        audioBitsPerSecond: 64000,   // Reduced to 64 kbps for audio
      };

      this.mediaRecorder = new MediaRecorder(stream, options);

      // Set up event handlers with memory management
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
          
          // Memory management: limit total chunk size
          this.manageMemoryUsage();
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.handleRecordingError(event);
      };

      this.mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped');
        this.cleanupChunkCleanup();
      };

      // Start recording with longer intervals to reduce processing overhead
      this.mediaRecorder.start(2000); // Collect data every 2 seconds instead of 1
      
      // Start memory cleanup interval
      this.startChunkCleanup();
      
      // Start performance monitoring
      this.performanceMonitor.startRecording();
      
      console.log(`Recording started for barcode: ${barcode}`);

    } catch (error) {
      this.isRecordingActive = false;
      this.isPausedState = false;
      this.cleanupChunkCleanup();
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stopRecording(): Promise<RecordingResult> {
    if (!this.isRecordingActive || !this.mediaRecorder || !this.startTime) {
      throw new Error('No active recording to stop');
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not available'));
        return;
      }

      // Set up the stop handler
      this.mediaRecorder.onstop = () => {
        try {
          const endTime = new Date();
          const duration = endTime.getTime() - this.startTime!.getTime();

          // Create the recording blob asynchronously to avoid blocking UI
          this.createRecordingBlob(duration, endTime)
            .then(result => {
              this.resetRecordingState();
              console.log(`Recording stopped. Duration: ${duration}ms, Size: ${result.blob.size} bytes`);
              resolve(result);
            })
            .catch(error => {
              this.resetRecordingState();
              reject(new Error(`Failed to process recording: ${error instanceof Error ? error.message : String(error)}`));
            });
        } catch (error) {
          this.resetRecordingState();
          reject(new Error(`Failed to process recording: ${error instanceof Error ? error.message : String(error)}`));
        }
      };

      // Stop the recording
      this.mediaRecorder.stop();
    });
  }

  pauseRecording(): void {
    if (!this.isRecordingActive || !this.mediaRecorder) {
      throw new Error('No active recording to pause');
    }

    if (this.isPausedState) {
      throw new Error('Recording is already paused');
    }

    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPausedState = true;
      console.log('Recording paused');
    }
  }

  resumeRecording(): void {
    if (!this.isRecordingActive || !this.mediaRecorder) {
      throw new Error('No active recording to resume');
    }

    if (!this.isPausedState) {
      throw new Error('Recording is not paused');
    }

    if (this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPausedState = false;
      console.log('Recording resumed');
    }
  }

  isRecording(): boolean {
    return this.isRecordingActive;
  }

  isPaused(): boolean {
    return this.isPausedState;
  }

  // Private helper methods

  private async loadConfiguration(): Promise<void> {
    try {
      // Load configuration using the proper config API
      if (window.electron?.config) {
        const tenantId = await window.electron.config.getTenantId();
        const webcamId = await window.electron.config.getWebcamId();

        this.tenantId = tenantId || 'default-tenant';
        this.webcamId = webcamId || 'default-webcam';
      } else {
        // Fallback values for testing or when electron API is not available
        this.tenantId = 'default-tenant';
        this.webcamId = 'default-webcam';
      }
    } catch (error) {
      console.warn('Failed to load configuration, using defaults:', error);
      this.tenantId = 'default-tenant';
      this.webcamId = 'default-webcam';
    }
  }

  private getSupportedMimeType(): string {
    // Check for supported MIME types in order of preference
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    // Fallback to default
    return 'video/webm';
  }

  private generateRecordingId(): string {
    // Generate a unique ID for the recording
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `rec_${timestamp}_${random}`;
  }

  private handleRecordingError(event: Event): void {
    console.error('Recording error occurred:', event);
    this.resetRecordingState();
    // In a real implementation, this would notify the error handler service
  }

  private resetRecordingState(): void {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.currentStream = null;
    this.currentBarcode = null;
    this.startTime = null;
    this.isRecordingActive = false;
    this.isPausedState = false;
  }

  private async createRecordingBlob(duration: number, endTime: Date): Promise<RecordingResult> {
    // Process blob creation in a background task to avoid blocking UI
    return new Promise((resolve, reject) => {
      // Use requestIdleCallback or setTimeout to defer processing
      const processBlob = async () => {
        try {
          const processingStartTime = performance.now();
          
          const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
          const blob = new Blob(this.recordedChunks, { type: mimeType });

          // Use blob processor service for better performance
          const { blob: processedBlob, processingTime } = await this.blobProcessor.processBlob(blob, mimeType);

          // Get stream resolution
          const videoTrack = this.currentStream?.getVideoTracks()[0];
          const settings = videoTrack?.getSettings();
          const resolution = {
            width: settings?.width || 1280,
            height: settings?.height || 720,
          };

          // Create metadata
          const metadata: RecordingMetadata = {
            id: this.generateRecordingId(),
            tenantId: this.tenantId,
            barcode: this.currentBarcode || '',
            startTime: this.startTime!,
            endTime,
            duration,
            webcamId: this.webcamId,
            resolution,
            hasAudio: (this.currentStream?.getAudioTracks().length ?? 0) > 0,
          };

          const result: RecordingResult = {
            blob: processedBlob,
            metadata,
          };

          // Track performance metrics
          const totalProcessingTime = performance.now() - processingStartTime;
          this.performanceMonitor.stopRecording(processedBlob.size, totalProcessingTime);

          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      // Use requestIdleCallback if available, otherwise use setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(processBlob);
      } else {
        setTimeout(processBlob, 0);
      }
    });
  }

  private manageMemoryUsage(): void {
    let totalSize = 0;
    for (let i = this.recordedChunks.length - 1; i >= 0; i--) {
      totalSize += this.recordedChunks[i].size;
      if (totalSize > this.maxChunkSize) {
        // Remove oldest chunks to free memory
        this.recordedChunks.splice(0, i + 1);
        console.warn(`Memory management: Removed ${i + 1} old chunks to free memory`);
        break;
      }
    }
  }

  private startChunkCleanup(): void {
    // Clean up chunks periodically to prevent memory buildup
    this.chunkCleanupInterval = setInterval(() => {
      if (this.isRecordingActive && this.recordedChunks.length > 10) {
        // Keep only the last 10 chunks to reduce memory usage
        const chunksToRemove = this.recordedChunks.length - 10;
        if (chunksToRemove > 0) {
          this.recordedChunks.splice(0, chunksToRemove);
          console.log(`Cleaned up ${chunksToRemove} old chunks`);
        }
      }
    }, 10000); // Clean up every 10 seconds
  }

  private cleanupChunkCleanup(): void {
    if (this.chunkCleanupInterval) {
      clearInterval(this.chunkCleanupInterval);
      this.chunkCleanupInterval = null;
    }
  }

  /**
   * Dispose of resources and clean up
   */
  dispose(): void {
    this.cleanupChunkCleanup();
    this.performanceMonitor.dispose();
    this.blobProcessor.dispose();
    this.resetRecordingState();
  }
}
