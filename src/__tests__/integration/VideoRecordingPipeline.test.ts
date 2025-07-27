// Mock QuaggaJS first
const mockQuagga = {
  init: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  onDetected: jest.fn(),
  offDetected: jest.fn(),
};

jest.mock('quagga', () => ({
  default: mockQuagga,
  ...mockQuagga,
}));

// Integration tests for video recording and barcode detection pipeline
import { VideoStreamManager } from '../../services/VideoStreamManager';
import { BarcodeDetectionService } from '../../services/BarcodeDetectionService';
import { RecordingManager } from '../../services/RecordingManager';
import { RecordingOrchestrator } from '../../services/RecordingOrchestrator';

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
    setTimeout(() => {
      if (this.ondataavailable) {
        const mockBlob = new Blob(['mock video data'], { type: this.mimeType });
        this.ondataavailable({ data: mockBlob } as BlobEvent);
      }
    }, 10);
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
    return mimeType === 'video/webm';
  }
}

// Mock MediaStream and MediaStreamTrack
class MockMediaStreamTrack {
  public readyState: 'live' | 'ended' = 'live';
  public kind: string;

  constructor(kind: string) {
    this.kind = kind;
  }

  stop() {
    this.readyState = 'ended';
  }

  addEventListener() {}
  removeEventListener() {}
  getSettings() {
    return { width: 1280, height: 720 };
  }
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[];

  constructor(tracks: MockMediaStreamTrack[] = []) {
    this.tracks = tracks;
  }

  getTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }

  getVideoTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter(track => track.kind === 'video');
  }

  getAudioTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter(track => track.kind === 'audio');
  }
}

// Setup global mocks
(global as any).MediaRecorder = MockMediaRecorder;
(global as any).MediaStream = MockMediaStream;
(global as any).Blob = class MockBlob {
  public size: number;
  public type: string;

  constructor(data: any[], options: { type: string }) {
    this.size = data.reduce((acc, item) => acc + (item.length || 0), 0);
    this.type = options.type;
  }
};

// Mock MediaDevices API
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();

Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
});

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

