// Tests for RecordingOrchestrator service
import { RecordingOrchestrator } from '../services/RecordingOrchestrator';

// Mock the services completely to avoid dependency issues
const mockBarcodeDetectionService = {
  startDetection: jest.fn(),
  stopDetection: jest.fn(),
  onBarcodeDetected: jest.fn(),
  isActive: jest.fn().mockReturnValue(true),
};

const mockRecordingManager = {
  startRecording: jest.fn().mockResolvedValue(undefined),
  stopRecording: jest.fn().mockResolvedValue({
    blob: new Blob(['test'], { type: 'video/webm' }),
    metadata: {
      id: 'test-id',
      tenantId: 'test-tenant',
      barcode: 'test-barcode',
      startTime: new Date(),
      endTime: new Date(),
      duration: 1000,
      webcamId: 'test-webcam',
      resolution: { width: 640, height: 480 },
      hasAudio: true,
    },
  }),
  pauseRecording: jest.fn(),
  resumeRecording: jest.fn(),
  isRecording: jest.fn().mockReturnValue(false),
  isPaused: jest.fn().mockReturnValue(false),
};

describe('RecordingOrchestrator', () => {
  let orchestrator: RecordingOrchestrator;
  let mockVideoElement: HTMLVideoElement;
  let mockStream: MediaStream;

  beforeEach(() => {
    jest.clearAllMocks();

    orchestrator = new RecordingOrchestrator(
      mockBarcodeDetectionService as any,
      mockRecordingManager as any
    );

    mockVideoElement = document.createElement('video') as HTMLVideoElement;
    mockStream = new MediaStream();
  });

  describe('basic functionality', () => {
    it('should start orchestration successfully', () => {
      orchestrator.start(mockVideoElement, mockStream);

      expect(mockBarcodeDetectionService.startDetection).toHaveBeenCalledWith(mockVideoElement);
      expect(mockBarcodeDetectionService.onBarcodeDetected).toHaveBeenCalled();
      expect(orchestrator.isOrchestratorActive()).toBe(true);
    });

    it('should stop orchestration successfully', async () => {
      orchestrator.start(mockVideoElement, mockStream);

      await orchestrator.stop();

      expect(mockBarcodeDetectionService.stopDetection).toHaveBeenCalled();
      expect(orchestrator.isOrchestratorActive()).toBe(false);
    });

    it('should return correct state', () => {
      orchestrator.start(mockVideoElement, mockStream);

      const state = orchestrator.getRecordingState();

      expect(state.isActive).toBe(true);
      expect(state.detectionActive).toBe(true);
    });
  });
});
