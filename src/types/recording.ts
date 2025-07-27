// Recording-related type definitions

export interface RecordingMetadata {
  id: string;
  tenantId: string;
  barcode: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  webcamId: string;
  resolution: {
    width: number;
    height: number;
  };
  hasAudio: boolean;
}

export interface RecordingResult {
  blob: Blob;
  metadata: RecordingMetadata;
}

export interface RecordingManager {
  startRecording(stream: MediaStream, barcode: string): Promise<void>;
  stopRecording(): Promise<RecordingResult>;
  pauseRecording(): void;
  resumeRecording(): void;
  isRecording(): boolean;
  isPaused(): boolean;
}

export interface RecordingState {
  isActive: boolean;
  isPaused: boolean;
  currentBarcode: string | null;
  startTime: Date | null;
}
