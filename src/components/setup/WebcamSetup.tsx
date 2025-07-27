import React, { useState, useEffect, useRef, useCallback } from 'react';
import Button from '../ui/Button';
import { RendererConfigService } from '../../services/RendererConfigService';
import { VideoStreamManager } from '../../services/VideoStreamManager';

interface WebcamSetupProps {
  onComplete: (webcamId: string) => void;
  onBack?: () => void;
}

const WebcamSetup: React.FC<WebcamSetupProps> = ({ onComplete, onBack }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const configService = new RendererConfigService();
  const videoManager = new VideoStreamManager();

  const loadDevicesAndExistingConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      // Load available devices
      const availableDevices = await videoManager.getAvailableDevices();
      setDevices(availableDevices);

      if (availableDevices.length === 0) {
        setError('No cameras found. Please connect a camera and try again.');
        return;
      }

      // Try to load existing webcam selection
      const existingWebcamId = await configService.getWebcamId();

      if (
        existingWebcamId &&
        availableDevices.some((device) => device.deviceId === existingWebcamId)
      ) {
        setSelectedDeviceId(existingWebcamId);
        await startPreview(existingWebcamId);
      } else if (availableDevices.length > 0) {
        // Select first device by default
        const defaultDevice = availableDevices[0];
        setSelectedDeviceId(defaultDevice.deviceId);
        await startPreview(defaultDevice.deviceId);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
      setError(
        'Failed to access camera devices. Please check permissions and try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [configService, videoManager]);

  useEffect(() => {
    loadDevicesAndExistingConfig();

    return () => {
      // Cleanup stream on unmount
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [loadDevicesAndExistingConfig, previewStream]);

  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const startPreview = async (deviceId: string) => {
    try {
      setIsPreviewLoading(true);
      setError('');

      // Stop existing preview
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
      }

      const stream = await videoManager.startStream(deviceId);
      setPreviewStream(stream);
    } catch (error) {
      console.error('Error starting preview:', error);
      setError(
        'Failed to start camera preview. Please try a different camera.',
      );
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDeviceChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const deviceId = e.target.value;
    setSelectedDeviceId(deviceId);

    if (deviceId) {
      await startPreview(deviceId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDeviceId) {
      setError('Please select a camera');
      return;
    }

    try {
      setIsLoading(true);
      await configService.setWebcamId(selectedDeviceId);

      // Stop preview stream before completing
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
      }

      onComplete(selectedDeviceId);
    } catch (error) {
      console.error('Error saving webcam selection:', error);
      setError('Failed to save camera selection. Please try again.');
      setIsLoading(false);
    }
  };

  const getDeviceLabel = (device: MediaDeviceInfo) => {
    return device.label || `Camera ${devices.indexOf(device) + 1}`;
  };

  if (isLoading && devices.length === 0) {
    return (
      <div className="neo-container">
        <div className="neo-card neo-text--center">
          <h1 className="neo-text--xl neo-text--uppercase">
            Loading Cameras...
          </h1>
          <p>Please allow camera access when prompted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="neo-container">
      <div className="neo-card">
        <div className="neo-text--center">
          <h1 className="neo-text--xl neo-text--uppercase">Camera Setup</h1>
          <p className="neo-text--large" style={{ marginBottom: '32px' }}>
            Select your camera and verify the preview looks good.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="neo-form">
          <div className="neo-form__group">
            <label htmlFor="webcam-select" className="neo-form__label">
              Select Camera
            </label>
            <select
              id="webcam-select"
              className="neo-form__select"
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              disabled={isLoading || devices.length === 0}
            >
              <option value="">Choose a camera...</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {getDeviceLabel(device)}
                </option>
              ))}
            </select>
          </div>

          {/* Camera Preview */}
          {selectedDeviceId && (
            <div className="neo-form__group">
              <label className="neo-form__label">Camera Preview</label>
              <div
                className="neo-card"
                style={{ padding: '16px', position: 'relative' }}
              >
                {isPreviewLoading ? (
                  <div
                    className="neo-text--center"
                    style={{ padding: '60px 0' }}
                  >
                    <p>Loading preview...</p>
                  </div>
                ) : previewStream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="neo-video"
                    style={{
                      width: '100%',
                      height: '300px',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    className="neo-text--center"
                    style={{ padding: '60px 0' }}
                  >
                    <p>No preview available</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div
              className="neo-status neo-status--error"
              style={{ marginBottom: '16px' }}
            >
              {error}
            </div>
          )}

          <div className="neo-flex neo-flex--between">
            {onBack && (
              <Button
                type="button"
                variant="info"
                onClick={onBack}
                disabled={isLoading}
              >
                Back
              </Button>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !selectedDeviceId || devices.length === 0}
              style={{ marginLeft: 'auto' }}
            >
              {isLoading ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        </form>

        {devices.length === 0 && !isLoading && (
          <div className="neo-text--center" style={{ marginTop: '24px' }}>
            <Button variant="info" onClick={loadDevicesAndExistingConfig}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebcamSetup;
