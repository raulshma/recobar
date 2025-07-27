// Demo component showing automatic recording integration
import React, { useRef, useEffect, useState } from 'react';
import { useRecordingOrchestrator } from '../../hooks';
import { RecordingControls } from './';
import { VideoStreamManager } from '../../services/VideoStreamManager';
import { RecordingResult } from '../../types';
import '../../styles/neobrutalism.scss';

interface AutoRecordingDemoProps {
  webcamId?: string;
}

const AutoRecordingDemo: React.FC<AutoRecordingDemoProps> = ({ webcamId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<RecordingResult[]>([]);
  const [videoStreamManager] = useState(() => new VideoStreamManager());

  // Initialize recording orchestrator with callbacks
  const orchestrator = useRecordingOrchestrator({
    onRecordingStarted: (barcode: string) => {
      console.log(`🎬 Recording started for barcode: ${barcode}`);
      setError(null);
    },
    onRecordingStopped: (result: RecordingResult) => {
      console.log(`⏹️ Recording stopped. Duration: ${result.metadata.duration}ms`);
      setRecordings(prev => [...prev, result]);
    },
    onRecordingError: (error: Error) => {
      console.error('❌ Recording error:', error);
      setError(error.message);
    },
    onBarcodeDetected: (barcode: string) => {
      console.log(`📷 Barcode detected: ${barcode}`);
    },
  });

  // Initialize video stream
  useEffect(() => {
    const initializeVideo = async () => {
      try {
        if (!videoRef.current) return;

        // Get available devices
        const devices = await videoStreamManager.getAvailableDevices();
        const targetDevice = webcamId
          ? devices.find(d => d.deviceId === webcamId)
          : devices[0];

        if (!targetDevice) {
          throw new Error('No webcam device available');
        }

        // Start video stream
        const mediaStream = await videoStreamManager.startStream(targetDevice.deviceId);
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);

        // Start orchestrator when video is ready
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && mediaStream) {
            orchestrator.start(videoRef.current, mediaStream);
          }
        };

      } catch (err) {
        console.error('Failed to initialize video:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize video');
      }
    };

    initializeVideo();

    // Cleanup
    return () => {
      orchestrator.stop();
      videoStreamManager.stopStream();
    };
  }, [webcamId, orchestrator, videoStreamManager]);

  // Handle manual recording controls
  const handlePause = () => {
    try {
      orchestrator.pauseRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause recording');
    }
  };

  const handleResume = () => {
    try {
      orchestrator.resumeRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume recording');
    }
  };

  const handleStop = async () => {
    try {
      await orchestrator.stopRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
    }
  };

  // Handle manual barcode trigger (for testing)
  const handleManualTrigger = async () => {
    try {
      const testBarcode = `TEST_${Date.now()}`;
      await orchestrator.forceStartRecording(testBarcode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger recording');
    }
  };

  return (
    <div className="auto-recording-demo">
      {/* Video Display */}
      <div className="video-container">
        <video
          ref={videoRef}
          className="neo-video"
          autoPlay
          muted
          playsInline
        />

        {/* Status Overlay */}
        <div className="status-overlay">
          {orchestrator.lastDetectedBarcode && (
            <div className="neo-status neo-status--ready">
              Last Barcode: {orchestrator.lastDetectedBarcode}
            </div>
          )}

          {error && (
            <div className="neo-status neo-status--error">
              Error: {error}
            </div>
          )}
        </div>
      </div>

      {/* Recording Controls */}
      <RecordingControls
        isRecording={orchestrator.isRecording}
        isPaused={orchestrator.isPaused}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        disabled={!orchestrator.isActive}
      />

      {/* Debug Panel */}
      <div className="debug-panel neo-card">
        <h3 className="neo-text--uppercase">Debug Panel</h3>

        <div className="debug-info">
          <p><strong>Orchestrator Active:</strong> {orchestrator.isActive ? '✅' : '❌'}</p>
          <p><strong>Detection Active:</strong> {orchestrator.detectionActive ? '✅' : '❌'}</p>
          <p><strong>Recording:</strong> {orchestrator.isRecording ? '🔴' : '⚪'}</p>
          <p><strong>Paused:</strong> {orchestrator.isPaused ? '⏸️' : '▶️'}</p>
          <p><strong>Last Barcode:</strong> {orchestrator.lastDetectedBarcode || 'None'}</p>
          <p><strong>Recordings Count:</strong> {recordings.length}</p>
        </div>

        <button
          className="neo-button neo-button--primary"
          onClick={handleManualTrigger}
          disabled={!orchestrator.isActive}
        >
          🧪 Trigger Test Recording
        </button>
      </div>

      {/* Recordings List */}
      {recordings.length > 0 && (
        <div className="recordings-list neo-card">
          <h3 className="neo-text--uppercase">Recordings ({recordings.length})</h3>
          {recordings.map((recording, index) => (
            <div key={recording.metadata.id} className="recording-item">
              <p><strong>#{index + 1}</strong> - {recording.metadata.barcode}</p>
              <p>Duration: {Math.round(recording.metadata.duration / 1000)}s</p>
              <p>Size: {Math.round(recording.blob.size / 1024)}KB</p>
              <p>Time: {recording.metadata.startTime.toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutoRecordingDemo;
