// Component tests for RecordingControls
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RecordingControls from '../../components/recording/RecordingControls';

describe('RecordingControls Component', () => {
  const defaultProps = {
    isRecording: false,
    isPaused: false,
    onPause: jest.fn(),
    onResume: jest.fn(),
    onStop: jest.fn(),
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when not recording', () => {
      const { container } = render(<RecordingControls {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render active recording state', () => {
      const props = {
        ...defaultProps,
        isRecording: true,
      };

      render(<RecordingControls {...props} />);

      expect(screen.getByText(/recording/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
    });

    it('should render paused recording state', () => {
      const props = {
        ...defaultProps,
        isRecording: true,
        isPaused: true,
      };

      render(<RecordingControls {...props} />);

      expect(screen.getByText(/paused/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
    });

    it('should disable buttons when disabled prop is true', () => {
      const props = {
        ...defaultProps,
        isRecording: true,
        disabled: true,
      };

      render(<RecordingControls {...props} />);

      const pauseButton = screen.getByRole('button', { name: /pause/i });
      const stopButton = screen.getByRole('button', { name: /stop/i });

      expect(pauseButton).toBeDisabled();
      expect(stopButton).toBeDisabled();
    });
  });

  describe('User Interactions', () => {
    it('should call onPause when pause button is clicked', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        isRecording: true,
      };

      render(<RecordingControls {...props} />);

      const pauseButton = screen.getByRole('button', { name: /pause/i });
      await user.click(pauseButton);

      expect(defaultProps.onPause).toHaveBeenCalledTimes(1);
    });

    it('should call onResume when resume button is clicked', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        isRecording: true,
        isPaused: true,
      };

      render(<RecordingControls {...props} />);

      const resumeButton = screen.getByRole('button', { name: /resume/i });
      await user.click(resumeButton);

      expect(defaultProps.onResume).toHaveBeenCalledTimes(1);
    });

    it('should call onStop when stop button is clicked', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        isRecording: true,
      };

      render(<RecordingControls {...props} />);

      const stopButton = screen.getByRole('button', { name: /stop/i });
      await user.click(stopButton);

      expect(defaultProps.onStop).toHaveBeenCalledTimes(1);
    });

    it('should not call callbacks when disabled', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        isRecording: true,
        disabled: true,
      };

      render(<RecordingControls {...props} />);

      const pauseButton = screen.getByRole('button', { name: /pause/i });
      const stopButton = screen.getByRole('button', { name: /stop/i });

      await user.click(pauseButton);
      await user.click(stopButton);

      expect(defaultProps.onPause).not.toHaveBeenCalled();
      expect(defaultProps.onStop).not.toHaveBeenCalled();
    });
  });
});
