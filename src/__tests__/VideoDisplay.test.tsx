import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoDisplay from '../components/video/VideoDisplay';

// Mock MediaStream
class MockMediaStream {
  getTracks() {
    return [
      {
        readyState: 'live',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        stop: jest.fn(),
      },
    ];
  }
}

// Mock BarcodeDetectionService
const mockBarcodeDetectionService = {
  startDetection: jest.fn(),
  stopDetection: jest.fn(),
  onBarcodeDetected: jest.fn(),
  clearCallbacks: jest.fn(),
  isActive: jest.fn().mockReturnValue(false),
};

jest.mock('../services/BarcodeDetectionService', () => ({
  BarcodeDetectionService: jest.fn().mockImplementation(() => mockBarcodeDetectionService),
}));

describe('VideoDisplay', () => {
  const defaultProps = {
    stream: null,
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock HTMLVideoElement methods
    Object.defineProperty(HTMLVideoElement.prototype, 'play', {
      writable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });

    Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
      writable: true,
      value: jest.fn(),
    });
  });

  it('renders no stream overlay when no stream is provided', () => {
    render(<VideoDisplay {...defaultProps} />);

    expect(screen.getByText('No video stream available')).toBeInTheDocument();
    expect(
      screen.getByText('Please select a camera to start streaming'),
    ).toBeInTheDocument();
  });

  it('renders video element when stream is provided', () => {
    const mockStream = new MockMediaStream() as unknown as MediaStream;
    render(<VideoDisplay {...defaultProps} stream={mockStream} />);

    const videoElement = document.querySelector('video');
    expect(videoElement).toBeInTheDocument();
  });

  it('calls onError when error occurs', () => {
    const mockOnError = jest.fn();
    const mockStream = new MockMediaStream() as unknown as MediaStream;

    render(<VideoDisplay stream={mockStream} onError={mockOnError} />);

    // Simulate video error
    const videoElement = document.querySelector('video');
    if (videoElement) {
      fireEvent.error(videoElement);
    }

    expect(mockOnError).toHaveBeenCalledWith('Video playback error occurred');
  });

  it('applies custom className', () => {
    const customClass = 'custom-video-class';
    render(<VideoDisplay {...defaultProps} className={customClass} />);

    const container = screen.getByTestId('video-display');
    expect(container).toHaveClass(customClass);
  });

  it('shows retry button on error', () => {
    const mockStream = new MockMediaStream() as unknown as MediaStream;
    render(<VideoDisplay {...defaultProps} stream={mockStream} />);

    // Simulate video error
    const videoElement = document.querySelector('video');
    if (videoElement) {
      fireEvent.error(videoElement);
    }

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  describe('Barcode Detection', () => {
    beforeEach(() => {
      mockBarcodeDetectionService.startDetection.mockClear();
      mockBarcodeDetectionService.stopDetection.mockClear();
      mockBarcodeDetectionService.onBarcodeDetected.mockClear();
      mockBarcodeDetectionService.clearCallbacks.mockClear();
    });

    it('does not show barcode detection status when disabled', () => {
      const mockStream = new MockMediaStream() as unknown as MediaStream;
      render(
        <VideoDisplay stream={mockStream} enableBarcodeDetection={false} />,
      );

      expect(
        screen.queryByText('Scanning for barcodes...'),
      ).not.toBeInTheDocument();
    });

    it('shows barcode detection status when enabled', async () => {
      const mockStream = new MockMediaStream() as unknown as MediaStream;
      const mockOnBarcodeDetected = jest.fn();

      render(
        <VideoDisplay
          stream={mockStream}
          enableBarcodeDetection
          onBarcodeDetected={mockOnBarcodeDetected}
        />,
      );

      // Simulate video loaded metadata event to trigger barcode detection
      const videoElement = document.querySelector('video');
      if (videoElement) {
        fireEvent.loadedMetadata(videoElement);
      }

      await waitFor(() => {
        expect(
          screen.getByText('Scanning for barcodes...'),
        ).toBeInTheDocument();
      });
    });

    it('calls onBarcodeDetected callback when barcode is detected', async () => {
      const mockStream = new MockMediaStream() as unknown as MediaStream;
      const mockOnBarcodeDetected = jest.fn();

      render(
        <VideoDisplay
          stream={mockStream}
          enableBarcodeDetection
          onBarcodeDetected={mockOnBarcodeDetected}
        />,
      );

      // Simulate video loaded metadata event
      const videoElement = document.querySelector('video');
      if (videoElement) {
        fireEvent.loadedMetadata(videoElement);
      }

      // Get the callback that was passed to onBarcodeDetected
      const barcodeCallback =
        mockBarcodeDetectionService.onBarcodeDetected.mock.calls[0]?.[0];

      if (barcodeCallback) {
        // Simulate barcode detection
        barcodeCallback('123456789');
        expect(mockOnBarcodeDetected).toHaveBeenCalledWith('123456789');
      }
    });
  });
});
