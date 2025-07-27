import '@testing-library/jest-dom';

// Mock console methods to suppress test noise
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

// Configure React testing environment 
beforeAll(() => {
  // This tells React that we're in a test environment that supports act
  (global as any).IS_REACT_ACT_ENVIRONMENT = true;
});

// Mock Electron APIs
Object.defineProperty(window, 'electron', {
  value: {
    config: {
      isFirstTimeSetup: jest.fn().mockResolvedValue(false),
      getConfig: jest.fn().mockResolvedValue({
        tenantId: 'test-tenant',
        webcamId: 'test-webcam',
        storageSettings: {
          localPath: '/test/path',
          s3Config: null,
        },
      }),
      getTenantId: jest.fn().mockResolvedValue('test-tenant'),
      setTenantId: jest.fn().mockResolvedValue(undefined),
      getWebcamId: jest.fn().mockResolvedValue('test-webcam'),
      setWebcamId: jest.fn().mockResolvedValue(undefined),
      getStorageSettings: jest.fn().mockResolvedValue({
        localPath: '/test/path',
        s3Config: null,
      }),
      setStorageSettings: jest.fn().mockResolvedValue(undefined),
      updateStorageSettings: jest.fn().mockResolvedValue(undefined),
      validateS3Settings: jest.fn().mockResolvedValue(true),
      getAvailableDevices: jest.fn().mockResolvedValue([
        { deviceId: 'test-device', label: 'Test Camera' },
      ]),
    },
    storage: {
      saveLocal: jest.fn().mockResolvedValue('/test/path/file.webm'),
      uploadToS3: jest.fn().mockResolvedValue('s3://bucket/key'),
      saveRecording: jest.fn().mockResolvedValue({
        success: true,
        localPath: '/test/path/file.webm',
        s3Path: 's3://bucket/key',
        errors: [],
      }),
    },
    recording: {
      startRecording: jest.fn().mockResolvedValue(undefined),
      stopRecording: jest.fn().mockResolvedValue({
        path: '/test/path/recording.webm',
        metadata: {
          duration: 5000,
          barcode: 'TEST123',
          timestamp: new Date().toISOString(),
        },
      }),
      isRecording: jest.fn().mockReturnValue(false),
    },
  },
  configurable: true,
});

// Mock MediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockImplementation(() =>
      Promise.resolve({
        getTracks: () => [
          {
            stop: jest.fn(),
            kind: 'video',
            enabled: true,
          },
        ],
        getVideoTracks: () => [
          {
            stop: jest.fn(),
            kind: 'video',
            enabled: true,
          },
        ],
      })
    ),
    enumerateDevices: jest.fn().mockResolvedValue([
      {
        deviceId: 'test-device-1',
        label: 'Test Camera 1',
        kind: 'videoinput',
      },
      {
        deviceId: 'test-device-2',
        label: 'Test Camera 2',
        kind: 'videoinput',
      },
    ]),
  },
  configurable: true,
});

// Mock Quagga
jest.mock('quagga', () => ({
  init: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  onDetected: jest.fn(),
  offDetected: jest.fn(),
  offProcessed: jest.fn(),
}));

// Note: electron-store is mocked individually in each test file that needs it
// to allow for more granular control over mock behavior

// Mock file system operations
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('mock file content'),
  access: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
  HeadBucketCommand: jest.fn(),
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock HTMLVideoElement
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  writable: true,
  value: jest.fn().mockResolvedValue(undefined),
});

Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
  writable: true,
  value: jest.fn(),
});

// Mock MediaRecorder
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  state: 'inactive',
  stream: null,
  mimeType: 'video/webm',
})) as any; 

// Mock MediaStream
global.MediaStream = jest.fn().mockImplementation(() => ({
  getTracks: jest.fn(() => [
    {
      stop: jest.fn(),
      kind: 'video',
      enabled: true,
      readyState: 'live',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    {
      stop: jest.fn(),
      kind: 'audio',
      enabled: true,
      readyState: 'live',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  ]),
  getVideoTracks: jest.fn(() => [
    {
      stop: jest.fn(),
      kind: 'video',
      enabled: true,
      readyState: 'live',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  ]),
  getAudioTracks: jest.fn(() => [
    {
      stop: jest.fn(),
      kind: 'audio',
      enabled: true,
      readyState: 'live',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  ]),
  addTrack: jest.fn(),
  removeTrack: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  active: true,
  id: 'mock-stream-id',
})) as any;

// Mock MediaStreamTrack
global.MediaStreamTrack = jest.fn().mockImplementation(() => ({
  stop: jest.fn(),
  kind: 'video',
  enabled: true,
  readyState: 'live',
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  id: 'mock-track-id',
  label: 'Mock Track',
  getSettings: jest.fn(() => ({ width: 640, height: 480 })),
  getCapabilities: jest.fn(() => ({})),
  getConstraints: jest.fn(() => ({})),
  applyConstraints: jest.fn().mockResolvedValue(undefined),
  clone: jest.fn(() => new MediaStreamTrack()),
})) as any; 