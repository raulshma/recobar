// Comprehensive unit tests for RecordingManager service
import { RecordingManager } from '../services/RecordingManager';
import { RecordingResult } from '../types';

// Mock MediaRecorder
class MockMediaRecorder {
  public state: 'inactive' | 'recording' | 'paused' = 'inactive';
  public mimeType: string;
  public ondataavailable: ((event: BlobEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onstop: (() => void) | null = null;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType || 'video/webm';
  }

  start(timeslice?: number) {
    this.state = 'recording';
    // Simulate data available events
    setTimeout(() => {
      if (this.ondataavailable) {
        const mockBlob = new Blob(['mock video data'], { type: this.mimeType });
        this.ondataavailable({ data: mockBlob } as BlobEvent);
      }
    }, 100);
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      setTimeout(() => this.onstop!(), 10);
    }
  }

  pause() {
    if (this.state === 'recording') {
      this.state = 'paused';
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.state = 'recording';
    }
  }

  static isTypeSupported(mimeType: string): boolean {
    const supportedTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ];
    return supportedTypes.includes(mimeType);
  }
}

// Mock MediaStream and MediaStreamTrack
class MockMediaStreamTrack {
  public kind: string;
  private settings: MediaTrackSettings;

  constructor(kind: string, settings: MediaTrackSettings = {}) {
    this.kind = kind;
    this.settings = {
      width: 1280,
      height: 720,
      ...settings,
    };
  }

  getSettings(): MediaTrackSettings {
    return this.settings;
  }
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[];
  public active: boolean = true;
  public id: string = 'mock-stream-id';
  public onaddtrack: any = null;
  public onremovetrack: any = null;

  constructor(tracks: MockMediaStreamTrack[] = []) {
    this.tracks = tracks;
  }

  getTracks(): any[] {
    return this.tracks;
  }

  getVideoTracks(): any[] {
    return this.tracks.filter(track => track.kind === 'video');
  }

  getAudioTracks(): any[] {
    return this.tracks.filter(track => track.kind === 'audio');
  }

  addTrack(track: any): void {
    this.tracks.push(track);
  }

  removeTrack(track: any): void {
    const index = this.tracks.indexOf(track);
    if (index > -1) {
      this.tracks.splice(index, 1);
    }
  }

  getTrackById(trackId: string): any {
    return this.tracks.find(track => (track as any).id === trackId) || null;
  }

  clone(): any {
    return new MockMediaStream([...this.tracks]);
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean { return true; }
}

// Mock window.electron API
const mockElectronConfig = {
  getTenantId: jest.fn(),
  getWebcamId: jest.fn(),
};

Object.defineProperty(global, 'window', {
  value: {
    electron: {
      config: mockElectronConfig,
    },
  },
  writable: true,
});

// Setup global mocks
(global as any).MediaRecorder = MockMediaRecorder;
(global as any).MediaStream = MockMediaStream;
(global as any).Blob = class MockBlob {
  public size: number;
  public type: string;
  private data: any[];

  constructor(data: any[], options: { type: string }) {
    this.data = data;
    this.size = data.reduce((acc, item) => acc + (item.length || 0), 0);
    this.type = options.type;
  }
};

describe('RecordingManager', () => {
  let recordingManager: RecordingManager;
  let mockVideoTrack: MockMediaStreamTrack;
  let mockAudioTrack: MockMediaStreamTrack;
  let mockStream: MockMediaStream;

  // Helper to cast mock stream to MediaStream
  const asMediaStream = (stream: MockMediaStream) => stream as unknown as MediaStream;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock electron config
    mockElectronConfig.getTenantId.mockResolvedValue('test-tenant');
    mockElectronConfig.getWebcamId.mockResolvedValue('test-webcam');

    // Create mock tracks and stream
    mockVideoTrack = new MockMediaStreamTrack('video', { width: 1920, height: 1080 });
    mockAudioTrack = new MockMediaStreamTrack('audio');
    mockStream = new MockMediaStream([mockVideoTrack, mockAudioTrack]);

    // Create new instance
    recordingManager = new RecordingManager();
  });

