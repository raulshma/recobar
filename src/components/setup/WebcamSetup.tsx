import React, { useState, useRef, useCallback, useEffect } from 'react';
import { VideoStreamManager } from '../../services/VideoStreamManager';
import { RendererConfigService } from '../../services/RendererConfigService';
import Button from '../ui/Button';

export interface WebcamSetupProps {
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
  // Use useRef to maintain stable service instances
  const configServiceRef = useRef(new RendererConfigService());
  const videoManagerRef = useRef(new VideoStreamManager());

  // Use useRef to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  const startPreview = useCallback(async (deviceId: string) => {
    if (!isMountedRef.current) return;
    
    try {
      setIsPreviewLoading(true);
      setError('');

      // Stop existing preview
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
        setPreviewStream(null);
      }

      const stream = await videoManagerRef.current.startStream(deviceId);
      
      if (isMountedRef.current) {
        setPreviewStream(stream);
      } else {
        // Component unmounted, clean up the stream
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (error) {
      console.error('Error starting preview:', error);
      if (isMountedRef.current) {
        setError(
          'Failed to start camera preview. Please try a different camera.',
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsPreviewLoading(false);
      }
    }
  }, [previewStream]);

  const loadDevicesAndExistingConfig = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      setIsLoading(true);
      setError('');

      // Load available devices
      const availableDevices = await videoManagerRef.current.getAvailableDevices();
      
      if (!isMountedRef.current) return;
      
      setDevices(availableDevices);

      if (availableDevices.length === 0) {
        setError('No cameras found. Please connect a camera and try again.');
        return;
      }

      // Try to load existing webcam selection
      const existingWebcamId = await configServiceRef.current.getWebcamId();

      if (!isMountedRef.current) return;

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
      if (isMountedRef.current) {
        setError(
          'Failed to access camera devices. Please check permissions and try again.',
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [startPreview]);

  // Load devices and config on mount only
  useEffect(() => {
    loadDevicesAndExistingConfig();
  }, []); // Empty dependency array - only run on mount

  // Set video source when stream changes
  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  // Cleanup effect on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Cleanup stream on unmount
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
      }
      
      // Cleanup video manager
      videoManagerRef.current.stopStream();
    };
  }, []); // Empty dependency array - only cleanup on unmount

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
      await configServiceRef.current.setWebcamId(selectedDeviceId);

      // Stop preview stream before completing
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
        setPreviewStream(null);
      }

      onComplete(selectedDeviceId);
    } catch (error) {
      console.error('Error saving webcam selection:', error);
      if (isMountedRef.current) {
        setError('Failed to save camera selection. Please try again.');
        setIsLoading(false);
      }
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
      <div className="neo-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="neo-card__header">
          <h2 className="neo-heading">Webcam Setup</h2>
          <p className="neo-text neo-text--muted">
            Select a camera for video recording
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLoading && devices.length > 0 && (
            <div className="neo-form__group">
              <label htmlFor="webcam-select" className="neo-form__label">
                Select Camera
              </label>
              <select
                id="webcam-select"
                className="neo-form__input"
                value={selectedDeviceId}
                onChange={handleDeviceChange}
                disabled={isLoading}
              >
                <option value="">Choose a camera...</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

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
