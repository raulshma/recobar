// Recording management service implementation
import {
  RecordingManager as IRecordingManager,
  RecordingResult,
  RecordingMetadata,
} from '../types';

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

  constructor() {
    // Initialize with default values - these will be set when recording starts
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

      // Create MediaRecorder with appropriate options
      const options: MediaRecorderOptions = {
        mimeType: this.getSupportedMimeType(),
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
        audioBitsPerSecond: 128000,  // 128 kbps for audio
      };

      this.mediaRecorder = new MediaRecorder(stream, options);

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.handleRecordingError(event);
      };

      this.mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped');
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      console.log(`Recording started for barcode: ${barcode}`);

    } catch (error) {
      this.isRecordingActive = false;
      this.isPausedState = false;
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

          // Create the recording blob
          const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
          const blob = new Blob(this.recordedChunks, { type: mimeType });

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
            blob,
            metadata,
          };

          // Reset state
          this.resetRecordingState();

          console.log(`Recording stopped. Duration: ${duration}ms, Size: ${blob.size} bytes`);
          resolve(result);

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
}