describe('Video Recording Pipeline Integration', () => {
  let videoStreamManager: VideoStreamManager;
  let barcodeDetectionService: BarcodeDetectionService;
  let recordingManager: RecordingManager;
  let recordingOrchestrator: RecordingOrchestrator;
  let mockVideoElement: HTMLVideoElement;
  let mockStream: MockMediaStream;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock electron config
    mockElectronConfig.getTenantId.mockResolvedValue('test-tenant');
    mockElectronConfig.getWebcamId.mockResolvedValue('test-webcam');

    // Create services
    videoStreamManager = new VideoStreamManager();
    barcodeDetectionService = new BarcodeDetectionService();
    recordingManager = new RecordingManager();
    recordingOrchestrator = new RecordingOrchestrator(
      barcodeDetectionService,
      recordingManager
    );

    // Create mock video element
    mockVideoElement = {
      videoWidth: 1280,
      videoHeight: 720,
    } as HTMLVideoElement;

    // Create mock stream
    const videoTrack = new MockMediaStreamTrack('video');
    const audioTrack = new MockMediaStreamTrack('audio');
    mockStream = new MockMediaStream([videoTrack, audioTrack]);

    // Setup default mock implementations
    const mockDevices: MediaDeviceInfo[] = [
      {
        deviceId: 'camera1',
        kind: 'videoinput',
        label: 'Test Camera',
        groupId: 'group1',
        toJSON: () => ({}),
      },
    ];

    mockEnumerateDevices.mockResolvedValue(mockDevices);
    mockGetUserMedia.mockResolvedValue(mockStream);

    // Setup Quagga mock
    mockQuagga.init.mockImplementation((config, callback) => {
      callback(null); // Success
    });
  });

  afterEach(() => {
    // Clean up
    videoStreamManager.dispose();
    barcodeDetectionService.stopDetection();
    recordingOrchestrator.stop();
  });

  describe('Complete recording pipeline', () => {
    it('should complete full video recording workflow', async () => {
      // Step 1: Start video stream
      const stream = await videoStreamManager.startStream('camera1');
      expect(stream).toBe(mockStream);
      expect(videoStreamManager.isStreamActive()).toBe(true);

      // Step 2: Start barcode detection
      barcodeDetectionService.startDetection(mockVideoElement);
      expect(mockQuagga.init).toHaveBeenCalled();
      expect(mockQuagga.start).toHaveBeenCalled();
      expect(barcodeDetectionService.isActive()).toBe(true);

      // Step 3: Simulate barcode detection
      const barcodeCallback = jest.fn();
      barcodeDetectionService.onBarcodeDetected(barcodeCallback);

      // Get the detection handler from Quagga mock
      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];
      const mockBarcodeResult = {
        codeResult: {
          code: 'TEST123',
          confidence: 85,
          format: 'code_128',
        },
      };

      detectionHandler(mockBarcodeResult);
      expect(barcodeCallback).toHaveBeenCalledWith('TEST123');

      // Step 4: Start recording
      await recordingManager.startRecording(stream, 'TEST123');
      expect(recordingManager.isRecording()).toBe(true);

      // Step 5: Stop recording
      const result = await recordingManager.stopRecording();
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.barcode).toBe('TEST123');
      expect(recordingManager.isRecording()).toBe(false);

      // Step 6: Clean up
      barcodeDetectionService.stopDetection();
      videoStreamManager.stopStream();

      expect(barcodeDetectionService.isActive()).toBe(false);
      expect(videoStreamManager.isStreamActive()).toBe(false);
    });

    it('should handle automatic recording with orchestrator', async () => {
      // Start video stream
      const stream = await videoStreamManager.startStream('camera1');

      // Start orchestrator
      recordingOrchestrator.start(mockVideoElement, stream);

      expect(recordingOrchestrator.isOrchestratorActive()).toBe(true);
      expect(mockQuagga.init).toHaveBeenCalled();

      // Simulate first barcode detection (should start recording)
      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      detectionHandler({
        codeResult: {
          code: 'BARCODE001',
          confidence: 85,
        },
      });

      // Wait for recording to start
      await new Promise(resolve => setTimeout(resolve, 50));

      const state = recordingOrchestrator.getRecordingState();
      expect(state.isActive).toBe(true);
      expect(state.lastDetectedBarcode).toBe('BARCODE001');

      // Simulate second barcode detection (should stop current and start new)
      detectionHandler({
        codeResult: {
          code: 'BARCODE002',
          confidence: 90,
        },
      });

      // Wait for recording transition
      await new Promise(resolve => setTimeout(resolve, 100));

      const newState = recordingOrchestrator.getRecordingState();
      expect(newState.isActive).toBe(true);
      expect(newState.lastDetectedBarcode).toBe('BARCODE002');

      // Stop orchestrator
      await recordingOrchestrator.stop();
      expect(recordingOrchestrator.isOrchestratorActive()).toBe(false);
    });

    it('should handle recording pause and resume', async () => {
      const stream = await videoStreamManager.startStream('camera1');
      await recordingManager.startRecording(stream, 'TEST123');

      expect(recordingManager.isRecording()).toBe(true);
      expect(recordingManager.isPaused()).toBe(false);

      // Pause recording
      recordingManager.pauseRecording();
      expect(recordingManager.isPaused()).toBe(true);
      expect(recordingManager.isRecording()).toBe(true); // Still recording, just paused

      // Resume recording
      recordingManager.resumeRecording();
      expect(recordingManager.isPaused()).toBe(false);
      expect(recordingManager.isRecording()).toBe(true);

      // Stop recording
      const result = await recordingManager.stopRecording();
      expect(result.metadata.barcode).toBe('TEST123');
    });

    it('should handle multiple barcode detections correctly', async () => {
      const stream = await videoStreamManager.startStream('camera1');
      recordingOrchestrator.start(mockVideoElement, stream);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];
      const recordingResults: any[] = [];

      // Mock the recording completion callback
      const originalStop = recordingManager.stopRecording.bind(recordingManager);
      recordingManager.stopRecording = jest.fn().mockImplementation(async () => {
        const result = await originalStop();
        recordingResults.push(result);
        return result;
      });

      // Detect multiple barcodes in sequence
      const barcodes = ['ITEM001', 'ITEM002', 'ITEM003'];

      for (let i = 0; i < barcodes.length; i++) {
        detectionHandler({
          codeResult: {
            code: barcodes[i],
            confidence: 85,
          },
        });

        // Wait for recording transition
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Stop orchestrator to finish last recording
      await recordingOrchestrator.stop();

      // Should have created recordings for each barcode transition
      expect(recordingResults.length).toBeGreaterThan(0);
      recordingResults.forEach((result, index) => {
        expect(result.metadata.barcode).toBeDefined();
        expect(result.blob).toBeDefined();
      });
    });
  });

  describe('Error handling in pipeline', () => {
    it('should handle video stream errors gracefully', async () => {
      // Mock stream failure
      mockGetUserMedia.mockRejectedValue(new Error('Camera access denied'));

      await expect(videoStreamManager.startStream('camera1')).rejects.toThrow(
        'Camera access denied'
      );

      // Should not affect other services
      expect(() => {
        barcodeDetectionService.startDetection(mockVideoElement);
      }).not.toThrow();
    });

    it('should handle barcode detection initialization errors', async () => {
      // Mock Quagga initialization failure
      mockQuagga.init.mockImplementation((config, callback) => {
        callback(new Error('Quagga init failed'));
      });

      const stream = await videoStreamManager.startStream('camera1');

      // Should not throw, but detection should not be active
      barcodeDetectionService.startDetection(mockVideoElement);
      expect(barcodeDetectionService.isActive()).toBe(false);

      // Recording should still work independently
      await recordingManager.startRecording(stream, 'MANUAL123');
      expect(recordingManager.isRecording()).toBe(true);

      const result = await recordingManager.stopRecording();
      expect(result.metadata.barcode).toBe('MANUAL123');
    });

    it('should handle recording errors during pipeline', async () => {
      const stream = await videoStreamManager.startStream('camera1');
      recordingOrchestrator.start(mockVideoElement, stream);

      // Mock recording failure
      const originalStart = recordingManager.startRecording.bind(recordingManager);
      recordingManager.startRecording = jest.fn().mockRejectedValue(
        new Error('Recording failed')
      );

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      // Simulate barcode detection
      detectionHandler({
        codeResult: {
          code: 'TEST123',
          confidence: 85,
        },
      });

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Orchestrator should handle the error gracefully
      expect(recordingOrchestrator.isOrchestratorActive()).toBe(true);

      // Restore original function for cleanup
      recordingManager.startRecording = originalStart;
    });

    it('should handle device disconnection during recording', async () => {
      const stream = await videoStreamManager.startStream('camera1');
      await recordingManager.startRecording(stream, 'TEST123');

      // Simulate device disconnection
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());

      // Stream should no longer be active
      expect(videoStreamManager.isStreamActive()).toBe(false);

      // Recording should still complete
      const result = await recordingManager.stopRecording();
      expect(result.metadata.barcode).toBe('TEST123');
    });

    it('should handle low confidence barcode detections', async () => {
      const stream = await videoStreamManager.startStream('camera1');
      recordingOrchestrator.start(mockVideoElement, stream);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      // Simulate low confidence detection
      detectionHandler({
        codeResult: {
          code: 'LOWCONF',
          confidence: 50, // Below threshold
        },
      });

      // Wait for potential recording start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not have started recording
      const state = recordingOrchestrator.getRecordingState();
      expect(state.isActive).toBe(false);
      expect(state.lastDetectedBarcode).toBeNull();
    });
  });

  describe('Performance and resource management', () => {
    it('should properly clean up resources', async () => {
      const stream = await videoStreamManager.startStream('camera1');
      barcodeDetectionService.startDetection(mockVideoElement);
      await recordingManager.startRecording(stream, 'TEST123');

      // Stop all services
      await recordingManager.stopRecording();
      barcodeDetectionService.stopDetection();
      videoStreamManager.stopStream();

      // Verify cleanup
      expect(recordingManager.isRecording()).toBe(false);
      expect(barcodeDetectionService.isActive()).toBe(false);
      expect(videoStreamManager.isStreamActive()).toBe(false);

      // Should be able to restart
      const newStream = await videoStreamManager.startStream('camera1');
      expect(videoStreamManager.isStreamActive()).toBe(true);
    });

    it('should handle concurrent operations', async () => {
      const stream = await videoStreamManager.startStream('camera1');

      // Start multiple operations concurrently
      const operations = [
        recordingManager.startRecording(stream, 'CONCURRENT1'),
        new Promise(resolve => {
          barcodeDetectionService.startDetection(mockVideoElement);
          resolve(undefined);
        }),
      ];

      // First operation should succeed, second should not interfere
      await Promise.all(operations);

      expect(recordingManager.isRecording()).toBe(true);
      expect(barcodeDetectionService.isActive()).toBe(true);

      // Clean up
      await recordingManager.stopRecording();
      barcodeDetectionService.stopDetection();
    });

    it('should handle rapid barcode detection changes', async () => {
      const stream = await videoStreamManager.startStream('camera1');
      recordingOrchestrator.start(mockVideoElement, stream);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      // Rapidly fire multiple detections
      const rapidBarcodes = ['RAPID1', 'RAPID2', 'RAPID3', 'RAPID4', 'RAPID5'];

      rapidBarcodes.forEach((barcode, index) => {
        setTimeout(() => {
          detectionHandler({
            codeResult: {
              code: barcode,
              confidence: 85,
            },
          });
        }, index * 10); // 10ms apart
      });

      // Wait for all detections to process
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should handle rapid changes gracefully
      const state = recordingOrchestrator.getRecordingState();
      expect(state.isActive).toBe(true);
      expect(rapidBarcodes).toContain(state.lastDetectedBarcode);

      await recordingOrchestrator.stop();
    });

    it('should maintain performance with long recording sessions', async () => {
      const stream = await videoStreamManager.startStream('camera1');
      await recordingManager.startRecording(stream, 'LONGTEST');

      // Simulate data chunks over time
      const mediaRecorder = (recordingManager as any).mediaRecorder;

      for (let i = 0; i < 10; i++) {
        if (mediaRecorder.ondataavailable) {
          const mockBlob = new Blob([`chunk${i}`], { type: 'video/webm' });
          mediaRecorder.ondataavailable({ data: mockBlob } as BlobEvent);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const result = await recordingManager.stopRecording();

      // Should handle multiple chunks
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.metadata.duration).toBeGreaterThan(0);
    });
  });
});
