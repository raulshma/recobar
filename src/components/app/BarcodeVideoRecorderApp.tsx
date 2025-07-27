import React, { useState, useEffect, useRef } from 'react';
import { SetupWizard } from '../setup';
import { VideoDisplay } from '../video';
import { RecordingControls } from '../recording';
import { SettingsModal } from '../settings';
import { StatusIndicator, NotificationSystem, NotificationSystemRef } from '../ui';
import { BarcodeDetectionTester } from '../ui';
import { RendererConfigService } from '../../services/RendererConfigService';
import { VideoStreamManager } from '../../services/VideoStreamManager';
import { RecordingManager } from '../../services/RecordingManager';
import { RendererStorageService } from '../../services/RendererStorageService';
import { ErrorHandler } from '../../services/ErrorHandler';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { AppConfig, RecordingResult } from '../../types';
import '../../styles/neobrutalism.scss';
import '../../styles/main-app.scss';

type AppView = 'setup' | 'main';

interface AppState {
  currentView: AppView;
  isLoading: boolean;
  config: AppConfig | null;
  videoStream: MediaStream | null;
  isRecording: boolean;
  isPaused: boolean;
  lastDetectedBarcode: string | null;
  showSettings: boolean;
}

const BarcodeVideoRecorderApp: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentView: 'setup',
    isLoading: true,
    config: null,
    videoStream: null,
    isRecording: false,
    isPaused: false,
    lastDetectedBarcode: null,
    showSettings: false,
  });

  // Debug state
  const [showDebugTester, setShowDebugTester] = useState(false);

  // Service instances
  const configService = useRef(new RendererConfigService());
  const videoManager = useRef(new VideoStreamManager());
  const recordingManager = useRef(new RecordingManager());
  const storageService = useRef(new RendererStorageService());
  const errorHandler = useRef(new ErrorHandler());

  // Current video stream ref - use ref instead of state for real-time access
  const currentVideoStreamRef = useRef<MediaStream | null>(null);

  // Video display ref for barcode detection
  const videoDisplayRef = useRef<{ getVideoElement: () => HTMLVideoElement | null }>(null);

  // Notification system ref
  const notificationSystemRef = useRef<NotificationSystemRef | null>(null);

  // Error handling hook
  const { showNotification } = useErrorHandler(notificationSystemRef);

  // Convenience methods for different notification types
  const showError = (message: string) => showNotification(message, 'error');
  const showSuccess = (message: string) => showNotification(message, 'success');
  const showInfo = (message: string) => showNotification(message, 'info');

  // Initialize application
  useEffect(() => {
    initializeApp();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  const initializeApp = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Check if setup is complete
      const isFirstTime = await configService.current.isFirstTimeSetup();

      if (isFirstTime) {
        setState(prev => ({
          ...prev,
          currentView: 'setup',
          isLoading: false
        }));
        return;
      }

      // Load configuration
      const config = await configService.current.getConfig();

      // Validate required configuration
      if (!config.tenantId || !config.webcamId) {
        setState(prev => ({
          ...prev,
          currentView: 'setup',
          isLoading: false
        }));
        return;
      }

      // Initialize video stream
      await initializeVideoStream(config.webcamId);

      setState(prev => ({
        ...prev,
        config,
        currentView: 'main',
        isLoading: false,
      }));

    } catch (error) {
      console.error('Failed to initialize app:', error);
      showError('Failed to initialize application. Please check your configuration.');
      setState(prev => ({
        ...prev,
        currentView: 'setup',
        isLoading: false
      }));
    }
  };

  const initializeVideoStream = async (webcamId: string) => {
    try {
      const stream = await videoManager.current.startStream(webcamId);
      
      // Store in both state and ref
      setState(prev => ({ ...prev, videoStream: stream }));
      currentVideoStreamRef.current = stream;

      // Barcode detection will be handled by VideoDisplay component

    } catch (error) {
      console.error('Failed to initialize video stream:', error);
      throw new Error('Failed to access camera. Please check permissions and device availability.');
    }
  };



  // Debouncing for barcode detection
  const lastBarcodeRef = useRef<string | null>(null);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleBarcodeDetected = async (barcode: string) => {
    console.log(`🎯 BarcodeVideoRecorderApp: Barcode detected: "${barcode}"`);
    
    try {
      // Debounce rapid detections of the same barcode
      if (lastBarcodeRef.current === barcode) {
        console.log('🚫 BarcodeVideoRecorderApp: Ignoring duplicate barcode detection');
        return;
      }

      // Clear any existing timeout
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      // Set debounce timeout
      barcodeTimeoutRef.current = setTimeout(() => {
        lastBarcodeRef.current = null;
      }, 2000); // Reset after 2 seconds

      lastBarcodeRef.current = barcode;
      setState(prev => ({ ...prev, lastDetectedBarcode: barcode }));

      // If currently recording, stop and save current recording
      if (state.isRecording) {
        console.log('🛑 BarcodeVideoRecorderApp: Stopping current recording due to new barcode');
        await stopCurrentRecording();
      }

      // Start new recording with detected barcode
      console.log('▶️ BarcodeVideoRecorderApp: Starting new recording');
      await startRecording(barcode);

    } catch (error) {
      console.error('❌ BarcodeVideoRecorderApp: Error handling barcode detection:', error);
      showError('Failed to process barcode detection.');
    }
  };

  const startRecording = async (barcode: string) => {
    // Use ref instead of state to get current stream
    const currentStream = currentVideoStreamRef.current;
    
    console.log('🎬 BarcodeVideoRecorderApp: Attempting to start recording', {
      hasVideoStream: !!currentStream,
      streamActive: currentStream?.active,
      videoTracks: currentStream?.getVideoTracks().length,
      audioTracks: currentStream?.getAudioTracks().length
    });

    if (!currentStream || !currentStream.active) {
      console.error('❌ BarcodeVideoRecorderApp: No active video stream for recording');
      throw new Error('No video stream available for recording');
    }

    try {
      await recordingManager.current.startRecording(currentStream, barcode);
      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false
      }));
      showInfo(`Recording started for barcode: ${barcode}`);

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Failed to start recording');
    }
  };

  const stopCurrentRecording = async (): Promise<RecordingResult | null> => {
    if (!state.isRecording) return null;

    try {
      const result = await recordingManager.current.stopRecording();
      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false
      }));

      // Save recording
      if (result && state.config) {
        await saveRecording(result);
      }

      return result;

    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw new Error('Failed to stop recording');
    }
  };

  const saveRecording = async (recording: RecordingResult) => {
    if (!state.config) return;

    try {
      const storageSettings = state.config.storage;

      // Process storage operations in background to avoid blocking UI
      const processStorage = async () => {
        try {
          // Save locally if configured
          if (storageSettings.local.enabled) {
            await storageService.current.saveLocal(recording, storageSettings.local.path);
          }

          // Upload to S3 if configured
          if (storageSettings.s3.enabled) {
            await storageService.current.uploadToS3(recording, storageSettings.s3);
          }

          showSuccess('Recording saved successfully');
        } catch (error) {
          console.error('Failed to save recording:', error);
          showError('Failed to save recording. Check storage configuration.');
        }
      };

      // Use requestIdleCallback if available, otherwise use setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => processStorage());
      } else {
        setTimeout(() => processStorage(), 0);
      }

    } catch (error) {
      console.error('Failed to save recording:', error);
      showError('Failed to save recording. Check storage configuration.');
    }
  };

  // Manual recording controls
  const handlePauseRecording = async () => {
    try {
      recordingManager.current.pauseRecording();
      setState(prev => ({ ...prev, isPaused: true }));
      showInfo('Recording paused');
    } catch (error) {
      console.error('Failed to pause recording:', error);
      showError('Failed to pause recording');
    }
  };

  const handleResumeRecording = async () => {
    try {
      recordingManager.current.resumeRecording();
      setState(prev => ({ ...prev, isPaused: false }));
      showInfo('Recording resumed');
    } catch (error) {
      console.error('Failed to resume recording:', error);
      showError('Failed to resume recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopCurrentRecording();
      showInfo('Recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      showError('Failed to stop recording');
    }
  };

  // Setup completion handler
  const handleSetupComplete = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await initializeApp();
  };

  // Settings handlers
  const handleOpenSettings = () => {
    setState(prev => ({ ...prev, showSettings: true }));
  };

  const handleCloseSettings = async () => {
    setState(prev => ({ ...prev, showSettings: false }));

    // Reload configuration and reinitialize if needed
    try {
      const newConfig = await configService.current.getConfig();

      // Check if webcam changed
      if (state.config?.webcamId !== newConfig.webcamId) {
        // Stop current stream and start new one
        videoManager.current.stopStream();
        currentVideoStreamRef.current = null; // Clear the ref
        await initializeVideoStream(newConfig.webcamId);
      }

      setState(prev => ({ ...prev, config: newConfig }));
    } catch (error) {
      console.error('Failed to reload configuration:', error);
      showError('Failed to reload configuration');
    }
  };

  const cleanup = () => {
    // Clear any pending timeouts
    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current);
    }
    
    // Clear video stream ref
    currentVideoStreamRef.current = null;
    
    // Stop all services
    videoManager.current.stopStream();
    
    if (state.isRecording) {
      recordingManager.current.stopRecording().catch(console.error);
    }
  };

  // Loading view
  if (state.isLoading) {
    return (
      <div className="barcode-app barcode-app--loading">
        <div className="neo-container">
          <div className="neo-card neo-text--center">
            <div className="loading-spinner"></div>
            <h1 className="neo-text--xl neo-text--uppercase">
              Loading Application...
            </h1>
            <p className="neo-text--large">
              Please wait while we initialize your barcode video recorder.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Setup view
  if (state.currentView === 'setup') {
    return (
      <div className="barcode-app barcode-app--setup">
        <SetupWizard onComplete={handleSetupComplete} />
      </div>
    );
  }

  // Main application view
  return (
    <div className="barcode-app barcode-app--main">
      {/* Header with controls */}
      <div className="barcode-app__header">
        <div className="header-left">
          <StatusIndicator
            status={state.isRecording ? (state.isPaused ? 'paused' : 'recording') : 'ready'}
            message={
              state.isRecording
                ? (state.isPaused ? 'Recording Paused' : 'Recording Active')
                : 'Ready to Record'
            }
          />
          {state.lastDetectedBarcode && (
            <div className="neo-status neo-status--ready">
              Last Barcode: {state.lastDetectedBarcode}
            </div>
          )}
        </div>

        <div className="header-right">
          <button
            className="neo-button neo-button--secondary"
            onClick={() => setShowDebugTester(!showDebugTester)}
          >
            🔍 {showDebugTester ? 'Hide' : 'Debug'} Barcode Detection
          </button>
          <button
            className="neo-button neo-button--info"
            onClick={handleOpenSettings}
            style={{ marginLeft: '10px' }}
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Video display */}
      <div className="barcode-app__video">
        <VideoDisplay
          stream={state.videoStream}
          enableBarcodeDetection={true}
          onBarcodeDetected={handleBarcodeDetected}
          onError={(error) => showError(error)}
          ref={videoDisplayRef}
        />
      </div>

      {/* Debug Tester */}
      {showDebugTester && (
        <div className="barcode-app__debug" style={{ margin: '20px 0' }}>
          <BarcodeDetectionTester 
            videoElement={videoDisplayRef.current?.getVideoElement() || null}
          />
        </div>
      )}

      {/* Recording controls */}
      <div className="barcode-app__controls">
        <RecordingControls
          isRecording={state.isRecording}
          isPaused={state.isPaused}
          onPause={handlePauseRecording}
          onResume={handleResumeRecording}
          onStop={handleStopRecording}
        />
      </div>

      {/* Settings modal */}
      <SettingsModal
        isOpen={state.showSettings}
        onClose={handleCloseSettings}
      />

      {/* Notification system */}
      <NotificationSystem ref={notificationSystemRef} />
    </div>
  );
};

export default BarcodeVideoRecorderApp;
