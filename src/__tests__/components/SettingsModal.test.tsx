// Component tests for SettingsModal
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SettingsModal from '../../components/settings/SettingsModal';

// Mock all the services that are used in the settings components
jest.mock('../../services/VideoStreamManager', () => ({
  VideoStreamManager: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
    getAvailableDevices: jest.fn().mockResolvedValue([]),
    startStream: jest.fn(),
    stopStream: jest.fn(),
  })),
}));

jest.mock('../../services/RendererConfigService', () => ({
  RendererConfigService: jest.fn().mockImplementation(() => ({
    getTenantId: jest.fn().mockResolvedValue('test-tenant'),
    getWebcamId: jest.fn().mockResolvedValue('test-webcam'),
    setTenantId: jest.fn(),
    setWebcamId: jest.fn(),
    getStorageSettings: jest.fn().mockResolvedValue({
      localPath: '/test/path',
      s3Config: null,
    }),
    setStorageSettings: jest.fn(),
  })),
}));

describe('SettingsModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render when open', async () => {
      await act(async () => {
        render(<SettingsModal {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('General')).toBeInTheDocument();
        expect(screen.getByText('Storage')).toBeInTheDocument();
        expect(screen.getByText('Close')).toBeInTheDocument();
      });
    });

    it('should not render when closed', async () => {
      await act(async () => {
        render(<SettingsModal {...defaultProps} isOpen={false} />);
      });

      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('should show General tab as active by default', async () => {
      await act(async () => {
        render(<SettingsModal {...defaultProps} />);
      });

      await waitFor(() => {
        const generalTab = screen.getByText('General');
        expect(generalTab).toHaveClass('settings-modal__tab--active');
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should switch to Storage tab when clicked', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<SettingsModal {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Storage')).toBeInTheDocument();
      });

      const storageTab = screen.getByText('Storage');
      await act(async () => {
        await user.click(storageTab);
      });

      expect(storageTab).toHaveClass('settings-modal__tab--active');

      const generalTab = screen.getByText('General');
      expect(generalTab).not.toHaveClass('settings-modal__tab--active');
    });

    it('should switch back to General tab when clicked', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<SettingsModal {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Storage')).toBeInTheDocument();
      });

      // First click Storage
      const storageTab = screen.getByText('Storage');
      await act(async () => {
        await user.click(storageTab);
      });

      // Then click General
      const generalTab = screen.getByText('General');
      await act(async () => {
        await user.click(generalTab);
      });

      expect(generalTab).toHaveClass('settings-modal__tab--active');
      expect(storageTab).not.toHaveClass('settings-modal__tab--active');
    });
  });

  describe('Modal Actions', () => {
    it('should call onClose when Close button is clicked', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<SettingsModal {...defaultProps} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('Close');
      await act(async () => {
        await user.click(closeButton);
      });

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
