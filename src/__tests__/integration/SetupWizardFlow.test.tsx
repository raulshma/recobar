// Integration tests for setup wizard flow
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SetupWizard from '../../components/setup/SetupWizard';
import { ConfigManager } from '../../services/ConfigManager';
import { VideoStreamManager } from '../../services/VideoStreamManager';

// Note: electron-store is mocked inside the describe block for this test

// Mock MediaStream
class MockMediaStream {
  constructor() {}
  getTracks() { return []; }
  getVideoTracks() { return []; }
  getAudioTracks() { return []; }
}

(global as any).MediaStream = MockMediaStream;

// Mock services
jest.mock('../../services/ConfigManager');
jest.mock('../../services/VideoStreamManager');
jest.mock('../../services/RendererConfigService', () => ({
  RendererConfigService: jest.fn().mockImplementation(() => ({
    isFirstTimeSetup: jest.fn().mockResolvedValue(true),
    getTenantId: jest.fn().mockResolvedValue(null),
    getWebcamId: jest.fn().mockResolvedValue(null),
    setTenantId: jest.fn(),
    setWebcamId: jest.fn(),
  })),
}));

// Mock electron API
const mockElectronConfig = {
  getTenantId: jest.fn(),
  setTenantId: jest.fn(),
  getWebcamId: jest.fn(),
  setWebcamId: jest.fn(),
  isFirstTimeSetup: jest.fn(),
};

Object.defineProperty(global, 'window', {
  value: {
    electron: {
      config: mockElectronConfig,
    },
  },
  writable: true,
});

// Mock MediaDevices API
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();

Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices,
  },
});

// Mock electron-store for this test file
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  }));
});

