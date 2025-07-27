// Comprehensive unit tests for VideoStreamManager service
import { VideoStreamManager } from '../services/VideoStreamManager';

// Mock MediaDevices API
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

// Mock MediaStream and MediaStreamTrack
class MockMediaStreamTrack {
  public readyState: 'live' | 'ended' = 'live';
  public kind: string;
  private eventListeners: { [key: string]: ((event: Event) => void)[] } = {};

  constructor(kind: string) {
    this.kind = kind;
  }

  stop() {
    this.readyState = 'ended';
    this.dispatchEvent(new Event('ended'));
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    if (this.eventListeners[type]) {
      const index = this.eventListeners[type].indexOf(listener);
      if (index > -1) {
        this.eventListeners[type].splice(index, 1);
      }
    }
  }

  private dispatchEvent(event: Event) {
    if (this.eventListeners[event.type]) {
      this.eventListeners[event.type].forEach(listener => listener(event));
    }
  }
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[] = [];

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

  addTrack(track: MockMediaStreamTrack) {
    this.tracks.push(track);
  }
}

// Setup global mocks
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices,
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  },
});

// Mock global MediaStream
(global as any).MediaStream = MockMediaStream;

describe('VideoStreamManager', () => {
  let videoStreamManager: VideoStreamManager;
  let mockVideoTrack: MockMediaStreamTrack;
  let mockAudioTrack: MockMediaStreamTrack;
  let mockStream: MockMediaStream;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock tracks and stream
    mockVideoTrack = new MockMediaStreamTrack('video');
    mockAudioTrack = new MockMediaStreamTrack('audio');
    mockStream = new MockMediaStream([mockVideoTrack, mockAudioTrack]);

    // Create new instance
    videoStreamManager = new VideoStreamManager();
  });

  afterEach(() => {
    // Clean up
    videoStreamManager.dispose();
  });

  describe('Device enumeration', () => {
    it('should get available video devices', async () => {
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'camera1',
          kind: 'videoinput',
          label: 'Camera 1',
          groupId: 'group1',
          toJSON: () => ({}),
        },
        {
          deviceId: 'camera2',
          kind: 'videoinput',
          label: 'Camera 2',
          groupId: 'group2',
          toJSON: () => ({}),
        },
        {
          deviceId: 'mic1',
          kind: 'audioinput',
          label: 'Microphone 1',
          groupId: 'group3',
          toJSON: () => ({}),
        },
      ];

      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue(mockStream);

      const result = await videoStreamManager.getAvailableDevices();

      expect(result).toHaveLength(2);
      expect(result[0].kind).toBe('videoinput');
      expect(result[1].kind).toBe('videoinput');
      expect(mockGetUserMedia).toHaveBeenCalledWith({ video: true });
    });

    it('should handle permission denied gracefully', async () => {
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'camera1',
          kind: 'videoinput',
          label: '',
          groupId: 'group1',
          toJSON: () => ({}),
        },
      ];

      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      const result = await videoStreamManager.getAvailableDevices();

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('');
    });

    it('should throw error when no video devices found', async () => {
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'mic1',
          kind: 'audioinput',
          label: 'Microphone 1',
          groupId: 'group1',
          toJSON: () => ({}),
        },
      ];

      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue(mockStream);

      await expect(videoStreamManager.getAvailableDevices()).rejects.toThrow(
        'No video input devices found'
      );
    });

    it('should throw error when mediaDevices API not supported', async () => {
      // Temporarily remove mediaDevices
      const originalMediaDevices = navigator.mediaDevices;
      delete (navigator as any).mediaDevices;

      await expect(videoStreamManager.getAvailableDevices()).rejects.toThrow(
        'Media devices API not supported in this browser'
      );

      // Restore mediaDevices
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        writable: true,
      });
    });

    it('should throw error when enumerateDevices not supported', async () => {
      // Remove enumerateDevices
      delete (navigator.mediaDevices as any).enumerateDevices;

      await expect(videoStreamManager.getAvailableDevices()).rejects.toThrow(
        'Media devices API not supported in this browser'
      );

      // Restore enumerateDevices
      (navigator.mediaDevices as any).enumerateDevices = mockEnumerateDevices;
    });

    it('should handle enumerateDevices errors', async () => {
      mockEnumerateDevices.mockRejectedValue(new Error('Device enumeration failed'));

      await expect(videoStreamManager.getAvailableDevices()).rejects.toThrow(
        'Failed to access camera devices'
      );
    });
  });

  describe('Stream management', () => {
    beforeEach(() => {
      const mockDevices: MediaDeviceInfo[] = [
        {
          deviceId: 'camera1',
          kind: 'videoinput',
          label: 'Camera 1',
          groupId: 'group1',
          toJSON: () => ({}),
        },
      ];
      mockEnumerateDevices.mockResolvedValue(mockDevices);
    });

    it('should start stream with specific device ID', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const result = await videoStreamManager.startStream('camera1');

      expect(result).toBe(mockStream);
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          deviceId: { exact: 'camera1' },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
        },
        audio: true,
      });
    });

    it('should start stream without device ID', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const result = await videoStreamManager.startStream('');

      expect(result).toBe(mockStream);
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          deviceId: undefined,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
        },
        audio: true,
      });
    });

    it('should stop existing stream before starting new one', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      // Start first stream
      await videoStreamManager.startStream('camera1');
      const stopSpy = jest.spyOn(mockVideoTrack, 'stop');

      // Start second stream
      await videoStreamManager.startStream('camera1');

      expect(stopSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent device ID', async () => {
      await expect(videoStreamManager.startStream('non-existent')).rejects.toThrow(
        'Camera device with ID "non-existent" not found'
      );
    });

    it('should handle getUserMedia errors appropriately', async () => {
      const errorTests = [
        {
          error: { name: 'NotFoundError', message: 'Device not found' },
          expectedMessage: 'Camera device not found. Please check if the camera is connected.',
        },
        {
          error: { name: 'NotAllowedError', message: 'Permission denied' },
          expectedMessage: 'Camera access denied. Please grant camera permissions.',
        },
        {
          error: { name: 'NotReadableError', message: 'Device in use' },
          expectedMessage: 'Camera is already in use by another application.',
        },
        {
          error: { name: 'OverconstrainedError', message: 'Constraints not supported' },
          expectedMessage: 'Camera does not support the requested video settings.',
        },
        {
          error: { name: 'UnknownError', message: 'Unknown error' },
          expectedMessage: 'Unknown error',
        },
      ];

      for (const test of errorTests) {
        mockGetUserMedia.mockRejectedValueOnce(test.error);

        await expect(videoStreamManager.startStream('camera1')).rejects.toThrow(
          test.expectedMessage
        );
      }
    });

    it('should handle non-Error objects in getUserMedia', async () => {
      mockGetUserMedia.mockRejectedValue('String error');

      await expect(videoStreamManager.startStream('camera1')).rejects.toThrow(
        'Failed to start video stream'
      );
    });

    it('should stop stream and clean up tracks', () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      // Start stream first
      videoStreamManager.startStream('camera1');

      const videoStopSpy = jest.spyOn(mockVideoTrack, 'stop');
      const audioStopSpy = jest.spyOn(mockAudioTrack, 'stop');

      videoStreamManager.stopStream();

      expect(videoStopSpy).toHaveBeenCalled();
      expect(audioStopSpy).toHaveBeenCalled();
      expect(videoStreamManager.getCurrentStream()).toBeNull();
    });

    it('should handle stopping when no stream is active', () => {
      expect(() => videoStreamManager.stopStream()).not.toThrow();
    });

    it('should return current stream', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      expect(videoStreamManager.getCurrentStream()).toBeNull();

      await videoStreamManager.startStream('camera1');

      expect(videoStreamManager.getCurrentStream()).toBe(mockStream);
    });

    it('should check if stream is active', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      expect(videoStreamManager.isStreamActive()).toBe(false);

      await videoStreamManager.startStream('camera1');

      expect(videoStreamManager.isStreamActive()).toBe(true);

      // Stop one track
      mockVideoTrack.stop();

      expect(videoStreamManager.isStreamActive()).toBe(true); // Audio track still live

      // Stop all tracks
      mockAudioTrack.stop();

      expect(videoStreamManager.isStreamActive()).toBe(false);
    });
  });

  describe('Device change handling', () => {
    it('should register device change listeners', () => {
      const callback = jest.fn();

      videoStreamManager.onDeviceChange(callback);

      expect(mockAddEventListener).toHaveBeenCalledWith(
        'devicechange',
        expect.any(Function)
      );
    });

    it('should call device change callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      videoStreamManager.onDeviceChange(callback1);
      videoStreamManager.onDeviceChange(callback2);

      // Simulate device change
      const deviceChangeHandler = mockAddEventListener.mock.calls[0][1];
      deviceChangeHandler();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should remove device change listeners', () => {
      const callback = jest.fn();

      videoStreamManager.onDeviceChange(callback);
      videoStreamManager.removeDeviceChangeListener(callback);

      // Simulate device change
      const deviceChangeHandler = mockAddEventListener.mock.calls[0][1];
      deviceChangeHandler();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent listener', () => {
      const callback = jest.fn();

      expect(() => {
        videoStreamManager.removeDeviceChangeListener(callback);
      }).not.toThrow();
    });
  });

  describe('Track event handling', () => {
    it('should handle track ended events', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      await videoStreamManager.startStream('camera1');

      expect(videoStreamManager.getCurrentStream()).toBe(mockStream);

      // Simulate track ending
      mockVideoTrack.stop();

      expect(videoStreamManager.getCurrentStream()).toBeNull();
    });
  });

  describe('Disposal', () => {
    it('should dispose properly', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const callback = jest.fn();
      videoStreamManager.onDeviceChange(callback);

      await videoStreamManager.startStream('camera1');

      const videoStopSpy = jest.spyOn(mockVideoTrack, 'stop');
      const audioStopSpy = jest.spyOn(mockAudioTrack, 'stop');

      videoStreamManager.dispose();

      expect(videoStopSpy).toHaveBeenCalled();
      expect(audioStopSpy).toHaveBeenCalled();
      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        'devicechange',
        expect.any(Function)
      );

      // Callbacks should be cleared
      const deviceChangeHandler = mockAddEventListener.mock.calls[0][1];
      deviceChangeHandler();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle disposal when mediaDevices API not available', () => {
      // Remove mediaDevices
      const originalMediaDevices = navigator.mediaDevices;
      delete (navigator as any).mediaDevices;

      expect(() => videoStreamManager.dispose()).not.toThrow();

      // Restore mediaDevices
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        writable: true,
      });
    });

    it('should handle disposal when removeEventListener not available', () => {
      // Remove removeEventListener
      delete (navigator.mediaDevices as any).removeEventListener;

      expect(() => videoStreamManager.dispose()).not.toThrow();

      // Restore removeEventListener
      (navigator.mediaDevices as any).removeEventListener = mockRemoveEventListener;
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple simultaneous startStream calls', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const promises = [
        videoStreamManager.startStream('camera1'),
        videoStreamManager.startStream('camera1'),
        videoStreamManager.startStream('camera1'),
      ];

      const results = await Promise.all(promises);

      // All should succeed and return the same stream
      results.forEach(result => {
        expect(result).toBe(mockStream);
      });
    });

    it('should handle stream with no tracks', async () => {
      const emptyStream = new MockMediaStream([]);
      mockGetUserMedia.mockResolvedValue(emptyStream);

      const result = await videoStreamManager.startStream('camera1');

      expect(result).toBe(emptyStream);
      expect(videoStreamManager.isStreamActive()).toBe(false);
    });

    it('should handle stream with only video track', async () => {
      const videoOnlyStream = new MockMediaStream([mockVideoTrack]);
      mockGetUserMedia.mockResolvedValue(videoOnlyStream);

      const result = await videoStreamManager.startStream('camera1');

      expect(result).toBe(videoOnlyStream);
      expect(videoStreamManager.isStreamActive()).toBe(true);
    });

    it('should handle stream with only audio track', async () => {
      const audioOnlyStream = new MockMediaStream([mockAudioTrack]);
      mockGetUserMedia.mockResolvedValue(audioOnlyStream);

      const result = await videoStreamManager.startStream('camera1');

      expect(result).toBe(audioOnlyStream);
      expect(videoStreamManager.isStreamActive()).toBe(true);
    });
  });
});
