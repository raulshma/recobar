// React hook for managing recording orchestration
import { useEffect, useRef, useState, useCallback } from 'react';
import { BarcodeDetectionService } from '../services/BarcodeDetectionService';
import { RecordingManager } from '../services/RecordingManager';
import { RecordingOrchestrator } from '../services/RecordingOrchestrator';
import { RecordingResult } from '../types';

interface UseRecordingOrchestratorOptions {
  onRecordingStarted?: (barcode: string) => void;
  onRecordingStopped?: (result: RecordingResult) => void;
  onRecordingError?: (error: Error) => void;
  onBarcodeDetected?: (barcode: string) => void;
}

interface RecordingOrchestratorState {
  isActive: boolean;
  isRecording: boolean;
  isPaused: boolean;
  lastDetectedBarcode: string | null;
  detectionActive: boolean;
}

export const useRecordingOrchestrator = (options: UseRecordingOrchestratorOptions = {}) => {
  const orchestratorRef = useRef<RecordingOrchestrator | null>(null);
  const [state, setState] = useState<RecordingOrchestratorState>({
    isActive: false,
    isRecording: false,
    isPaused: false,
    lastDetectedBarcode: null,
    detectionActive: false,
  });

  // Initialize services and orchestrator
  useEffect(() => {
    const barcodeService = new BarcodeDetectionService();
    const recordingManager = new RecordingManager();
    orchestratorRef.current = new RecordingOrchestrator(barcodeService, recordingManager);

    return () => {
      // Cleanup on unmount
      if (orchestratorRef.current) {
        orchestratorRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Update state when orchestrator state changes
  const updateState = useCallback(() => {
    if (orchestratorRef.current) {
      const newState = orchestratorRef.current.getRecordingState();
      setState(newState);
    }
  }, []);

  // Start orchestration
  const start = useCallback(async (videoElement: HTMLVideoElement, stream: MediaStream) => {
    if (!orchestratorRef.current) {
      throw new Error('Recording orchestrator not initialized');
    }

    try {
      orchestratorRef.current.start(videoElement, stream, {
        onRecordingStarted: (barcode: string) => {
          updateState();
          options.onRecordingStarted?.(barcode);
        },
        onRecordingStopped: (result: RecordingResult) => {
          updateState();
          options.onRecordingStopped?.(result);
        },
        onRecordingError: (error: Error) => {
          updateState();
          options.onRecordingError?.(error);
        },
        onBarcodeDetected: (barcode: string) => {
          updateState();
          options.onBarcodeDetected?.(barcode);
        },
      });
      updateState();
    } catch (error) {
      console.error('Error starting recording orchestrator:', error);
      throw error;
    }
  }, [options, updateState]);

  // Stop orchestration
  const stop = useCallback(async () => {
    if (!orchestratorRef.current) {
      return;
    }

    try {
      await orchestratorRef.current.stop();
      updateState();
    } catch (error) {
      console.error('Error stopping recording orchestrator:', error);
      throw error;
    }
  }, [updateState]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (!orchestratorRef.current) {
      throw new Error('Recording orchestrator not initialized');
    }

    try {
      orchestratorRef.current.pauseRecording();
      updateState();
    } catch (error) {
      console.error('Error pausing recording:', error);
      throw error;
    }
  }, [updateState]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (!orchestratorRef.current) {
      throw new Error('Recording orchestrator not initialized');
    }

    try {
      orchestratorRef.current.resumeRecording();
      updateState();
    } catch (error) {
      console.error('Error resuming recording:', error);
      throw error;
    }
  }, [updateState]);

  // Stop recording manually
  const stopRecording = useCallback(async () => {
    if (!orchestratorRef.current) {
      throw new Error('Recording orchestrator not initialized');
    }

    try {
      const result = await orchestratorRef.current.stopRecording();
      updateState();
      return result;
    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    }
  }, [updateState]);

  // Force start recording with specific barcode
  const forceStartRecording = useCallback(async (barcode: string) => {
    if (!orchestratorRef.current) {
      throw new Error('Recording orchestrator not initialized');
    }

    try {
      await orchestratorRef.current.forceStartRecording(barcode);
      updateState();
    } catch (error) {
      console.error('Error force starting recording:', error);
      throw error;
    }
  }, [updateState]);

  return {
    // State
    ...state,

    // Actions
    start,
    stop,
    pauseRecording,
    resumeRecording,
    stopRecording,
    forceStartRecording,

    // Utilities
    updateState,
  };
};