describe('Setup Wizard Flow Integration', () => {

  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockVideoStreamManager: jest.Mocked<VideoStreamManager>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock instances
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    mockVideoStreamManager = new VideoStreamManager() as jest.Mocked<VideoStreamManager>;

    // Setup default mock implementations
    mockElectronConfig.isFirstTimeSetup.mockResolvedValue(true);
    mockElectronConfig.getTenantId.mockResolvedValue(null);
    mockElectronConfig.getWebcamId.mockResolvedValue(null);
    mockElectronConfig.setTenantId.mockResolvedValue(undefined);
    mockElectronConfig.setWebcamId.mockResolvedValue(undefined);

    // Mock video devices
    const mockDevices: MediaDeviceInfo[] = [
      {
        deviceId: 'camera1',
        kind: 'videoinput',
        label: 'Built-in Camera',
        groupId: 'group1',
        toJSON: () => ({}),
      },
      {
        deviceId: 'camera2',
        kind: 'videoinput',
        label: 'External Camera',
        groupId: 'group2',
        toJSON: () => ({}),
      },
    ];

    mockEnumerateDevices.mockResolvedValue(mockDevices);
    mockVideoStreamManager.getAvailableDevices.mockResolvedValue(mockDevices);

    // Mock video stream
    const mockStream = new MediaStream();
    mockGetUserMedia.mockResolvedValue(mockStream);
    mockVideoStreamManager.startStream.mockResolvedValue(mockStream);
  });

  describe('Complete setup flow', () => {
    it('should complete full setup wizard flow', async () => {
      render(<SetupWizard onComplete={jest.fn()} />);

      // Step 1: Tenant setup should be visible
      expect(screen.getByText(/tenant setup/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tenant id/i)).toBeInTheDocument();

      // Enter tenant ID
      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant-123' } });

      // Click next
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Wait for tenant ID to be saved
      await waitFor(() => {
        expect(mockElectronConfig.setTenantId).toHaveBeenCalledWith('test-tenant-123');
      });

      // Step 2: Webcam setup should be visible
      await waitFor(() => {
        expect(screen.getByText(/webcam setup/i)).toBeInTheDocument();
      });

      // Wait for devices to load
      await waitFor(() => {
        expect(screen.getByText('Built-in Camera')).toBeInTheDocument();
        expect(screen.getByText('External Camera')).toBeInTheDocument();
      });

      // Select a webcam
      const webcamSelect = screen.getByRole('combobox');
      fireEvent.change(webcamSelect, { target: { value: 'camera1' } });

      // Click finish
      const finishButton = screen.getByRole('button', { name: /finish/i });
      fireEvent.click(finishButton);

      // Wait for webcam ID to be saved
      await waitFor(() => {
        expect(mockElectronConfig.setWebcamId).toHaveBeenCalledWith('camera1');
      });

      // Setup should be complete
      await waitFor(() => {
        expect(screen.getByText(/setup complete/i)).toBeInTheDocument();
      });
    });

    it('should handle tenant ID validation errors', async () => {
      render(<SetupWizard onComplete={jest.fn()} />);

      const tenantInput = screen.getByLabelText(/tenant id/i);
      const nextButton = screen.getByRole('button', { name: /next/i });

      // Test empty tenant ID
      fireEvent.change(tenantInput, { target: { value: '' } });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/tenant id is required/i)).toBeInTheDocument();
      });

      // Test invalid characters
      fireEvent.change(tenantInput, { target: { value: 'invalid tenant!' } });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid characters/i)).toBeInTheDocument();
      });

      // Should not proceed to next step
      expect(screen.queryByText(/webcam setup/i)).not.toBeInTheDocument();
    });

    it('should handle webcam access errors', async () => {
      // Mock webcam access failure
      mockVideoStreamManager.getAvailableDevices.mockRejectedValue(
        new Error('Camera access denied')
      );

      render(<SetupWizard onComplete={jest.fn()} />);

      // Complete tenant setup
      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Wait for webcam setup step
      await waitFor(() => {
        expect(screen.getByText(/webcam setup/i)).toBeInTheDocument();
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/camera access denied/i)).toBeInTheDocument();
      });

      // Should show retry button
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should allow retrying webcam access', async () => {
      // Initially fail, then succeed
      mockVideoStreamManager.getAvailableDevices
        .mockRejectedValueOnce(new Error('Camera access denied'))
        .mockResolvedValueOnce([
          {
            deviceId: 'camera1',
            kind: 'videoinput',
            label: 'Built-in Camera',
            groupId: 'group1',
            toJSON: () => ({}),
          },
        ]);

      render(<SetupWizard onComplete={jest.fn()} />);

      // Complete tenant setup
      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/camera access denied/i)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      // Should show cameras after retry
      await waitFor(() => {
        expect(screen.getByText('Built-in Camera')).toBeInTheDocument();
      });
    });

    it('should handle save errors gracefully', async () => {
      // Mock save failure
      mockElectronConfig.setTenantId.mockRejectedValue(new Error('Save failed'));

      render(<SetupWizard onComplete={jest.fn()} />);

      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });

      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      });

      // Should remain on tenant setup step
      expect(screen.getByText(/tenant setup/i)).toBeInTheDocument();
    });

    it('should skip setup when already configured', async () => {
      // Mock already configured
      mockElectronConfig.isFirstTimeSetup.mockResolvedValue(false);
      mockElectronConfig.getTenantId.mockResolvedValue('existing-tenant');
      mockElectronConfig.getWebcamId.mockResolvedValue('existing-camera');

      const onComplete = jest.fn();
      render(<SetupWizard onComplete={onComplete} />);

      // Should immediately call onComplete
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      // Should not show setup steps
      expect(screen.queryByText(/tenant setup/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/webcam setup/i)).not.toBeInTheDocument();
    });

    it('should allow going back between steps', async () => {
      render(<SetupWizard onComplete={jest.fn()} />);

      // Complete tenant setup
      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Wait for webcam setup
      await waitFor(() => {
        expect(screen.getByText(/webcam setup/i)).toBeInTheDocument();
      });

      // Click back button
      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);

      // Should return to tenant setup
      await waitFor(() => {
        expect(screen.getByText(/tenant setup/i)).toBeInTheDocument();
      });

      // Tenant ID should be preserved
      expect(screen.getByDisplayValue('test-tenant')).toBeInTheDocument();
    });

    it('should show webcam preview when available', async () => {
      render(<SetupWizard onComplete={jest.fn()} />);

      // Complete tenant setup
      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Wait for webcam setup
      await waitFor(() => {
        expect(screen.getByText(/webcam setup/i)).toBeInTheDocument();
      });

      // Select a webcam
      const webcamSelect = screen.getByRole('combobox');
      fireEvent.change(webcamSelect, { target: { value: 'camera1' } });

      // Should show preview
      await waitFor(() => {
        expect(screen.getByTestId('webcam-preview')).toBeInTheDocument();
      });

      expect(mockVideoStreamManager.startStream).toHaveBeenCalledWith('camera1');
    });

    it('should handle webcam preview errors', async () => {
      // Mock stream start failure
      mockVideoStreamManager.startStream.mockRejectedValue(
        new Error('Failed to start stream')
      );

      render(<SetupWizard onComplete={jest.fn()} />);

      // Complete tenant setup
      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Wait for webcam setup
      await waitFor(() => {
        expect(screen.getByText(/webcam setup/i)).toBeInTheDocument();
      });

      // Select a webcam
      const webcamSelect = screen.getByRole('combobox');
      fireEvent.change(webcamSelect, { target: { value: 'camera1' } });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to start stream/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and state management', () => {
    it('should maintain wizard state across re-renders', async () => {
      const { rerender } = render(<SetupWizard onComplete={jest.fn()} />);

      // Enter tenant ID
      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });

      // Re-render component
      rerender(<SetupWizard onComplete={jest.fn()} />);

      // State should be preserved
      expect(screen.getByDisplayValue('test-tenant')).toBeInTheDocument();
    });

    it('should disable navigation buttons during async operations', async () => {
      // Mock slow save operation
      mockElectronConfig.setTenantId.mockImplementation(
        () => new Promise(resolve => {setTimeout(resolve, 100)})
      );

      render(<SetupWizard onComplete={jest.fn()} />);

      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });

      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Button should be disabled during save
      expect(nextButton).toBeDisabled();

      // Wait for save to complete
      await waitFor(() => {
        expect(screen.getByText(/webcam setup/i)).toBeInTheDocument();
      });
    });

    it('should show loading states appropriately', async () => {
      render(<SetupWizard onComplete={jest.fn()} />);

      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });

      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      // Should show loading indicator
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText(/webcam setup/i)).toBeInTheDocument();
      });

      // Loading should be gone
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<SetupWizard onComplete={jest.fn()} />);

      // Check form accessibility
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText(/tenant id/i)).toBeInTheDocument();

      // Check button accessibility
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toHaveAttribute('type', 'submit');
    });

    it('should support keyboard navigation', async () => {
      render(<SetupWizard onComplete={jest.fn()} />);

      const tenantInput = screen.getByLabelText(/tenant id/i);
      const nextButton = screen.getByRole('button', { name: /next/i });

      // Tab navigation should work
      tenantInput.focus();
      expect(document.activeElement).toBe(tenantInput);

      // Enter key should submit form
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });
      fireEvent.keyDown(tenantInput, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(mockElectronConfig.setTenantId).toHaveBeenCalledWith('test-tenant');
      });
    });

    it('should announce step changes to screen readers', async () => {
      render(<SetupWizard onComplete={jest.fn()} />);

      // Complete tenant setup
      const tenantInput = screen.getByLabelText(/tenant id/i);
      fireEvent.change(tenantInput, { target: { value: 'test-tenant' } });
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Should have aria-live region for announcements
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });
  });
});
