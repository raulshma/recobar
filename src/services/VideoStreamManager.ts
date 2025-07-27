// Video stream management service
import { VideoStreamManager as IVideoStreamManager } from '../types/video';

export class VideoStreamManager implements IVideoStreamManager {
  private currentStream: MediaStream | null = null;

  private deviceChangeListeners: (() => void)[] = [];

  constructor() {
    // Listen for device changes
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener(
        'devicechange',
        this.handleDeviceChange.bind(this),
      );
    }
  }

  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('Media devices API not supported in this browser');
      }

      // Request permissions first to ensure devices are available with labels
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        tempStream.getTracks().forEach((track) => track.stop());
      } catch (permissionError) {
        console.warn(
          'Camera permission not granted, device labels may not be available',
        );
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === 'videoinput',
      );

      if (videoDevices.length === 0) {
        throw new Error('No video input devices found');
      }

      return videoDevices;
    } catch (error) {
      console.error('Error getting available devices:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        'Failed to access camera devices. Please check permissions and device availability.',
      );
    }
  }

  async startStream(deviceId: string): Promise<MediaStream> {
    try {
      // Stop existing stream if any
      this.stopStream();

      // Validate deviceId if provided
      if (deviceId) {
        const devices = await this.getAvailableDevices();
        const deviceExists = devices.some(
          (device) => device.deviceId === deviceId,
        );
        if (!deviceExists) {
          throw new Error(`Camera device with ID "${deviceId}" not found`);
        }
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
        },
        audio: true,
      };

      this.currentStream =
        await navigator.mediaDevices.getUserMedia(constraints);

      // Add event listeners for stream events
      this.currentStream.getTracks().forEach((track) => {
        track.addEventListener('ended', this.handleTrackEnded.bind(this));
      });

      return this.currentStream;
    } catch (error) {
      console.error('Error starting video stream:', error);

      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          throw new Error(
            'Camera device not found. Please check if the camera is connected.',
          );
        } else if (error.name === 'NotAllowedError') {
          throw new Error(
            'Camera access denied. Please grant camera permissions.',
          );
        } else if (error.name === 'NotReadableError') {
          throw new Error('Camera is already in use by another application.');
        } else if (error.name === 'OverconstrainedError') {
          throw new Error(
            'Camera does not support the requested video settings.',
          );
        }
        throw error;
      }

      throw new Error(
        'Failed to start video stream. Please check camera permissions and availability.',
      );
    }
  }

  stopStream(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => {
        track.removeEventListener('ended', this.handleTrackEnded.bind(this));
        track.stop();
      });
      this.currentStream = null;
    }
  }

  getCurrentStream(): MediaStream | null {
    return this.currentStream;
  }

  isStreamActive(): boolean {
    return (
      this.currentStream !== null &&
      this.currentStream
        .getTracks()
        .some((track) => track.readyState === 'live')
    );
  }

  onDeviceChange(callback: () => void): void {
    this.deviceChangeListeners.push(callback);
  }

  removeDeviceChangeListener(callback: () => void): void {
    const index = this.deviceChangeListeners.indexOf(callback);
    if (index > -1) {
      this.deviceChangeListeners.splice(index, 1);
    }
  }

  private handleDeviceChange(): void {
    console.log('Media devices changed');
    this.deviceChangeListeners.forEach((callback) => callback());
  }

  private handleTrackEnded(): void {
    console.log('Video track ended');
    this.currentStream = null;
  }

  dispose(): void {
    this.stopStream();
    this.deviceChangeListeners = [];

    if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        this.handleDeviceChange.bind(this),
      );
    }
  }
}
