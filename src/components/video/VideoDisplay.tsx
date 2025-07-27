import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { VideoDisplayProps } from '../../types/video';
import { BarcodeDetectionService } from '../../services/BarcodeDetectionService';
import '../../styles/neobrutalism.scss';
import '../../styles/barcode-detection.scss';

export interface VideoDisplayRef {
  getVideoElement: () => HTMLVideoElement | null;
}

const VideoDisplay = forwardRef<VideoDisplayRef, VideoDisplayProps>(({
  stream,
  onError,
  className = '',
  enableBarcodeDetection = false,
  onBarcodeDetected,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Expose video element through ref
  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
  }));
  const barcodeServiceRef = useRef<BarcodeDetectionService | null>(null);
  const onBarcodeDetectedRef = useRef(onBarcodeDetected);
  const onErrorRef = useRef(onError);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [lastDetectedBarcode, setLastDetectedBarcode] = useState<string | null>(
    null,
  );
  const [barcodeDetectionActive, setBarcodeDetectionActive] = useState(false);

  // Update refs when callbacks change
  useEffect(() => {
    onBarcodeDetectedRef.current = onBarcodeDetected;
    onErrorRef.current = onError;
  }, [onBarcodeDetected, onError]);

  // Barcode detection functions
  const startBarcodeDetection = () => {
    const videoElement = videoRef.current;
    if (!videoElement || !enableBarcodeDetection || !onBarcodeDetectedRef.current) {
      return;
    }

    try {
      // Initialize barcode detection service if not already done
      if (!barcodeServiceRef.current) {
        barcodeServiceRef.current = new BarcodeDetectionService();
      }

      const service = barcodeServiceRef.current;

      // Set up barcode detection callback
      const handleBarcodeDetected = (barcode: string) => {
        setLastDetectedBarcode(barcode);
        onBarcodeDetectedRef.current?.(barcode);

        // Clear the detected barcode after 3 seconds for visual feedback
        setTimeout(() => {
          setLastDetectedBarcode(null);
        }, 3000);
      };

      service.onBarcodeDetected(handleBarcodeDetected);
      service.startDetection(videoElement);
      setBarcodeDetectionActive(true);
    } catch (error) {
      console.error('Failed to start barcode detection:', error);
      const errorMsg = 'Failed to initialize barcode detection';
      setError(errorMsg);
      onErrorRef.current?.(errorMsg);
    }
  };

  const stopBarcodeDetection = () => {
    if (barcodeServiceRef.current) {
      barcodeServiceRef.current.stopDetection();
      barcodeServiceRef.current.clearCallbacks();
      setBarcodeDetectionActive(false);
      setLastDetectedBarcode(null);
    }
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (stream) {
      setIsLoading(true);
      setError(null);
      setVideoReady(false);

      // Set the stream as the video source
      videoElement.srcObject = stream;

      const handleLoadedMetadata = () => {
        setIsLoading(false);
        setVideoReady(true);
        videoElement.play().catch((err) => {
          console.error('Error playing video:', err);
          const errorMsg = 'Failed to play video stream';
          setError(errorMsg);
          onErrorRef.current?.(errorMsg);
        });

        // Start barcode detection if enabled
        if (enableBarcodeDetection && onBarcodeDetectedRef.current) {
          startBarcodeDetection();
        }
      };

      const handleError = (event: Event) => {
        const errorMsg = 'Video playback error occurred';
        setError(errorMsg);
        setIsLoading(false);
        setVideoReady(false);
        onErrorRef.current?.(errorMsg);
      };

      const handleLoadStart = () => {
        setIsLoading(true);
      };

      const handleCanPlay = () => {
        setIsLoading(false);
      };

      // Add event listeners
      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.addEventListener('error', handleError);
      videoElement.addEventListener('loadstart', handleLoadStart);
      videoElement.addEventListener('canplay', handleCanPlay);

      // Cleanup function
      return () => {
        videoElement.removeEventListener(
          'loadedmetadata',
          handleLoadedMetadata,
        );
        videoElement.removeEventListener('error', handleError);
        videoElement.removeEventListener('loadstart', handleLoadStart);
        videoElement.removeEventListener('canplay', handleCanPlay);

        // Stop barcode detection
        stopBarcodeDetection();

        // Stop the video and clear the source
        videoElement.pause();
        videoElement.srcObject = null;
      };
    } else {
      // No stream provided, clear the video
      videoElement.srcObject = null;
      setVideoReady(false);
      setIsLoading(false);
      setError(null);
    }
  }, [stream]); // Simplified dependencies - only track stream changes

  // Separate effect for barcode detection to avoid unnecessary video restarts
  useEffect(() => {
    if (videoReady && enableBarcodeDetection && onBarcodeDetectedRef.current) {
      startBarcodeDetection();
    } else if (!enableBarcodeDetection) {
      stopBarcodeDetection();
    }
  }, [videoReady, enableBarcodeDetection]); // Remove onBarcodeDetected from deps to prevent restarts

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      stopBarcodeDetection();
    };
  }, []);

  const handleVideoClick = () => {
    const videoElement = videoRef.current;
    if (videoElement) {
      if (videoElement.paused) {
        videoElement.play().catch((err) => {});
      }
    }
  };

  return (
    <div className={`video-display ${className}`} data-testid="video-display" role="img" aria-label="Video stream display" tabIndex={0}>
      <div className="video-container" data-testid="video-container">
        <video
          ref={videoRef}
          className="video-element"
          autoPlay
          muted
          playsInline
          onClick={handleVideoClick}
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="video-overlay loading-overlay">
            <div className="loading-spinner" />
            <p className="loading-text">Loading video stream...</p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="video-overlay error-overlay">
            <div className="error-icon">⚠️</div>
            <p className="error-text">{error}</p>
            <button
              className="btn btn-primary retry-btn"
              onClick={() => {
                setError(null);
                if (stream && videoRef.current) {
                  videoRef.current.srcObject = stream;
                }
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* No stream overlay */}
        {!stream && !isLoading && !error && (
          <div className="video-overlay no-stream-overlay">
            <div className="no-stream-icon">📹</div>
            <p className="no-stream-text">No video stream available</p>
            <p className="no-stream-subtitle">
              Please select a camera to start streaming
            </p>
          </div>
        )}

        {/* Barcode detection status overlay */}
        {enableBarcodeDetection && videoReady && (
          <div className="barcode-detection-status">
            <div
              className={`detection-indicator ${barcodeDetectionActive ? 'active' : 'inactive'}`}
            >
              <span className="detection-icon">🔍</span>
              <span className="detection-text">
                {barcodeDetectionActive
                  ? 'Scanning for barcodes...'
                  : 'Barcode detection inactive'}
              </span>
            </div>

            {lastDetectedBarcode && (
              <div className="barcode-detected-overlay">
                <div className="barcode-detected-content">
                  <span className="barcode-icon">📊</span>
                  <div className="barcode-info">
                    <p className="barcode-label">Barcode Detected:</p>
                    <p className="barcode-value">{lastDetectedBarcode}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default VideoDisplay;
