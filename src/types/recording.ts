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

// Interface for serialized recording data sent over IPC
export interface SerializedRecordingData {
  metadata: RecordingMetadata;
  blobBuffer: number[]; // Array representation of Uint8Array
  blobType: string;
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

// Recording statistics and metadata types
export interface RecordingStatistics {
  totalRecordings: number;
  totalDuration: number;
  totalSize: number;
  lastRecording: RecordingMetadata | null;
}

export interface RecordingFilters {
  tenantId?: string;
  barcode?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
