import React from 'react';
import '../../styles/neobrutalism.scss';
import '../../styles/recording-controls.scss';

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  disabled?: boolean;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  isPaused,
  onPause,
  onResume,
  onStop,
  disabled = false,
}) => {
  const handlePause = () => {
    if (!disabled && isRecording && !isPaused) {
      onPause();
    }
  };

  const handleResume = () => {
    if (!disabled && isRecording && isPaused) {
      onResume();
    }
  };

  const handleStop = () => {
    if (!disabled && isRecording) {
      onStop();
    }
  };

  // Don't render controls if not recording
  if (!isRecording) {
    return null;
  }

  return (
    <div className="recording-controls">
      <div className="recording-controls__status">
        <div className={`neo-status ${isPaused ? 'neo-status--paused' : 'neo-status--recording'}`}>
          {isPaused ? '⏸️ PAUSED' : '🔴 RECORDING'}
        </div>
      </div>

      <div className="recording-controls__buttons">
        {!isPaused ? (
          <button
            className="neo-button neo-button--info recording-controls__button"
            onClick={handlePause}
            disabled={disabled}
            title="Pause recording"
          >
            ⏸️ PAUSE
          </button>
        ) : (
          <button
            className="neo-button neo-button--success recording-controls__button"
            onClick={handleResume}
            disabled={disabled}
            title="Resume recording"
          >
            ▶️ RESUME
          </button>
        )}

        <button
          className="neo-button neo-button--danger recording-controls__button"
          onClick={handleStop}
          disabled={disabled}
          title="Stop recording"
        >
          ⏹️ STOP
        </button>
      </div>
    </div>
  );
};

export default RecordingControls;