  describe('Recording lifecycle', () => {
    it('should start recording successfully', async () => {
      await recordingManager.startRecording(mockStream as unknown as MediaStream, 'TEST123');

      expect(recordingManager.isRecording()).toBe(true);
      expect(recordingManager.isPaused()).toBe(false);
    });

    it('should load configuration when starting recording', async () => {
      await recordingManager.startRecording(mockStream as unknown as MediaStream, 'TEST123');

      expect(mockElectronConfig.getTenantId).toHaveBeenCalled();
      expect(mockElectronConfig.getWebcamId).toHaveBeenCalled();
    });

    it('should use fallback configuration when electron API is not available', async () => {
      // Remove electron API
      delete (window as any).electron;

      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      expect(recordingManager.isRecording()).toBe(true);
    });

    it('should use fallback configuration when config calls fail', async () => {
      mockElectronConfig.getTenantId.mockRejectedValue(new Error('Config error'));
      mockElectronConfig.getWebcamId.mockRejectedValue(new Error('Config error'));

      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      expect(recordingManager.isRecording()).toBe(true);
    });

    it('should throw error when recording is already active', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      await expect(
        recordingManager.startRecording(asMediaStream(mockStream), 'TEST456')
      ).rejects.toThrow('Recording is already active');
    });

    it('should stop recording and return result', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      const result = await recordingManager.stopRecording();

      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.barcode).toBe('TEST123');
      expect(result.metadata.tenantId).toBe('test-tenant');
      expect(result.metadata.webcamId).toBe('test-webcam');
      expect(result.metadata.resolution).toEqual({ width: 1920, height: 1080 });
      expect(result.metadata.hasAudio).toBe(true);
      expect(recordingManager.isRecording()).toBe(false);
    });

    it('should handle stream without video track', async () => {
      const audioOnlyStream = new MockMediaStream([mockAudioTrack]);

      await recordingManager.startRecording(asMediaStream(audioOnlyStream), 'TEST123');
      const result = await recordingManager.stopRecording();

      expect(result.metadata.resolution).toEqual({ width: 1280, height: 720 }); // Default values
      expect(result.metadata.hasAudio).toBe(true);
    });

    it('should handle stream without audio track', async () => {
      const videoOnlyStream = new MockMediaStream([mockVideoTrack]);

      await recordingManager.startRecording(asMediaStream(videoOnlyStream), 'TEST123');
      const result = await recordingManager.stopRecording();

      expect(result.metadata.hasAudio).toBe(false);
    });

    it('should handle stream with no tracks', async () => {
      const emptyStream = new MockMediaStream([]);

      await recordingManager.startRecording(asMediaStream(emptyStream), 'TEST123');
      const result = await recordingManager.stopRecording();

      expect(result.metadata.resolution).toEqual({ width: 1280, height: 720 }); // Default values
      expect(result.metadata.hasAudio).toBe(false);
    });

    it('should throw error when stopping without active recording', async () => {
      await expect(recordingManager.stopRecording()).rejects.toThrow(
        'No active recording to stop'
      );
    });

    it('should generate unique recording IDs', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');
      const result1 = await recordingManager.stopRecording();

      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST456');
      const result2 = await recordingManager.stopRecording();

      expect(result1.metadata.id).not.toBe(result2.metadata.id);
      expect(result1.metadata.id).toMatch(/^rec_\d+_[a-z0-9]{6}$/);
      expect(result2.metadata.id).toMatch(/^rec_\d+_[a-z0-9]{6}$/);
    });

    it('should calculate recording duration correctly', async () => {
      const startTime = Date.now();
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await recordingManager.stopRecording();
      const endTime = Date.now();

      expect(result.metadata.duration).toBeGreaterThan(0);
      expect(result.metadata.duration).toBeLessThan(endTime - startTime + 50); // Allow some margin
      expect(result.metadata.startTime).toBeInstanceOf(Date);
      expect(result.metadata.endTime).toBeInstanceOf(Date);
      expect(result.metadata.endTime.getTime()).toBeGreaterThan(
        result.metadata.startTime.getTime()
      );
    });
  });

  describe('Recording controls', () => {
    beforeEach(async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');
    });

    it('should pause recording', () => {
      recordingManager.pauseRecording();

      expect(recordingManager.isPaused()).toBe(true);
      expect(recordingManager.isRecording()).toBe(true); // Still recording, just paused
    });

    it('should resume recording', () => {
      recordingManager.pauseRecording();
      recordingManager.resumeRecording();

      expect(recordingManager.isPaused()).toBe(false);
      expect(recordingManager.isRecording()).toBe(true);
    });

    it('should throw error when pausing without active recording', async () => {
      await recordingManager.stopRecording();

      expect(() => recordingManager.pauseRecording()).toThrow(
        'No active recording to pause'
      );
    });

    it('should throw error when pausing already paused recording', () => {
      recordingManager.pauseRecording();

      expect(() => recordingManager.pauseRecording()).toThrow(
        'Recording is already paused'
      );
    });

    it('should throw error when resuming without active recording', async () => {
      await recordingManager.stopRecording();

      expect(() => recordingManager.resumeRecording()).toThrow(
        'No active recording to resume'
      );
    });

    it('should throw error when resuming non-paused recording', () => {
      expect(() => recordingManager.resumeRecording()).toThrow(
        'Recording is not paused'
      );
    });

    it('should handle pause/resume cycle', () => {
      expect(recordingManager.isPaused()).toBe(false);

      recordingManager.pauseRecording();
      expect(recordingManager.isPaused()).toBe(true);

      recordingManager.resumeRecording();
      expect(recordingManager.isPaused()).toBe(false);

      recordingManager.pauseRecording();
      expect(recordingManager.isPaused()).toBe(true);
    });
  });

  describe('MIME type selection', () => {
    it('should select supported MIME type', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      // Access the private method through any to test it
      const mimeType = (recordingManager as any).getSupportedMimeType();

      expect(mimeType).toBe('video/webm;codecs=vp9,opus');
    });

    it('should fallback to basic webm when specific codecs not supported', async () => {
      // Mock isTypeSupported to return false for specific codecs
      const originalIsTypeSupported = MockMediaRecorder.isTypeSupported;
      MockMediaRecorder.isTypeSupported = jest.fn().mockImplementation((type: string) => {
        if (type.includes('codecs')) return false;
        return originalIsTypeSupported(type);
      });

      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      const mimeType = (recordingManager as any).getSupportedMimeType();
      expect(mimeType).toBe('video/webm');

      // Restore original function
      MockMediaRecorder.isTypeSupported = originalIsTypeSupported;
    });

    it('should use fallback MIME type when none are supported', async () => {
      // Mock isTypeSupported to return false for all types
      MockMediaRecorder.isTypeSupported = jest.fn().mockReturnValue(false);

      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      const mimeType = (recordingManager as any).getSupportedMimeType();
      expect(mimeType).toBe('video/webm');

      // Restore original function
      MockMediaRecorder.isTypeSupported = jest.fn().mockImplementation((type: string) => {
        const supportedTypes = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=h264,opus',
          'video/webm',
          'video/mp4',
        ];
        return supportedTypes.includes(type);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle MediaRecorder creation errors', async () => {
      // Mock MediaRecorder constructor to throw
      const originalMediaRecorder = global.MediaRecorder;
      (global as any).MediaRecorder = jest.fn().mockImplementation(() => {
        throw new Error('MediaRecorder creation failed');
      });

      await expect(
        recordingManager.startRecording(asMediaStream(mockStream), 'TEST123')
      ).rejects.toThrow('Failed to start recording');

      // Restore original MediaRecorder
      (global as any).MediaRecorder = originalMediaRecorder;
    });

    it('should handle MediaRecorder errors during recording', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      // Get the MediaRecorder instance and trigger an error
      const mediaRecorder = (recordingManager as any).mediaRecorder;
      const errorEvent = new Event('error');

      // Simulate error
      if (mediaRecorder.onerror) {
        mediaRecorder.onerror(errorEvent);
      }

      expect(recordingManager.isRecording()).toBe(false);
    });

    it('should handle stop recording errors', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      // Mock the MediaRecorder to not have onstop handler
      const mediaRecorder = (recordingManager as any).mediaRecorder;
      mediaRecorder.onstop = null;

      // This should still work, just without the stop event
      const stopPromise = recordingManager.stopRecording();

      // Manually trigger stop to resolve the promise
      mediaRecorder.stop();

      await expect(stopPromise).resolves.toBeDefined();
    });

    it('should reset state on recording errors', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      expect(recordingManager.isRecording()).toBe(true);

      // Trigger error
      const mediaRecorder = (recordingManager as any).mediaRecorder;
      if (mediaRecorder.onerror) {
        mediaRecorder.onerror(new Event('error'));
      }

      expect(recordingManager.isRecording()).toBe(false);
      expect(recordingManager.isPaused()).toBe(false);
    });
  });

  describe('Data handling', () => {
    it('should collect data chunks during recording', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      // Get the MediaRecorder and simulate data events
      const mediaRecorder = (recordingManager as any).mediaRecorder;

      const mockBlob1 = new Blob(['chunk1'], { type: 'video/webm' });
      const mockBlob2 = new Blob(['chunk2'], { type: 'video/webm' });

      if (mediaRecorder.ondataavailable) {
        mediaRecorder.ondataavailable({ data: mockBlob1 } as BlobEvent);
        mediaRecorder.ondataavailable({ data: mockBlob2 } as BlobEvent);
      }

      const result = await recordingManager.stopRecording();

      expect(result.blob.size).toBeGreaterThan(0);
    });

    it('should ignore empty data chunks', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      const mediaRecorder = (recordingManager as any).mediaRecorder;

      const emptyBlob = new Blob([], { type: 'video/webm' });
      const validBlob = new Blob(['data'], { type: 'video/webm' });

      if (mediaRecorder.ondataavailable) {
        mediaRecorder.ondataavailable({ data: emptyBlob } as BlobEvent);
        mediaRecorder.ondataavailable({ data: validBlob } as BlobEvent);
      }

      const result = await recordingManager.stopRecording();

      // Should only include the valid blob
      expect(result.blob.size).toBe(4); // 'data'.length
    });

    it('should handle null data chunks', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      const mediaRecorder = (recordingManager as any).mediaRecorder;

      if (mediaRecorder.ondataavailable) {
        mediaRecorder.ondataavailable({ data: null } as any);
        mediaRecorder.ondataavailable({ data: undefined } as any);
      }

      const result = await recordingManager.stopRecording();

      expect(result.blob).toBeDefined();
    });
  });

  describe('State management', () => {
    it('should return correct initial state', () => {
      expect(recordingManager.isRecording()).toBe(false);
      expect(recordingManager.isPaused()).toBe(false);
    });

    it('should maintain state consistency', async () => {
      // Initial state
      expect(recordingManager.isRecording()).toBe(false);
      expect(recordingManager.isPaused()).toBe(false);

      // Start recording
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');
      expect(recordingManager.isRecording()).toBe(true);
      expect(recordingManager.isPaused()).toBe(false);

      // Pause recording
      recordingManager.pauseRecording();
      expect(recordingManager.isRecording()).toBe(true);
      expect(recordingManager.isPaused()).toBe(true);

      // Resume recording
      recordingManager.resumeRecording();
      expect(recordingManager.isRecording()).toBe(true);
      expect(recordingManager.isPaused()).toBe(false);

      // Stop recording
      await recordingManager.stopRecording();
      expect(recordingManager.isRecording()).toBe(false);
      expect(recordingManager.isPaused()).toBe(false);
    });

    it('should reset state after stopping', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');
      recordingManager.pauseRecording();

      await recordingManager.stopRecording();

      expect(recordingManager.isRecording()).toBe(false);
      expect(recordingManager.isPaused()).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle very short recordings', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      // Stop immediately
      const result = await recordingManager.stopRecording();

      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
      expect(result.metadata.endTime.getTime()).toBeGreaterThanOrEqual(
        result.metadata.startTime.getTime()
      );
    });

    it('should handle special characters in barcode', async () => {
      const specialBarcode = 'TEST-123_ABC@#$%^&*()';

      await recordingManager.startRecording(asMediaStream(mockStream), specialBarcode);
      const result = await recordingManager.stopRecording();

      expect(result.metadata.barcode).toBe(specialBarcode);
    });

    it('should handle empty barcode', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), '');
      const result = await recordingManager.stopRecording();

      expect(result.metadata.barcode).toBe('');
    });

    it('should handle very long barcode', async () => {
      const longBarcode = 'A'.repeat(1000);

      await recordingManager.startRecording(asMediaStream(mockStream), longBarcode);
      const result = await recordingManager.stopRecording();

      expect(result.metadata.barcode).toBe(longBarcode);
    });

    it('should handle multiple pause/resume cycles', async () => {
      await recordingManager.startRecording(asMediaStream(mockStream), 'TEST123');

      for (let i = 0; i < 5; i++) {
        recordingManager.pauseRecording();
        expect(recordingManager.isPaused()).toBe(true);

        recordingManager.resumeRecording();
        expect(recordingManager.isPaused()).toBe(false);
      }

      const result = await recordingManager.stopRecording();
      expect(result).toBeDefined();
    });
  });
});
